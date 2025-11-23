import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { NearRpcService } from './near-rpc.service';
import { EventParserService, ParsedDonation } from './event-parser.service';
import { PriceService } from '../pricing/price.service';
import { Prisma } from '../../generated/prisma';

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private isRunning = false;
  private pollInterval: number;
  private startBlockHeight: bigint;

  constructor(
    private prisma: PrismaService,
    private nearRpc: NearRpcService,
    private eventParser: EventParserService,
    private priceService: PriceService,
    private configService: ConfigService,
  ) {
    this.pollInterval = this.configService.get<number>('INDEXER_POLL_INTERVAL_MS') || 5000;
    this.startBlockHeight = BigInt(this.configService.get<number>('START_BLOCK_HEIGHT') || 0);
  }

  async onModuleInit() {
    this.logger.log('Indexer service initialized');
    setTimeout(() => this.start(), 5000);
  }

  async start() {
    if (this.isRunning) {
      this.logger.warn('Indexer is already running');
      return;
    }

    this.logger.log('Starting blockchain indexer...');
    this.isRunning = true;

    try {
      this.logger.log('Fetching indexer checkpoint from database...');
      let checkpoint = await this.getCheckpoint();

      // Get the latest block height to validate checkpoint
      this.logger.log('Fetching latest block from NEAR RPC...');
      const latestBlock = await this.nearRpc.getLatestBlock();
      this.logger.log(`Latest block height on chain: ${latestBlock.height}`);

      let currentHeight = checkpoint ? checkpoint.lastBlockHeight : this.startBlockHeight;

      if (checkpoint) {
        this.logger.log(`Found checkpoint at block height: ${checkpoint.lastBlockHeight}`);

        // Check if checkpoint is ahead of the chain (invalid state)
        if (checkpoint.lastBlockHeight > latestBlock.height) {
          this.logger.warn(
            `Checkpoint (${checkpoint.lastBlockHeight}) is ahead of latest block (${latestBlock.height})!`
          );

          await this.prisma.indexerCheckpoint.delete({
            where: { id: 'singleton' },
          });

          currentHeight = this.startBlockHeight;
          this.logger.log(`Checkpoint reset. Starting from block height: ${currentHeight}`);
        }
      } else {
        this.logger.log(`No checkpoint found, using configured start height: ${this.startBlockHeight}`);
      }

      if (!checkpoint && this.startBlockHeight === BigInt(0)) {
        currentHeight = latestBlock.height - BigInt(10);
        this.logger.log(`Starting from current block height: ${currentHeight}`);
      }

      this.logger.log(`Beginning indexing from block height: ${currentHeight}`);

      while (this.isRunning) {
        try {
          const latestBlock = await this.nearRpc.getLatestBlock();
          this.logger.log(`Current height: ${currentHeight}, Latest height: ${latestBlock.height}`);

          if (currentHeight < latestBlock.height) {
            setTimeout(() => 5000)
            await this.processBlock(currentHeight);
            currentHeight += BigInt(1);
          } else {
            this.logger.log('Caught up to latest block, waiting for new blocks...');
            await this.sleep(this.pollInterval);
          }
        } catch (error) {
          this.logger.error(`Error processing block ${currentHeight}: ${error.message}`);
          await this.sleep(this.pollInterval);
        }
      }
    } catch (error) {
      this.logger.error(`Fatal error in indexer: ${error.message}`);
      this.isRunning = false;
    }
  }

  async processBlock(height: bigint) {
    try {
      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`[BLOCK ${height}] Fetching block data...`);
      const block = await this.nearRpc.getBlockByHeight(height);
      this.logger.log(`[BLOCK ${height}] Block timestamp: ${new Date(block.timestamp).toISOString()}`);
      this.logger.log(`[BLOCK ${height}] Processing ${block.chunks.length} chunks...`);

      // Map to store transaction hash by receipt ID
      const receiptToTxMap = new Map<string, string>();

      let receiptsProcessed = 0;
      let potlockReceiptsFound = 0;
      let transactionsProcessed = 0;

      for (const chunk of block.chunks) {
        try {
          const chunkData = await this.nearRpc.getChunk(chunk.chunk_hash);

          // Log the actual chunk structure we receive
          this.logger.log(`[CHUNK DEBUG] Available fields: ${Object.keys(chunkData).join(', ')}`);
          this.logger.log(`[CHUNK DEBUG] Transactions count: ${chunkData.transactions?.length || 0}`);
          this.logger.log(`[CHUNK DEBUG] Receipts count: ${chunkData.receipts?.length || 0}`);

          // Log first transaction structure in detail
          if (chunkData.transactions && chunkData.transactions.length > 0 && transactionsProcessed === 0) {
            this.logger.log(`\n[TRANSACTION STRUCTURE] Full transaction object:`);
            this.logger.log(JSON.stringify(chunkData.transactions[0], null, 2));
          }

          // Process transactions and build receipt->transaction mapping
          for (const transaction of chunkData.transactions || []) {
            const txHash = transaction.hash;

            // Log transaction details
            this.logger.log(`\n[TRANSACTION] Hash: ${txHash}`);
            this.logger.log(`[TRANSACTION] Signer: ${transaction.signer_id}`);
            this.logger.log(`[TRANSACTION] Receiver: ${transaction.receiver_id}`);
            this.logger.log(`[TRANSACTION] Actions: ${transaction.actions?.length || 0}`);

            transactionsProcessed++;

            // Map the converted receipt ID to this transaction hash
            if (transaction.hash) {
              // The receipt ID will be available when we process receipts
              // Store transaction for later lookup
              receiptToTxMap.set(transaction.hash, transaction.hash);
            }
          }

          this.logger.log(`[BLOCK ${height}] Chunk has ${chunkData.receipt_execution_outcomes?.length || 0} receipt execution outcomes`);
          for (const receiptOutcome of chunkData.receipt_execution_outcomes || []) {
            const isPotlock = await this.processReceipt(receiptOutcome, block, receiptToTxMap);
            receiptsProcessed++;
            if (isPotlock) potlockReceiptsFound++;
          }
        } catch (error) {
          this.logger.error(`[BLOCK ${height}] Error processing chunk: ${error.message}`);
        }
      }

      await this.updateCheckpoint(block);
      this.logger.log(`[BLOCK ${height}]  Completed: ${transactionsProcessed} transactions, ${receiptsProcessed} receipts (${potlockReceiptsFound} potlock-related)`);
      this.logger.log(`${'='.repeat(80)}\n`);
    } catch (error) {
      this.logger.error(`[BLOCK ${height}] Error in processBlock: ${error.message}`);
      throw error;
    }
  }

  async processTransaction(transaction: any, block: any) {
    // Transactions are processed via their receipts
  }

  async processReceipt(receiptOutcome: any, block: any, receiptToTxMap: Map<string, string>): Promise<boolean> {
    // Log the full receipt outcome structure with proper depth
    console.log('[RECEIPT OUTCOME STRUCTURE]', JSON.stringify(receiptOutcome, null, 2).substring(0, 1000));

    // Extract receipt and outcome from the structure
    const receipt = receiptOutcome.receipt;
    const outcome = receiptOutcome.execution_outcome?.outcome;

    if (!receipt?.receipt_id || !outcome) {
      return false;
    }

    const contractId = outcome.executor_id || receipt.receiver_id;

    // Log some sample receipts to show what blockchain data looks like
    if (receipt.receipt && receipt.receipt.Action) {
      const actions = receipt.receipt.Action.actions || [];
      if (actions.length > 0 && Math.random() < 0.05) { // Log 5% of receipts
        this.logger.log(`\n[SAMPLE RECEIPT] Contract: ${contractId}`);
        this.logger.log(`[SAMPLE RECEIPT] Receipt ID: ${receipt.receipt_id}`);
        this.logger.log(`[SAMPLE RECEIPT] Actions: ${actions.map((a: any) => Object.keys(a)[0]).join(', ')}`);
        if (outcome.logs?.length > 0) {
          this.logger.log(`[SAMPLE RECEIPT] Has ${outcome.logs.length} log(s)`);
        }
      }
    }

    // Check if this is a potlock contract first
    // Matches: donate.potlock.near, lists.potlock.near, v1.potfactory.potlock.near
    // Also matches pot subaccounts: *.v1.potfactory.potlock.near
    // const isPotlockContract = contractId.includes('potlock') || contractId.includes('nadabot');
    // console.log(isPotlockContract, "+++++++++++++++++++++")
    // if (!isPotlockContract) {
    //   return false;
    // }

    this.logger.log(`\n[RECEIPT] Found Potlock contract: ${contractId}`);
    this.logger.log(`[RECEIPT] Receipt ID: ${receipt.receipt_id}`);
    this.logger.log(`[RECEIPT] Executor: ${receipt.predecessor_id}`);
    this.logger.log(`[RECEIPT] Logs count: ${outcome.logs?.length || 0}`);

    // Try to find the transaction hash for this receipt
    let transactionHash = receiptOutcome.execution_outcome?.id || receipt.receipt_id;

    // Log all logs from this receipt
    if (outcome.logs && outcome.logs.length > 0) {
      for (const log of outcome.logs) {
        if (log.startsWith('EVENT_JSON:')) {
          this.logger.log(`[RECEIPT]  EVENT_JSON found!`);
          try {
            const eventJson = log.substring('EVENT_JSON:'.length);
            const event = JSON.parse(eventJson);
            this.logger.log(`[RECEIPT] Event standard: ${event.standard}, type: ${event.event}`);
          } catch (e) {
            this.logger.warn(`[RECEIPT] Failed to parse event: ${e.message}`);
          }
        }
      }
    }

    // Parse donations
    const donations = this.eventParser.parseExecutionOutcome(
      outcome,
      block.height,
      transactionHash,
    );

    if (donations.length > 0) {
      this.logger.log(`[RECEIPT]  ${donations.length} donation(s) parsed - saving to database...`);
    }

    for (const donation of donations) {
      await this.saveDonation(donation, block.timestamp);
    }

    // Parse pot payouts
    const payout = this.eventParser.parsePotPayout(outcome, block.height, transactionHash);
    if (payout) {
      this.logger.log(`[RECEIPT]  Pot payout parsed - saving to database...`);
      await this.savePotPayout(payout, block.timestamp);
    }

    return true;
  }

  async saveDonation(parsed: ParsedDonation, blockTimestamp: Date) {
    try {
      this.logger.log(`\n[DATABASE] Preparing to save ${parsed.type} donation to PostgreSQL...`);

      const donatedAt = new Date(parsed.donatedAtMs);
      const amountNear = this.priceService.yoctoToNear(parsed.amount);
      const amountUsd = await this.priceService.calculateUsdValue(parsed.amount, donatedAt);

      this.logger.log(`[DATABASE] Converted amounts:`);
      this.logger.log(`[DATABASE]   - Raw amount: ${parsed.amount} yoctoNEAR`);
      this.logger.log(`[DATABASE]   - NEAR: ${amountNear.toFixed(6)} NEAR`);
      this.logger.log(`[DATABASE]   - USD: $${amountUsd.toFixed(2)}`);

      const protocolFeeNear = parsed.protocolFee
        ? this.priceService.yoctoToNear(parsed.protocolFee)
        : 0;
      const protocolFeeUsd = parsed.protocolFee
        ? await this.priceService.calculateUsdValue(parsed.protocolFee, donatedAt)
        : 0;

      const referrerFeeNear = parsed.referrerFee
        ? this.priceService.yoctoToNear(parsed.referrerFee)
        : 0;
      const referrerFeeUsd = parsed.referrerFee
        ? await this.priceService.calculateUsdValue(parsed.referrerFee, donatedAt)
        : 0;

      const netAmountNear = parsed.netAmount
        ? this.priceService.yoctoToNear(parsed.netAmount)
        : null;

      const chefFeeValue = parsed.chefFee
        ? this.priceService.yoctoToNear(parsed.chefFee)
        : null;

      this.logger.log(`[DATABASE] Upserting Account records...`);
      await this.prisma.account.upsert({
        where: { id: parsed.donorId },
        create: { id: parsed.donorId },
        update: { lastActivityAt: donatedAt },
      });

      if (parsed.recipientId) {
        await this.prisma.account.upsert({
          where: { id: parsed.recipientId },
          create: { id: parsed.recipientId },
          update: { lastActivityAt: donatedAt },
        });
      }

      if (parsed.referrerId) {
        await this.prisma.account.upsert({
          where: { id: parsed.referrerId },
          create: { id: parsed.referrerId },
          update: { lastActivityAt: donatedAt },
        });
      }

      if (parsed.potId) {
        this.logger.log(`[DATABASE] Upserting Pot record: ${parsed.potId}`);
        await this.prisma.pot.upsert({
          where: { id: parsed.potId },
          create: { id: parsed.potId },
          update: { updatedAt: donatedAt },
        });
      }

      if (parsed.campaignId) {
        this.logger.log(`[DATABASE] Upserting Campaign record: ${parsed.campaignId}`);
        await this.prisma.campaign.upsert({
          where: { id: parsed.campaignId },
          create: { id: parsed.campaignId },
          update: { updatedAt: donatedAt },
        });
      }

      this.logger.log(`[DATABASE] Creating Donation record in database...`);
      this.logger.log(`[DATABASE]   - Type: ${parsed.type}`);
      this.logger.log(`[DATABASE]   - Donor: ${parsed.donorId}`);
      this.logger.log(`[DATABASE]   - Recipient: ${parsed.recipientId || parsed.potId || parsed.campaignId || 'N/A'}`);
      this.logger.log(`[DATABASE]   - Transaction: ${parsed.transactionHash}`);
      this.logger.log(`[DATABASE]   - Block: ${parsed.blockHeight}`);

      await this.prisma.donation.create({
        data: {
          type: parsed.type,
          donorId: parsed.donorId,
          recipientId: parsed.recipientId,
          amountNear: new Prisma.Decimal(amountNear),
          amountUsd: new Prisma.Decimal(amountUsd),
          ftId: parsed.ftId,
          message: parsed.message,
          donatedAt,
          blockHeight: parsed.blockHeight,
          transactionHash: parsed.transactionHash,
          protocolFeeNear: new Prisma.Decimal(protocolFeeNear),
          protocolFeeUsd: new Prisma.Decimal(protocolFeeUsd),
          referrerId: parsed.referrerId,
          referrerFeeNear: new Prisma.Decimal(referrerFeeNear),
          referrerFeeUsd: new Prisma.Decimal(referrerFeeUsd),
          potId: parsed.potId,
          campaignId: parsed.campaignId,
          netAmount: netAmountNear ? new Prisma.Decimal(netAmountNear) : null,
          chefId: parsed.chefId,
          chefFee: chefFeeValue ? new Prisma.Decimal(chefFeeValue) : null,
          projectId: parsed.projectId,
        },
      });

      this.logger.log(`[DATABASE] Updating Account aggregate metrics...`);
      await this.updateAccountAggregates(parsed, amountUsd, referrerFeeUsd, donatedAt);

      this.logger.log(
        `[DATABASE] SUCCESSFULLY SAVED to PostgreSQL: ${parsed.type} donation ${parsed.donorId} -> ${parsed.recipientId || parsed.potId || parsed.campaignId} ($${amountUsd.toFixed(2)} USD / ${amountNear.toFixed(2)} NEAR)`,
      );
    } catch (error) {
      if (error.code === 'P2002') {
        this.logger.debug(`[DATABASE] Donation already exists: ${parsed.transactionHash}`);
      } else {
        this.logger.error(`[DATABASE] FAILED to save donation: ${error.message}`);
        throw error;
      }
    }
  }

  async updateAccountAggregates(
    parsed: ParsedDonation,
    amountUsd: number,
    referrerFeeUsd: number,
    donatedAt: Date,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: parsed.donorId },
      select: { firstDonationDate: true },
    });

    this.logger.log(`[DATABASE] Updating donor aggregate (${parsed.donorId}):`);
    this.logger.log(`[DATABASE]   - Incrementing totalDonatedUsd by $${amountUsd.toFixed(2)}`);
    this.logger.log(`[DATABASE]   - Incrementing donationsSentCount by 1`);
    this.logger.log(`[DATABASE]   - Incrementing ${parsed.type.toLowerCase()} specific counters`);

    await this.prisma.account.update({
      where: { id: parsed.donorId },
      data: {
        totalDonatedUsd: { increment: amountUsd },
        donationsSentCount: { increment: 1 },
        referralFeesPaidUsd: referrerFeeUsd ? { increment: referrerFeeUsd } : undefined,
        firstDonationDate: !account?.firstDonationDate ? donatedAt : undefined,
        lastDonationDate: donatedAt,
        ...(parsed.type === 'DIRECT' && {
          directDonatedUsd: { increment: amountUsd },
          directSentCount: { increment: 1 },
        }),
        ...(parsed.type === 'POT' || parsed.type === 'POT_PROJECT' ? {
          potDonatedUsd: { increment: amountUsd },
          potSentCount: { increment: 1 },
        } : {}),
        ...(parsed.type === 'CAMPAIGN' && {
          campaignDonatedUsd: { increment: amountUsd },
          campaignSentCount: { increment: 1 },
        }),
      },
    });

    if (parsed.recipientId) {
      this.logger.log(`[DATABASE] Updating recipient aggregate (${parsed.recipientId}):`);
      this.logger.log(`[DATABASE]   - Incrementing totalReceivedUsd by $${amountUsd.toFixed(2)}`);
      this.logger.log(`[DATABASE]   - Incrementing donationsReceivedCount by 1`);

      await this.prisma.account.update({
        where: { id: parsed.recipientId },
        data: {
          totalReceivedUsd: { increment: amountUsd },
          donationsReceivedCount: { increment: 1 },
          ...(parsed.type === 'DIRECT' && {
            directReceivedUsd: { increment: amountUsd },
            directReceivedCount: { increment: 1 },
          }),
          ...(parsed.type === 'POT_PROJECT' && {
            potReceivedUsd: { increment: amountUsd },
            potReceivedCount: { increment: 1 },
          }),
          ...(parsed.type === 'CAMPAIGN' && {
            campaignReceivedUsd: { increment: amountUsd },
            campaignReceivedCount: { increment: 1 },
          }),
        },
      });
    }

    if (parsed.referrerId && referrerFeeUsd) {
      this.logger.log(`[DATABASE] Updating referrer aggregate (${parsed.referrerId}):`);
      this.logger.log(`[DATABASE]   - Incrementing referralFeesEarnedUsd by $${referrerFeeUsd.toFixed(2)}`);

      await this.prisma.account.update({
        where: { id: parsed.referrerId },
        data: {
          referralFeesEarnedUsd: { increment: referrerFeeUsd },
        },
      });
    }
  }

  async savePotPayout(payout: any, blockTimestamp: Date) {
    try {
      const paidAt = new Date(payout.paidAtMs);
      const amountNear = this.priceService.yoctoToNear(payout.amount);
      const amountUsd = await this.priceService.calculateUsdValue(payout.amount, paidAt);

      await this.prisma.account.upsert({
        where: { id: payout.recipientId },
        create: { id: payout.recipientId },
        update: { lastActivityAt: paidAt },
      });

      await this.prisma.potPayout.create({
        data: {
          potId: payout.potId,
          recipientId: payout.recipientId,
          amountNear: new Prisma.Decimal(amountNear),
          amountUsd: new Prisma.Decimal(amountUsd),
          ftId: payout.ftId,
          paidAt,
          blockHeight: payout.blockHeight,
          transactionHash: payout.transactionHash,
        },
      });

      await this.prisma.account.update({
        where: { id: payout.recipientId },
        data: {
          totalReceivedUsd: { increment: amountUsd },
          potReceivedUsd: { increment: amountUsd },
          potReceivedCount: { increment: 1 },
        },
      });

      this.logger.log(`Saved pot payout: ${payout.recipientId} (${amountNear.toFixed(2)} NEAR)`);
    } catch (error) {
      if (error.code === 'P2002') {
        this.logger.debug(`Payout already exists: ${payout.transactionHash}`);
      } else {
        this.logger.error(`Failed to save payout: ${error.message}`);
      }
    }
  }

  async getCheckpoint() {
    return await this.prisma.indexerCheckpoint.findUnique({
      where: { id: 'singleton' },
    });
  }

  async updateCheckpoint(block: any) {
    await this.prisma.indexerCheckpoint.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        lastBlockHeight: block.height,
        lastBlockHash: block.hash,
        lastBlockTime: block.timestamp,
      },
      update: {
        lastBlockHeight: block.height,
        lastBlockHash: block.hash,
        lastBlockTime: block.timestamp,
      },
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  stop() {
    this.logger.log('Stopping indexer...');
    this.isRunning = false;
  }
}

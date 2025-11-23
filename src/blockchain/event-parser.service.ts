import { Injectable, Logger } from '@nestjs/common';

export interface PotlockEvent {
  standard: string;
  version: string;
  event: string;
  data: any;
}

export interface ParsedDonation {
  type: 'DIRECT' | 'POT' | 'POT_PROJECT' | 'CAMPAIGN';
  donorId: string;
  recipientId?: string;
  amount: string;
  ftId: string;
  message?: string;
  donatedAtMs: number;
  protocolFee?: string;
  referrerId?: string;
  referrerFee?: string;
  potId?: string;
  campaignId?: string;
  netAmount?: string;
  chefId?: string;
  chefFee?: string;
  projectId?: string;
  transactionHash: string;
  blockHeight: bigint;
}

@Injectable()
export class EventParserService {
  private readonly logger = new Logger(EventParserService.name);

  parseExecutionOutcome(outcome: any, blockHeight: bigint, transactionHash: string): ParsedDonation[] {
    const donations: ParsedDonation[] = [];

    if (!outcome.logs || outcome.logs.length === 0) {
      return donations;
    }

    this.logger.log(`[EVENT PARSER] Processing ${outcome.logs.length} logs from executor: ${outcome.executor_id}`);

    for (const log of outcome.logs) {
      try {
        if (log.startsWith('EVENT_JSON:')) {
          const eventJson = log.substring('EVENT_JSON:'.length);
          const event: PotlockEvent = JSON.parse(eventJson);

          this.logger.log(`[EVENT PARSER] Found EVENT_JSON - Standard: ${event.standard}, Event: ${event.event}, Version: ${event.version}`);
          this.logger.log(`[EVENT PARSER] Raw event data: ${JSON.stringify(event.data)}`);

          if (event.standard === 'potlock') {
            this.logger.log(`[EVENT PARSER]  Potlock event detected! Processing ${event.event} event...`);
            const parsed = this.parsePotlockEvent(event, outcome, blockHeight, transactionHash);
            if (parsed) {
              this.logger.log(`[EVENT PARSER]  Successfully parsed ${parsed.type} donation:`);
              this.logger.log(`[EVENT PARSER]   - Donor: ${parsed.donorId}`);
              this.logger.log(`[EVENT PARSER]   - Recipient: ${parsed.recipientId || parsed.potId || parsed.campaignId || 'N/A'}`);
              this.logger.log(`[EVENT PARSER]   - Amount: ${parsed.amount} yoctoNEAR`);
              this.logger.log(`[EVENT PARSER]   - Transaction: ${parsed.transactionHash}`);
              donations.push(parsed);
            } else {
              this.logger.warn(`[EVENT PARSER]  Failed to parse event type: ${event.event}`);
            }
          } else {
            this.logger.debug(`[EVENT PARSER] Skipping non-potlock event (standard: ${event.standard})`);
          }
        }
      } catch (error) {
        this.logger.warn(`[EVENT PARSER] Failed to parse log: ${log} - Error: ${error.message}`);
      }
    }

    this.logger.log(`[EVENT PARSER] Extraction complete: ${donations.length} donations parsed`);
    return donations;
  }

  private parsePotlockEvent(
    event: PotlockEvent,
    outcome: any,
    blockHeight: bigint,
    transactionHash: string,
  ): ParsedDonation | null {
    const { event: eventType, data } = event;

    switch (eventType) {
      case 'donate':
        return this.parseDirectDonation(data, transactionHash, blockHeight);
      case 'pot_donate':
        return this.parsePotDonation(data, transactionHash, blockHeight);
      case 'pot_project_donation':
        return this.parsePotProjectDonation(data, transactionHash, blockHeight);
      case 'campaign_donate':
        return this.parseCampaignDonation(data, transactionHash, blockHeight);
      default:
        this.logger.debug(`Unknown event type: ${eventType}`);
        return null;
    }
  }

  private parseDirectDonation(
    data: any,
    txHash: string,
    blockHeight: bigint,
  ): ParsedDonation {
    return {
      type: 'DIRECT',
      donorId: data.donor_id,
      recipientId: data.recipient_id,
      amount: data.amount,
      ftId: data.ft_id || 'near',
      message: data.message,
      donatedAtMs: data.donated_at_ms,
      protocolFee: data.protocol_fee,
      referrerId: data.referrer_id,
      referrerFee: data.referrer_fee,
      transactionHash: txHash,
      blockHeight,
    };
  }

  private parsePotDonation(
    data: any,
    txHash: string,
    blockHeight: bigint,
  ): ParsedDonation {
    return {
      type: 'POT',
      donorId: data.donor_id,
      potId: data.pot_id,
      amount: data.total_amount || data.amount,
      netAmount: data.net_amount,
      ftId: data.ft_id || 'near',
      message: data.message,
      donatedAtMs: data.donated_at_ms,
      protocolFee: data.protocol_fee,
      referrerId: data.referrer_id,
      referrerFee: data.referrer_fee,
      chefId: data.chef_id,
      chefFee: data.chef_fee,
      transactionHash: txHash,
      blockHeight,
    };
  }

  private parsePotProjectDonation(
    data: any,
    txHash: string,
    blockHeight: bigint,
  ): ParsedDonation {
    return {
      type: 'POT_PROJECT',
      donorId: data.donor_id,
      recipientId: data.project_id,
      projectId: data.project_id,
      potId: data.pot_id,
      amount: data.amount,
      ftId: data.ft_id || 'near',
      donatedAtMs: data.donated_at_ms,
      referrerId: data.referrer_id,
      referrerFee: data.referrer_fee,
      transactionHash: txHash,
      blockHeight,
    };
  }

  private parseCampaignDonation(
    data: any,
    txHash: string,
    blockHeight: bigint,
  ): ParsedDonation {
    return {
      type: 'CAMPAIGN',
      donorId: data.donor_id,
      campaignId: data.campaign_id,
      amount: data.amount,
      ftId: data.ft_id || 'near',
      message: data.message,
      donatedAtMs: data.donated_at_ms,
      protocolFee: data.protocol_fee,
      referrerId: data.referrer_id,
      referrerFee: data.referrer_fee,
      transactionHash: txHash,
      blockHeight,
    };
  }

  parsePotPayout(outcome: any, blockHeight: bigint, transactionHash: string): any {
    if (!outcome.logs || outcome.logs.length === 0) {
      return null;
    }

    for (const log of outcome.logs) {
      try {
        if (log.startsWith('EVENT_JSON:')) {
          const eventJson = log.substring('EVENT_JSON:'.length);
          const event: PotlockEvent = JSON.parse(eventJson);

          if (event.standard === 'potlock' && event.event === 'pot_payout') {
            return {
              potId: event.data.pot_id,
              recipientId: event.data.recipient_id,
              amount: event.data.amount,
              ftId: event.data.ft_id || 'near',
              paidAtMs: event.data.paid_at_ms,
              transactionHash: transactionHash,
              blockHeight,
            };
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to parse payout log: ${log}`);
      }
    }

    return null;
  }
}

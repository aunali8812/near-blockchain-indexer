import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nearAPI from 'near-api-js';

export interface BlockInfo {
  height: bigint;
  hash: string;
  timestamp: Date;
  chunks: any[];
}

@Injectable()
export class NearRpcService {
  private readonly logger = new Logger(NearRpcService.name);
  private provider: InstanceType<typeof nearAPI.providers.JsonRpcProvider>;
  private readonly rpcUrl: string;

  constructor(private configService: ConfigService) {
    this.rpcUrl = this.configService.get<string>('NEAR_RPC_URL');
    this.provider = new nearAPI.providers.JsonRpcProvider({
      url: this.rpcUrl,
    });
  }

  async getLatestBlock(): Promise<BlockInfo> {
    try {
      const block = await this.provider.block({ finality: 'final' });
      return {
        height: BigInt(block.header.height),
        hash: block.header.hash,
        timestamp: new Date(Math.floor(block.header.timestamp / 1000000)),
        chunks: block.chunks,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch latest block: ${error.message}`);
      throw error;
    }
  }

  async getBlockByHeight(height: bigint): Promise<BlockInfo> {
    try {
      const block = await this.provider.block({ blockId: Number(height) });
      return {
        height: BigInt(block.header.height),
        hash: block.header.hash,
        timestamp: new Date(Math.floor(block.header.timestamp / 1000000)),
        chunks: block.chunks,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch block ${height}: ${error.message}`);
      throw error;
    }
  }

  async getChunk(chunkHash: string): Promise<any> {
    try {
      return await this.provider.chunk(chunkHash);
    } catch (error) {
      this.logger.error(`Failed to fetch chunk ${chunkHash}: ${error.message}`);
      throw error;
    }
  }

  async getTxStatus(txHash: string, accountId: string): Promise<any> {
    try {
      return await this.provider.txStatus(txHash, accountId);
    } catch (error) {
      this.logger.error(`Failed to fetch tx status ${txHash}: ${error.message}`);
      throw error;
    }
  }
}

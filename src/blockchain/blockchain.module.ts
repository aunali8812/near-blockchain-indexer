import { Module } from '@nestjs/common';
import { NearRpcService } from './near-rpc.service';
import { EventParserService } from './event-parser.service';
import { IndexerService } from './indexer.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  providers: [NearRpcService, EventParserService, IndexerService],
  exports: [NearRpcService, EventParserService, IndexerService],
})
export class BlockchainModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AccountsModule } from './accounts/accounts.module';
import { DonationsModule } from './donations/donations.module';
import { StatsModule } from './stats/stats.module';
import { PricingModule } from './pricing/pricing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 500,
      },
    ]),
    DatabaseModule,
    BlockchainModule,
    PricingModule,
    AccountsModule,
    DonationsModule,
    StatsModule,
  ],
})
export class AppModule {}

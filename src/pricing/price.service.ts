import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import axios from 'axios';

@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);
  private cachedPrice: number = 0;
  private lastFetchTime: number = 0;
  private readonly cacheDuration = 5 * 60 * 1000; // 5 minutes

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async getCurrentNearPrice(): Promise<number> {
    const now = Date.now();

    if (this.cachedPrice && now - this.lastFetchTime < this.cacheDuration) {
      return this.cachedPrice;
    }

    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: 'near',
            vs_currencies: 'usd',
          },
        },
      );

      const price = response.data.near?.usd || 0;
      this.cachedPrice = price;
      this.lastFetchTime = now;

      await this.savePriceToDb(price);

      return price;
    } catch (error) {
      this.logger.error(`Failed to fetch NEAR price: ${error.message}`);

      if (this.cachedPrice) {
        return this.cachedPrice;
      }

      const fallbackPrice = await this.getLatestPriceFromDb();
      return fallbackPrice || 0;
    }
  }

  private async savePriceToDb(priceUsd: number): Promise<void> {
    try {
      const timestamp = new Date();
      timestamp.setSeconds(0, 0);

      await this.prisma.tokenPrice.upsert({
        where: {
          tokenId_timestamp: {
            tokenId: 'near',
            timestamp,
          },
        },
        create: {
          tokenId: 'near',
          priceUsd,
          timestamp,
          source: 'coingecko',
        },
        update: {
          priceUsd,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to save price to DB: ${error.message}`);
    }
  }

  async getHistoricalPrice(timestamp: Date): Promise<number> {
    try {
      const price = await this.prisma.tokenPrice.findFirst({
        where: {
          tokenId: 'near',
          timestamp: {
            lte: timestamp,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (price) {
        return Number(price.priceUsd);
      }

      return await this.getCurrentNearPrice();
    } catch (error) {
      this.logger.error(`Failed to get historical price: ${error.message}`);
      return await this.getCurrentNearPrice();
    }
  }

  private async getLatestPriceFromDb(): Promise<number | null> {
    try {
      const latestPrice = await this.prisma.tokenPrice.findFirst({
        where: { tokenId: 'near' },
        orderBy: { timestamp: 'desc' },
      });

      return latestPrice ? Number(latestPrice.priceUsd) : null;
    } catch (error) {
      this.logger.error(`Failed to get latest price from DB: ${error.message}`);
      return null;
    }
  }

  yoctoToNear(yoctoAmount: string): number {
    return Number(yoctoAmount) / 1e24;
  }

  async calculateUsdValue(yoctoAmount: string, timestamp?: Date): Promise<number> {
    const nearAmount = this.yoctoToNear(yoctoAmount);

    let price: number;
    if (timestamp) {
      price = await this.getHistoricalPrice(timestamp);
    } else {
      price = await this.getCurrentNearPrice();
    }

    return nearAmount * price;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GlobalStatsResponse, LeaderboardResponse, LeaderboardEntry } from './dto/stats-response.dto';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private prisma: PrismaService) {}

  async getGlobalStats(): Promise<GlobalStatsResponse> {
    this.logger.log('\n[STATS API] /api/v1/stats endpoint called - querying PostgreSQL database...');
    this.logger.log('[STATS API] Running 5 parallel database queries:');
    this.logger.log('[STATS API]   1. Donation.aggregate() - sum amounts and count');
    this.logger.log('[STATS API]   2. Account.count() - donors (donationsSentCount > 0)');
    this.logger.log('[STATS API]   3. Account.count() - recipients (donationsReceivedCount > 0)');
    this.logger.log('[STATS API]   4. Donation.aggregate() - sum referrer fees');
    this.logger.log('[STATS API]   5. Donation.groupBy(type) - breakdown by donation type');

    const [donationStats, donorCount, recipientCount, referralFees, typeBreakdown] = await Promise.all([
      this.prisma.donation.aggregate({
        _sum: {
          amountUsd: true,
          amountNear: true,
        },
        _count: true,
      }),
      this.prisma.account.count({
        where: {
          donationsSentCount: {
            gt: 0,
          },
        },
      }),
      this.prisma.account.count({
        where: {
          donationsReceivedCount: {
            gt: 0,
          },
        },
      }),
      this.prisma.donation.aggregate({
        _sum: {
          referrerFeeUsd: true,
        },
      }),
      this.prisma.donation.groupBy({
        by: ['type'],
        _sum: {
          amountUsd: true,
        },
      }),
    ]);

    this.logger.log('[STATS API]  Database queries completed. Results from PostgreSQL:');
    this.logger.log(`[STATS API]   - Total donations in DB: ${donationStats._count}`);
    this.logger.log(`[STATS API]   - Total USD amount: $${Number(donationStats._sum.amountUsd || 0).toFixed(2)}`);
    this.logger.log(`[STATS API]   - Total NEAR amount: ${Number(donationStats._sum.amountNear || 0).toFixed(2)}`);
    this.logger.log(`[STATS API]   - Unique donors: ${donorCount}`);
    this.logger.log(`[STATS API]   - Unique recipients: ${recipientCount}`);
    this.logger.log(`[STATS API]   - Total referral fees: $${Number(referralFees._sum.referrerFeeUsd || 0).toFixed(2)}`);

    const typeBreakdownMap = typeBreakdown.reduce(
      (acc, item) => {
        acc[item.type] = Number(item._sum.amountUsd || 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    this.logger.log('[STATS API] Breakdown by donation type:');
    this.logger.log(`[STATS API]   - DIRECT: $${typeBreakdownMap.DIRECT || 0}`);
    this.logger.log(`[STATS API]   - POT: $${typeBreakdownMap.POT || 0}`);
    this.logger.log(`[STATS API]   - POT_PROJECT: $${typeBreakdownMap.POT_PROJECT || 0}`);
    this.logger.log(`[STATS API]   - CAMPAIGN: $${typeBreakdownMap.CAMPAIGN || 0}`);

    const response = {
      total_donations_usd: Number(donationStats._sum.amountUsd || 0),
      total_donations_near: Number(donationStats._sum.amountNear || 0),
      total_donations_count: donationStats._count,
      total_donors: donorCount,
      total_recipients: recipientCount,
      total_referral_fees_usd: Number(referralFees._sum.referrerFeeUsd || 0),
      direct_donations_usd: typeBreakdownMap.DIRECT || 0,
      pot_donations_usd: (typeBreakdownMap.POT || 0) + (typeBreakdownMap.POT_PROJECT || 0),
      campaign_donations_usd: typeBreakdownMap.CAMPAIGN || 0,
    };

    this.logger.log('[STATS API] Returning aggregated stats to API response\n');
    return response;
  }

  async getLeaderboard(
    type: 'donors' | 'recipients' | 'referrers' = 'donors',
    limit: number = 100,
  ): Promise<LeaderboardResponse> {
    this.logger.log(`\n[STATS API] /api/v1/stats/leaderboard endpoint called (type: ${type}, limit: ${limit})`);
    this.logger.log('[STATS API] Querying PostgreSQL Account table...');

    let entries: LeaderboardEntry[] = [];

    switch (type) {
      case 'donors':
        this.logger.log('[STATS API] Finding top donors ordered by totalDonatedUsd DESC');
        const topDonors = await this.prisma.account.findMany({
          where: {
            donationsSentCount: {
              gt: 0,
            },
          },
          orderBy: {
            totalDonatedUsd: 'desc',
          },
          take: limit,
          select: {
            id: true,
            totalDonatedUsd: true,
            donationsSentCount: true,
          },
        });
        this.logger.log(`[STATS API] Found ${topDonors.length} donors from database`);
        entries = topDonors.map((account) => ({
          account_id: account.id,
          value: Number(account.totalDonatedUsd),
          count: account.donationsSentCount,
        }));
        break;

      case 'recipients':
        this.logger.log('[STATS API] Finding top recipients ordered by totalReceivedUsd DESC');
        const topRecipients = await this.prisma.account.findMany({
          where: {
            donationsReceivedCount: {
              gt: 0,
            },
          },
          orderBy: {
            totalReceivedUsd: 'desc',
          },
          take: limit,
          select: {
            id: true,
            totalReceivedUsd: true,
            donationsReceivedCount: true,
          },
        });
        this.logger.log(`[STATS API] Found ${topRecipients.length} recipients from database`);
        entries = topRecipients.map((account) => ({
          account_id: account.id,
          value: Number(account.totalReceivedUsd),
          count: account.donationsReceivedCount,
        }));
        break;

      case 'referrers':
        this.logger.log('[STATS API] Finding top referrers ordered by referralFeesEarnedUsd DESC');
        const topReferrers = await this.prisma.account.findMany({
          where: {
            referralFeesEarnedUsd: {
              gt: 0,
            },
          },
          orderBy: {
            referralFeesEarnedUsd: 'desc',
          },
          take: limit,
          select: {
            id: true,
            referralFeesEarnedUsd: true,
          },
        });
        this.logger.log(`[STATS API] Found ${topReferrers.length} referrers, counting their donations...`);
        const referralCounts = await Promise.all(
          topReferrers.map(async (account) => {
            const count = await this.prisma.donation.count({
              where: { referrerId: account.id },
            });
            return { accountId: account.id, count };
          }),
        );
        const countMap = referralCounts.reduce(
          (acc, item) => {
            acc[item.accountId] = item.count;
            return acc;
          },
          {} as Record<string, number>,
        );
        entries = topReferrers.map((account) => ({
          account_id: account.id,
          value: Number(account.referralFeesEarnedUsd),
          count: countMap[account.id] || 0,
        }));
        break;
    }

    this.logger.log(`[STATS API] Returning ${entries.length} leaderboard entries to API response\n`);
    return {
      type,
      entries,
    };
  }
}

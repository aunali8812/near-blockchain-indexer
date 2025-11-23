import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  AccountSummaryResponse,
  ReferralSummaryResponse,
  AccountResponse,
} from './dto/account-response.dto';
import { PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async getAccounts(
    page: number = 1,
    limit: number = 20,
    sort: string = 'totalDonatedUsd:desc',
  ): Promise<PaginatedResponse<AccountResponse>> {
    const skip = (page - 1) * limit;
    const [sortField, sortOrder] = sort.split(':');

    const validSortFields = [
      'totalDonatedUsd',
      'totalReceivedUsd',
      'donationsSentCount',
      'donationsReceivedCount',
      'firstSeenAt',
      'lastActivityAt',
    ];
    const field = validSortFields.includes(sortField) ? sortField : 'totalDonatedUsd';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [accounts, total] = await Promise.all([
      this.prisma.account.findMany({
        skip,
        take: limit,
        orderBy: { [field]: order },
      }),
      this.prisma.account.count(),
    ]);

    return {
      data: accounts.map((account) => ({
        id: account.id,
        first_seen_at: account.firstSeenAt.toISOString(),
        last_activity_at: account.lastActivityAt.toISOString(),
        total_donated_usd: Number(account.totalDonatedUsd),
        total_received_usd: Number(account.totalReceivedUsd),
        donations_sent_count: account.donationsSentCount,
        donations_received_count: account.donationsReceivedCount,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAccountById(accountId: string): Promise<AccountResponse> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    return {
      id: account.id,
      first_seen_at: account.firstSeenAt.toISOString(),
      last_activity_at: account.lastActivityAt.toISOString(),
      total_donated_usd: Number(account.totalDonatedUsd),
      total_received_usd: Number(account.totalReceivedUsd),
      donations_sent_count: account.donationsSentCount,
      donations_received_count: account.donationsReceivedCount,
    };
  }

  async getAccountSummary(accountId: string): Promise<AccountSummaryResponse> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    return {
      account_id: account.id,
      total_donated_usd: Number(account.totalDonatedUsd),
      total_donated_near: Number(account.totalDonatedNear),
      total_received_usd: Number(account.totalReceivedUsd),
      total_received_near: Number(account.totalReceivedNear),
      donations_sent_count: account.donationsSentCount,
      donations_received_count: account.donationsReceivedCount,
      referral_fees_earned_usd: Number(account.referralFeesEarnedUsd),
      referral_fees_paid_usd: Number(account.referralFeesPaidUsd),
      breakdown_by_type: {
        direct_donations: {
          sent_usd: Number(account.directDonatedUsd),
          received_usd: Number(account.directReceivedUsd),
          count_sent: account.directSentCount,
          count_received: account.directReceivedCount,
        },
        pot_donations: {
          sent_usd: Number(account.potDonatedUsd),
          received_usd: Number(account.potReceivedUsd),
          count_sent: account.potSentCount,
          count_received: account.potReceivedCount,
        },
        campaign_donations: {
          sent_usd: Number(account.campaignDonatedUsd),
          received_usd: Number(account.campaignReceivedUsd),
          count_sent: account.campaignSentCount,
          count_received: account.campaignReceivedCount,
        },
      },
      first_donation_date: account.firstDonationDate?.toISOString() || null,
      last_donation_date: account.lastDonationDate?.toISOString() || null,
    };
  }

  async getReferralSummary(accountId: string): Promise<ReferralSummaryResponse> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const referredCount = await this.prisma.donation.count({
      where: { referrerId: accountId },
    });

    return {
      account_id: account.id,
      referral_fees_earned_usd: Number(account.referralFeesEarnedUsd),
      referral_fees_earned_near: Number(account.referralFeesEarnedNear),
      referral_fees_paid_usd: Number(account.referralFeesPaidUsd),
      referral_fees_paid_near: Number(account.referralFeesPaidNear),
      donations_referred_count: referredCount,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DonationQueryDto } from './dto/donation-query.dto';
import { DonationResponse } from './dto/donation-response.dto';
import { PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class DonationsService {
  constructor(private prisma: PrismaService) {}

  async getDonationsSent(
    accountId: string,
    query: DonationQueryDto,
  ): Promise<PaginatedResponse<DonationResponse>> {
    return this.getDonations(accountId, 'sent', query);
  }

  async getDonationsReceived(
    accountId: string,
    query: DonationQueryDto,
  ): Promise<PaginatedResponse<DonationResponse>> {
    return this.getDonations(accountId, 'received', query);
  }

  private async getDonations(
    accountId: string,
    direction: 'sent' | 'received',
    query: DonationQueryDto,
  ): Promise<PaginatedResponse<DonationResponse>> {
    const { page = 1, limit = 20, type, startDate, endDate, minAmount, maxAmount, sort = 'donatedAt:desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (direction === 'sent') {
      where.donorId = accountId;
    } else {
      where.recipientId = accountId;
    }

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.donatedAt = {};
      if (startDate) {
        where.donatedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.donatedAt.lte = new Date(endDate);
      }
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amountUsd = {};
      if (minAmount !== undefined) {
        where.amountUsd.gte = minAmount;
      }
      if (maxAmount !== undefined) {
        where.amountUsd.lte = maxAmount;
      }
    }

    const [sortField, sortOrder] = sort.split(':');
    const validSortFields = ['donatedAt', 'amountUsd', 'amountNear'];
    const field = validSortFields.includes(sortField) ? sortField : 'donatedAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [donations, total] = await Promise.all([
      this.prisma.donation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [field]: order },
      }),
      this.prisma.donation.count({ where }),
    ]);

    return {
      data: donations.map((donation) => ({
        id: donation.id,
        type: donation.type,
        donor_id: donation.donorId,
        recipient_id: donation.recipientId,
        amount_near: Number(donation.amountNear),
        amount_usd: Number(donation.amountUsd),
        ft_id: donation.ftId,
        message: donation.message,
        donated_at: donation.donatedAt.toISOString(),
        block_height: donation.blockHeight.toString(),
        transaction_hash: donation.transactionHash,
        protocol_fee_near: Number(donation.protocolFeeNear),
        protocol_fee_usd: Number(donation.protocolFeeUsd),
        referrer_id: donation.referrerId,
        referrer_fee_near: Number(donation.referrerFeeNear),
        referrer_fee_usd: Number(donation.referrerFeeUsd),
        pot_id: donation.potId,
        campaign_id: donation.campaignId,
        project_id: donation.projectId,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

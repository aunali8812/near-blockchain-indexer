import { Controller, Get, Param, Query } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { DonationQueryDto } from './dto/donation-query.dto';

@Controller('api/v1/accounts')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Get(':accountId/donations-sent')
  async getDonationsSent(
    @Param('accountId') accountId: string,
    @Query() query: DonationQueryDto,
  ) {
    return this.donationsService.getDonationsSent(accountId, query);
  }

  @Get(':accountId/donations-received')
  async getDonationsReceived(
    @Param('accountId') accountId: string,
    @Query() query: DonationQueryDto,
  ) {
    return this.donationsService.getDonationsReceived(accountId, query);
  }
}

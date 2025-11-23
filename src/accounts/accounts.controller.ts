import { Controller, Get, Param, Query } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('api/v1/accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async getAccounts(
    @Query() pagination: PaginationDto,
    @Query('sort') sort?: string,
  ) {
    return this.accountsService.getAccounts(
      pagination.page,
      pagination.limit,
      sort,
    );
  }

  @Get(':accountId')
  async getAccount(@Param('accountId') accountId: string) {
    return this.accountsService.getAccountById(accountId);
  }

  @Get(':accountId/donation-summary')
  async getDonationSummary(@Param('accountId') accountId: string) {
    return this.accountsService.getAccountSummary(accountId);
  }

  @Get(':accountId/referral-summary')
  async getReferralSummary(@Param('accountId') accountId: string) {
    return this.accountsService.getReferralSummary(accountId);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('api/v1/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  async getGlobalStats() {
    return this.statsService.getGlobalStats();
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('type') type: 'donors' | 'recipients' | 'referrers' = 'donors',
    @Query('limit') limit: number = 100,
  ) {
    return this.statsService.getLeaderboard(type, limit);
  }
}

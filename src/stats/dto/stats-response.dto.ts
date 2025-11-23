export class GlobalStatsResponse {
  total_donations_usd: number;
  total_donations_near: number;
  total_donations_count: number;
  total_donors: number;
  total_recipients: number;
  total_referral_fees_usd: number;
  direct_donations_usd: number;
  pot_donations_usd: number;
  campaign_donations_usd: number;
}

export class LeaderboardEntry {
  account_id: string;
  value: number;
  count: number;
}

export class LeaderboardResponse {
  type: string;
  entries: LeaderboardEntry[];
}

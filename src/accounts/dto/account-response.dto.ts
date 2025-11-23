export class BreakdownByType {
  sent_usd: number;
  received_usd: number;
  count_sent: number;
  count_received: number;
}

export class AccountSummaryResponse {
  account_id: string;
  total_donated_usd: number;
  total_donated_near: number;
  total_received_usd: number;
  total_received_near: number;
  donations_sent_count: number;
  donations_received_count: number;
  referral_fees_earned_usd: number;
  referral_fees_paid_usd: number;
  breakdown_by_type: {
    direct_donations: BreakdownByType;
    pot_donations: BreakdownByType;
    campaign_donations: BreakdownByType;
  };
  first_donation_date: string | null;
  last_donation_date: string | null;
}

export class ReferralSummaryResponse {
  account_id: string;
  referral_fees_earned_usd: number;
  referral_fees_earned_near: number;
  referral_fees_paid_usd: number;
  referral_fees_paid_near: number;
  donations_referred_count: number;
}

export class AccountResponse {
  id: string;
  first_seen_at: string;
  last_activity_at: string;
  total_donated_usd: number;
  total_received_usd: number;
  donations_sent_count: number;
  donations_received_count: number;
}

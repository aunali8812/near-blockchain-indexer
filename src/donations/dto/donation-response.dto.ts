export class DonationResponse {
  id: string;
  type: string;
  donor_id: string;
  recipient_id: string | null;
  amount_near: number;
  amount_usd: number;
  ft_id: string;
  message: string | null;
  donated_at: string;
  block_height: string;
  transaction_hash: string;
  protocol_fee_near: number;
  protocol_fee_usd: number;
  referrer_id: string | null;
  referrer_fee_near: number;
  referrer_fee_usd: number;
  pot_id: string | null;
  campaign_id: string | null;
  project_id: string | null;
}

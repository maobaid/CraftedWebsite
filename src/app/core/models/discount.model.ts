// Coupon model matches backend CouponDto exactly
export type CouponType = 'PERCENTAGE' | 'FIXED';

export interface Coupon {
  code: string;
  type: CouponType;
  value: number;
  minimum_order_amount: number | null;
  expires_at: string;
  usage_limit: number | null;
  is_active: boolean;
}

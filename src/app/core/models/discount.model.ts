export interface DiscountCode {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdAt?: string;
}

import { Injectable, signal } from '@angular/core';
import { Coupon } from '../models/discount.model';
import { CouponService } from './coupon.service';

@Injectable({ providedIn: 'root' })
export class DiscountService {
  private appliedCodeSignal = signal('');
  private appliedMessageSignal = signal('');

  appliedCode = this.appliedCodeSignal.asReadonly();
  appliedMessage = this.appliedMessageSignal.asReadonly();

  constructor(private coupons: CouponService) {}

  private findCoupon(code: string): Coupon | undefined {
    const normalized = code.trim().toUpperCase();
    return this.coupons
      .coupons()
      .find((c) => c.code.toUpperCase() === normalized);
  }

  private isValidForOrder(coupon: Coupon, subtotal: number): boolean {
    if (!coupon.is_active) return false;
    const now = new Date();
    if (new Date(coupon.expires_at) <= now) return false;
    if (
      coupon.minimum_order_amount != null &&
      subtotal < coupon.minimum_order_amount
    ) {
      return false;
    }
    return true;
  }

  applyDiscount(
    subtotal: number,
    code: string
  ): { amount: number; message?: string } {
    const coupon = this.findCoupon(code);
    if (!coupon || !this.isValidForOrder(coupon, subtotal)) {
      return { amount: 0, message: 'كود الخصم غير صالح أو لا ينطبق على هذا الطلب' };
    }

    const amount =
      coupon.type === 'PERCENTAGE'
        ? (subtotal * coupon.value) / 100
        : Math.min(coupon.value, subtotal);

    return { amount };
  }

  /** Apply coupon from cart; stores code so checkout uses the same discount. */
  applyCoupon(subtotal: number, code: string): { amount: number; message?: string } {
    const result = this.applyDiscount(subtotal, code);
    const normalized = code.trim().toUpperCase();
    if (result.amount > 0) {
      this.appliedCodeSignal.set(normalized);
      this.appliedMessageSignal.set('');
    } else {
      this.appliedCodeSignal.set('');
      this.appliedMessageSignal.set(result.message ?? '');
    }
    return result;
  }

  /** Discount amount for current applied code (used by cart and checkout). */
  getAppliedDiscountAmount(subtotal: number): number {
    const code = this.appliedCodeSignal();
    if (!code) return 0;
    return this.applyDiscount(subtotal, code).amount;
  }

  /** Clear applied coupon (e.g. after order is placed). */
  clearAppliedCoupon(): void {
    this.appliedCodeSignal.set('');
    this.appliedMessageSignal.set('');
  }

  /** Clear only the error/success message (e.g. when user edits the code input). */
  clearMessage(): void {
    this.appliedMessageSignal.set('');
  }
}

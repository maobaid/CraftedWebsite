import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Coupon, CouponType } from '../../../core/models/discount.model';
import { CouponService } from '../../../core/services/coupon.service';
import { HeroIconComponent } from '../../../shared/icons/hero-icon.component';

const COUPON_TYPE_OPTIONS: { value: CouponType; label: string }[] = [
  { value: 'PERCENTAGE', label: 'نسبة مئوية' },
  { value: 'FIXED', label: 'مبلغ ثابت' },
];

@Component({
  selector: 'app-admin-coupons',
  standalone: true,
  imports: [FormsModule, DatePipe, HeroIconComponent],
  templateUrl: './admin-coupons.component.html',
})
export class AdminCouponsComponent {
  showForm = false;
  editingCode: string | null = null;
  typeOptions = COUPON_TYPE_OPTIONS;
  form = {
    code: '',
    type: 'PERCENTAGE' as CouponType,
    value: 0,
    minimum_order_amount: null as number | string | null,
    expires_at: '',
    usage_limit: null as number | string | null,
    isActive: true,
  };

  constructor(public couponService: CouponService) {}

  openAdd(): void {
    this.editingCode = null;
    const exp = new Date();
    exp.setMonth(exp.getMonth() + 1);
    this.form = {
      code: '',
      type: 'PERCENTAGE',
      value: 0,
      minimum_order_amount: null,
      expires_at: exp.toISOString().slice(0, 16),
      usage_limit: null,
      isActive: true,
    };
    this.showForm = true;
  }

  openEdit(c: Coupon): void {
    this.editingCode = c.code;
    this.form = {
      code: c.code,
      type: c.type,
      value: c.value,
      minimum_order_amount: c.minimum_order_amount ?? null,
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : '',
      usage_limit: c.usage_limit ?? null,
      isActive: c.is_active !== false,
    };
    this.showForm = true;
  }

  save(): void {
    const code = (this.form.code || '').trim().toUpperCase();
    if (!code) return;
    if (this.form.value < 0) return;
    if (!this.form.expires_at) return;

    const payload: Coupon = {
      code,
      type: this.form.type,
      value: Number(this.form.value) || 0,
      minimum_order_amount: coerceNumberOrNull(this.form.minimum_order_amount),
      expires_at: this.form.expires_at,
      usage_limit: coerceUsageLimit(this.form.usage_limit),
      is_active: this.form.isActive,
    };

    if (this.editingCode) {
      this.couponService.update(this.editingCode, payload);
    } else {
      this.couponService.add(payload);
    }
    this.showForm = false;
  }

  delete(code: string): void {
    if (confirm('حذف هذا الكوبون؟')) this.couponService.delete(code);
  }

  typeLabel(value: CouponType): string {
    return COUPON_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
  }
}

function coerceNumberOrNull(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Backend requires usage_limit >= 1 when present; use null for "no limit". */
function coerceUsageLimit(v: number | string | null | undefined): number | null {
  const n = coerceNumberOrNull(v);
  return n != null && n >= 1 ? n : null;
}

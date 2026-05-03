import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Coupon, CouponType } from '../models/discount.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

/** API response for GET /stores/{storeId}/coupons */
interface CouponsListResponse {
  data?: Coupon[];
}

@Injectable({ providedIn: 'root' })
export class CouponService {
  private couponsSignal = signal<Coupon[]>([]);

  coupons = this.couponsSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {
    this.refresh();
  }

  private getStoreId(): string | null {
    const user = this.auth.user();
    return user?.store_id ?? environment.storeId ?? null;
  }

  private getAuthHeaders(): { headers?: HttpHeaders } {
    const token = this.auth.getAccessToken();
    if (!token) return {};
    return {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
    };
  }

  refresh(): void {
    const storeId = this.getStoreId();
    if (!storeId) {
      this.couponsSignal.set([]);
      return;
    }
    this.http
      .get<
        Coupon[] | CouponsListResponse
      >(`/stores/${storeId}/coupons`, this.getAuthHeaders())
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res)
            ? res
            : Array.isArray((res as CouponsListResponse).data)
              ? (res as CouponsListResponse).data!
              : [];
          this.couponsSignal.set(list.map(normalizeCoupon));
        },
        error: () => this.couponsSignal.set([]),
      });
  }

  add(coupon: Coupon): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    this.http
      .post<Coupon>(
        `/stores/${storeId}/coupons`,
        toApiBody(coupon),
        this.getAuthHeaders(),
      )
      .subscribe({
        next: () => this.refresh(),
        error: () => {},
      });
  }

  update(code: string, updates: Partial<Coupon>): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    const encoded = encodeURIComponent(code);
    this.http
      .patch<Coupon>(
        `/stores/${storeId}/coupons/${encoded}`,
        toApiBody(updates),
        this.getAuthHeaders(),
      )
      .subscribe({
        next: () => this.refresh(),
        error: () => {},
      });
  }

  delete(code: string): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    const encoded = encodeURIComponent(code);
    this.http
      .delete<void>(
        `/stores/${storeId}/coupons/${encoded}`,
        this.getAuthHeaders(),
      )
      .subscribe({
        next: () => this.refresh(),
        error: () => {},
      });
  }
}

function normalizeCoupon(c: Coupon): Coupon {
  return {
    code: c.code ?? '',
    type: (c.type === 'PERCENTAGE' || c.type === 'FIXED'
      ? c.type
      : 'PERCENTAGE') as CouponType,
    value: Number(c.value) || 0,
    minimum_order_amount:
      c.minimum_order_amount != null ? Number(c.minimum_order_amount) : null,
    expires_at: c.expires_at ?? '',
    usage_limit: c.usage_limit != null ? Number(c.usage_limit) : null,
    is_active: c.is_active !== false,
  };
}

function toApiBody(c: Partial<Coupon>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (c.code !== undefined) body['code'] = String(c.code).trim();
  if (c.type !== undefined) body['type'] = c.type;
  if (c.value !== undefined) body['value'] = Number(c.value) || 0;
  if (c.minimum_order_amount !== undefined) {
    const n = Number(c.minimum_order_amount);
    body['minimum_order_amount'] = Number.isNaN(n) ? null : n;
  }
  if (c.expires_at !== undefined) body['expires_at'] = c.expires_at;
  if (c.usage_limit !== undefined) {
    const n = Number(c.usage_limit);
    body['usage_limit'] = Number.isNaN(n) || n < 1 ? null : n;
  }
  if (c.is_active !== undefined) body['is_active'] = c.is_active;
  return body;
}

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  Product,
  ProductDiscount,
  ProductPriceResult,
  AppliesTo,
} from '../models/product.model';
import { AuthService } from './auth.service';

/** API response for GET /stores/{storeId}/product-discounts */
interface ProductDiscountsListResponse {
  data?: ProductDiscount[];
}

@Injectable({ providedIn: 'root' })
export class ProductDiscountService {
  private discountsSignal = signal<ProductDiscount[]>([]);

  discounts = this.discountsSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {
    this.refresh();
  }

  private getStoreId(): string | null {
    const user = this.auth.user();
    return user?.store_id ?? null;
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
      this.discountsSignal.set([]);
      return;
    }
    this.http
      .get<
        ProductDiscount[] | ProductDiscountsListResponse
      >(`/stores/${storeId}/product-discounts`)
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res)
            ? res
            : Array.isArray((res as ProductDiscountsListResponse).data)
              ? (res as ProductDiscountsListResponse).data!
              : [];
          this.discountsSignal.set(list.map(apiToDiscount));
        },
        error: () => this.discountsSignal.set([]),
      });
  }

  /**
   * Get the effective price for a product (after applying the best applicable discount).
   * Uses discounts that are valid for today and apply to this product; picks highest percentage.
   */
  add(discount: Omit<ProductDiscount, 'id'>): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    this.http
      .post<ProductDiscount>(
        `/stores/${storeId}/product-discounts`,
        toApiBody(discount),
        this.getAuthHeaders(),
      )
      .subscribe({
        next: () => this.refresh(),
        error: () => {},
      });
  }

  update(id: string, discount: Partial<ProductDiscount>): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    this.http
      .patch<ProductDiscount>(
        `/stores/${storeId}/product-discounts/${id}`,
        toApiBody(discount),
        this.getAuthHeaders(),
      )
      .subscribe({
        next: () => this.refresh(),
        error: () => {},
      });
  }

  delete(id: string): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    this.http
      .delete<void>(
        `/stores/${storeId}/product-discounts/${id}`,
        this.getAuthHeaders(),
      )
      .subscribe({
        next: () => this.refresh(),
        error: () => {},
      });
  }

  getEffectivePrice(product: Product): ProductPriceResult {
    const originalPrice = product.price;
    const now = new Date();
    const list = this.discountsSignal();

    const applicable = list.filter((d) => {
      if (d.is_active === false) return false;
      const start = new Date(d.start_date);
      const end = new Date(d.end_date);
      if (now < start || now > end) return false;
      switch (d.applies_to) {
        case 'ALL_PRODUCTS':
          return true;
        case 'CATEGORY':
          return !!d.category_id && d.category_id === product.category_id;
        case 'SPECIFIC_PRODUCTS':
          return (
            Array.isArray(d.product_ids) && d.product_ids.includes(product.id)
          );
        default:
          return false;
      }
    });

    if (applicable.length === 0) {
      return { price: originalPrice, originalPrice, discount: null };
    }

    const best = applicable.reduce((a, b) =>
      b.percentage > a.percentage ? b : a,
    );
    const price = originalPrice * (1 - best.percentage / 100);
    return {
      price: Math.max(0, Math.round(price * 100) / 100),
      originalPrice,
      discount: best,
    };
  }
}

function apiToDiscount(api: ProductDiscount): ProductDiscount {
  return {
    id: api.id,
    name: api.name,
    percentage: api.percentage,
    applies_to: api.applies_to as AppliesTo,
    category_id: api.category_id,
    start_date: api.start_date,
    end_date: api.end_date,
    is_active: api.is_active,
    product_ids: Array.isArray(api.product_ids) ? api.product_ids : [],
  };
}

function toApiBody(d: Partial<ProductDiscount>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (d.name !== undefined) body['name'] = d.name;
  if (d.percentage !== undefined) {
    const n = Number(d.percentage);
    body['percentage'] = Number.isNaN(n) ? 0 : Math.max(0, n);
  }
  if (d.applies_to !== undefined) body['applies_to'] = d.applies_to;
  if (d.category_id !== undefined) body['category_id'] = d.category_id || null;
  if (d.start_date !== undefined) body['start_date'] = d.start_date;
  if (d.end_date !== undefined) body['end_date'] = d.end_date;
  if (d.is_active !== undefined) body['is_active'] = d.is_active;
  if (d.product_ids !== undefined && Array.isArray(d.product_ids)) {
    body['product_ids'] = d.product_ids.map((id) => String(id));
  }
  return body;
}

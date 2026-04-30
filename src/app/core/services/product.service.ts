import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  Product,
  ProductVariant,
  ProductVariantInput,
  parseNonNegativeProductPrice,
} from '../models/product.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

/** API response for GET /stores/{storeId}/products */
interface ProductsListResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductListFilters {
  low_stock_only?: boolean;
  low_stock_threshold?: number;
}

/** POST body — excludes read-only/top-level computed fields */
export type ProductCreatePayload = Omit<
  Product,
  'id' | 'in_stock' | 'is_low_stock' | 'variants'
> & {
  variants?: ProductVariantInput[];
};

export type ProductUpdatePayload = Partial<
  Omit<Product, 'id' | 'in_stock' | 'is_low_stock' | 'variants'>
> & {
  variants?: ProductVariantInput[];
};

@Injectable({ providedIn: 'root' })
export class ProductService {
  private productsSignal = signal<Product[]>([]);

  products = computed(() => this.productsSignal().filter((p) => p.is_active));
  allProducts = this.productsSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {
    this.refresh();
  }

  private getStoreId(): string | null {
    const user = this.auth.user();
    return user?.store_id ?? environment.storeId;
  }

  private getAuthHeaders(required = false): { headers?: HttpHeaders } {
    const token = this.auth.getAccessToken();
    if (!token && required) {
      return {};
    }
    if (!token) return {};
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`,
      }),
    };
  }

  refresh(filters?: ProductListFilters): void {
    const storeId = this.getStoreId();
    if (!storeId) {
      this.productsSignal.set([]);
      return;
    }
    const params: Record<string, string> = {};
    if (filters?.low_stock_only) params['low_stock_only'] = 'true';
    if (typeof filters?.low_stock_threshold === 'number') {
      params['low_stock_threshold'] = String(
        Math.max(0, Math.floor(filters.low_stock_threshold)),
      );
    }
    this.http
      .get<ProductsListResponse>(
        `/stores/${storeId}/products`,
        { ...this.getAuthHeaders(), params },
      )
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res?.data) ? res.data : [];
          this.productsSignal.set(list.map(normalizeProduct));
        },
        error: () => {
          this.productsSignal.set([]);
        },
      });
  }

  getById(id: string): Product | undefined {
    return this.productsSignal().find((p) => p.id === id);
  }

  /** Fetch product by id (for admin order list enrichment). */
  getByIdApi(id: string): Observable<Product | null> {
    const storeId = this.getStoreId();
    if (!storeId) return of(null);
    return this.http
      .get<Product>(`/stores/${storeId}/products/${id}`, this.getAuthHeaders())
      .pipe(
        map((product) => normalizeProduct(product)),
        catchError(() => of(null)),
      );
  }

  loadById(id: string): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    this.http
      .get<Product>(`/stores/${storeId}/products/${id}`, this.getAuthHeaders())
      .subscribe({
        next: (product) => {
          if (!product) return;
          const normalized = normalizeProduct(product);
          const exists = this.productsSignal().some((p) => p.id === product.id);
          const list = exists
            ? this.productsSignal().map((p) =>
                p.id === product.id ? normalized : p,
              )
            : [...this.productsSignal(), normalized];
          this.productsSignal.set(list);
        },
      });
  }

  add(product: ProductCreatePayload): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    const body = toProductUpdatePayload(product as ProductUpdatePayload);
    this.http
      .post<Product>(
        `/stores/${storeId}/products`,
        body,
        this.getAuthHeaders(true),
      )
      .subscribe({
        next: (created) => {
          if (!created) return;
          const list = [...this.productsSignal(), normalizeProduct(created)];
          this.productsSignal.set(list);
        },
      });
  }

  update(id: string, updates: ProductUpdatePayload): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    const payload = toProductUpdatePayload(updates);
    this.http
      .patch<Product>(
        `/stores/${storeId}/products/${id}`,
        payload,
        this.getAuthHeaders(true),
      )
      .subscribe({
        next: (updated) => {
          if (!updated) return;
          const list = this.productsSignal().map((p) =>
            p.id === id ? normalizeProduct(updated) : p,
          );
          this.productsSignal.set(list);
        },
      });
  }

  delete(id: string): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    this.http
      .delete<void>(
        `/stores/${storeId}/products/${id}`,
        this.getAuthHeaders(true),
      )
      .subscribe({
        next: () => {
          const list = this.productsSignal().filter((p) => p.id !== id);
          this.productsSignal.set(list);
        },
      });
  }
}

function normalizeProduct(p: Product): Product {
  const variants: ProductVariant[] = Array.isArray(p.variants)
    ? p.variants.map(normalizeVariant)
    : [];
  const stockQty =
    typeof p.stock_quantity === 'number' && Number.isFinite(p.stock_quantity)
      ? Math.max(0, Math.floor(p.stock_quantity))
      : 0;
  const threshold =
    typeof p.low_stock_threshold === 'number' &&
    Number.isFinite(p.low_stock_threshold)
      ? Math.max(0, Math.floor(p.low_stock_threshold))
      : 5;
  return {
    ...p,
    price: parseNonNegativeProductPrice(p.price),
    colors: Array.isArray(p.colors) ? p.colors : [],
    sizes: Array.isArray(p.sizes) ? p.sizes : [],
    variants,
    stock_quantity: stockQty,
    low_stock_threshold: threshold,
    in_stock: typeof p.in_stock === 'boolean' ? p.in_stock : stockQty > 0,
    is_low_stock:
      typeof p.is_low_stock === 'boolean'
        ? p.is_low_stock
        : stockQty <= threshold,
  };
}

function normalizeVariant(v: ProductVariant): ProductVariant {
  const stock =
    typeof v.stock_quantity === 'number' && Number.isFinite(v.stock_quantity)
      ? Math.max(0, Math.floor(v.stock_quantity))
      : 0;
  const th =
    typeof v.low_stock_threshold === 'number' &&
    Number.isFinite(v.low_stock_threshold)
      ? Math.max(0, Math.floor(v.low_stock_threshold))
      : 5;
  return {
    id: v.id ? String(v.id) : '',
    color: v.color ?? null,
    size: v.size ?? null,
    price_override: v.price_override ?? null,
    stock_quantity: stock,
    low_stock_threshold: th,
    is_active: v.is_active !== false,
    created_at: v.created_at ? String(v.created_at) : '',
  };
}

function toProductVariantInputBody(
  v: ProductVariantInput,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  row['stock_quantity'] = Math.max(
    0,
    Math.floor(Number(v.stock_quantity) || 0),
  );
  if (v.low_stock_threshold !== undefined) {
    row['low_stock_threshold'] = Math.max(
      0,
      Math.floor(Number(v.low_stock_threshold) || 0),
    );
  }
  if (v.color !== undefined) {
    row['color'] =
      v.color == null || v.color === '' ? null : String(v.color).trim();
  }
  if (v.size !== undefined) {
    row['size'] =
      v.size == null || v.size === '' ? null : String(v.size).trim();
  }
  if (v.price_override !== undefined) {
    const n =
      v.price_override == null ? null : Number(v.price_override);
    row['price_override'] =
      n == null || Number.isNaN(n) ? null : Math.max(0, n);
  }
  if (v.is_active !== undefined) row['is_active'] = v.is_active;
  return row;
}

function toProductUpdatePayload(
  updates: ProductUpdatePayload,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (updates.category_id !== undefined) payload['category_id'] = updates.category_id;
  if (updates.title !== undefined) payload['title'] = updates.title;
  if (updates.description !== undefined) payload['description'] = updates.description;
  if (updates.price !== undefined) payload['price'] = Number(updates.price);
  if (updates.image_url !== undefined) payload['image_url'] = updates.image_url;
  if (updates.colors !== undefined) payload['colors'] = updates.colors;
  if (updates.sizes !== undefined) payload['sizes'] = updates.sizes;
  if (updates.stock_quantity !== undefined) {
    payload['stock_quantity'] = Number(updates.stock_quantity);
  }
  if (updates.low_stock_threshold !== undefined) {
    payload['low_stock_threshold'] = Number(updates.low_stock_threshold);
  }
  if (updates.is_active !== undefined) payload['is_active'] = updates.is_active;
  if (updates.variants !== undefined) {
    payload['variants'] = updates.variants.map(toProductVariantInputBody);
  }
  return payload;
}

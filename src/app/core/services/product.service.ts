import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  BestSellerProduct,
  Product,
  ProductVariant,
  ProductVariantInput,
  ProductCustomization,
  ProductCustomizationInputRow,
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

/** Query params for GET /stores/:storeId/products/best-sellers */
export interface BestSellersFetchOptions {
  /** 1–50; omit to use backend default (10). */
  limit?: number;
  /** If set, only sales from orders in the last N days (1–3650). Omit for all-time. */
  days?: number;
}

/** Matches canonical UUID hex form (same checks as typical store id usage). */
const STORE_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidStoreUuid(storeId: string | null | undefined): boolean {
  return typeof storeId === 'string' && STORE_UUID_REGEX.test(storeId.trim());
}

/** POST body — excludes read-only/top-level computed fields */
export type ProductCreatePayload = Omit<
  Product,
  'id' | 'in_stock' | 'is_low_stock' | 'variants' | 'customizations'
> & {
  variants?: ProductVariantInput[];
  customizations?: ProductCustomizationInputRow[];
};

export type ProductUpdatePayload = Partial<
  Omit<Product, 'id' | 'in_stock' | 'is_low_stock' | 'variants' | 'customizations'>
> & {
  variants?: ProductVariantInput[];
  customizations?: ProductCustomizationInputRow[];
};

@Injectable({ providedIn: 'root' })
export class ProductService {
  private productsSignal = signal<Product[]>([]);
  private bestSellersSignal = signal<BestSellerProduct[]>([]);
  private bestSellersWindowDaysSignal = signal<number | null>(null);

  products = computed(() => this.productsSignal().filter((p) => p.is_active));
  allProducts = this.productsSignal.asReadonly();
  bestSellers = this.bestSellersSignal.asReadonly();
  /** Set when the active best-sellers request used `days`; `null` = all‑time listing. */
  bestSellersWindowDays = this.bestSellersWindowDaysSignal.asReadonly();

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

  /**
   * Public storefront bestsellers. Preserves API order by units_sold descending.
   * Non-2xx clears the list (same pattern as listing errors).
   */
  refreshBestSellers(opts?: BestSellersFetchOptions): void {
    const storeId = this.getStoreId();
    if (!storeId || !isValidStoreUuid(storeId)) {
      this.bestSellersSignal.set([]);
      this.bestSellersWindowDaysSignal.set(null);
      return;
    }

    let windowDays: number | null = null;
    if (opts?.days != null) {
      windowDays = Math.min(3650, Math.max(1, Math.floor(Number(opts.days))));
    }

    const params: Record<string, string> = {};
    if (opts?.limit != null) {
      const limit = Math.min(50, Math.max(1, Math.floor(Number(opts.limit))));
      params['limit'] = String(limit);
    }
    if (windowDays !== null) {
      params['days'] = String(windowDays);
    }

    this.http
      .get<Product[]>(`/stores/${storeId}/products/best-sellers`, {
        ...this.getAuthHeaders(),
        params,
      })
      .subscribe({
        next: (rows) => {
          const list = Array.isArray(rows) ? rows : [];
          this.bestSellersSignal.set(list.map(normalizeBestSellerRow));
          this.bestSellersWindowDaysSignal.set(windowDays);
        },
        error: () => {
          this.bestSellersSignal.set([]);
          this.bestSellersWindowDaysSignal.set(null);
        },
      });
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

  /** Emits normalized product and updates local cache on success only. */
  add(product: ProductCreatePayload): Observable<Product> {
    const storeId = this.getStoreId();
    if (!storeId) {
      return throwError(
        () =>
          new Error(
            'تعذر تحديد المتجر. سجّل الدخول بحساب له متجر أو اضبط معرّف المتجر.',
          ),
      );
    }
    const body = toProductUpdatePayload(product as ProductUpdatePayload);
    return this.http
      .post<Product>(
        `/stores/${storeId}/products`,
        body,
        this.getAuthHeaders(true),
      )
      .pipe(
        map((created) => {
          if (!created) {
            throw new Error('لم يُعد الخادم أي بيانات للمنتج.');
          }
          return normalizeProduct(created);
        }),
        tap((normalized) => {
          this.productsSignal.set([...this.productsSignal(), normalized]);
        }),
      );
  }

  /** Emits normalized product and updates local cache on success only. */
  update(id: string, updates: ProductUpdatePayload): Observable<Product> {
    const storeId = this.getStoreId();
    if (!storeId) {
      return throwError(
        () =>
          new Error(
            'تعذر تحديد المتجر. سجّل الدخول بحساب له متجر أو اضبط معرّف المتجر.',
          ),
      );
    }
    const payload = toProductUpdatePayload(updates);
    return this.http
      .patch<Product>(
        `/stores/${storeId}/products/${id}`,
        payload,
        this.getAuthHeaders(true),
      )
      .pipe(
        map((updated) => {
          if (!updated) {
            throw new Error('لم يُعد الخادم أي بيانات للمنتج.');
          }
          return normalizeProduct(updated);
        }),
        tap((normalized) => {
          this.productsSignal.set(
            this.productsSignal().map((p) => (p.id === id ? normalized : p)),
          );
        }),
      );
  }

  /** Deletes on server and updates local cache only after a successful response. */
  delete(id: string): Observable<void> {
    const storeId = this.getStoreId();
    if (!storeId) {
      return throwError(
        () =>
          new Error(
            'تعذر تحديد المتجر. سجّل الدخول بحساب له متجر أو اضبط معرّف المتجر.',
          ),
      );
    }
    return this.http
      .delete<void>(`/stores/${storeId}/products/${id}`, this.getAuthHeaders(true))
      .pipe(
        tap(() => {
          this.productsSignal.set(
            this.productsSignal().filter((p) => p.id !== id),
          );
        }),
      );
  }
}

function normalizeCustomization(c: Partial<ProductCustomization>): ProductCustomization {
  const kind: ProductCustomization['kind'] =
    c.kind === 'IMAGE' ? 'IMAGE' : 'TEXT';
  const sort_order =
    typeof c.sort_order === 'number' && Number.isFinite(c.sort_order)
      ? c.sort_order
      : 0;
  let max_chars: number | null = null;
  let text_mode: ProductCustomization['text_mode'] = null;
  if (kind === 'TEXT') {
    const mc =
      typeof c.max_chars === 'number' && Number.isFinite(c.max_chars)
        ? Math.max(1, Math.floor(c.max_chars))
        : 80;
    max_chars = mc;
    text_mode =
      c.text_mode === 'SINGLE_WORD' ? 'SINGLE_WORD' : 'SENTENCE';
  }
  return {
    id: c.id ? String(c.id).trim() : '',
    label: (c.label ?? '').trim(),
    sort_order,
    kind,
    required: c.required === true,
    max_chars,
    text_mode,
  };
}

function normalizeBestSellerRow(
  raw: Product & { units_sold?: unknown },
): BestSellerProduct {
  const base = normalizeProduct(raw);
  const u = raw.units_sold;
  const units_sold =
    typeof u === 'number' && Number.isFinite(u)
      ? Math.max(0, Math.floor(u))
      : 0;
  return { ...base, units_sold };
}

function normalizeProduct(p: Product): Product {
  const variants: ProductVariant[] = Array.isArray(p.variants)
    ? p.variants.map(normalizeVariant)
    : [];
  const customizations: ProductCustomization[] = Array.isArray(
    (p as { customizations?: unknown }).customizations,
  )
    ? ((p as { customizations?: ProductCustomization[] }).customizations ??
        [])
        .map((x) =>
          normalizeCustomization(
            typeof x === 'object' && x !== null
              ? (x as ProductCustomization)
              : {},
          ),
        )
        .filter((c) => c.id !== '')
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
    customizations:
      customizations.length > 0 ? customizations : undefined,
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

function toCustomizationPayloadBody(
  row: ProductCustomizationInputRow,
  indexFallback: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    label: String(row.label ?? '').trim(),
    kind: row.kind === 'IMAGE' ? 'IMAGE' : 'TEXT',
    required: row.required === true,
    sort_order:
      typeof row.sort_order === 'number' && Number.isFinite(row.sort_order)
        ? row.sort_order
        : indexFallback,
  };
  if (row.id?.trim()) out['id'] = row.id.trim();
  if (row.kind === 'TEXT') {
    const mc =
      typeof row.max_chars === 'number' && Number.isFinite(row.max_chars)
        ? Math.max(1, Math.floor(row.max_chars))
        : 80;
    out['max_chars'] = mc;
    out['text_mode'] =
      row.text_mode === 'SINGLE_WORD' ? 'SINGLE_WORD' : 'SENTENCE';
  }
  return out;
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
  if (updates.customizations !== undefined) {
    payload['customizations'] = updates.customizations.map((row, i) =>
      toCustomizationPayloadBody(row, i),
    );
  }
  return payload;
}

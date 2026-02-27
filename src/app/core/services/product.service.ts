import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Product, ProductApi, productFromApi, productToApiBody } from '../models/product.model';
import { AuthService } from './auth.service';

const DEFAULT_STORE_ID = 'e0a4703a-e743-4b18-ae6a-4df83f768282';

/** API response for GET /stores/{storeId}/products */
interface ProductsListResponse {
  data: ProductApi[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private productsSignal = signal<Product[]>([]);

  products = computed(() => this.productsSignal().filter((p) => p.isActive));
  allProducts = this.productsSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {
    this.refresh();
  }

  private getStoreId(): string | null {
    const user = this.auth.user();
    if (user?.store_id) return user.store_id;
    return DEFAULT_STORE_ID;
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

  refresh(): void {
    const storeId = this.getStoreId();
    if (!storeId) {
      this.productsSignal.set([]);
      return;
    }
    this.http.get<ProductsListResponse>(`/stores/${storeId}/products`, this.getAuthHeaders()).subscribe({
        next: (res) => {
          const list = Array.isArray(res?.data) ? res.data : [];
          this.productsSignal.set(list.map(productFromApi));
        },
        error: () => {
          this.productsSignal.set([]);
        },
      });
  }

  getById(id: string): Product | undefined {
    return this.productsSignal().find((p) => p.id === id);
  }

  loadById(id: string): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    this.http
      .get<ProductApi>(`/stores/${storeId}/products/${id}`, this.getAuthHeaders())
      .subscribe({
        next: (api) => {
          if (!api) return;
          const product = productFromApi(api);
          const exists = this.productsSignal().some((p) => p.id === product.id);
          const list = exists
            ? this.productsSignal().map((p) => (p.id === product.id ? product : p))
            : [...this.productsSignal(), product];
          this.productsSignal.set(list);
        },
      });
  }

  add(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    const body = productToApiBody(product);
    this.http
      .post<ProductApi>(`/stores/${storeId}/products`, body, this.getAuthHeaders(true))
      .subscribe({
        next: (created) => {
          if (!created) return;
          const list = [...this.productsSignal(), productFromApi(created)];
          this.productsSignal.set(list);
        },
      });
  }

  update(id: string, updates: Partial<Product>): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    const current = this.productsSignal().find((p) => p.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    const body = productToApiBody(merged);
    this.http
      .post<ProductApi>(`/stores/${storeId}/products/${id}`, body, this.getAuthHeaders(true))
      .subscribe({
        next: (updated) => {
          if (!updated) return;
          const list = this.productsSignal().map((p) =>
            p.id === id ? productFromApi(updated) : p
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
        this.getAuthHeaders(true)
      )
      .subscribe({
        next: () => {
          const list = this.productsSignal().filter((p) => p.id !== id);
          this.productsSignal.set(list);
        },
      });
  }
}

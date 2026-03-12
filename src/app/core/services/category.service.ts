import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Category } from '../models/category.model';
import { AuthService } from './auth.service';

interface CategoriesListResponse {
  data?: Category[];
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private categoriesSignal = signal<Category[]>([]);

  categories = this.categoriesSignal.asReadonly();

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
      this.categoriesSignal.set([]);
      return;
    }
    this.http
      .get<
        Category[] | CategoriesListResponse
      >(`/stores/${storeId}/categories`, this.getAuthHeaders())
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res)
            ? res
            : Array.isArray((res as CategoriesListResponse).data)
              ? (res as CategoriesListResponse).data!
              : [];
          this.categoriesSignal.set(list.map(normalizeCategory));
        },
        error: () => this.categoriesSignal.set([]),
      });
  }

  add(category: Omit<Category, 'id'>): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    this.http
      .post<Category>(
        `/stores/${storeId}/categories`,
        toApiBody(category),
        this.getAuthHeaders(),
      )
      .subscribe({
        next: () => this.refresh(),
        error: () => {},
      });
  }

  update(id: string, updates: Partial<Category>): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    this.http
      .patch<Category>(
        `/stores/${storeId}/categories/${id}`,
        toApiBody(updates),
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
        `/stores/${storeId}/categories/${id}`,
        this.getAuthHeaders(),
      )
      .subscribe({
        next: () => this.refresh(),
        error: () => {},
      });
  }
}

function normalizeCategory(c: Category): Category {
  return {
    id: c.id,
    name: c.name ?? '',
    slug: c.slug ?? '',
    parent_id: c.parent_id ?? null,
    is_active: c.is_active !== false,
  };
}

function toApiBody(c: Partial<Category>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (c.name !== undefined) body['name'] = String(c.name).trim();
  if (c.slug !== undefined) body['slug'] = String(c.slug).trim();
  if (c.parent_id !== undefined) {
    const v = c.parent_id?.trim();
    body['parent_id'] = v || null;
  }
  if (c.is_active !== undefined) body['is_active'] = c.is_active;
  return body;
}

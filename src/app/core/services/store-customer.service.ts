import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { StoreCustomerResponse, CreateStoreCustomerDto } from '../models/customer.model';
import { Address, CreateAddressDto } from '../models/address.model';

@Injectable({ providedIn: 'root' })
export class StoreCustomerService {
  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  private getStoreId(): string {
    return environment.storeId ?? '';
  }

  /** Auth headers when caller is admin (token present). Omitted for storefront. */
  private getAuthHeaders(): { headers?: HttpHeaders } {
    const token = this.auth.getAccessToken();
    if (!token) return {};
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  /**
   * Get customer by phone. Returns the customer or null if not found (404).
   * When 404 is returned, the checkout flow treats the user as a new customer
   * and will create the customer (and address) on order submit.
   */
  getCustomerByPhone(phone: string): Observable<StoreCustomerResponse | null> {
    const storeId = this.getStoreId();
    if (!storeId) return of(null);
    const normalized = phone.replace(/\D/g, '');
    return this.http
      .get<StoreCustomerResponse>(
        `/stores/${storeId}/customers/by-phone`,
        { params: { phone: normalized } }
      )
      .pipe(catchError(() => of(null)));
  }

  /**
   * List store customers (admin). Uses auth. Supports { data: [] } or array response.
   */
  listCustomers(params?: { page?: number; limit?: number }): Observable<StoreCustomerResponse[]> {
    const storeId = this.getStoreId();
    if (!storeId) return of([]);
    const httpParams: Record<string, string> = {};
    if (params?.page != null) httpParams['page'] = String(params.page);
    if (params?.limit != null) httpParams['limit'] = String(params.limit);
    return this.http
      .get<StoreCustomerResponse[] | { data?: StoreCustomerResponse[] }>(
        `/stores/${storeId}/customers`,
        { ...this.getAuthHeaders(), params: httpParams },
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data ?? [])),
        catchError(() => of([])),
      );
  }

  /**
   * Get customer by id (for admin order list enrichment). Uses auth when available.
   */
  getCustomerById(customerId: string): Observable<StoreCustomerResponse | null> {
    const storeId = this.getStoreId();
    if (!storeId) return of(null);
    return this.http
      .get<StoreCustomerResponse>(
        `/stores/${storeId}/customers/${customerId}`,
        this.getAuthHeaders(),
      )
      .pipe(catchError(() => of(null)));
  }

  /**
   * Get addresses for a customer. Uses auth when available (e.g. admin).
   */
  getAddresses(customerId: string): Observable<Address[]> {
    const storeId = this.getStoreId();
    if (!storeId) return of([]);
    return this.http
      .get<Address[] | { data?: Address[] }>(
        `/stores/${storeId}/customers/${customerId}/addresses`,
        this.getAuthHeaders(),
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data ?? [])),
        catchError(() => of([])),
      );
  }

  /**
   * Update customer (admin). PATCH /stores/:storeId/customers/:id.
   */
  updateCustomer(
    customerId: string,
    dto: Partial<{ full_name: string; email: string }>,
  ): Observable<StoreCustomerResponse | null> {
    const storeId = this.getStoreId();
    if (!storeId) return of(null);
    return this.http
      .patch<StoreCustomerResponse>(
        `/stores/${storeId}/customers/${customerId}`,
        dto,
        this.getAuthHeaders(),
      )
      .pipe(catchError(() => of(null)));
  }

  /**
   * Register a new customer. Returns the created customer with id.
   */
  createCustomer(dto: CreateStoreCustomerDto): Observable<StoreCustomerResponse | null> {
    const storeId = this.getStoreId();
    if (!storeId) return of(null);
    return this.http
      .post<StoreCustomerResponse>(`/stores/${storeId}/customers`, dto)
      .pipe(catchError(() => of(null)));
  }

  /**
   * Add an address for a customer. Returns the created address with id.
   */
  createAddress(customerId: string, dto: CreateAddressDto): Observable<Address | null> {
    const storeId = this.getStoreId();
    if (!storeId) return of(null);
    return this.http
      .post<Address>(`/stores/${storeId}/customers/${customerId}/addresses`, dto)
      .pipe(catchError(() => of(null)));
  }
}

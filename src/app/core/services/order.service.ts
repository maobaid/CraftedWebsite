import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Order, OrderStatus, OrderResponse, CreateOrderDto } from '../models/order.model';
import { Customer } from '../models/customer.model';
import { AuthService } from './auth.service';
import { StoreCustomerService } from './store-customer.service';
import { ProductService } from './product.service';
import { CartItem, Product } from '../models/product.model';
import { Address, formatAddressLine } from '../models/address.model';
import { environment } from '../../../environments/environment';
const ORDERS_KEY = 'crafted_orders';
const CUSTOMERS_KEY = 'crafted_customers';

interface OrdersListResponse {
  data?: OrderResponse[];
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private ordersSignal = signal<Order[]>([]);
  private customersSignal = signal<Customer[]>(this.loadCustomers());

  orders = this.ordersSignal.asReadonly();
  customers = this.customersSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private storeCustomer: StoreCustomerService,
    private productService: ProductService,
  ) {}

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

  private loadCustomers(): Customer[] {
    try {
      const raw = localStorage.getItem(CUSTOMERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  private persistCustomers(list: Customer[]): void {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list));
  }

  /** Fetch orders from backend and update the orders signal. */
  refreshOrders(): void {
    const storeId = this.getStoreId();
    if (!storeId) {
      this.ordersSignal.set([]);
      return;
    }
    this.http
      .get<OrderResponse[] | OrdersListResponse>(
        `/stores/${storeId}/orders`,
        this.getAuthHeaders(),
      )
      .pipe(
        map((res) => {
          return Array.isArray(res)
            ? res
            : Array.isArray((res as OrdersListResponse).data)
              ? (res as OrdersListResponse).data!
              : [];
        }),
        switchMap((list) => {
          const orders = list as OrderResponse[];
          const customerIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))] as string[];
          const productIds = [...new Set(orders.flatMap((o) => (o.items ?? []).map((it) => it.product_id).filter(Boolean)))];
          return forkJoin({
            customers: customerIds.length
              ? forkJoin(customerIds.map((id) => this.storeCustomer.getCustomerById(id)))
              : of([]),
            addresses: customerIds.length
              ? forkJoin(customerIds.map((id) => this.storeCustomer.getAddresses(id)))
              : of([]),
            products: productIds.length
              ? forkJoin(productIds.map((id) => this.productService.getByIdApi(id)))
              : of([]),
          }).pipe(
            map(({ customers, addresses, products }) => {
              const customerMap = new Map<string, (typeof customers)[0]>();
              const addressMap = new Map<string, Address[]>();
              const productMap = new Map<string, Product | null>();
              customerIds.forEach((id, i) => customerMap.set(id, customers[i]));
              customerIds.forEach((id, i) => addressMap.set(id, addresses[i] ?? []));
              productIds.forEach((id, i) => productMap.set(id, products[i] ?? null));
              const enriched = orders.map((o) => {
                const cust = o.customer_id ? customerMap.get(o.customer_id) : null;
                const addrs = o.customer_id ? addressMap.get(o.customer_id) : [];
                const addr = o.address_id && addrs?.length ? addrs.find((a) => a.id === o.address_id) : null;
                const addressLine = addr ? formatAddressLine(addr) : undefined;
                const customer = cust
                  ? {
                      full_name: cust.full_name,
                      phone: (cust as { phone?: string }).phone ?? cust.phone_number,
                      email: cust.email,
                      address: addressLine,
                    }
                  : undefined;
                const items = (o.items ?? []).map((it) => ({
                  ...it,
                  product_title: productMap.get(it.product_id)?.title ?? it.product_title,
                }));
                return { ...o, customer, address: addressLine, items } as OrderResponse;
              });
              return enriched.map(apiOrderToOrder);
            }),
          );
        }),
      )
      .subscribe({
        next: (orders) => this.ordersSignal.set(orders),
        error: () => this.ordersSignal.set([]),
      });
  }

  /**
   * Create order via API (storefront checkout). Uses environment.storeId; no auth.
   * Returns the created order or null on error.
   */
  createOrderApi(dto: CreateOrderDto): Observable<OrderResponse | null> {
    const storeId = environment.storeId ?? this.getStoreId();
    if (!storeId) return of(null);
    return this.http
      .post<OrderResponse>(`/stores/${storeId}/orders`, dto)
      .pipe(catchError(() => of(null)));
  }

  /** Update order status via API. */
  updateOrderStatus(id: string, status: OrderStatus): void {
    const storeId = this.getStoreId();
    if (!storeId) return;
    this.http
      .patch(
        `/stores/${storeId}/orders/${id}`,
        { status },
        this.getAuthHeaders(),
      )
      .subscribe({
        next: () => this.refreshOrders(),
        error: () => {},
      });
  }

  createOrder(order: Omit<Order, 'id' | 'createdAt'>): Order {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newOrder: Order = { ...order, id, createdAt: now };
    const list = [...this.ordersSignal(), newOrder];
    this.ordersSignal.set(list);

    const phone = order.customer.phone;
    let customers = this.customersSignal();
    let customer = customers.find((c) => c.phone === phone);
    if (!customer) {
      customer = {
        id: crypto.randomUUID(),
        phone: order.customer.phone,
        fullName: order.customer.fullName,
        email: order.customer.email,
        address: order.customer.address,
        createdAt: now,
      };
      customers = [...customers, customer];
      this.customersSignal.set(customers);
      this.persistCustomers(customers);
    } else if (order.customer.address && !customer.address) {
      customer = {
        ...customer,
        address: order.customer.address,
        updatedAt: now,
      };
      customers = customers.map((c) => (c.id === customer!.id ? customer! : c));
      this.customersSignal.set(customers);
      this.persistCustomers(customers);
    }

    return newOrder;
  }

  getOrdersByStatus(status: OrderStatus): Order[] {
    return this.ordersSignal().filter((o) => o.status === status);
  }

  getCustomerByPhone(phone: string): Customer | undefined {
    return this.customersSignal().find((c) => c.phone === phone);
  }

  updateCustomer(id: string, updates: Partial<Customer>): void {
    const list = this.customersSignal().map((c) =>
      c.id === id
        ? { ...c, ...updates, updatedAt: new Date().toISOString() }
        : c,
    );
    this.customersSignal.set(list);
    this.persistCustomers(list);
  }
}

function parseNum(v: string | number | undefined | null): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(s: string | undefined): Order['status'] {
  const lower = (s ?? 'pending').toLowerCase();
  if (lower === 'pending' || lower === 'confirmed' || lower === 'shipped' || lower === 'delivered') return lower;
  return 'pending';
}

function apiOrderToOrder(api: OrderResponse): Order {
  const addrLine =
    typeof api.address === 'string'
      ? api.address
      : api.address && typeof api.address === 'object' && 'line' in api.address
        ? String((api.address as { line?: string }).line)
        : undefined;
  const customer = api.customer
    ? {
        phone: api.customer.phone ?? '',
        fullName: api.customer.full_name ?? api.customer.phone ?? '—',
        email: api.customer.email,
        address: api.customer.address ?? addrLine,
      }
    : {
        phone: '—',
        fullName: '—',
        email: undefined,
        address: addrLine,
      };

  const items: CartItem[] = (api.items ?? []).map((it) => ({
    product: {
      id: it.product_id,
      category_id: null,
      title: it.product_title ?? '—',
      description: null,
      price: parseNum(it.product_price ?? it.unit_price),
      image_url: null,
      is_active: true,
    },
    quantity: it.quantity ?? 1,
  }));

  const created_at = api.created_at ?? new Date().toISOString();
  const updated_at = api.updated_at;
  const total = parseNum(api.total ?? api.total_amount);
  const subtotal = api.subtotal != null ? Number(api.subtotal) : total;

  return {
    id: api.id,
    customerId: api.customer_id,
    customer,
    items,
    subtotal,
    total,
    status: normalizeStatus(api.status),
    deliveryMessage: api.scheduled_delivery
      ? formatScheduledDelivery(api.scheduled_delivery)
      : undefined,
    discountCode: api.coupon_code,
    discountAmount: parseNum(api.discount_amount ?? api.total_coupon_discount_amount),
    productDiscountAmount: parseNum(api.total_product_discount_amount),
    createdAt: created_at,
    updatedAt: updated_at,
  };
}

function formatScheduledDelivery(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ar-KW', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

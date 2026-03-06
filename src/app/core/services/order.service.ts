import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Order, OrderStatus, OrderResponse } from '../models/order.model';
import { Customer } from '../models/customer.model';
import { AuthService } from './auth.service';
import { CartItem } from '../models/product.model';

const DEFAULT_STORE_ID = 'e2de7aa8-72ce-45e5-a9c2-9e6613101f82';
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
  ) {
    this.refreshOrders();
  }

  private getStoreId(): string | null {
    const user = this.auth.user();
    if (user?.store_id) return user.store_id;
    return DEFAULT_STORE_ID;
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
      .get<
        OrderResponse[] | OrdersListResponse
      >(`/stores/${storeId}/orders`, this.getAuthHeaders())
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res)
            ? res
            : Array.isArray((res as OrdersListResponse).data)
              ? (res as OrdersListResponse).data!
              : [];
          this.ordersSignal.set(list.map(apiOrderToOrder));
        },
        error: () => this.ordersSignal.set([]),
      });
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
      price: it.product_price ?? 0,
      image_url: null,
      is_active: true,
    },
    quantity: it.quantity ?? 1,
  }));

  const created_at = api.created_at ?? new Date().toISOString();
  const updated_at = api.updated_at;

  return {
    id: api.id,
    customerId: api.customer_id,
    customer,
    items,
    subtotal: api.subtotal ?? 0,
    total: api.total ?? 0,
    status: api.status ?? 'pending',
    deliveryMessage: api.scheduled_delivery
      ? formatScheduledDelivery(api.scheduled_delivery)
      : undefined,
    discountCode: api.coupon_code,
    discountAmount: api.discount_amount,
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

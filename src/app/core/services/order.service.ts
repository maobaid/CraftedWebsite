import { Injectable, signal } from '@angular/core';
import { Order, OrderStatus } from '../models/order.model';
import { Customer } from '../models/customer.model';

const ORDERS_KEY = 'crafted_orders';
const CUSTOMERS_KEY = 'crafted_customers';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private ordersSignal = signal<Order[]>(this.loadOrders());
  private customersSignal = signal<Customer[]>(this.loadCustomers());

  orders = this.ordersSignal.asReadonly();
  customers = this.customersSignal.asReadonly();

  private loadOrders(): Order[] {
    try {
      const raw = localStorage.getItem(ORDERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
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

  private persistOrders(list: Order[]): void {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
  }

  private persistCustomers(list: Customer[]): void {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list));
  }

  createOrder(order: Omit<Order, 'id' | 'createdAt'>): Order {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newOrder: Order = { ...order, id, createdAt: now };
    const list = [...this.ordersSignal(), newOrder];
    this.ordersSignal.set(list);
    this.persistOrders(list);

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
      customer = { ...customer, address: order.customer.address, updatedAt: now };
      customers = customers.map((c) => (c.id === customer!.id ? customer! : c));
      this.customersSignal.set(customers);
      this.persistCustomers(customers);
    }

    return newOrder;
  }

  updateOrderStatus(id: string, status: OrderStatus): void {
    const list = this.ordersSignal().map((o) =>
      o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o
    );
    this.ordersSignal.set(list);
    this.persistOrders(list);
  }

  getOrdersByStatus(status: OrderStatus): Order[] {
    return this.ordersSignal().filter((o) => o.status === status);
  }

  getCustomerByPhone(phone: string): Customer | undefined {
    return this.customersSignal().find((c) => c.phone === phone);
  }

  updateCustomer(id: string, updates: Partial<Customer>): void {
    const list = this.customersSignal().map((c) =>
      c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    );
    this.customersSignal.set(list);
    this.persistCustomers(list);
  }
}

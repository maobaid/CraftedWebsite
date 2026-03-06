import { Component, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { OrderStatus } from '../../../core/models/order.model';
import { getProductPrice } from '../../../core/models/product.model';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './admin-orders.component.html',
})
export class AdminOrdersComponent {
  statusFilter = signal<OrderStatus | 'all'>('all');
  orders = computed(() => {
    const all = this.orderService.orders();
    const filter = this.statusFilter();
    if (filter === 'all') return all;
    return all.filter((o) => o.status === filter);
  });

  constructor(public orderService: OrderService) {
    this.orderService.refreshOrders();
  }

  getProductPrice = getProductPrice;

  setFilter(s: OrderStatus | 'all'): void {
    this.statusFilter.set(s);
  }

  updateStatus(orderId: string, status: OrderStatus): void {
    this.orderService.updateOrderStatus(orderId, status);
  }

  statusLabel(s: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      pending: 'قيد الانتظار',
      confirmed: 'تم التأكيد',
      shipped: 'تم الشحن',
      delivered: 'تم التوصيل',
    };
    return map[s];
  }
}

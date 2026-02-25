import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { Customer } from '../../../core/models/customer.model';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-customers.component.html',
})
export class AdminCustomersComponent {
  search = signal('');
  editingId: string | null = null;
  editForm = { fullName: '', email: '', address: '' };

  constructor(public orderService: OrderService) {}

  get filteredCustomers(): Customer[] {
    const q = this.search().trim().toLowerCase();
    const list = this.orderService.customers();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }

  openEdit(c: Customer): void {
    this.editingId = c.id;
    this.editForm = {
      fullName: c.fullName,
      email: c.email ?? '',
      address: c.address ?? '',
    };
  }

  saveEdit(): void {
    if (!this.editingId) return;
    this.orderService.updateCustomer(this.editingId, this.editForm);
    this.editingId = null;
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  getOrdersForCustomer(c: Customer): number {
    return this.orderService.orders().filter((o) => o.customer.phone === c.phone).length;
  }
}

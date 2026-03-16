import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { StoreCustomerService } from '../../../core/services/store-customer.service';
import { StoreCustomerResponse } from '../../../core/models/customer.model';
import { Address, formatAddressLine } from '../../../core/models/address.model';

/** Row shape for admin customers table (id from API, display fields). */
export interface AdminCustomerRow {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
}

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [FormsModule, NgClass, RouterLink],
  templateUrl: './admin-customers.component.html',
})
export class AdminCustomersComponent implements OnInit {
  search = signal('');
  customers = signal<AdminCustomerRow[]>([]);
  loading = signal(true);
  loadError = signal('');
  editingId: string | null = null;
  editForm = { fullName: '', email: '', address: '' };
  saving = signal(false);
  /** Expanded row: show details (addresses, orders). */
  expandedId = signal<string | null>(null);
  /** Addresses for the expanded customer. */
  expandedAddresses = signal<Address[]>([]);
  expandedAddressesLoading = signal(false);

  private orderService = inject(OrderService);
  private storeCustomer = inject(StoreCustomerService);

  filteredCustomers = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.customers();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)),
    );
  });

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.storeCustomer.listCustomers().subscribe({
      next: (list) => {
        const rows: AdminCustomerRow[] = list.map((c) => {
          const api = c as StoreCustomerResponse & { phone?: string };
          return {
            id: c.id,
            fullName: (c.full_name ?? '').trim() || '—',
            phone: api.phone ?? c.phone_number ?? '—',
            email: c.email ?? '',
            address: '—',
          };
        });
        this.customers.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('فشل تحميل العملاء');
        this.loading.set(false);
      },
    });
  }

  openEdit(c: AdminCustomerRow): void {
    this.editingId = c.id;
    this.editForm = {
      fullName: c.fullName,
      email: c.email ?? '',
      address: c.address ?? '',
    };
  }

  saveEdit(): void {
    const id = this.editingId;
    if (!id) return;
    this.saving.set(true);
    this.storeCustomer
      .updateCustomer(id, {
        full_name: this.editForm.fullName.trim() || undefined,
        email: this.editForm.email.trim() || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.editingId = null;
          if (updated) this.loadCustomers();
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  getOrdersForCustomer(c: AdminCustomerRow): number {
    return this.orderService.orders().filter((o) => o.customerId === c.id).length;
  }

  toggleExpand(c: AdminCustomerRow): void {
    if (this.editingId === c.id) return;
    const current = this.expandedId();
    if (current === c.id) {
      this.expandedId.set(null);
      this.expandedAddresses.set([]);
      return;
    }
    this.expandedId.set(c.id);
    this.expandedAddresses.set([]);
    this.expandedAddressesLoading.set(true);
    this.storeCustomer.getAddresses(c.id).subscribe({
      next: (addrs) => {
        this.expandedAddresses.set(addrs);
        this.expandedAddressesLoading.set(false);
      },
      error: () => this.expandedAddressesLoading.set(false),
    });
  }

  formatAddressLine = formatAddressLine;
}

import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { Order, OrderStatus } from '../../../core/models/order.model';
import { getProductPrice } from '../../../core/models/product.model';
import { DEFAULT_PRODUCT_IMAGE } from '../../../core/models/product.model';
import { HeroIconComponent } from '../../../shared/icons/hero-icon.component';
import { AuthService } from '../../../core/services/auth.service';
import { parseApiErrorMessage } from '../../../core/utils/http-error.util';
import { triggerPdfDownload } from '../../../core/utils/file-download.util';

type ToastType = 'success' | 'error';
interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [DatePipe, HeroIconComponent],
  templateUrl: './admin-orders.component.html',
})
export class AdminOrdersComponent implements OnInit {
  search = signal('');
  statusFilter = signal<OrderStatus | 'all'>('all');
  /** When set (e.g. from /admin/orders?customerId=xxx), only show this customer's orders. */
  customerIdFilter = signal<string | null>(null);

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private toastCounter = 0;
  receiptResendLoading = signal<Record<string, boolean>>({});
  receiptDownloadLoading = signal<Record<string, boolean>>({});
  toasts = signal<ToastMessage[]>([]);

  orders = computed(() => {
    let all = this.orderService.orders();
    const customerId = this.customerIdFilter();
    if (customerId) {
      all = all.filter((o) => o.customerId === customerId);
    }
    const q = this.search().trim().toLowerCase();
    const filter = this.statusFilter();
    return all.filter((o) => {
      if (q) {
        const inId = (o.id ?? '').toLowerCase().includes(q);
        const inName = (o.customer?.fullName ?? '').toLowerCase().includes(q);
        const inPhone = (o.customer?.phone ?? '').includes(q);
        const inAddress = (o.customer?.address ?? '').toLowerCase().includes(q);
        const inCode = (o.discountCode ?? '').toLowerCase().includes(q);
        if (!inId && !inName && !inPhone && !inAddress && !inCode) return false;
      }
      if (filter !== 'all' && o.status !== filter) return false;
      return true;
    });
  });

  constructor(public orderService: OrderService) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const id = params['customerId'] ?? null;
      this.customerIdFilter.set(id);
      // We filter by customer ID only (no search pre-fill) so duplicate customer names stay unambiguous.
    });
  }

  /** Clear customer filter and search, show all orders. */
  clearCustomerFilter(): void {
    this.customerIdFilter.set(null);
    this.search.set('');
    this.router.navigate(['/admin/orders']);
  }

  getProductPrice = getProductPrice;
  get canManageReceipts(): boolean {
    const role = (this.auth.user()?.role ?? '').toUpperCase();
    return role === 'STORE_ADMIN' || role === 'STORE_MANAGER';
  }

  setFilter(s: OrderStatus | 'all'): void {
    this.statusFilter.set(s);
  }

  updateStatus(orderId: string, status: OrderStatus): void {
    this.orderService.updateOrderStatus(orderId, status);
  }

  statusLabel(s: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      PENDING: 'قيد الانتظار',
      CONFIRMED: 'تم التأكيد',
      SHIPPED: 'تم الشحن',
      DELIVERED: 'تم التوصيل',
    };
    return map[s];
  }

  readonly storeName = 'متجر كرافتد';
  readonly storeLogoPath = '/logo.PNG';
  readonly defaultProductImage = DEFAULT_PRODUCT_IMAGE;

  private getStoreId(): string | null {
    return this.auth.user()?.store_id ?? null;
  }

  private setOrderActionLoading(
    source: typeof this.receiptDownloadLoading | typeof this.receiptResendLoading,
    orderId: string,
    loading: boolean,
  ): void {
    source.update((state) => ({
      ...state,
      [orderId]: loading,
    }));
  }

  isResendingReceipt(orderId: string): boolean {
    return !!this.receiptResendLoading()[orderId];
  }

  isDownloadingReceipt(orderId: string): boolean {
    return !!this.receiptDownloadLoading()[orderId];
  }

  private showToast(message: string, type: ToastType): void {
    const id = ++this.toastCounter;
    this.toasts.update((list) => [...list, { id, message, type }]);
    setTimeout(() => {
      this.toasts.update((list) => list.filter((t) => t.id !== id));
    }, 3500);
  }

  async resendReceipt(orderId: string): Promise<void> {
    const storeId = this.getStoreId();
    if (!storeId) {
      this.showToast('تعذر تحديد المتجر لهذا الحساب', 'error');
      return;
    }
    this.setOrderActionLoading(this.receiptResendLoading, orderId, true);
    try {
      const res = await this.orderService.resendOrderReceipt(storeId, orderId);
      this.showToast(
        res.message?.trim() || 'Receipt resent successfully',
        'success',
      );
    } catch (err) {
      this.showToast(
        parseApiErrorMessage(err, 'فشل إعادة إرسال الإيصال عبر واتساب'),
        'error',
      );
    } finally {
      this.setOrderActionLoading(this.receiptResendLoading, orderId, false);
    }
  }

  async downloadReceipt(orderId: string): Promise<void> {
    const storeId = this.getStoreId();
    if (!storeId) {
      this.showToast('تعذر تحديد المتجر لهذا الحساب', 'error');
      return;
    }
    this.setOrderActionLoading(this.receiptDownloadLoading, orderId, true);
    try {
      const blob = await this.orderService.downloadOrderReceipt(storeId, orderId);
      triggerPdfDownload(blob, `receipt-${orderId}.pdf`);
      this.showToast('تم تنزيل الإيصال بنجاح', 'success');
    } catch (err) {
      this.showToast(parseApiErrorMessage(err, 'فشل تنزيل الإيصال'), 'error');
    } finally {
      this.setOrderActionLoading(this.receiptDownloadLoading, orderId, false);
    }
  }

  printReceipt(order: Order): void {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const esc = (s: string | undefined | null) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const attrEsc = (s: string) => String(s).replace(/"/g, '&quot;');
    const logoUrl = origin + this.storeLogoPath;
    const imgUrl = (path: string) =>
      path.startsWith('http')
        ? path
        : origin + (path.startsWith('/') ? path : '/' + path);

    const created = order.createdAt
      ? new Date(order.createdAt).toLocaleString('ar-KW', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : '—';

    const rows = order.items
      .map((item) => {
        const price = getProductPrice(item.product);
        const lineTotal = price * item.quantity;
        const src = imgUrl(item.product.image_url || this.defaultProductImage);
        return `<tr>
          <td class="col-img"><img src="${attrEsc(src)}" alt="" /></td>
          <td>${esc(item.product.title)}</td>
          <td class="col-qty">${item.quantity}</td>
          <td class="col-price">${price.toFixed(2)} د.ك</td>
          <td class="col-total">${lineTotal.toFixed(2)} د.ك</td>
        </tr>`;
      })
      .join('');

    const subtotal = order.subtotal.toFixed(2);
    const total = order.total.toFixed(2);

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>إيصال طلب #${esc(order.id.slice(0, 8))}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { --primary: #252442; --primary-light: #3d3b5c; --border: #e2e8f0; --text: #1a202c; --text-muted: #64748b; }
    * { box-sizing: border-box; }
    body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 24px; color: var(--text); background: #f1f5f9; }
    .receipt { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .receipt-header { background: var(--primary); color: #fff; padding: 28px 32px; display: flex; align-items: center; gap: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .receipt-header img { height: 56px; width: auto; object-fit: contain; }
    .receipt-header h1 { margin: 0; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .receipt-body { padding: 28px 32px; }
    .section-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 12px; }
    .order-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 32px; margin-bottom: 28px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
    .order-meta p { margin: 0 0 8px; font-size: 0.9375rem; line-height: 1.5; }
    .order-meta strong { color: var(--text-muted); font-weight: 500; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.9375rem; }
    .items-table thead { background: var(--primary); color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .items-table th { padding: 14px 16px; text-align: right; font-weight: 600; }
    .items-table th:first-child { text-align: center; width: 72px; }
    .items-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .items-table tbody tr:last-child td { border-bottom: none; }
    .items-table .col-img { text-align: center; width: 72px; }
    .items-table .col-img img { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; background: #f8fafc; }
    .items-table .col-qty { text-align: center; }
    .items-table .col-price, .items-table .col-total { text-align: left; }
    .totals-box { background: #f8fafc; border-radius: 12px; padding: 20px 24px; margin-top: 24px; }
    .totals-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 0.9375rem; }
    .totals-row.final { font-size: 1.125rem; font-weight: 700; color: var(--primary); margin-top: 8px; padding-top: 12px; border-top: 2px solid var(--border); }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt { box-shadow: none; border: 1px solid var(--border); }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-header">
      <img src="${attrEsc(logoUrl)}" alt="${esc(this.storeName)}" />
      <h1>${esc(this.storeName)}</h1>
    </div>
    <div class="receipt-body">
      <p class="section-title">تفاصيل الطلب</p>
      <div class="order-meta">
        <div>
          <p><strong>رقم الطلب</strong> #${esc(order.id.slice(0, 8))}</p>
          <p><strong>التاريخ</strong> ${esc(created)}</p>
        </div>
        <div>
          <p><strong>العميل</strong> ${esc(order.customer.fullName)}</p>
          <p><strong>الهاتف</strong> ${esc(order.customer.phone)}</p>
          ${order.customer.address ? `<p><strong>العنوان</strong> ${esc(order.customer.address)}</p>` : ''}
          ${order.deliveryMessage ? `<p><strong>موعد التوصيل</strong> ${esc(order.deliveryMessage)}</p>` : ''}
        </div>
      </div>
      <p class="section-title">المنتجات</p>
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-img">الصورة</th>
            <th>المنتج</th>
            <th class="col-qty">الكمية</th>
            <th class="col-price">السعر</th>
            <th class="col-total">المجموع</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals-box">
        <div class="totals-row"><span>المجموع الفرعي</span><span>${subtotal} د.ك</span></div>${order.productDiscountAmount != null && order.productDiscountAmount > 0 ? `<div class="totals-row"><span>خصم المنتجات</span><span>- ${order.productDiscountAmount.toFixed(2)} د.ك</span></div>` : ''}${order.discountCode || (order.discountAmount != null && order.discountAmount > 0) ? `<div class="totals-row"><span>كود الخصم${order.discountCode ? ' (' + esc(order.discountCode) + ')' : ''}</span><span>- ${(order.discountAmount ?? 0).toFixed(2)} د.ك</span></div>` : ''}
        <div class="totals-row final"><span>الإجمالي</span><span>${total} د.ك</span></div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.onload = () => w.print();
    }
  }
}

import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AppliesTo, ProductDiscount, ProductDiscountApi } from '../../../core/models/product.model';
import { ProductDiscountService } from '../../../core/services/product-discount.service';
import { HeroIconComponent } from '../../../shared/icons/hero-icon.component';

const APPLIES_TO_OPTIONS: { value: AppliesTo; label: string }[] = [
  { value: 'ALL_PRODUCTS', label: 'جميع المنتجات' },
  { value: 'CATEGORY', label: 'تصنيف معيّن' },
  { value: 'SPECIFIC_PRODUCTS', label: 'منتجات محددة' },
];

@Component({
  selector: 'app-admin-discounts',
  standalone: true,
  imports: [FormsModule, DatePipe, HeroIconComponent],
  templateUrl: './admin-discounts.component.html',
})
export class AdminDiscountsComponent {
  showForm = false;
  editingId: string | null = null;
  appliesToOptions = APPLIES_TO_OPTIONS;
  form = {
    name: '',
    percentage: 0,
    applies_to: 'ALL_PRODUCTS' as AppliesTo,
    category_id: '',
    start_date: '',
    end_date: '',
    isActive: true,
    product_ids_str: '',
  };

  constructor(public discountService: ProductDiscountService) {}

  openAdd(): void {
    this.editingId = null;
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    this.form = {
      name: '',
      percentage: 0,
      applies_to: 'ALL_PRODUCTS',
      category_id: '',
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      isActive: true,
      product_ids_str: '',
    };
    this.showForm = true;
  }

  openEdit(d: ProductDiscount): void {
    this.editingId = d.id ?? null;
    this.form = {
      name: d.name,
      percentage: d.percentage,
      applies_to: d.applies_to,
      category_id: d.category_id ?? '',
      start_date: d.start_date.slice(0, 10),
      end_date: d.end_date.slice(0, 10),
      isActive: d.is_active !== false,
      product_ids_str: Array.isArray(d.product_ids) ? d.product_ids.join(', ') : '',
    };
    this.showForm = true;
  }

  save(): void {
    const name = (this.form.name || '').trim();
    if (!name || this.form.percentage < 0) return;
    if (!this.form.start_date || !this.form.end_date) return;
    if (this.form.applies_to === 'SPECIFIC_PRODUCTS') {
      const ids = (this.form.product_ids_str || '')
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        alert('يرجى إدخال معرف منتج واحد على الأقل عند اختيار "منتجات محددة"');
        return;
      }
    }

    const percentage = Number(this.form.percentage);
    if (Number.isNaN(percentage) || percentage < 0) return;

    const payload: Record<string, unknown> = {
      name,
      percentage,
      applies_to: this.form.applies_to,
      category_id: this.form.applies_to === 'CATEGORY' ? (this.form.category_id.trim() || undefined) : undefined,
      start_date: this.form.start_date,
      end_date: this.form.end_date,
      is_active: this.form.isActive,
    };
    if (this.form.applies_to === 'SPECIFIC_PRODUCTS') {
      payload['product_ids'] = (this.form.product_ids_str || '')
        .split(/[\s,]+/)
        .map((s) => String(s).trim())
        .filter(Boolean);
    }

    if (this.editingId) {
      this.discountService.update(this.editingId, payload as Partial<ProductDiscountApi>);
    } else {
      this.discountService.add(payload as Omit<ProductDiscountApi, 'id'>);
    }
    this.showForm = false;
  }

  delete(id: string): void {
    if (confirm('حذف هذا الخصم؟')) this.discountService.delete(id);
  }

  appliesToLabel(value: AppliesTo): string {
    return APPLIES_TO_OPTIONS.find((o) => o.value === value)?.label ?? value;
  }
}

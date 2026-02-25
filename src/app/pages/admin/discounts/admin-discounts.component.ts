import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DiscountService } from '../../../core/services/discount.service';
import { HeroIconComponent } from '../../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-admin-discounts',
  standalone: true,
  imports: [FormsModule, DatePipe, HeroIconComponent],
  templateUrl: './admin-discounts.component.html',
})
export class AdminDiscountsComponent {
  showForm = false;
  form = {
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    expiresAt: '',
    maxUses: 1,
    isActive: true,
  };

  constructor(public discountService: DiscountService) {}

  openAdd(): void {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    this.form = {
      code: '',
      type: 'percentage',
      value: 10,
      expiresAt: d.toISOString().slice(0, 10),
      maxUses: 100,
      isActive: true,
    };
    this.showForm = true;
  }

  save(): void {
    if (!this.form.code.trim() || this.form.value <= 0 || !this.form.expiresAt) return;
    this.discountService.add({
      code: this.form.code.trim().toUpperCase(),
      type: this.form.type,
      value: this.form.value,
      expiresAt: new Date(this.form.expiresAt).toISOString(),
      maxUses: this.form.maxUses,
      isActive: this.form.isActive,
    });
    this.showForm = false;
  }

  delete(id: string): void {
    if (confirm('حذف كود الخصم؟')) this.discountService.delete(id);
  }
}

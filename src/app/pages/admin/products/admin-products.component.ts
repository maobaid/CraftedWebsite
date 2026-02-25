import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { Product } from '../../../core/models/product.model';
import { HeroIconComponent } from '../../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [FormsModule, HeroIconComponent],
  templateUrl: './admin-products.component.html',
})
export class AdminProductsComponent {
  showForm = false;
  editingId: string | null = null;
  form = {
    nameAr: '',
    descriptionAr: '',
    price: 0,
    imageUrl: '',
    category_id: '' as string,
    discountType: 'percentage' as 'percentage' | 'fixed' | null,
    discountValue: 0,
    isActive: true,
  };

  constructor(public productService: ProductService) {}

  openAdd(): void {
    this.editingId = null;
    this.form = {
      nameAr: '',
      descriptionAr: '',
      price: 0,
      imageUrl: '',
      category_id: '',
      discountType: null,
      discountValue: 0,
      isActive: true,
    };
    this.showForm = true;
  }

  openEdit(p: Product): void {
    this.editingId = p.id;
    this.form = {
      nameAr: p.nameAr,
      descriptionAr: p.descriptionAr ?? '',
      price: p.price,
      imageUrl: p.imageUrl,
      category_id: p.category_id ?? '',
      discountType: p.discountType ?? null,
      discountValue: p.discountValue ?? 0,
      isActive: p.isActive,
    };
    this.showForm = true;
  }

  save(): void {
    if (!this.form.nameAr.trim() || this.form.price <= 0) return;
    const payload = {
      nameAr: this.form.nameAr.trim(),
      descriptionAr: this.form.descriptionAr.trim() || undefined,
      price: this.form.price,
      imageUrl: this.form.imageUrl.trim(),
      category_id: this.form.category_id.trim() || undefined,
      discountType: this.form.discountType ?? undefined,
      discountValue: this.form.discountValue || undefined,
      isActive: this.form.isActive,
    };
    if (this.editingId) {
      this.productService.update(this.editingId, payload);
    } else {
      this.productService.add(payload);
    }
    this.showForm = false;
  }

  delete(id: string): void {
    if (confirm('هل تريد حذف هذا المنتج؟')) this.productService.delete(id);
  }
}

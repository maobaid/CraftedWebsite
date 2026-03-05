import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { CategoryService } from '../../../core/services/category.service';
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
    title: '',
    description: '',
    price: 0,
    image_url: '',
    category_id: null as string | null,
    is_active: true,
  };

  constructor(
    public productService: ProductService,
    public categoryService: CategoryService,
  ) {}

  openAdd(): void {
    this.editingId = null;
    this.form = {
      title: '',
      description: '',
      price: 0,
      image_url: '',
      category_id: null,
      is_active: true,
    };
    this.showForm = true;
  }

  openEdit(p: Product): void {
    this.editingId = p.id;
    this.form = {
      title: p.title,
      description: p.description ?? '',
      price: p.price,
      image_url: p.image_url ?? '',
      category_id: p.category_id ?? null,
      is_active: p.is_active,
    };
    this.showForm = true;
  }

  save(): void {
    const title = (this.form.title || '').trim();
    if (!title || this.form.price <= 0) return;
    const description = (this.form.description || '').trim();
    const image = (this.form.image_url || '').trim();
    const categoryId = this.form.category_id?.trim() || null;
    const payload = {
      title,
      description: description || null,
      price: this.form.price,
      image_url: image || null,
      category_id: categoryId,
      is_active: this.form.is_active,
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

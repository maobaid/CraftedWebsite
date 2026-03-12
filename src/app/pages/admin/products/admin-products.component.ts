import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  selectedProductIds = new Set<string>();
  search = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  categoryFilter: string | 'all' = 'all';
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
    private router: Router,
  ) {}

  getCategoryName(categoryId: string | null): string {
    if (!categoryId) return '—';
    const cat = this.categoryService
      .categories()
      .find((c) => c.id === categoryId);
    return cat?.name ?? '—';
  }

  isSelected(id: string): boolean {
    return this.selectedProductIds.has(id);
  }

  toggleProductSelection(id: string, checked: boolean): void {
    if (checked) {
      this.selectedProductIds.add(id);
    } else {
      this.selectedProductIds.delete(id);
    }
  }

  hasSelection(): boolean {
    return this.selectedProductIds.size > 0;
  }

  get allVisibleSelected(): boolean {
    const visible = this.filteredProducts;
    if (!visible.length) return false;
    return visible.every((p) => this.selectedProductIds.has(p.id));
  }

  toggleSelectAllVisible(checked: boolean): void {
    const visible = this.filteredProducts;
    if (checked) {
      visible.forEach((p) => this.selectedProductIds.add(p.id));
    } else {
      visible.forEach((p) => this.selectedProductIds.delete(p.id));
    }
  }

  addDiscountForSelected(): void {
    if (!this.selectedProductIds.size) return;
    const ids = Array.from(this.selectedProductIds);
    this.router.navigate(['/admin/discounts'], {
      queryParams: {
        appliesTo: 'SPECIFIC_PRODUCTS',
        productIds: ids.join(','),
      },
    });
  }

  get filteredProducts(): Product[] {
    const q = this.search.trim().toLowerCase();
    const status = this.statusFilter;
    const categoryId = this.categoryFilter;
    return this.productService
      .allProducts()
      .filter((p) => {
        if (q) {
          const inTitle = p.title.toLowerCase().includes(q);
          const inDesc = (p.description ?? '').toLowerCase().includes(q);
          if (!inTitle && !inDesc) return false;
        }
        if (status === 'active' && !p.is_active) return false;
        if (status === 'inactive' && p.is_active) return false;
        if (categoryId !== 'all' && p.category_id !== categoryId) return false;
        return true;
      });
  }

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

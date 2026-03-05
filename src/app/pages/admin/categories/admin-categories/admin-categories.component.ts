import { Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Category } from '../../../../core/models/category.model';
import { CategoryService } from '../../../../core/services/category.service';
import { HeroIconComponent } from '../../../../shared/icons/hero-icon.component';
import { slugFromName } from '../../../../core/models/category.model';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [NgClass, FormsModule, HeroIconComponent],
  templateUrl: './admin-categories.component.html',
})
export class AdminCategoriesComponent {
  showForm = false;
  editingId: string | null = null;
  form = {
    name: '',
    slug: '',
    parent_id: null as string | null,
    is_active: true,
  };

  constructor(public categoryService: CategoryService) {}

  openAdd(): void {
    this.editingId = null;
    this.form = {
      name: '',
      slug: '',
      parent_id: null,
      is_active: true,
    };
    this.showForm = true;
  }

  openEdit(c: Category): void {
    this.editingId = c.id ?? null;
    this.form = {
      name: c.name,
      slug: c.slug,
      parent_id: c.parent_id ?? null,
      is_active: c.is_active !== false,
    };
    this.showForm = true;
  }

  onNameChange(): void {
    if (!this.editingId) {
      this.form.slug = slugFromName(this.form.name);
    }
  }

  save(): void {
    const name = (this.form.name || '').trim();
    const slug = (this.form.slug || '').trim().toLowerCase();
    if (!name || !slug) return;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      alert('الرابط (slug) يجب أن يكون حروفاً إنجليزية صغيرة وأرقاماً وشرطات فقط، مثل: my-category');
      return;
    }

    const payload = {
      name,
      slug,
      parent_id: this.form.parent_id?.trim() || null,
      is_active: this.form.is_active,
    };

    if (this.editingId) {
      this.categoryService.update(this.editingId, payload);
    } else {
      this.categoryService.add(payload);
    }
    this.showForm = false;
  }

  delete(id: string): void {
    if (confirm('حذف هذا التصنيف؟')) this.categoryService.delete(id);
  }

  parentName(c: Category): string {
    if (!c.parent_id) return '—';
    const parent = this.categoryService.categories().find((x) => x.id === c.parent_id);
    return parent?.name ?? c.parent_id;
  }

  /** Root categories (no parent) for hierarchical display */
  rootCategories(): Category[] {
    return this.categoryService.categories().filter((c) => !c.parent_id);
  }

  /** Direct children of a parent category */
  childrenOf(parentId: string): Category[] {
    return this.categoryService.categories().filter((c) => c.parent_id === parentId);
  }

  /** All descendants of a category in depth-first order with depth (1 = direct child, 2 = grandchild, ...). */
  descendantsWithDepth(parentId: string, startDepth: number): { category: Category; depth: number }[] {
    const result: { category: Category; depth: number }[] = [];
    const children = this.categoryService.categories().filter((c) => c.parent_id === parentId);
    for (const child of children) {
      result.push({ category: child, depth: startDepth });
      if (child.id) {
        result.push(...this.descendantsWithDepth(child.id, startDepth + 1));
      }
    }
    return result;
  }

  /** Returns [0, 1, ..., n-1] for use in template iteration (e.g. indent depth). */
  depthLevels(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }

  /** Orphan categories (parent_id set but parent not in list) – show as roots */
  orphanCategories(): Category[] {
    const list = this.categoryService.categories();
    const parentIds = new Set(list.map((c) => c.id).filter(Boolean));
    return list.filter((c) => c.parent_id && !parentIds.has(c.parent_id));
  }
}

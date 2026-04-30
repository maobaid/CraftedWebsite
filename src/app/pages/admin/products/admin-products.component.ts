import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ProductService,
  ProductCreatePayload,
  ProductUpdatePayload,
} from '../../../core/services/product.service';
import { CategoryService } from '../../../core/services/category.service';
import {
  Product,
  ProductVariantInput,
  normalizeColorKey,
} from '../../../core/models/product.model';
import { HeroIconComponent } from '../../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [FormsModule, HeroIconComponent],
  templateUrl: './admin-products.component.html',
})
export class AdminProductsComponent implements OnInit {
  showForm = false;
  editingId: string | null = null;
  selectedProductIds = new Set<string>();
  search = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  categoryFilter: string | 'all' = 'all';
  lowStockOnly = false;
  lowStockThreshold: number | null = null;
  form = {
    title: '',
    description: '',
    price: 0,
    image_url: '',
    category_id: null as string | null,
    is_active: true,
    colors: [] as string[],
    sizesInput: '',
    stock_quantity: 0,
    low_stock_threshold: 5,
  };
  colorPickerValue = '#000000';

  variantRows: {
    color: string;
    size: string;
    price_override: string;
    stock_quantity: number;
    low_stock_threshold: number;
    is_active: boolean;
  }[] = [];
  /** When true, next save PATCH sends variants: [] (replace-all empty). */
  explicitClearVariants = false;

  constructor(
    public productService: ProductService,
    public categoryService: CategoryService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.applyStockFilters();
  }

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
    this.explicitClearVariants = false;
    this.variantRows = [];
    this.editingId = null;
    this.form = {
      title: '',
      description: '',
      price: 0,
      image_url: '',
      category_id: null,
      is_active: true,
      colors: [],
      sizesInput: '',
      stock_quantity: 0,
      low_stock_threshold: 5,
    };
    this.colorPickerValue = '#000000';
    this.showForm = true;
  }

  openEdit(p: Product): void {
    this.explicitClearVariants = false;
    this.variantRows = (p.variants ?? []).map((v) => ({
      color: (v.color ?? '').trim().toLowerCase(),
      size: v.size ?? '',
      price_override:
        v.price_override == null || v.price_override === ''
          ? ''
          : String(v.price_override),
      stock_quantity: v.stock_quantity ?? 0,
      low_stock_threshold: v.low_stock_threshold ?? 5,
      is_active: v.is_active !== false,
    }));
    this.editingId = p.id;
    this.form = {
      title: p.title,
      description: p.description ?? '',
      price: p.price,
      image_url: p.image_url ?? '',
      category_id: p.category_id ?? null,
      is_active: p.is_active,
      colors: [...(p.colors ?? [])].map((c) => c.trim().toLowerCase()).filter(Boolean),
      sizesInput: (p.sizes ?? []).join('-'),
      stock_quantity: p.stock_quantity ?? 0,
      low_stock_threshold: p.low_stock_threshold ?? 5,
    };
    this.ensureVariantRowsFromProductOptions();
    this.showForm = true;
  }

  parseTags(input: string): string[] {
    return input
      .split('-')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  addColorFromPicker(): void {
    const hex = (this.colorPickerValue || '').trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(hex)) return;
    if (this.form.colors.includes(hex)) return;
    this.form.colors = [...this.form.colors, hex];
    this.ensureVariantRowsFromProductOptions();
  }

  removeColor(hex: string): void {
    this.form.colors = this.form.colors.filter((c) => c !== hex);
    this.ensureVariantRowsFromProductOptions();
  }

  /**
   * Rebuild variant rows from form.colors × sizes (preserve stock/per-row data per combo).
   * No-op when both color and size lists are empty (manual-only variant rows unchanged).
   */
  ensureVariantRowsFromProductOptions(): void {
    if (this.explicitClearVariants) return;
    const colors = [...(this.form.colors ?? [])].map((c) => c.trim().toLowerCase()).filter(Boolean);
    const sizes = this.parseTags(this.form.sizesInput);
    const combos = this.variantCombosFromOptions(colors, sizes);
    if (combos.length === 0) return;

    const keyOf = (color: string, size: string) =>
      `${normalizeColorKey(color)}\u241F${(size || '').trim()}`;

    const existing = new Map<string, (typeof this.variantRows)[0]>();
    for (const r of this.variantRows) {
      existing.set(keyOf(r.color ?? '', r.size ?? ''), { ...r });
    }

    this.variantRows = combos.map(({ color, size }) => {
      const prev = existing.get(keyOf(color, size));
      if (prev) {
        return {
          ...prev,
          color,
          size,
        };
      }
      return {
        color,
        size,
        price_override: '',
        stock_quantity: 0,
        low_stock_threshold: Math.max(
          0,
          Math.floor(Number(this.form.low_stock_threshold) || 5),
        ),
        is_active: true,
      };
    });
  }

  syncVariantsAfterSizesBlur(): void {
    this.ensureVariantRowsFromProductOptions();
  }

  private variantCombosFromOptions(
    colors: string[],
    sizes: string[],
  ): { color: string; size: string }[] {
    if (colors.length > 0 && sizes.length > 0) {
      const out: { color: string; size: string }[] = [];
      for (const c of colors) {
        for (const s of sizes) {
          out.push({ color: c, size: s });
        }
      }
      return out;
    }
    if (colors.length > 0) {
      return colors.map((c) => ({ color: c, size: '' }));
    }
    if (sizes.length > 0) {
      return sizes.map((s) => ({ color: '', size: s }));
    }
    return [];
  }

  /** Native color input expects #rrggbb; non-hex stored values fall back visually. */
  pickerHexForVariantColor(stored: string | undefined): string {
    const c = (stored ?? '').trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(c) ? c : '#cccccc';
  }

  setVariantRowColor(index: number, hexFromPicker: string): void {
    const h = (hexFromPicker || '#000000').trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(h)) return;
    const next = [...this.variantRows];
    if (!next[index]) return;
    next[index] = { ...next[index], color: h };
    this.variantRows = next;
  }

  addVariantRow(): void {
    this.explicitClearVariants = false;
    this.variantRows = [
      ...this.variantRows,
      {
        color: '#000000',
        size: '',
        price_override: '',
        stock_quantity: 0,
        low_stock_threshold: this.form.low_stock_threshold || 5,
        is_active: true,
      },
    ];
  }

  removeVariantRow(index: number): void {
    this.variantRows = this.variantRows.filter((_, i) => i !== index);
  }

  markClearVariantsOnServer(): void {
    this.explicitClearVariants = true;
    this.variantRows = [];
  }

  private rowsToVariantPayload(): ProductVariantInput[] {
    return this.variantRows.map((r) => {
      const raw = r.price_override.trim();
      const n = raw === '' ? null : Number(raw);
      return {
        color: (() => {
          const c = r.color.trim().toLowerCase();
          return /^#[0-9a-f]{6}$/.test(c) ? c : null;
        })(),
        size: r.size.trim() || null,
        price_override:
          n == null || Number.isNaN(n) ? null : Math.max(0, n),
        stock_quantity: Math.max(0, Math.floor(Number(r.stock_quantity) || 0)),
        low_stock_threshold: Math.max(
          0,
          Math.floor(Number(r.low_stock_threshold) || 0),
        ),
        is_active: r.is_active,
      };
    });
  }

  /** Hide product-level stock when variant rows define per-combination inventory. */
  productLevelStockLocked(): boolean {
    if (this.explicitClearVariants) return false;
    return this.variantRows.length > 0;
  }

  applyStockFilters(): void {
    this.productService.refresh({
      low_stock_only: this.lowStockOnly || undefined,
      low_stock_threshold:
        this.lowStockOnly && this.lowStockThreshold != null
          ? Math.max(0, Math.floor(this.lowStockThreshold))
          : undefined,
    });
  }

  save(): void {
    const title = (this.form.title || '').trim();
    if (!title || this.form.price <= 0) return;
    const description = (this.form.description || '').trim();
    const image = (this.form.image_url || '').trim();
    const categoryId = this.form.category_id?.trim() || null;
    const stockQty = Math.max(0, Math.floor(Number(this.form.stock_quantity || 0)));
    const lowStockThreshold = Math.max(
      0,
      Math.floor(Number(this.form.low_stock_threshold || 0)),
    );
    if (!this.explicitClearVariants) {
      this.ensureVariantRowsFromProductOptions();
    }
    let variantsPart: ProductVariantInput[] | undefined;
    if (this.explicitClearVariants) variantsPart = [];
    else if (this.variantRows.length > 0) {
      variantsPart = this.rowsToVariantPayload();
    }

    const productColors = [...(this.form.colors ?? [])]
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    const productSizes = this.parseTags(this.form.sizesInput);

    const savingWithVariants =
      !this.explicitClearVariants &&
      Array.isArray(variantsPart) &&
      variantsPart.length > 0;

    const payloadBase = {
      title,
      description: description || null,
      price: this.form.price,
      image_url: image || null,
      category_id: categoryId,
      is_active: this.form.is_active,
      colors: productColors,
      sizes: productSizes,
      ...(savingWithVariants
        ? {}
        : {
            stock_quantity: stockQty,
            low_stock_threshold: lowStockThreshold,
          }),
    };
    if (this.editingId) {
      const u: ProductUpdatePayload = { ...(payloadBase as ProductUpdatePayload) };
      if (variantsPart !== undefined) u.variants = variantsPart;
      this.productService.update(this.editingId, u);
    } else {
      const c: ProductCreatePayload = payloadBase as ProductCreatePayload;
      if (variantsPart !== undefined) c.variants = variantsPart;
      this.productService.add(c);
    }
    this.showForm = false;
  }

  delete(id: string): void {
    if (confirm('هل تريد حذف هذا المنتج؟')) this.productService.delete(id);
  }
}

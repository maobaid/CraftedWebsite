import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  CartLineCustomization,
  Product,
  ProductCustomization,
  ProductPriceResult,
  displayColors,
  displaySizes,
  findMatchingVariant,
  isVariantSelectable,
  productHasVariants,
  sanitizeSingleWordText,
  sortedProductCustomizations,
  isValidHttpProductImageUrl,
  variantColorSelectable,
  variantSizeSelectable,
} from '../../core/models/product.model';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { ProductDiscountService } from '../../core/services/product-discount.service';
import {
  CustomizationUploadError,
  StoreUploadService,
} from '../../core/services/store-upload.service';
import { validateCustomizationImageFileBeforeUpload } from '../../core/constants/customization-upload.constants';
import { HeroIconComponent } from '../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, HeroIconComponent, NgClass, FormsModule],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent implements OnInit {
  readonly productHasVariants = productHasVariants;

  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private productService = inject(ProductService);
  private cart = inject(CartService);
  private discountService = inject(ProductDiscountService);
  private upload = inject(StoreUploadService);
  outOfStockMessage = '';
  optionMessage = '';
  selectedColorHex = '';
  selectedSize = '';
  custText: Record<string, string> = {};
  custImageUrl: Record<string, string> = {};
  /** Object URLs for local preview while upload is in flight (revoked on success/clear). */
  custImageLocalPreviewUrl: Partial<Record<string, string>> = {};
  custImageUploadBusy: Record<string, boolean> = {};
  custUploadError: Record<string, string> = {};
  /** Shown after a successful add — includes customization recap for the buyer. */
  cartAddedSummary = signal<string[]>([]);

  product: Product | undefined = this.productService.getById(
    this.route.snapshot.paramMap.get('id') ?? '',
  );

  displayColorsFn = displayColors;
  displaySizesFn = displaySizes;
  sortedCust = sortedProductCustomizations;
  isHttpsOrHttpImg = isValidHttpProductImageUrl;

  get priceInfo(): ProductPriceResult | null {
    this.discountService.discounts();
    if (!this.product) return null;
    return this.discountService.getEffectivePrice(this.product, {
      selectedColorHex: this.selectedColorHex,
      selectedSize: this.selectedSize,
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((pm) => {
      const id = pm.get('id') ?? '';
      this.resetCustomizationDraft();
      this.selectedColorHex = '';
      this.selectedSize = '';
      this.optionMessage = '';
      this.cartAddedSummary.set([]);
      this.product = id ? this.productService.getById(id) : undefined;
      if (id && !this.product) {
        this.productService.loadById(id);
        queueMicrotask(() => {
          this.product = this.productService.getById(id);
        });
      }
    });
  }

  private resetCustomizationDraft(): void {
    this.custText = {};
    this.custImageUrl = {};
    for (const u of Object.values(this.custImageLocalPreviewUrl)) {
      if (u) URL.revokeObjectURL(u);
    }
    this.custImageLocalPreviewUrl = {};
    this.custImageUploadBusy = {};
    this.custUploadError = {};
  }

  pickCustImageFile(c: ProductCustomization): void {
    if (typeof document === 'undefined') return;
    document.getElementById(`cust-upload-${c.id}`)?.click();
  }

  onCustImageFileSelect(c: ProductCustomization, evt: Event): void {
    if (c.kind !== 'IMAGE') return;
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.custUploadError[c.id] = '';
    const precheck = validateCustomizationImageFileBeforeUpload(file);
    if (precheck) {
      this.custUploadError[c.id] = precheck;
      input.value = '';
      return;
    }

    const oldLocal = this.custImageLocalPreviewUrl[c.id];
    if (oldLocal) URL.revokeObjectURL(oldLocal);
    delete this.custImageLocalPreviewUrl[c.id];
    delete this.custImageUrl[c.id];

    const blobUrl = URL.createObjectURL(file);
    this.custImageLocalPreviewUrl[c.id] = blobUrl;
    this.custImageUploadBusy[c.id] = true;

    this.upload.uploadCustomizationImage(file).subscribe({
      next: (url) => {
        this.custImageUploadBusy[c.id] = false;
        const still = this.custImageLocalPreviewUrl[c.id];
        if (still === blobUrl) {
          URL.revokeObjectURL(blobUrl);
          delete this.custImageLocalPreviewUrl[c.id];
        }
        this.custImageUrl[c.id] = url;
      },
      error: (err: unknown) => {
        this.custImageUploadBusy[c.id] = false;
        URL.revokeObjectURL(blobUrl);
        delete this.custImageLocalPreviewUrl[c.id];
        delete this.custImageUrl[c.id];
        const msg =
          err instanceof CustomizationUploadError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'تعذر رفع الصورة. حاول مرة أخرى.';
        this.custUploadError[c.id] = msg;
        input.value = '';
      },
    });
  }

  /** Hosted image URL after upload (normalized for bindings). */
  uploadedCustImageUrl(c: ProductCustomization): string {
    return (this.custImageUrl[c.id] ?? '').trim();
  }

  showUploadedCustImagePreview(c: ProductCustomization): boolean {
    const url = this.uploadedCustImageUrl(c);
    return url.length > 0 && this.isHttpsOrHttpImg(url);
  }

  removeCustImage(c: ProductCustomization): void {
    if (c.kind !== 'IMAGE') return;
    const blob = this.custImageLocalPreviewUrl[c.id];
    if (blob) URL.revokeObjectURL(blob);
    delete this.custImageLocalPreviewUrl[c.id];
    delete this.custImageUrl[c.id];
    delete this.custUploadError[c.id];
    this.custImageUploadBusy[c.id] = false;
    if (typeof document !== 'undefined') {
      const el = document.getElementById(
        `cust-upload-${c.id}`,
      ) as HTMLInputElement | null;
      if (el) el.value = '';
    }
  }

  private buildAddToCartSummaryLines(p: Product): string[] {
    const lines: string[] = [`تمت إضافة «${p.title}» إلى السلة`];
    for (const opt of sortedProductCustomizations(p)) {
      if (opt.kind === 'TEXT') {
        const t = (this.custText[opt.id] ?? '').trim();
        if (!t) continue;
        lines.push(`${opt.label}: ${t}`);
      } else {
        if (this.custImageUploadBusy[opt.id]) continue;
        const u = (this.custImageUrl[opt.id] ?? '').trim();
        if (!u) continue;
        lines.push(`${opt.label}: صورة مرفوعة`);
      }
    }
    return lines;
  }

  onCustTextInput(c: ProductCustomization, raw: string): void {
    if (c.kind !== 'TEXT') return;
    let next = raw;
    if (c.text_mode === 'SINGLE_WORD') {
      next = sanitizeSingleWordText(raw);
    }
    const max = c.max_chars ?? 500;
    if (next.length > max) next = next.slice(0, max);
    this.custText[c.id] = next;
  }

  private customizationsComplete(p: Product): boolean {
    for (const c of sortedProductCustomizations(p)) {
      if (!c.required) continue;
      if (c.kind === 'TEXT') {
        const t = (this.custText[c.id] ?? '').trim();
        if (!t) return false;
        const max = c.max_chars ?? 0;
        if (max > 0 && t.length > max) return false;
        if (c.text_mode === 'SINGLE_WORD' && /\s/.test(t)) return false;
      } else {
        if (this.custImageUploadBusy[c.id]) return false;
        const u = (this.custImageUrl[c.id] ?? '').trim();
        if (!isValidHttpProductImageUrl(u)) return false;
      }
    }
    return true;
  }

  private buildLineCustomizations(p: Product): CartLineCustomization[] {
    const out: CartLineCustomization[] = [];
    for (const c of sortedProductCustomizations(p)) {
      if (c.kind === 'TEXT') {
        const text = (this.custText[c.id] ?? '').trim();
        if (!text && !c.required) continue;
        out.push({ product_customization_id: c.id, text_value: text });
      } else {
        const url = (this.custImageUrl[c.id] ?? '').trim();
        if (!url && !c.required) continue;
        out.push({ product_customization_id: c.id, image_url: url });
      }
    }
    return out;
  }

  onSelectColor(hex: string): void {
    this.optionMessage = '';
    this.selectedColorHex = hex;
    const p = this.product;
    if (!p) return;
    const sizes = displaySizes(p, hex);
    if (this.selectedSize && !sizes.includes(this.selectedSize)) {
      this.selectedSize = '';
    }
  }

  colorDisabled(p: Product, hex: string): boolean {
    if (!productHasVariants(p)) return false;
    return !variantColorSelectable(p, hex, this.selectedSize);
  }

  sizeDisabled(p: Product, size: string): boolean {
    if (!productHasVariants(p)) return false;
    return !variantSizeSelectable(p, size, this.selectedColorHex);
  }

  resolvedVariantQuantity(p: Product | undefined): number | null {
    if (!p || !productHasVariants(p)) return null;
    const v = findMatchingVariant(p, this.selectedColorHex, this.selectedSize);
    return v ? v.stock_quantity : null;
  }

  resolvedVariantLowStock(p: Product | undefined): boolean {
    const v = p
      ? findMatchingVariant(p, this.selectedColorHex, this.selectedSize)
      : null;
    if (
      !v ||
      !isVariantSelectable(v) ||
      typeof v.stock_quantity !== 'number' ||
      typeof v.low_stock_threshold !== 'number'
    ) {
      return false;
    }
    return (
      v.stock_quantity > 0 && v.stock_quantity <= v.low_stock_threshold
    );
  }

  canAddLine(p: Product | undefined): boolean {
    if (!p) return false;
    if (productHasVariants(p)) {
      const v = findMatchingVariant(p, this.selectedColorHex, this.selectedSize);
      if (v === null || !isVariantSelectable(v)) return false;
      return this.customizationsComplete(p);
    }
    if (!p.in_stock) return false;
    if ((p.colors?.length ?? 0) > 0 && !this.selectedColorHex.trim()) return false;
    if ((p.sizes?.length ?? 0) > 0 && !this.selectedSize.trim()) return false;
    return this.customizationsComplete(p);
  }

  addToCart(): void {
    const p = this.product;
    if (!p) return;
    if (!this.customizationsComplete(p)) {
      this.optionMessage = 'أكمل حقول التخصيص المطلوبة';
      return;
    }
    if (productHasVariants(p)) {
      const cols = displayColors(p);
      const szs = displaySizes(p, this.selectedColorHex);
      if (cols.length > 0 && !this.selectedColorHex.trim()) {
        this.optionMessage = 'اختر اللون أولاً';
        return;
      }
      if (szs.length > 0 && !this.selectedSize.trim()) {
        this.optionMessage = 'اختر المقاس أولاً';
        return;
      }
      const v = findMatchingVariant(p, this.selectedColorHex, this.selectedSize);
      if (!v || !isVariantSelectable(v)) {
        this.outOfStockMessage = 'التشكيلة المحددة غير متوفرة';
        setTimeout(() => {
          this.outOfStockMessage = '';
        }, 2500);
        return;
      }
      this.optionMessage = '';
      this.outOfStockMessage = '';
      this.cart.addItem(p, 1, {
        product_variant_id: v.id,
        selectedColorHex: this.selectedColorHex || undefined,
        selectedSize: this.selectedSize || undefined,
        customizations: this.buildLineCustomizations(p),
      });
      this.cartAddedSummary.set(this.buildAddToCartSummaryLines(p));
      window.setTimeout(() => this.cartAddedSummary.set([]), 7000);
      return;
    }
    if (!p.in_stock) {
      this.outOfStockMessage = 'هذا المنتج غير متوفر حالياً';
      setTimeout(() => {
        this.outOfStockMessage = '';
      }, 2500);
      return;
    }
    if ((p.colors?.length ?? 0) > 0 && !this.selectedColorHex) {
      this.optionMessage = 'اختر اللون أولاً';
      return;
    }
    if ((p.sizes?.length ?? 0) > 0 && !this.selectedSize) {
      this.optionMessage = 'اختر المقاس أولاً';
      return;
    }
    this.outOfStockMessage = '';
    this.optionMessage = '';
    this.cart.addItem(p, 1, {
      selectedColorHex: this.selectedColorHex || undefined,
      selectedSize: this.selectedSize || undefined,
      customizations: this.buildLineCustomizations(p),
    });
    this.cartAddedSummary.set(this.buildAddToCartSummaryLines(p));
    window.setTimeout(() => this.cartAddedSummary.set([]), 7000);
  }
}

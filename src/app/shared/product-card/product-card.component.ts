import { Component, input, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Product,
  ProductPriceResult,
  ProductVariant,
  displayColors,
  displaySizes,
  findMatchingVariant,
  isVariantSelectable,
  productHasVariants,
  variantColorSelectable,
  variantSizeSelectable,
} from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { ProductDiscountService } from '../../core/services/product-discount.service';
import { HeroIconComponent } from '../icons/hero-icon.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, HeroIconComponent, NgClass],
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  product = input.required<Product>();
  private cart = inject(CartService);
  private discountService = inject(ProductDiscountService);
  outOfStockMessage = '';
  optionMessage = '';
  selectedColorHex = '';
  selectedSize = '';

  readonly displayColorsFn = displayColors;
  readonly displaySizesFn = displaySizes;
  readonly productHasVariants = productHasVariants;

  /**
   * Not a `computed()` signal: selection is stored on plain fields, so a signal
   * computed would never invalidate when color/size changes. Recompute each CD
   * like PDP `priceInfo` getter.
   */
  effectivePrice(): ProductPriceResult {
    const p = this.product();
    this.discountService.discounts();
    if (!p) return { price: 0, originalPrice: 0, discount: null };
    return this.discountService.getEffectivePrice(p, {
      selectedColorHex: this.selectedColorHex,
      selectedSize: this.selectedSize,
    });
  }

  onSelectColor(hex: string, p: Product): void {
    this.optionMessage = '';
    this.selectedColorHex = hex;
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

  resolvedVariantForUi(p: Product): ProductVariant | null {
    if (!productHasVariants(p)) return null;
    return findMatchingVariant(p, this.selectedColorHex, this.selectedSize);
  }

  variantSelectable(v: ProductVariant | null): boolean {
    return v !== null && isVariantSelectable(v);
  }

  variantLowBadge(v: ProductVariant): boolean {
    return (
      isVariantSelectable(v) &&
      v.stock_quantity <= v.low_stock_threshold
    );
  }

  canAddLine(p: Product): boolean {
    if (productHasVariants(p)) {
      const v = findMatchingVariant(p, this.selectedColorHex, this.selectedSize);
      return v !== null && isVariantSelectable(v);
    }
    if (!p.in_stock) return false;
    if ((p.colors?.length ?? 0) > 0 && !this.selectedColorHex.trim()) return false;
    if ((p.sizes?.length ?? 0) > 0 && !this.selectedSize.trim()) return false;
    return true;
  }

  addToCart(p: Product): void {
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
        this.outOfStockMessage = 'التشكيلة غير متوفرة';
        setTimeout(() => {
          this.outOfStockMessage = '';
        }, 2500);
        return;
      }
      this.optionMessage = '';
      this.cart.addItem(p, 1, {
        product_variant_id: v.id,
        selectedColorHex: this.selectedColorHex || undefined,
        selectedSize: this.selectedSize || undefined,
      });
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
    this.optionMessage = '';
    this.cart.addItem(p, 1, {
      selectedColorHex: this.selectedColorHex || undefined,
      selectedSize: this.selectedSize || undefined,
    });
  }
}

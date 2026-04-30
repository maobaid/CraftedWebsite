import { Component, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Product,
  ProductPriceResult,
  displayColors,
  displaySizes,
  findMatchingVariant,
  isVariantSelectable,
  productHasVariants,
  variantColorSelectable,
  variantSizeSelectable,
} from '../../core/models/product.model';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { ProductDiscountService } from '../../core/services/product-discount.service';
import { HeroIconComponent } from '../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, HeroIconComponent, NgClass],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent implements OnInit {
  readonly productHasVariants = productHasVariants;

  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private cart = inject(CartService);
  private discountService = inject(ProductDiscountService);
  outOfStockMessage = '';
  optionMessage = '';
  selectedColorHex = '';
  selectedSize = '';

  product = this.productService.getById(
    this.route.snapshot.paramMap.get('id') ?? '',
  );

  displayColorsFn = displayColors;
  displaySizesFn = displaySizes;

  get priceInfo(): ProductPriceResult | null {
    this.discountService.discounts();
    if (!this.product) return null;
    return this.discountService.getEffectivePrice(this.product, {
      selectedColorHex: this.selectedColorHex,
      selectedSize: this.selectedSize,
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !this.product) {
      this.productService.loadById(id);
      const check = () => {
        this.product = this.productService.getById(id);
      };
      queueMicrotask(check);
    }
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
      return v !== null && isVariantSelectable(v);
    }
    if (!p.in_stock) return false;
    if ((p.colors?.length ?? 0) > 0 && !this.selectedColorHex.trim()) return false;
    if ((p.sizes?.length ?? 0) > 0 && !this.selectedSize.trim()) return false;
    return true;
  }

  addToCart(): void {
    const p = this.product;
    if (!p) return;
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
    this.outOfStockMessage = '';
    this.optionMessage = '';
    this.cart.addItem(p, 1, {
      selectedColorHex: this.selectedColorHex || undefined,
      selectedSize: this.selectedSize || undefined,
    });
  }
}

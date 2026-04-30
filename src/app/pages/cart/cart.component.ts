import { Component, inject, computed, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  CartItem,
  displayColors,
  displaySizes,
} from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { ProductDiscountService } from '../../core/services/product-discount.service';
import { DiscountService } from '../../core/services/discount.service';
import { HeroIconComponent } from '../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, HeroIconComponent, NgClass],
  templateUrl: './cart.component.html',
})
export class CartComponent {
  private cartService = inject(CartService);
  private productDiscountService = inject(ProductDiscountService);
  couponDiscount = inject(DiscountService);

  cart = this.cartService.cart;
  subtotal = this.cartService.subtotal;
  count = this.cartService.count;

  couponInput = signal('');
  editingItemKey = signal<string | null>(null);

  readonly displayColorsFn = displayColors;
  readonly displaySizesFn = displaySizes;

  couponAmount = computed(() =>
    this.couponDiscount.getAppliedDiscountAmount(this.subtotal())
  );
  total = computed(() =>
    Math.max(0, this.subtotal() - this.couponAmount())
  );

  itemKey(item: CartItem): string {
    const vid = item.product_variant_id?.trim();
    if (vid) return `${item.product.id}::v:${vid}`;
    return `${item.product.id}::${item.selectedColorHex ?? ''}::${item.selectedSize ?? ''}`;
  }

  isEditingOptions(item: CartItem): boolean {
    return this.editingItemKey() === this.itemKey(item);
  }

  /** Show «تعديل» only when product has color/size choices to change. */
  itemHasOptions(item: CartItem): boolean {
    const p = item.product;
    if (this.displayColorsFn(p).length > 0) return true;
    return this.displaySizesFn(p, item.selectedColorHex ?? '').length > 0;
  }

  toggleEditOptions(item: CartItem): void {
    const key = this.itemKey(item);
    this.editingItemKey.update((current) => (current === key ? null : key));
  }

  getPriceInfo(item: CartItem) {
    this.productDiscountService.discounts();
    return this.productDiscountService.getEffectivePrice(item.product, {
      product_variant_id: item.product_variant_id,
      selectedColorHex: item.selectedColorHex,
      selectedSize: item.selectedSize,
    });
  }

  applyCoupon(): void {
    const code = this.couponInput().trim();
    if (!code) return;
    this.couponDiscount.applyCoupon(this.subtotal(), code);
  }

  updateQty(item: CartItem, qty: number): void {
    this.cartService.updateQuantity(item, qty);
  }

  remove(item: CartItem): void {
    this.cartService.removeItem(item);
  }

  updateColor(item: CartItem, color: string): void {
    this.cartService.updateItemOptions(item, { selectedColorHex: color });
    this.editingItemKey.set(null);
  }

  updateSize(item: CartItem, size: string): void {
    this.cartService.updateItemOptions(item, { selectedSize: size });
    this.editingItemKey.set(null);
  }
}

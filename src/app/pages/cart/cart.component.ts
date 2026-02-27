import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartItem } from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { ProductDiscountService } from '../../core/services/product-discount.service';
import { DiscountService } from '../../core/services/discount.service';
import { HeroIconComponent } from '../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, HeroIconComponent],
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

  couponAmount = computed(() =>
    this.couponDiscount.getAppliedDiscountAmount(this.subtotal())
  );
  total = computed(() =>
    Math.max(0, this.subtotal() - this.couponAmount())
  );

  getPriceInfo(item: CartItem) {
    this.productDiscountService.discounts();
    return this.productDiscountService.getEffectivePrice(item.product);
  }

  applyCoupon(): void {
    const code = this.couponInput().trim();
    if (!code) return;
    this.couponDiscount.applyCoupon(this.subtotal(), code);
  }

  updateQty(productId: string, qty: number): void {
    this.cartService.updateQuantity(productId, qty);
  }

  remove(productId: string): void {
    this.cartService.removeItem(productId);
  }
}

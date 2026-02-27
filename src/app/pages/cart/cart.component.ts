import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartItem } from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { ProductDiscountService } from '../../core/services/product-discount.service';
import { HeroIconComponent } from '../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, HeroIconComponent],
  templateUrl: './cart.component.html',
})
export class CartComponent {
  private cartService = inject(CartService);
  private discountService = inject(ProductDiscountService);
  cart = this.cartService.cart;
  subtotal = this.cartService.subtotal;
  count = this.cartService.count;

  getPriceInfo(item: CartItem) {
    this.discountService.discounts();
    return this.discountService.getEffectivePrice(item.product);
  }

  updateQty(productId: string, qty: number): void {
    this.cartService.updateQuantity(productId, qty);
  }

  remove(productId: string): void {
    this.cartService.removeItem(productId);
  }
}

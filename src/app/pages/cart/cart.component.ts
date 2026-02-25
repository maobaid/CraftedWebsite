import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { getProductPrice } from '../../core/models/product.model';
import { HeroIconComponent } from '../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, HeroIconComponent],
  templateUrl: './cart.component.html',
})
export class CartComponent {
  private cartService = inject(CartService);
  cart = this.cartService.cart;
  subtotal = this.cartService.subtotal;
  count = this.cartService.count;

  getPrice = getProductPrice;

  updateQty(productId: string, qty: number): void {
    this.cartService.updateQuantity(productId, qty);
  }

  remove(productId: string): void {
    this.cartService.removeItem(productId);
  }
}

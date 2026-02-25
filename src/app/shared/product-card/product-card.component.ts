import { Component, input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../core/models/product.model';
import { getProductPrice } from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { HeroIconComponent } from '../icons/hero-icon.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, HeroIconComponent],
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  product = input.required<Product>();
  private cart = inject(CartService);

  getPrice(p: Product): number {
    return getProductPrice(p);
  }

  addToCart(p: Product): void {
    this.cart.addItem(p, 1);
  }
}

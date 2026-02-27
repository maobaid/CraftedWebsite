import { Component, input, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { ProductDiscountService } from '../../core/services/product-discount.service';
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
  private discountService = inject(ProductDiscountService);

  effectivePrice = computed(() => {
    const p = this.product();
    this.discountService.discounts();
    return p
      ? this.discountService.getEffectivePrice(p)
      : { price: 0, originalPrice: 0, discount: null };
  });

  addToCart(p: Product): void {
    this.cart.addItem(p, 1);
  }
}

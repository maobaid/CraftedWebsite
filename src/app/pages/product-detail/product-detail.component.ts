import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductPriceResult } from '../../core/models/product.model';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { ProductDiscountService } from '../../core/services/product-discount.service';
import { HeroIconComponent } from '../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, HeroIconComponent],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private cart = inject(CartService);
  private discountService = inject(ProductDiscountService);

  product = this.productService.getById(this.route.snapshot.paramMap.get('id') ?? '');

  get priceInfo(): ProductPriceResult | null {
    this.discountService.discounts();
    return this.product ? this.discountService.getEffectivePrice(this.product) : null;
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

  addToCart(): void {
    const p = this.product;
    if (p) this.cart.addItem(p, 1);
  }
}

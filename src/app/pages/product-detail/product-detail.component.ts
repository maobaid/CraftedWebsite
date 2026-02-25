import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { getProductPrice } from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
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

  product = this.productService.getById(this.route.snapshot.paramMap.get('id') ?? '');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !this.product) {
      this.productService.loadById(id);
      // try to pick it up once loaded
      const check = () => {
        this.product = this.productService.getById(id);
      };
      // simple microtask to allow signal update; for more robustness we'd subscribe to changes
      queueMicrotask(check);
    }
  }

  getPrice = getProductPrice;

  addToCart(): void {
    const p = this.product;
    if (p) this.cart.addItem(p, 1);
  }
}

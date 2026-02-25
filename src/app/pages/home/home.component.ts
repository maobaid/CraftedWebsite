import { Component, computed } from '@angular/core';
import { ProductService } from '../../core/services/product.service';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ProductCardComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  products = computed(() => this.productService.products());

  constructor(public productService: ProductService) {}
}

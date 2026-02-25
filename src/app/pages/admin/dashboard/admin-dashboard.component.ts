import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { OrderService } from '../../../core/services/order.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent {
  constructor(
    public productService: ProductService,
    public orderService: OrderService
  ) {}
}

import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HeroIconComponent } from '../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [RouterLink, HeroIconComponent],
  templateUrl: './order-success.component.html',
})
export class OrderSuccessComponent {
  private route = inject(ActivatedRoute);
  orderId = this.route.snapshot.paramMap.get('id') ?? '';
}

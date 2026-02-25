import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { HeroIconComponent } from '../icons/hero-icon.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, HeroIconComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  constructor(public cart: CartService) {}
}

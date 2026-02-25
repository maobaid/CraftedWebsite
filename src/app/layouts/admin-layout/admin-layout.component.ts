import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { HeroIconComponent } from '../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HeroIconComponent],
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent {
  constructor(public auth: AuthService) {}
}

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../shared/header/header.component';

@Component({
  selector: 'app-customer-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  templateUrl: './customer-layout.component.html',
})
export class CustomerLayoutComponent {}

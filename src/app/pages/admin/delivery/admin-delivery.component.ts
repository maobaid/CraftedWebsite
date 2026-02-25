import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeliverySettingsService } from '../../../core/services/delivery-settings.service';
import { HeroIconComponent } from '../../../shared/icons/hero-icon.component';

@Component({
  selector: 'app-admin-delivery',
  standalone: true,
  imports: [FormsModule, HeroIconComponent],
  templateUrl: './admin-delivery.component.html',
})
export class AdminDeliveryComponent {
  deliverySettings = inject(DeliverySettingsService);
  form = {
    defaultMessage: this.deliverySettings.getDefaultMessage(),
    minDaysUntilDelivery: this.deliverySettings.settings().minDaysUntilDelivery,
  };

  save(): void {
    this.deliverySettings.update({
      defaultMessage: this.form.defaultMessage.trim(),
      minDaysUntilDelivery: this.form.minDaysUntilDelivery,
    });
  }
}

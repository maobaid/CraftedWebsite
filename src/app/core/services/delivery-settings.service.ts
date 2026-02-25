import { Injectable, signal } from '@angular/core';

const DELIVERY_SETTINGS_KEY = 'crafted_delivery_settings';

const DEFAULT_MESSAGE = 'سيتم توصيل طلبك خلال يومي عمل';

export interface DeliverySettings {
  defaultMessage: string;
  minDaysUntilDelivery: number;
}

@Injectable({ providedIn: 'root' })
export class DeliverySettingsService {
  private settingsSignal = signal<DeliverySettings>(this.load());

  settings = this.settingsSignal.asReadonly();

  private load(): DeliverySettings {
    try {
      const raw = localStorage.getItem(DELIVERY_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.defaultMessage === 'string') return parsed;
      }
    } catch {}
    const def: DeliverySettings = {
      defaultMessage: DEFAULT_MESSAGE,
      minDaysUntilDelivery: 2,
    };
    this.persist(def);
    return def;
  }

  private persist(s: DeliverySettings): void {
    localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(s));
  }

  update(updates: Partial<DeliverySettings>): void {
    const next = { ...this.settingsSignal(), ...updates };
    this.settingsSignal.set(next);
    this.persist(next);
  }

  getDefaultMessage(): string {
    return this.settingsSignal().defaultMessage;
  }
}

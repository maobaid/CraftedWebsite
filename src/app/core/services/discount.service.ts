import { Injectable, signal } from '@angular/core';
import { DiscountCode } from '../models/discount.model';

const DISCOUNTS_KEY = 'crafted_discounts';

@Injectable({ providedIn: 'root' })
export class DiscountService {
  private discountsSignal = signal<DiscountCode[]>(this.loadDiscounts());

  discounts = this.discountsSignal.asReadonly();

  private loadDiscounts(): DiscountCode[] {
    try {
      const raw = localStorage.getItem(DISCOUNTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  private persist(list: DiscountCode[]): void {
    localStorage.setItem(DISCOUNTS_KEY, JSON.stringify(list));
  }

  getByCode(code: string): DiscountCode | undefined {
    const normalized = code.trim().toUpperCase();
    return this.discountsSignal().find(
      (d) => d.code.toUpperCase() === normalized && d.isActive && d.usedCount < d.maxUses && new Date(d.expiresAt) > new Date()
    );
  }

  applyDiscount(subtotal: number, code: string): { amount: number; message?: string } {
    const discount = this.getByCode(code);
    if (!discount) return { amount: 0, message: 'كود الخصم غير صالح أو منتهي' };
    const amount =
      discount.type === 'percentage'
        ? (subtotal * discount.value) / 100
        : Math.min(discount.value, subtotal);
    return { amount };
  }

  useCode(code: string): void {
    const list = this.discountsSignal().map((d) => {
      if (d.code.toUpperCase() !== code.trim().toUpperCase()) return d;
      return { ...d, usedCount: d.usedCount + 1 };
    });
    this.discountsSignal.set(list);
    this.persist(list);
  }

  add(discount: Omit<DiscountCode, 'id' | 'usedCount' | 'createdAt'>): DiscountCode {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newOne: DiscountCode = {
      ...discount,
      id,
      usedCount: 0,
      createdAt: now,
    };
    const list = [...this.discountsSignal(), newOne];
    this.discountsSignal.set(list);
    this.persist(list);
    return newOne;
  }

  update(id: string, updates: Partial<DiscountCode>): void {
    const list = this.discountsSignal().map((d) =>
      d.id === id ? { ...d, ...updates } : d
    );
    this.discountsSignal.set(list);
    this.persist(list);
  }

  delete(id: string): void {
    const list = this.discountsSignal().filter((d) => d.id !== id);
    this.discountsSignal.set(list);
    this.persist(list);
  }
}

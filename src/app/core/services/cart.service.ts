import { Injectable, signal, computed } from '@angular/core';
import { CartItem } from '../models/product.model';
import { ProductDiscountService } from './product-discount.service';

const CART_STORAGE_KEY = 'crafted_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private cartSignal = signal<CartItem[]>(this.loadCart());

  cart = this.cartSignal.asReadonly();
  count = computed(() => this.cartSignal().reduce((sum, i) => sum + i.quantity, 0));

  constructor(private productDiscountService: ProductDiscountService) {}

  subtotal = computed(() => {
    this.productDiscountService.discounts();
    return this.cartSignal().reduce(
      (sum, i) => sum + this.productDiscountService.getEffectivePrice(i.product).price * i.quantity,
      0
    );
  });

  private loadCart(): CartItem[] {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(items: CartItem[]): void {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }

  addItem(product: CartItem['product'], quantity = 1): void {
    const items = [...this.cartSignal()];
    const idx = items.findIndex((i) => i.product.id === product.id);
    if (idx >= 0) items[idx].quantity += quantity;
    else items.push({ product, quantity });
    this.cartSignal.set(items);
    this.persist(items);
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity < 1) {
      this.removeItem(productId);
      return;
    }
    const items = this.cartSignal().map((i) =>
      i.product.id === productId ? { ...i, quantity } : i
    );
    this.cartSignal.set(items);
    this.persist(items);
  }

  removeItem(productId: string): void {
    const items = this.cartSignal().filter((i) => i.product.id !== productId);
    this.cartSignal.set(items);
    this.persist(items);
  }

  clear(): void {
    this.cartSignal.set([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  }
}

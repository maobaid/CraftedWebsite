import { Injectable, signal, computed } from '@angular/core';
import {
  CartItem,
  CartLineCustomization,
  findMatchingVariant,
  productHasVariants,
} from '../models/product.model';
import { ProductDiscountService } from './product-discount.service';

const CART_STORAGE_KEY = 'crafted_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private cartSignal = signal<CartItem[]>(this.loadCart());

  cart = this.cartSignal.asReadonly();
  count = computed(() =>
    this.cartSignal().reduce((sum, i) => sum + i.quantity, 0),
  );

  constructor(private productDiscountService: ProductDiscountService) {}

  subtotal = computed(() => {
    this.productDiscountService.discounts();
    return this.cartSignal().reduce((sum, i) => {
      const line = this.productDiscountService.getEffectivePrice(i.product, {
        product_variant_id: i.product_variant_id,
        selectedColorHex: i.selectedColorHex,
        selectedSize: i.selectedSize,
      });
      return sum + line.price * i.quantity;
    }, 0);
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

  /**
   * Merge key for duplicate lines — variant + color/size + customization payload.
   */
  lineKey(item: CartItem): string {
    return this.getItemKey(item);
  }

  private normalizeLineCustomizations(
    rows: CartLineCustomization[] | undefined,
  ): CartLineCustomization[] | undefined {
    if (!rows?.length) return undefined;
    const mapped = rows
      .map((r) => {
        const id = r.product_customization_id?.trim();
        if (!id) return null;
        if (r.text_value != null && r.text_value !== '') {
          return {
            product_customization_id: id,
            text_value: r.text_value.trim(),
          } as CartLineCustomization;
        }
        if (r.image_url != null && r.image_url !== '') {
          return {
            product_customization_id: id,
            image_url: r.image_url.trim(),
          } as CartLineCustomization;
        }
        return null;
      })
      .filter((x): x is CartLineCustomization => x != null);
    if (!mapped.length) return undefined;
    return [...mapped].sort((a, b) =>
      a.product_customization_id.localeCompare(b.product_customization_id),
    );
  }

  private customizationKeyPart(
    c: CartLineCustomization[] | undefined,
  ): string {
    if (!c?.length) return '';
    return c
      .map(
        (row) =>
          `${row.product_customization_id}:${row.text_value ?? ''}:${row.image_url ?? ''}`,
      )
      .join('|');
  }

  private getItemKey(
    item: Pick<
      CartItem,
      | 'product'
      | 'selectedColorHex'
      | 'selectedSize'
      | 'product_variant_id'
      | 'customizations'
    >,
  ): string {
    const vid = item.product_variant_id?.trim();
    const base = vid
      ? `${item.product.id}::v:${vid}`
      : `${item.product.id}::${item.selectedColorHex ?? ''}::${item.selectedSize ?? ''}`;
    const cPart = this.customizationKeyPart(item.customizations);
    return cPart ? `${base}::c:${cPart}` : base;
  }

  private resolveVariantId(
    product: CartItem['product'],
    options: {
      explicitId?: string;
      selectedColorHex?: string;
      selectedSize?: string;
    },
  ): string | undefined {
    if (options.explicitId?.trim()) return options.explicitId.trim();
    if (!productHasVariants(product)) return undefined;
    const v = findMatchingVariant(
      product,
      options.selectedColorHex ?? '',
      options.selectedSize ?? '',
    );
    return v?.id;
  }

  addItem(
    product: CartItem['product'],
    quantity = 1,
    options?: {
      selectedColorHex?: string;
      selectedSize?: string;
      product_variant_id?: string;
      customizations?: CartLineCustomization[];
    },
  ): void {
    const items = [...this.cartSignal()];
    const selectedColorHex = options?.selectedColorHex;
    const selectedSize = options?.selectedSize;
    const product_variant_id = this.resolveVariantId(product, {
      explicitId: options?.product_variant_id,
      selectedColorHex,
      selectedSize,
    });
    const customizations = this.normalizeLineCustomizations(
      options?.customizations,
    );
    const newItem: CartItem = {
      product,
      quantity,
      selectedColorHex,
      selectedSize,
      product_variant_id,
      ...(customizations?.length ? { customizations } : {}),
    };
    const newKey = this.getItemKey(newItem);
    const idx = items.findIndex((i) => this.getItemKey(i) === newKey);
    if (idx >= 0) items[idx].quantity += quantity;
    else items.push(newItem);
    this.cartSignal.set(items);
    this.persist(items);
  }

  updateQuantity(item: CartItem, quantity: number): void {
    if (quantity < 1) {
      this.removeItem(item);
      return;
    }
    const targetKey = this.getItemKey(item);
    const items = this.cartSignal().map((i) =>
      this.getItemKey(i) === targetKey ? { ...i, quantity } : i,
    );
    this.cartSignal.set(items);
    this.persist(items);
  }

  updateItemOptions(
    item: CartItem,
    options: { selectedColorHex?: string; selectedSize?: string },
  ): void {
    const targetKey = this.getItemKey(item);
    const current = this.cartSignal();
    const next = current.map((i) => {
      if (this.getItemKey(i) !== targetKey) return i;
      const mergedColorHex =
        options.selectedColorHex !== undefined
          ? options.selectedColorHex
          : i.selectedColorHex;
      const mergedSize =
        options.selectedSize !== undefined
          ? options.selectedSize
          : i.selectedSize;
      const product_variant_id = this.resolveVariantId(i.product, {
        selectedColorHex: mergedColorHex ?? '',
        selectedSize: mergedSize ?? '',
      });
      return {
        ...i,
        selectedColorHex: mergedColorHex,
        selectedSize: mergedSize,
        product_variant_id,
      };
    });
    const merged: CartItem[] = [];
    for (const line of next) {
      const existingIndex = merged.findIndex(
        (m) => this.getItemKey(m) === this.getItemKey(line),
      );
      if (existingIndex >= 0) {
        merged[existingIndex] = {
          ...merged[existingIndex],
          quantity: merged[existingIndex].quantity + line.quantity,
        };
      } else {
        merged.push(line);
      }
    }
    this.cartSignal.set(merged);
    this.persist(merged);
  }

  removeItem(item: CartItem): void {
    const targetKey = this.getItemKey(item);
    const items = this.cartSignal().filter((i) => this.getItemKey(i) !== targetKey);
    this.cartSignal.set(items);
    this.persist(items);
  }

  clear(): void {
    this.cartSignal.set([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  }
}

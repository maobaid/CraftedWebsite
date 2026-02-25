import { Injectable, signal, computed } from '@angular/core';
import { Product } from '../models/product.model';

const PRODUCTS_KEY = 'crafted_products';

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: '1',
    nameAr: 'منتج تجريبي ١',
    descriptionAr: 'وصف قصير للمنتج الأول.',
    price: 99,
    imageUrl: 'https://picsum.photos/400/400?random=1',
    isActive: true,
  },
  {
    id: '2',
    nameAr: 'منتج تجريبي ٢',
    descriptionAr: 'وصف للمنتج الثاني.',
    price: 149,
    imageUrl: 'https://picsum.photos/400/400?random=2',
    discountType: 'percentage',
    discountValue: 10,
    isActive: true,
  },
  {
    id: '3',
    nameAr: 'منتج تجريبي ٣',
    price: 199,
    imageUrl: 'https://picsum.photos/400/400?random=3',
    isActive: true,
  },
];

@Injectable({ providedIn: 'root' })
export class ProductService {
  private productsSignal = signal<Product[]>(this.loadProducts());

  products = computed(() => this.productsSignal().filter((p) => p.isActive));
  allProducts = this.productsSignal.asReadonly();

  private loadProducts(): Product[] {
    try {
      const raw = localStorage.getItem(PRODUCTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}
    this.persist(DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  }

  private persist(list: Product[]): void {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(list));
  }

  getById(id: string): Product | undefined {
    return this.productsSignal().find((p) => p.id === id);
  }

  add(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newProduct: Product = {
      ...product,
      id,
      createdAt: now,
      updatedAt: now,
    };
    const list = [...this.productsSignal(), newProduct];
    this.productsSignal.set(list);
    this.persist(list);
    return newProduct;
  }

  update(id: string, updates: Partial<Product>): Product | undefined {
    const list = this.productsSignal().map((p) => {
      if (p.id !== id) return p;
      return { ...p, ...updates, updatedAt: new Date().toISOString() };
    });
    this.productsSignal.set(list);
    this.persist(list);
    return list.find((p) => p.id === id);
  }

  delete(id: string): boolean {
    const list = this.productsSignal().filter((p) => p.id !== id);
    if (list.length === this.productsSignal().length) return false;
    this.productsSignal.set(list);
    this.persist(list);
    return true;
  }
}

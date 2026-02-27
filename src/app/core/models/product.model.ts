// Product model matches backend DTO exactly
export interface Product {
  id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
}

export const DEFAULT_PRODUCT_IMAGE = '/B1DFDACD-BCB9-489E-85BF-0F4E7A263DF5.JPG';

export interface CartItem {
  product: Product;
  quantity: number;
}

/** Price to show for a product (no discount; discounts come from product_discount table). */
export function getProductPrice(product: Product): number {
  const price = typeof product?.price === 'number' && !Number.isNaN(product.price) ? product.price : 0;
  return price;
}

// ─── Product discount (separate table: product_discount) ─────────────────────

export type AppliesTo = 'ALL_PRODUCTS' | 'CATEGORY' | 'SPECIFIC_PRODUCTS';

export interface ProductDiscount {
  id?: string;
  name: string;
  percentage: number;
  applies_to: AppliesTo;
  category_id?: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  product_ids: string[];
}

/** Result of applying discounts to a product (for display) */
export interface ProductPriceResult {
  price: number;
  originalPrice: number;
  discount: ProductDiscount | null;
}

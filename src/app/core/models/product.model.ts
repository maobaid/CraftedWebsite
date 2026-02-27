export interface Product {
  id: string;
  nameAr: string;
  descriptionAr?: string;
  price: number;
  imageUrl: string;
  isActive: boolean;
  category_id?: string;
}

export const DEFAULT_PRODUCT_IMAGE = '/B1DFDACD-BCB9-489E-85BF-0F4E7A263DF5.JPG';

/** Backend API shape for products (snake_case) – only what is stored in DB */
export interface ProductApi {
  id?: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id?: string;
  is_active?: boolean;
}

export function productFromApi(api: ProductApi | Record<string, unknown>): Product {
  const a = api as Record<string, unknown>;
  const title = (a['title'] ?? a['name'] ?? '') as string;
  const price = typeof a['price'] === 'number' ? a['price'] : Number(a['price']) || 0;
  return {
    id: (a['id'] ?? '') as string,
    nameAr: String(title || '').trim() || 'بدون اسم',
    descriptionAr: (a['description'] as string) || undefined,
    price,
    imageUrl: (a['image_url'] as string) || DEFAULT_PRODUCT_IMAGE,
    isActive: a['is_active'] !== false,
    category_id: a['category_id'] as string | undefined,
  };
}

export function productToApiBody(p: {
  nameAr: string;
  descriptionAr?: string;
  price: number;
  imageUrl?: string;
  isActive?: boolean;
  category_id?: string;
}): Omit<ProductApi, 'id'> {
  return {
    title: p.nameAr,
    description: p.descriptionAr ?? '',
    price: p.price,
    image_url: p.imageUrl || undefined,
    category_id: p.category_id || undefined,
    is_active: p.isActive ?? true,
  };
}

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

/** API shape for product_discount (snake_case) */
export interface ProductDiscountApi {
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

export interface Product {
  id: string;
  nameAr: string;
  descriptionAr?: string;
  price: number;
  imageUrl: string;
  imageUrls?: string[];
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  isActive: boolean;
  category_id?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_PRODUCT_IMAGE = '/B1DFDACD-BCB9-489E-85BF-0F4E7A263DF5.JPG';

/** Backend API shape for products (snake_case) */
export interface ProductApi {
  id?: string;
  category_id?: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  is_active?: boolean;
}

export function productFromApi(api: ProductApi): Product {
  return {
    id: api.id ?? '',
    nameAr: api.title,
    descriptionAr: api.description || undefined,
    price: api.price,
    imageUrl: api.image_url || DEFAULT_PRODUCT_IMAGE,
    isActive: api.is_active ?? true,
    category_id: api.category_id,
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
    category_id: p.category_id || undefined,
    title: p.nameAr,
    description: p.descriptionAr || undefined,
    price: p.price,
    image_url: p.imageUrl || undefined,
    is_active: p.isActive ?? true,
  };
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export function getProductPrice(product: Product): number {
  if (!product.discountValue) return product.price;
  if (product.discountType === 'percentage') {
    return product.price * (1 - product.discountValue / 100);
  }
  return Math.max(0, product.price - product.discountValue);
}

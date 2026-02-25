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
  createdAt?: string;
  updatedAt?: string;
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

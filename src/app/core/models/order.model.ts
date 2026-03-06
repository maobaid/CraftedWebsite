import { CartItem } from './product.model';

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered';

export interface CustomerInfo {
  phone: string;
  fullName: string;
  email?: string;
  address?: string;
}

export interface DeliverySlot {
  date: string;
  time?: string;
  scheduled: boolean;
}

/** Frontend order (local/checkout or normalized from API). */
export interface Order {
  id: string;
  customerId?: string;
  customer: CustomerInfo;
  items: CartItem[];
  subtotal: number;
  total: number;
  status: OrderStatus;
  deliverySlot?: DeliverySlot;
  deliveryMessage?: string;
  discountCode?: string;
  discountAmount?: number;
  paymentStatus?: 'pending' | 'paid';
  createdAt: string;
  updatedAt?: string;
}

// ─── Backend API DTOs ─────────────────────────────────────────────────────

export interface CreateOrderItemDto {
  product_id: string;
  quantity: number;
}

export interface CreateOrderDto {
  customer_id: string;
  address_id: string;
  items: CreateOrderItemDto[];
  coupon_code?: string;
  scheduled_delivery?: string;
}

/** Order item as returned by API (may include product details). */
export interface OrderItemResponse {
  product_id: string;
  quantity: number;
  product_title?: string;
  product_price?: number;
}

/** Order as returned by API (GET /stores/:storeId/orders). */
export interface OrderResponse {
  id: string;
  customer_id?: string;
  address_id?: string;
  customer?: { id?: string; full_name?: string; phone?: string; email?: string; address?: string };
  address?: string | { id?: string; line?: string; city?: string; [key: string]: unknown };
  items: OrderItemResponse[];
  coupon_code?: string;
  scheduled_delivery?: string;
  status?: OrderStatus;
  subtotal?: number;
  total?: number;
  discount_amount?: number;
  created_at?: string;
  updated_at?: string;
}

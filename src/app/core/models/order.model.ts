import { CartItem } from './product.model';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED';

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
  /** Total product-level discount (from API total_product_discount_amount). */
  productDiscountAmount?: number;
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
  unit_price?: string | number;
  product_discount_applied?: string | number;
  product_title?: string;
  product_price?: number;
}

/** Order as returned by API (GET /stores/:storeId/orders). */
export interface OrderResponse {
  id: string;
  store_id?: string;
  customer_id?: string;
  address_id?: string;
  coupon_id?: string | null;
  total_amount?: string | number;
  total_product_discount_amount?: string | number;
  total_coupon_discount_amount?: string | number;
  customer?: { id?: string; full_name?: string; phone?: string; email?: string; address?: string };
  address?: string | { id?: string; line?: string; city?: string; [key: string]: unknown };
  items: OrderItemResponse[];
  coupon_code?: string;
  scheduled_delivery?: string | null;
  status?: string;
  subtotal?: number;
  total?: number;
  discount_amount?: number;
  created_at?: string;
  updated_at?: string;
}

/** Response payload from POST /stores/:storeId/orders/:orderId/receipt/resend. */
export interface ResendOrderReceiptResponse {
  message?: string;
  status?: string;
}

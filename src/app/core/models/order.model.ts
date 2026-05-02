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

/** Matching product customization id; TEXT → text_value only; IMAGE → image_url only. */
export interface CreateOrderLineCustomizationDto {
  product_customization_id: string;
  text_value?: string;
  image_url?: string;
}

export interface CreateOrderItemDto {
  product_id: string;
  quantity: number;
  /** When the line uses variant stock / pricing — required for storefront variant products at checkout */
  product_variant_id?: string;
  customizations?: CreateOrderLineCustomizationDto[];
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
  product_variant_id?: string;
  unit_price?: string | number;
  product_discount_applied?: string | number;
  product_title?: string;
  product_price?: number;
  customization_values?: {
    label_snapshot?: string;
    kind?: string;
    text_mode?: string | null;
    text_value?: string | null;
    image_url?: string | null;
    product_customization_id?: string;
  }[];
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

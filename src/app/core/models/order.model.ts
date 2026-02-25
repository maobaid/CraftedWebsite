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

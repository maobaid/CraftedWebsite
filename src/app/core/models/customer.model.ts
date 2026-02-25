import { Order } from './order.model';

export interface Customer {
  id: string;
  phone: string;
  fullName: string;
  email?: string;
  address?: string;
  orders?: Order[];
  createdAt: string;
  updatedAt?: string;
}

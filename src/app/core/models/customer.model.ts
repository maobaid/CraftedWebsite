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

/** Customer as returned by GET /stores/:storeId/customers/by-phone */
export interface StoreCustomerResponse {
  id: string;
  full_name?: string;
  phone_number?: string;
  email?: string;
  [key: string]: unknown;
}

/** Body for POST /stores/:storeId/customers (register new customer) */
export interface CreateStoreCustomerDto {
  phone_number: string;
  full_name: string;
  email?: string;
}

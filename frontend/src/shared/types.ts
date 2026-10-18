/** Wire contracts of the existing Python API; money remains server-authoritative. */
export interface Property {
  name: string;
  description: string;
}
export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  photo: number;
  photos: string[];
  properties: Property[];
  description: string;
  demo: boolean;
}
export interface Settings {
  name: string;
  logo: string;
  accent: string;
  background: string;
  text: string;
  telegram: string;
}
export interface Shop {
  products: Product[];
  settings: Settings;
}
export interface Session {
  authenticated: boolean;
  setup: boolean;
}
export type Delivery = 'post' | 'pickup';
export interface Customer {
  fullname: string;
  phone: string;
}
export interface OrderInput extends Customer {
  token: string;
  delivery: Delivery;
  address: string;
  items: { id: number; quantity: number }[];
}
export interface OrderReceipt {
  id: number;
  total: number;
  delivery: Delivery;
}
export interface Order extends OrderReceipt {
  status: string;
  created: string;
  customer: Customer;
  address: string;
  items: { id: number; name: string; price: number; quantity: number }[];
}
export interface OrdersResponse {
  orders: Order[];
  statuses: string[];
}
export type ProductInput = Omit<Product, 'id'> & { id: number | null };

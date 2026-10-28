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
  cart_version: number;
}
export interface CartLine extends Product {
  quantity: number;
  subtotal: number;
}
export interface CartChange {
  id: number;
  name: string;
  reason: 'price_changed' | 'unavailable';
  old_price?: number;
  price?: number;
}
export interface Cart {
  lines: CartLine[];
  count: number;
  total: number;
  version: number;
  changes: CartChange[];
}
export interface OrderReceipt {
  id: number;
  total: number;
  delivery: Delivery;
  cart: Cart;
}
export interface Order extends Omit<OrderReceipt, 'cart'> {
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

import { request } from './http';
import type { OrderInput, OrderReceipt, OrdersResponse } from '@/types/api';
import { isCart } from './cart';

/** Сохраняет заказ; принимает только подтверждение с серверной суммой и номером. */
export async function createOrder(input: OrderInput): Promise<OrderReceipt> {
  const data = await request<OrderReceipt>('/api/orders', input);
  if (
    !data ||
    !Number.isInteger(data.id) ||
    !Number.isFinite(data.total) ||
    !['post', 'pickup'].includes(data.delivery) ||
    !isCart(data.cart)
  )
    throw new Error('Некорректное подтверждение заказа.');
  return data;
}
/** Читает заказы и разрешённые сервером статусы. */
export const fetchOrders = () => request<OrdersResponse>('/api/admin/orders');
/** Меняет статус заказа; допустимость перехода проверяет сервер. */
export const updateOrderStatus = (id: number, status: string) =>
  request('/api/admin/orders', { id, status });

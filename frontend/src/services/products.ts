import { request } from './http';
import type { ProductInput } from '@/types/api';
/** Создаёт или обновляет товар и возвращает его идентификатор. */
export const saveProduct = (product: ProductInput) =>
  request<{ id: number }>('/api/admin/products', product);
/** Убирает товар из каталога; исторические заказы сохраняются на сервере. */
export const deleteProduct = (id: number) =>
  request('/api/admin/products', { id }, 'DELETE');

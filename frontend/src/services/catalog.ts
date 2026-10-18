import type { Shop } from '@/types/api';
import { request } from './http';

/** Проверяет структуру каталога перед передачей данных в реактивное состояние. */
export async function fetchShop(): Promise<Shop> {
  const data = await request<Shop>('/api/shop');
  if (
    !data ||
    !Array.isArray(data.products) ||
    !data.settings ||
    !data.products.every(
      (product) =>
        Number.isInteger(product.id) &&
        typeof product.name === 'string' &&
        typeof product.category === 'string' &&
        Number.isFinite(product.price) &&
        product.price > 0 &&
        Array.isArray(product.photos) &&
        Array.isArray(product.properties),
    )
  ) {
    throw new Error('Некорректные данные каталога.');
  }
  return data;
}

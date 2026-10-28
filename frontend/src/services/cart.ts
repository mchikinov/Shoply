import { request } from './http';
import type { Cart } from '@/types/api';

export interface CartOperation {
  path: string;
  method: string;
  body: {
    version: number;
    request_id: string;
    id?: number;
    quantity?: number;
    delta?: number;
  };
}

/** Проверяет форму серверного снимка, не пересчитывая его предметные значения. */
export function isCart(value: unknown): value is Cart {
  if (!value || typeof value !== 'object') return false;
  const cart = value as Cart;
  return (
    Number.isInteger(cart.version) &&
    cart.version >= 0 &&
    Number.isInteger(cart.count) &&
    cart.count >= 0 &&
    Number.isFinite(cart.total) &&
    cart.total >= 0 &&
    Array.isArray(cart.changes) &&
    Array.isArray(cart.lines) &&
    cart.lines.every(
      (line) =>
        line &&
        Number.isInteger(line.id) &&
        typeof line.name === 'string' &&
        Array.isArray(line.photos) &&
        Number.isInteger(line.quantity) &&
        Number.isFinite(line.price) &&
        Number.isFinite(line.subtotal),
    )
  );
}

/** Принимает только полноценный серверный снимок, включая суммы позиций. */
async function readCart(
  path: string,
  body?: object,
  method?: string,
): Promise<Cart> {
  const data = await request<unknown>(path, body, method);
  if (!isCart(data)) throw new Error('Сервер вернул некорректную корзину.');
  return data;
}

export const fetchCart = () => readCart('/api/cart');
export const updateCart = (operation: CartOperation) =>
  readCart(operation.path, operation.body, operation.method);

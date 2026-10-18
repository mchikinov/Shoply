import { ref } from 'vue';
import { api } from '../../shared/api';
import type { OrderInput, OrderReceipt } from '../../shared/types';

/** Сохраняет единый токен повторной отправки до подтверждения заказа, предотвращая дубли. */
export function useCheckout() {
  const submitting = ref(false);
  const receipt = ref<OrderReceipt | null>(null);
  let token: string | null = null;

  /** Отправляет заказ с прежним токеном при повторе; сбрасывает токен только после корректного ответа. */
  async function submit(input: Omit<OrderInput, 'token'>) {
    if (submitting.value) return null;
    submitting.value = true;
    try {
      if (!token) {
        try {
          token = localStorage.getItem('shoply-pending-token');
        } catch {
          /* Session-only token. */
        }
      }
      if (!token) token = crypto.randomUUID();
      try {
        localStorage.setItem('shoply-pending-token', token);
      } catch {
        /* Retry still uses in-memory token. */
      }
      const data = await api<OrderReceipt>('/api/orders', { ...input, token });
      if (
        !Number.isInteger(data.id) ||
        !Number.isFinite(data.total) ||
        !['post', 'pickup'].includes(data.delivery)
      )
        throw new Error('Некорректное подтверждение заказа.');
      receipt.value = data;
      token = null;
      try {
        localStorage.removeItem('shoply-pending-token');
      } catch {
        /* Storage is optional. */
      }
      return data;
    } finally {
      submitting.value = false;
    }
  }

  return { submitting, receipt, submit };
}

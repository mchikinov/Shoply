import { ref } from 'vue';
import { defineStore } from 'pinia';
import { createOrder } from '@/services/orders';
import type { OrderInput, OrderReceipt } from '@/types/api';

/** Хранит подтверждение и токен повтора до успешного ответа; не сохраняет персональные данные. */
export const useCheckoutStore = defineStore('checkout', () => {
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
      const data = await createOrder({ ...input, token });
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
});

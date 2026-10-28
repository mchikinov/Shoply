import { ref } from 'vue';
import { defineStore } from 'pinia';
import { createOrder } from '@/services/orders';
import type { OrderInput, OrderReceipt } from '@/types/api';
import { useCartStore } from './cart';
import { ApiError } from '@/services/http';
import { isCart } from '@/services/cart';

/** Хранит подтверждение и токен повтора до успешного ответа; не сохраняет персональные данные. */
export const useCheckoutStore = defineStore('checkout', () => {
  const submitting = ref(false);
  const receipt = ref<OrderReceipt | null>(null);
  let token: string | null = null;
  let pendingStorage: Storage | null = null;
  try {
    pendingStorage = sessionStorage;
    token = pendingStorage.getItem('shoply-pending-token');
  } catch {
    /* Storage is optional. */
  }
  const hasPending = ref(!!token);
  const cart = useCartStore();

  /** Закрывает подтверждённую или отклонённую попытку; сетевой сбой её сохраняет. */
  function resetToken() {
    token = null;
    hasPending.value = false;
    try {
      pendingStorage?.removeItem('shoply-pending-token');
    } catch {
      /* Storage is optional. */
    }
  }

  /** Повторяет прежний токен после сетевого сбоя; завершает попытку при успехе или явном отказе. */
  async function submit(input: Omit<OrderInput, 'token'>) {
    if (submitting.value) return null;
    submitting.value = true;
    try {
      if (!token) {
        try {
          token = pendingStorage?.getItem('shoply-pending-token') ?? null;
        } catch {
          /* Session-only token. */
        }
      }
      if (!token) token = crypto.randomUUID();
      hasPending.value = true;
      try {
        pendingStorage?.setItem('shoply-pending-token', token);
      } catch {
        /* Retry still uses in-memory token. */
      }
      const requestToken = token;
      return await cart.synchronize(async () => {
        try {
          const data = await createOrder({ ...input, token: requestToken });
          cart.accept(data.cart);
          cart.notice = '';
          receipt.value = data;
          resetToken();
          return data;
        } catch (cause) {
          if (cause instanceof ApiError && cause.status === 409) {
            const data = cause.data as
              { code?: string; cart?: unknown } | undefined;
            if (data?.code === 'cart_changed' && isCart(data.cart)) {
              cart.accept(data.cart, cause.message);
            }
          }
          if (
            cause instanceof ApiError &&
            cause.status >= 400 &&
            cause.status < 500
          )
            resetToken();
          throw cause;
        }
      });
    } finally {
      submitting.value = false;
    }
  }

  return { submitting, receipt, hasPending, submit };
});

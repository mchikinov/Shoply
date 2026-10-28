<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import CheckoutForm from '@/components/storefront/CheckoutForm.vue';
import { useCartStore } from '@/stores/cart';
import { useCheckoutStore } from '@/stores/checkout';
import { useNotificationsStore } from '@/stores/notifications';
import { getErrorMessage } from '@/utils/errors';
import { ApiError } from '@/services/http';
import type { Delivery } from '@/types/api';
const cart = useCartStore();
const { lines, total, ready } = storeToRefs(cart);
const checkout = useCheckoutStore();
const { submitting, receipt, hasPending } = storeToRefs(checkout);
const { notify } = useNotificationsStore();
const router = useRouter();
/** Сохраняет заказ; очищает корзину и форму только после подтверждения сервера. */
async function placeOrder(fields: {
  fullname: string;
  phone: string;
  delivery: Delivery;
  address: string;
}) {
  if (
    !ready.value ||
    (!cart.count && !hasPending.value) ||
    cart.busy ||
    cart.uncertain
  )
    return;
  try {
    const saved = await checkout.submit({
      ...fields,
      cart_version: cart.version,
    });
    if (saved) {
      await router.push({ name: 'success' });
    }
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      (error.data as { code?: string } | undefined)?.code === 'cart_changed'
    ) {
      await router.push({ name: 'cart' });
      return;
    }
    notify(getErrorMessage(error) + ' Данные формы и корзина сохранены.');
  }
}
</script>
<template>
  <CheckoutForm
    :key="receipt?.id ?? 'draft'"
    :lines="lines"
    :total="total"
    :ready="ready"
    :submitting="submitting"
    :has-pending="hasPending"
    @submit="placeOrder"
  />
</template>

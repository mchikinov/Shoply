<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import CheckoutForm from '@/components/storefront/CheckoutForm.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useCartStore } from '@/stores/cart';
import { useCheckoutStore } from '@/stores/checkout';
import { useNotificationsStore } from '@/stores/notifications';
import { getErrorMessage } from '@/utils/errors';
import type { Delivery } from '@/types/api';
const { ready } = storeToRefs(useCatalogStore());
const cart = useCartStore();
const { lines, total } = storeToRefs(cart);
const checkout = useCheckoutStore();
const { submitting, receipt } = storeToRefs(checkout);
const { notify } = useNotificationsStore();
const router = useRouter();
/** Сохраняет заказ; очищает корзину и форму только после подтверждения сервера. */
async function placeOrder(fields: {
  fullname: string;
  phone: string;
  delivery: Delivery;
  address: string;
}) {
  if (!ready.value || !cart.count) return;
  try {
    const saved = await checkout.submit({
      ...fields,
      items: lines.value.map((product) => ({
        id: product.id,
        quantity: product.quantity,
      })),
    });
    if (saved) {
      cart.clear();
      await router.push({ name: 'success' });
    }
  } catch (error) {
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
    @submit="placeOrder"
  />
</template>

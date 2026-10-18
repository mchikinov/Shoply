import { computed, reactive, watch } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { useCatalogStore } from './catalog';
import { readBasket } from '@/utils/basketStorage';

/** Корзина одного приложения; формат localStorage совместим с прежней версией. */
export const useCartStore = defineStore('cart', () => {
  const { products } = storeToRefs(useCatalogStore());
  const basket = reactive(readBasket());
  watch(
    basket,
    () => {
      try {
        localStorage.setItem('shoply-basket', JSON.stringify(basket));
      } catch {
        /* Session-only basket. */
      }
    },
    { flush: 'sync' },
  );
  const lines = computed(() =>
    products.value
      .filter((product) => basket[product.id] > 0)
      .map((product) => ({ ...product, quantity: basket[product.id] })),
  );
  const count = computed(() =>
    lines.value.reduce((sum, product) => sum + product.quantity, 0),
  );
  const total = computed(() =>
    lines.value.reduce(
      (sum, product) => sum + product.price * product.quantity,
      0,
    ),
  );

  /** Меняет количество существующего товара в пределах 0–999; ноль удаляет позицию. */
  const change = (id: number, delta: number) => {
    if (!products.value.some((product) => product.id === id)) return;
    const quantity = Math.max(0, Math.min(999, (basket[id] || 0) + delta));
    if (quantity) basket[id] = quantity;
    else delete basket[id];
  };

  /** Удаляет позицию; наблюдатель состояния сохраняет обновлённую корзину. */
  const remove = (id: number) => {
    delete basket[id];
  };

  /** Очищает корзину после подтверждённого заказа. */
  const clear = () =>
    Object.keys(basket).forEach((id) => delete basket[Number(id)]);

  return { basket, lines, count, total, change, remove, clear };
});

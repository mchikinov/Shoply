import { computed, reactive, watch, type Ref } from 'vue';
import type { Product } from '../../shared/types';

/** Читает сохранённую корзину с проверкой данных; запрет хранилища не блокирует покупки. */
export function readBasket(): Record<number, number> {
  const basket: Record<number, number> = {};
  try {
    const saved = JSON.parse(localStorage.getItem('shoply-basket') || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved))
      return basket;
    for (const [id, quantity] of Object.entries(saved)) {
      if (
        Number.isInteger(Number(id)) &&
        Number(id) >= 0 &&
        Number.isInteger(quantity) &&
        Number(quantity) > 0 &&
        Number(quantity) <= 999
      )
        basket[Number(id)] = Number(quantity);
    }
  } catch {
    /* Malformed or unavailable storage falls back to an empty basket. */
  }
  return basket;
}

/** Сохраняет формат корзины и вычисляет суммы по текущему каталогу. */
export function useCart(products: Ref<Product[]>) {
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
    lines.value.reduce((sum, product) => sum + product.price * product.quantity, 0),
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
}

export type Cart = ReturnType<typeof useCart>;

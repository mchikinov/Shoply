import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { fetchCart, isCart, updateCart } from '@/services/cart';
import type { CartOperation } from '@/services/cart';
import { ApiError } from '@/services/http';
import { getErrorMessage } from '@/utils/errors';
import type { Cart } from '@/types/api';
import { formatPrice } from '@/utils/format';

/** Хранит последний серверный снимок; очередь сохраняет порядок HTTP-ответов. */
export const useCartStore = defineStore('cart', () => {
  const snapshot = shallowRef<Cart | null>(null);
  const ready = ref(false);
  const error = ref('');
  const notice = ref('');
  const pendingCount = ref(0);
  const uncertain = ref(false);
  let pending: CartOperation | null = null;
  let queue = Promise.resolve();
  const busy = computed(() => pendingCount.value > 0);
  const lines = computed(() => snapshot.value?.lines ?? []);
  const count = computed(() => snapshot.value?.count ?? 0);
  const total = computed(() => snapshot.value?.total ?? 0);
  const version = computed(() => snapshot.value?.version ?? 0);
  // Представление полученных количеств для карточек, без правил и расчёта цен.
  const basket = computed(() =>
    Object.fromEntries(lines.value.map((line) => [line.id, line.quantity])),
  );

  /** Применяет снимок сервера и объясняет изменения каталога покупателю. */
  function accept(cart: Cart, message = '') {
    snapshot.value = cart;
    ready.value = true;
    error.value = '';
    const changes = cart.changes.map((change) =>
      change.reason === 'unavailable'
        ? `${change.name}: товар больше недоступен и удалён из корзины.`
        : `${change.name}: цена изменилась с ${formatPrice(change.old_price ?? 0)} на ${formatPrice(change.price ?? 0)}.`,
    );
    if (message || changes.length)
      notice.value = [
        message || 'Корзина изменилась. Проверьте актуальные товары и цены.',
        ...changes,
      ]
        .filter(Boolean)
        .join(' ');
  }

  /** Последовательно выполняет чтения и действия, в том числе после ошибки запроса. */
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    pendingCount.value++;
    const result = queue.then(task).finally(() => {
      pendingCount.value--;
    });
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Загружает актуальную корзину; ошибка не превращается в пустое успешное состояние. */
  function load() {
    return enqueue(async () => {
      try {
        accept(await fetchCart());
      } catch (cause) {
        ready.value = false;
        error.value = getErrorMessage(cause);
      }
    });
  }

  /** Повторяет ровно исходную операцию, если её результат неизвестен из-за сети. */
  async function execute(operation: CartOperation) {
    pending = operation;
    try {
      const cart = await updateCart(operation);
      accept(cart);
      pending = null;
      uncertain.value = false;
    } catch (cause) {
      error.value = getErrorMessage(cause);
      if (
        cause instanceof ApiError &&
        cause.status >= 400 &&
        cause.status < 500
      ) {
        const data = cause.data as { cart?: unknown } | undefined;
        if (isCart(data?.cart)) accept(data.cart, cause.message);
        pending = null;
        uncertain.value = false;
      } else {
        uncertain.value = true;
      }
      throw cause;
    }
  }

  /** Отправляет намерение покупателя без локального изменения состава или количества. */
  function mutate(
    path: string,
    method: string,
    fields: { id?: number; quantity?: number; delta?: number } = {},
  ) {
    return enqueue(async () => {
      if (pending)
        throw new Error(
          'Сначала повторите неподтверждённую операцию в корзине.',
        );
      if (!ready.value) accept(await fetchCart());
      notice.value = '';
      await execute({
        path,
        method,
        body: {
          ...fields,
          version: version.value,
          request_id: crypto.randomUUID(),
        },
      });
    });
  }

  const change = (id: number, delta: number) =>
    delta > 0
      ? mutate('/api/cart/items', 'POST', { id, quantity: delta })
      : mutate(`/api/cart/items/${id}`, 'PATCH', { delta });
  const remove = (id: number) => mutate(`/api/cart/items/${id}`, 'DELETE');
  const clear = () => mutate('/api/cart/items', 'DELETE');

  /** Повтор доступен явно, чтобы потеря ответа не создавала новую покупку. */
  function retry() {
    if (!pending) return load();
    const operation = pending;
    return enqueue(() => execute(operation));
  }

  return {
    lines,
    count,
    total,
    version,
    basket,
    ready,
    error,
    notice,
    busy,
    uncertain,
    load,
    change,
    remove,
    clear,
    retry,
    accept,
    synchronize: enqueue,
  };
});

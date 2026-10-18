import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { fetchShop } from '@/services/catalog';
import { getErrorMessage } from '@/utils/errors';
import type { Product, Settings } from '@/types/api';

/** Каталог одного приложения; параллельные старты используют один запрос. */
export const useCatalogStore = defineStore('catalog', () => {
  const products = ref<Product[]>([]);
  const settings = ref<Settings>({
    name: 'Shoply',
    logo: '',
    accent: '#2864e8',
    background: '#ffffff',
    text: '#182231',
    telegram: '',
  });
  const ready = ref(false);
  const loading = ref(true);
  const error = ref('');
  const search = ref('');
  let initialization: Promise<void> | undefined;
  const note = computed(() =>
    error.value
      ? 'Нет соединения с сервером. Оформление недоступно: ' + error.value
      : ready.value
        ? 'Онлайн-оплата пока недоступна. Заказы сохраняются в магазине.'
        : 'Shoply · Подключение к магазину…',
  );
  /** Заменяет данные проверенным ответом; ошибка передаётся вызывающему коду. */
  async function refresh() {
    const shop = await fetchShop();
    products.value = shop.products;
    settings.value = shop.settings;
    ready.value = true;
    error.value = '';
    loading.value = false;
  }
  /** Загружает витрину один раз, сохраняя сообщение об ошибке для интерфейса. */
  function initialize() {
    initialization ??= refresh()
      .catch((cause: unknown) => {
        error.value = getErrorMessage(cause);
      })
      .finally(() => {
        loading.value = false;
      });
    return initialization;
  }
  /** Удаляет данные завершённой сессии админки. */
  function clear() {
    products.value = [];
    ready.value = false;
    initialization = undefined;
  }
  return {
    products,
    settings,
    ready,
    loading,
    error,
    search,
    note,
    refresh,
    initialize,
    clear,
  };
});

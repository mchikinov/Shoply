import { computed, ref, watch, type Ref } from 'vue';
import type { Product } from '@/types/api';

/** Вычисляет фильтры экземпляра каталога; диапазон обновляется после загрузки товаров. */
export function useProductFilters(
  products: Ref<Product[]>,
  search: Ref<string>,
) {
  const category = ref('Все');
  const sort = ref('new');
  const lower = computed(() =>
    products.value.length
      ? Math.min(...products.value.map((product) => product.price))
      : 0,
  );
  const upper = computed(() =>
    products.value.length
      ? Math.max(...products.value.map((product) => product.price))
      : 0,
  );
  const min = ref(0);
  const max = ref(0);
  watch(
    [lower, upper],
    () => {
      min.value = lower.value;
      max.value = upper.value;
    },
    { immediate: true },
  );
  const categories = computed(() => [
    'Все',
    ...new Set(products.value.map((product) => product.category)),
  ]);
  const filtered = computed(() =>
    products.value
      .filter(
        (product) =>
          (category.value === 'Все' || category.value === product.category) &&
          product.name
            .toLowerCase()
            .includes(search.value.trim().toLowerCase()) &&
          product.price >= min.value &&
          product.price <= max.value,
      )
      .sort((a, b) =>
        sort.value === 'new'
          ? b.id - a.id
          : (sort.value === 'asc' ? 1 : -1) * (a.price - b.price),
      ),
  );
  /** Сбрасывает локальные фильтры к полному диапазону каталога. */
  function resetFilters() {
    category.value = 'Все';
    sort.value = 'new';
    min.value = lower.value;
    max.value = upper.value;
  }
  return {
    category,
    sort,
    min,
    max,
    lower,
    upper,
    categories,
    filtered,
    resetFilters,
  };
}

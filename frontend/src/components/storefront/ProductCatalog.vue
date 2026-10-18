<script setup lang="ts">
import { nextTick, ref, toRef, watch } from 'vue';
import type { Product } from '@/types/api';
import { plural } from '@/utils/format';
import { animateAppearance } from '@/utils/motion';
import ProductCard from './ProductCard.vue';
import CatalogFilters from './CatalogFilters.vue';
import { useProductFilters } from '@/composables/useProductFilters';

const props = defineProps<{
  products: Product[];
  basket: Record<number, number>;
  loading: boolean;
  search: string;
}>();
const emit = defineEmits<{
  change: [id: number, delta: number];
  remove: [id: number];
  reset: [];
}>();
const root = ref<HTMLElement>();
const {
  category,
  sort,
  min,
  max,
  lower,
  upper,
  categories,
  filtered,
  resetFilters,
} = useProductFilters(toRef(props, 'products'), toRef(props, 'search'));
watch([filtered, () => props.loading], async () => {
  await nextTick();
  const cards = root.value?.querySelectorAll<HTMLElement>(
    '.product-grid article',
  );
  [...(cards || [])].slice(0, 4).forEach((card, index) => {
    if (card.getClientRects().length)
      animateAppearance(card, 4, 180, index * 25);
  });
});
/** Сбрасывает фильтры и просит страницу очистить общий поиск. */
function reset() {
  resetFilters();
  emit('reset');
}
</script>

<template>
  <section
    id="catalog"
    ref="root"
    class="screen"
    :class="{ 'is-loading': loading }"
  >
    <div class="heading-row">
      <h1>Каталог товаров</h1>
      <span
        v-if="products.some((product) => product.demo)"
        class="demo"
        >Демонстрационный каталог</span
      >
    </div>
    <CatalogFilters
      v-model:min="min"
      v-model:max="max"
      v-model:category="category"
      v-model:sort="sort"
      :lower="lower"
      :upper="upper"
      :categories="categories"
      :loading="loading"
      @reset="reset"
    />
    <div class="result-row">
      <span id="found-demo"
        >{{ filtered.length }} {{ plural(filtered.length) }}</span
      >
      <span>Цены указаны в рублях</span>
    </div>
    <p
      v-if="loading"
      id="catalog-loading-status"
      class="loading-status"
      role="status"
    >
      Загружаем товары…
    </p>
    <div
      v-if="loading"
      id="catalog-skeleton"
      class="product-grid"
      aria-hidden="true"
    >
      <div
        v-for="n in 4"
        :key="n"
        class="skeleton-card"
      >
        <div class="skeleton-photo"></div>
        <div class="skeleton-line skeleton-category"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-price"></div>
      </div>
    </div>
    <div
      v-else
      id="preview-products"
      class="product-grid"
      :aria-busy="loading"
    >
      <ProductCard
        v-for="product in filtered"
        :key="product.id"
        :product="product"
        :quantity="basket[product.id] || 0"
        @change="(id, delta) => emit('change', id, delta)"
        @remove="(id) => emit('remove', id)"
      />
    </div>
    <p
      v-if="!loading && !filtered.length"
      id="no-products"
      class="empty-message"
    >
      Товары не найдены. Измените фильтры или нажмите «Сбросить».
    </p>
  </section>
</template>

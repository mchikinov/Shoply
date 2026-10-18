<script setup lang="ts">
import { computed, nextTick, ref, watch, type ObjectDirective } from 'vue';
import type { Product } from '../../shared/types';
import { fmt, plural, photoStyle } from '../../shared/format';
import { animateAppearance } from '../../shared/motion';
import PurchaseControl from '../components/PurchaseControl.vue';

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
const category = ref('Все');
const sort = ref('new');
const lower = computed(() =>
  props.products.length ? Math.min(...props.products.map((product) => product.price)) : 0,
);
const upper = computed(() =>
  props.products.length ? Math.max(...props.products.map((product) => product.price)) : 0,
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
  ...new Set(props.products.map((product) => product.category)),
]);
const filtered = computed(() =>
  props.products
    .filter(
      (product) =>
        (category.value === 'Все' || category.value === product.category) &&
        product.name.toLowerCase().includes(props.search.trim().toLowerCase()) &&
        product.price >= min.value &&
        product.price <= max.value,
    )
    .sort((a, b) =>
      sort.value === 'new'
        ? b.id - a.id
        : (sort.value === 'asc' ? 1 : -1) * (a.price - b.price),
    ),
);
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
const rangeStyle = computed(() => {
  const span = upper.value - lower.value;
  return {
    '--range-start':
      (span ? ((min.value - lower.value) / span) * 100 : 0) + '%',
    '--range-end':
      (span ? ((max.value - lower.value) / span) * 100 : 100) + '%',
  };
});
/** Ползунок ограничивает значение при изменении min/max; устанавливаем его после обновления DOM. */
const vRange: ObjectDirective<HTMLInputElement, number> = {
  mounted: (element, binding) => {
    element.value = String(binding.value);
  },
  updated: (element, binding) => {
    element.value = String(binding.value);
  },
};

/** Ограничивает выбранную цену соседней границей и синхронизирует ползунок. */
function updateRange(event: Event, bound: 'min' | 'max') {
  const value = Number((event.target as HTMLInputElement).value);
  if (bound === 'min') min.value = Math.min(value, max.value);
  else max.value = Math.max(value, min.value);
  (event.target as HTMLInputElement).value = String(
    bound === 'min' ? min.value : max.value,
  );
}

/** Сбрасывает фильтры к полному каталогу и просит родителя очистить поиск. */
function reset() {
  category.value = 'Все';
  sort.value = 'new';
  min.value = lower.value;
  max.value = upper.value;
  emit('reset');
}
</script>

<template>
  <section
    ref="root"
    class="screen"
    id="catalog"
    :class="{ 'is-loading': loading }"
  >
    <div class="heading-row">
      <h1>Каталог товаров</h1>
      <span
        v-if="products.some((product) => product.demo)"
        class="demo"
      >Демонстрационный каталог</span>
    </div>
    <div class="filter-panel">
      <div
        class="chips"
        aria-label="Категории"
      >
        <button
          v-for="c in categories"
          :key="c"
          :class="{ active: category === c }"
          :disabled="loading"
          @click="category = c"
        >
          {{ c === 'Все' ? 'Все товары' : c }}
        </button>
      </div>
      <div class="filter-row">
        <div
          class="price-filter"
          role="group"
          aria-label="Цена"
        >
          <span class="price-filter-title">Цена, ₽</span>
          <div class="price-range-control">
            <div class="price-range-values">
              <label for="min-demo">От
                <output
                  id="min-price-value"
                  for="min-demo"
                >{{
                  fmt(min)
                }}</output>
              </label>
              <label for="max-demo">До
                <output
                  id="max-price-value"
                  for="max-demo"
                >{{
                  fmt(max)
                }}</output>
              </label>
            </div>
            <div
              class="price-range-track"
              id="price-range-track"
              :style="rangeStyle"
            >
              <div class="price-range-rail"></div>
              <input
                id="min-demo"
                v-range="min"
                type="range"
                :min="lower"
                :max="upper"
                step="1"
                :disabled="loading || lower === upper"
                aria-label="Цена от"
                :aria-valuetext="fmt(min)"
                :style="{ zIndex: min === upper ? 2 : 1 }"
                @input="updateRange($event, 'min')"
              />
              <input
                id="max-demo"
                v-range="max"
                type="range"
                :min="lower"
                :max="upper"
                step="1"
                :disabled="loading || lower === upper"
                aria-label="Цена до"
                :aria-valuetext="fmt(max)"
                @input="updateRange($event, 'max')"
              />
            </div>
          </div>
        </div>
        <button
          class="reset"
          id="reset-demo"
          :disabled="loading"
          @click="reset"
        >
          Сбросить</button>
        <label class="sort">Сортировка<select
            id="sort-demo"
            :disabled="loading"
            v-model="sort"
          >
            <option value="new">Сначала новые</option>
            <option value="asc">Сначала дешевле</option>
            <option value="desc">Сначала дороже</option>
          </select>
        </label>
      </div>
    </div>
    <div class="result-row">
      <span id="found-demo">{{ filtered.length }} {{ plural(filtered.length) }}</span>
      <span>Цены указаны в рублях</span>
    </div>
    <p
      v-if="loading"
      class="loading-status"
      id="catalog-loading-status"
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
      class="product-grid"
      id="preview-products"
      :aria-busy="loading"
    >
      <article
        v-for="product in filtered"
        :key="product.id"
        :data-id="product.id"
      >
        <a
          :href="`#product/${product.id}`"
          :class="`product-photo q${product.photo || 0}`"
          :style="photoStyle(product)"
          role="img"
          :aria-label="product.name"
        ></a>
        <div class="category">{{ product.category }}</div>
        <a
          :href="`#product/${product.id}`"
          class="product-name"
        >{{ product.name }}</a>
        <div class="buy-row">
          <span class="price">{{ fmt(product.price) }}</span>
          <PurchaseControl
            :product="product"
            :quantity="basket[product.id] || 0"
            @change="(id, delta) => emit('change', id, delta)"
            @remove="(id) => emit('remove', id)"
          />
        </div>
      </article>
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

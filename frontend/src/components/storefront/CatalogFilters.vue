<script setup lang="ts">
import { computed, toRefs, type ObjectDirective } from 'vue';
import { formatPrice } from '@/utils/format';
const props = defineProps<{
  lower: number;
  upper: number;
  categories: string[];
  loading: boolean;
}>();
const { lower, upper } = toRefs(props);
const min = defineModel<number>('min', { required: true });
const max = defineModel<number>('max', { required: true });
const category = defineModel<string>('category', { required: true });
const sort = defineModel<string>('sort', { required: true });
const emit = defineEmits<{ reset: [] }>();
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
</script>
<template>
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
            <label for="min-demo"
              >От
              <output
                id="min-price-value"
                for="min-demo"
                >{{ formatPrice(min) }}</output
              >
            </label>
            <label for="max-demo"
              >До
              <output
                id="max-price-value"
                for="max-demo"
                >{{ formatPrice(max) }}</output
              >
            </label>
          </div>
          <div
            id="price-range-track"
            class="price-range-track"
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
              :aria-valuetext="formatPrice(min)"
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
              :aria-valuetext="formatPrice(max)"
              @input="updateRange($event, 'max')"
            />
          </div>
        </div>
      </div>
      <button
        id="reset-demo"
        class="reset"
        :disabled="loading"
        @click="emit('reset')"
      >
        Сбросить
      </button>
      <label class="sort"
        >Сортировка<select
          id="sort-demo"
          v-model="sort"
          :disabled="loading"
        >
          <option value="new">Сначала новые</option>
          <option value="asc">Сначала дешевле</option>
          <option value="desc">Сначала дороже</option>
        </select>
      </label>
    </div>
  </div>
</template>

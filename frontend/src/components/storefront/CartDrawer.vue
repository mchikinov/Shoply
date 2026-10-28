<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { CartLine } from '@/types/api';
import { formatPrice, plural, photoStyle } from '@/utils/format';
import PurchaseControl from '@/components/storefront/PurchaseControl.vue';

const props = defineProps<{
  lines: CartLine[];
  count: number;
  total: number;
  ready: boolean;
  busy: boolean;
  error: string;
  notice: string;
  uncertain: boolean;
  hasPending: boolean;
}>();
const emit = defineEmits<{
  close: [];
  change: [id: number, delta: number];
  remove: [id: number];
  retry: [];
}>();
const root = ref<HTMLElement>();
const showProgress = ref(false);
/** Короткие запросы не показывают индикатор; новый запрос и закрытие отменяют таймер. */
watch(
  () => props.busy,
  (busy, _previous, onCleanup) => {
    showProgress.value = false;
    if (!busy) return;
    const timer = setTimeout(() => {
      showProgress.value = true;
    }, 200);
    onCleanup(() => clearTimeout(timer));
  },
  { immediate: true },
);
let restoreAfterRequest = false;
let focusedProduct: number | null = null;
watch(
  () => props.busy,
  (busy) => {
    if (busy)
      restoreAfterRequest ||= !!root.value?.contains(document.activeElement);
    else {
      const lineSurvives =
        focusedProduct !== null &&
        props.lines.some((line) => line.id === focusedProduct);
      if (restoreAfterRequest && !lineSurvives) void restoreFocus();
      restoreAfterRequest = false;
      focusedProduct = null;
    }
  },
);

/** Обрабатывает Escape и удерживает клавиатурный фокус внутри корзины. */
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  }
  if (event.key !== 'Tab') return;
  const controls = [
    ...(root.value?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex="0"]',
    ) || []),
  ].filter((el) => el.getClientRects().length);
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

/** После обновления DOM возвращает потерянный фокус на кнопку закрытия корзины. */
async function restoreFocus() {
  await nextTick();
  if (!root.value?.contains(document.activeElement))
    root.value?.querySelector<HTMLButtonElement>('.cart-close')?.focus();
}

/** Удаляет позицию и удерживает фокус в модальном окне после обновления DOM. */
function remove(id: number) {
  focusedProduct = id;
  restoreAfterRequest = !!root.value?.contains(document.activeElement);
  emit('remove', id);
}

/** Меняет количество и восстанавливает фокус, если последняя позиция исчезла. */
function change(id: number, delta: number) {
  focusedProduct = id;
  restoreAfterRequest = !!root.value?.contains(document.activeElement);
  emit('change', id, delta);
}

onMounted(() => {
  root.value?.querySelector<HTMLButtonElement>('.cart-close')?.focus();
  document.addEventListener('keydown', keydown);
});
onUnmounted(() => document.removeEventListener('keydown', keydown));
</script>

<template>
  <section
    id="cart"
    ref="root"
    class="cart-drawer"
    @click.self="emit('close')"
  >
    <div
      class="cart-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-title"
    >
      <div class="cart-heading">
        <div class="cart-title-group">
          <h1 id="cart-title">Корзина</h1>
          <span
            class="cart-progress"
            role="status"
          >
            <template v-if="showProgress">
              <span
                class="cart-progress-indicator"
                aria-hidden="true"
              ></span>
              <span class="cart-progress-label">Обновляем корзину…</span>
            </template>
          </span>
        </div>
        <button
          type="button"
          class="cart-close"
          aria-label="Закрыть корзину"
          @click="emit('close')"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <p
        v-if="notice"
        id="cart-notice"
        role="status"
      >
        {{ notice }}
      </p>
      <div
        v-if="error || uncertain"
        role="alert"
      >
        <p>
          {{
            error ||
            'Результат изменения корзины не подтверждён. Повторите запрос.'
          }}
        </p>
        <button
          type="button"
          class="button secondary"
          :disabled="busy"
          @click="emit('retry')"
        >
          Повторить запрос
        </button>
      </div>
      <p
        v-if="hasPending"
        role="status"
      >
        Подтверждение предыдущего заказа не получено. Повторите оформление,
        чтобы проверить результат без создания дубликата.
      </p>
      <div class="split">
        <div>
          <div id="cart-lines">
            <article
              v-for="product in lines"
              :key="product.id"
              class="cart-line"
              :data-cart-product="product.id"
            >
              <RouterLink
                :to="`/product/${product.id}`"
                :class="`product-photo q${product.photo || 0}`"
                :style="photoStyle(product)"
                role="img"
                :aria-label="product.name"
              ></RouterLink>
              <div>
                <h2>
                  <RouterLink :to="`/product/${product.id}`">{{
                    product.name
                  }}</RouterLink>
                </h2>
                <div class="small muted">
                  {{ formatPrice(product.price) }} за штуку
                </div>
                <PurchaseControl
                  :product="product"
                  :quantity="product.quantity"
                  steady
                  @change="change"
                  @remove="remove"
                />
              </div>
              <b class="price">{{ formatPrice(product.subtotal) }}</b>
            </article>
            <p
              v-if="ready && !lines.length"
              class="muted"
            >
              Корзина пуста.
              <RouterLink to="/catalog">Перейти в каталог →</RouterLink>
            </p>
          </div>
        </div>
        <aside class="summary">
          <h2>Ваш заказ</h2>
          <div class="summary-row">
            <span id="cart-quantity">{{ count }} {{ plural(count) }}</span>
            <span>{{ formatPrice(total) }}</span>
          </div>
          <div class="summary-row small">
            <span>Доставка</span>
            <span>Уточнит менеджер</span>
          </div>
          <div class="summary-row total">
            <span>Итого</span>
            <span>{{ formatPrice(total) }}</span>
          </div>
          <RouterLink
            v-if="count || hasPending"
            v-slot="{ href, navigate }"
            to="/checkout"
            custom
          >
            <a
              id="checkout-link"
              class="button"
              :href="!ready || busy || uncertain ? undefined : href"
              role="link"
              tabindex="0"
              :aria-disabled="!ready || busy || uncertain || undefined"
              @click="
                !ready || busy || uncertain
                  ? $event.preventDefault()
                  : navigate($event)
              "
              >{{
                hasPending ? 'Проверить оформление →' : 'Оформить заказ →'
              }}</a
            >
          </RouterLink>
          <p class="small muted">Стоимость доставки пока не рассчитывается.</p>
          <button
            type="button"
            class="cart-continue small"
            @click="emit('close')"
          >
            ← Продолжить покупки
          </button>
        </aside>
      </div>
    </div>
  </section>
</template>

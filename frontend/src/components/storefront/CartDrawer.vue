<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import type { Product } from '@/types/api';
import { formatPrice, plural, photoStyle } from '@/utils/format';
import PurchaseControl from '@/components/storefront/PurchaseControl.vue';

defineProps<{
  lines: (Product & { quantity: number })[];
  count: number;
  total: number;
}>();
const emit = defineEmits<{
  close: [];
  change: [id: number, delta: number];
  remove: [id: number];
}>();
const root = ref<HTMLElement>();

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
async function remove(id: number) {
  emit('remove', id);
  await restoreFocus();
}

/** Меняет количество и восстанавливает фокус, если последняя позиция исчезла. */
async function change(id: number, delta: number) {
  emit('change', id, delta);
  await restoreFocus();
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
        <h1 id="cart-title">Корзина</h1>
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
                  @change="change"
                  @remove="remove"
                />
              </div>
              <b class="price">{{
                formatPrice(product.price * product.quantity)
              }}</b>
            </article>
            <p
              v-if="!lines.length"
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
            v-if="count"
            id="checkout-link"
            class="button"
            to="/checkout"
            >Оформить заказ →</RouterLink
          >
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

<script setup lang="ts">
import { nextTick, onBeforeUpdate, onUpdated, ref } from 'vue';
import type { Product } from '@/types/api';

const props = defineProps<{
  product: Product;
  quantity: number;
  detail?: boolean;
}>();
const emit = defineEmits<{
  change: [id: number, delta: number];
  remove: [id: number];
}>();
const host = ref<HTMLElement>();
let before: { rect: DOMRect; content: string | null } | null = null;
/** Анимирует изменение размеров и количества с учётом настройки уменьшенного движения. */
onBeforeUpdate(() => {
  const control = host.value?.firstElementChild;
  before =
    control?.getClientRects().length &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? { rect: control.getBoundingClientRect(), content: control.textContent }
      : null;
});
onUpdated(() => {
  const control = host.value?.firstElementChild as HTMLElement | undefined;
  if (!before || !control?.animate || before.content === control.textContent)
    return;
  const after = control.getBoundingClientRect();
  if (
    Math.abs(before.rect.width - after.width) > 1 ||
    Math.abs(before.rect.height - after.height) > 1
  ) {
    control.animate(
      [
        {
          width: before.rect.width + 'px',
          height: before.rect.height + 'px',
          overflow: 'hidden',
        },
        {
          width: after.width + 'px',
          height: after.height + 'px',
          overflow: 'hidden',
        },
      ],
      { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
  }
  (control.querySelector<HTMLElement>('.purchase-qty span') || control).animate(
    [
      { opacity: 0.45, transform: 'scale(.88)' },
      { opacity: 1, transform: 'scale(1)' },
    ],
    { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
  );
});

/** Восстанавливает клавиатурный фокус после замены кнопок покупки при обновлении Vue. */
async function change(delta: number, remove = false) {
  const focused = host.value?.contains(document.activeElement);
  const label = document.activeElement?.getAttribute('aria-label');
  if (remove) emit('remove', props.product.id);
  else emit('change', props.product.id, delta);
  await nextTick();
  if (focused) {
    const buttons = [
      ...(host.value?.querySelectorAll<HTMLButtonElement>('button') || []),
    ];
    (
      buttons.find(
        (button) =>
          button.getAttribute('aria-label') === label && !button.disabled,
      ) || buttons.find((button) => !button.disabled)
    )?.focus({ preventScroll: true });
  }
}
</script>

<template>
  <div
    ref="host"
    :data-purchase="product.id"
    :class="{ 'detail-purchase': detail }"
  >
    <button
      v-if="!quantity"
      :class="['button', { secondary: !detail }]"
      :data-add="product.id"
      @click="change(1)"
    >
      {{ detail ? 'Добавить в корзину' : 'В корзину' }}
    </button>
    <div
      v-else
      class="purchase-actions"
    >
      <button
        type="button"
        class="remove-product"
        :data-remove="product.id"
        :aria-label="`Удалить ${product.name} из корзины`"
        title="Удалить из корзины"
        @click="change(0, true)"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
        </svg>
      </button>
      <div
        class="qty purchase-qty"
        role="group"
        :aria-label="`Количество ${product.name} в корзине`"
      >
        <button
          type="button"
          :aria-label="`Уменьшить количество ${product.name}`"
          @click="change(-1)"
        >
          −
        </button>
        <span
          aria-live="polite"
          aria-atomic="true"
          >{{ quantity }}</span
        >
        <button
          type="button"
          :aria-label="`Увеличить количество ${product.name}`"
          :disabled="quantity >= 999"
          @click="change(1)"
        >
          +
        </button>
      </div>
    </div>
  </div>
</template>

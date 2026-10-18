<script setup lang="ts">
import { onUnmounted, watch } from 'vue';

const props = defineProps<{
  text: string;
  detail: string;
  added: boolean;
  version: number;
}>();
const emit = defineEmits<{ close: [] }>();
let timer: ReturnType<typeof setTimeout>;
let hover = false;
let focus = false;

/** Приостанавливает скрытие уведомления при наведении или фокусе. */
function pause(kind: 'hover' | 'focus', value: boolean) {
  if (kind === 'hover') hover = value;
  else focus = value;
  if (value) clearTimeout(timer);
  else schedule();
}

/** Планирует скрытие через четыре секунды, если уведомление не удерживается пользователем. */
function schedule() {
  clearTimeout(timer);
  if (!hover && !focus && props.text)
    timer = setTimeout(() => emit('close'), 4000);
}

watch(() => props.version, schedule);
onUnmounted(() => clearTimeout(timer));
</script>

<template>
  <div
    v-show="text"
    id="preview-toast"
    class="toast"
    :data-tone="added ? 'success' : 'neutral'"
    @mouseenter="pause('hover', true)"
    @mouseleave="pause('hover', false)"
    @focusin="pause('focus', true)"
    @focusout="pause('focus', false)"
    @keydown.esc="emit('close')"
  >
    <span
      class="toast-icon"
      aria-hidden="true"
    >{{ added ? '✓' : 'i' }}</span>
    <div
      class="toast-copy"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        id="toast-message"
        class="toast-message"
      >{{ text }}</div>
      <div
        v-show="detail"
        id="toast-detail"
        class="toast-detail"
      >
        {{ detail }}
      </div>
    </div>
    <button
      type="button"
      id="toast-close"
      class="toast-close"
      aria-label="Закрыть уведомление"
      @click="emit('close')"
    >
      ×
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from '@/composables/useTheme';

const { dark, toggle } = useTheme();
const label = computed(() =>
  dark.value ? 'Включить светлую тему' : 'Включить тёмную тему',
);
</script>

<template>
  <button
    id="theme-toggle"
    type="button"
    class="theme-toggle"
    :aria-label="label"
    :aria-pressed="dark"
    :title="label"
    @click="toggle"
  >
    <svg
      class="theme-moon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />
    </svg>
    <svg
      class="theme-sun"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="4"
      />
      <path
        d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"
      />
    </svg>
  </button>
</template>

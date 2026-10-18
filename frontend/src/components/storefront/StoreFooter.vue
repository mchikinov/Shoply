<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useCartStore } from '@/stores/cart';
import { plural } from '@/utils/format';
defineProps<{ cartOpen: boolean }>();
const { count } = storeToRefs(useCartStore());
</script>
<template>
  <footer
    class="wrap"
    :inert="cartOpen"
  >
    <span>Shoply</span>
    <span>
      <a href="admin.html">Админка</a>
    </span>
  </footer>
  <RouterLink
    v-show="!cartOpen"
    id="floating-cart"
    class="floating-cart"
    to="/cart"
    :aria-label="`Открыть корзину: ${count} ${plural(count)}`"
  >
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M6 7h14l-2 9H8L5 3H2" />
      <circle
        cx="9"
        cy="21"
        r="1"
      />
      <circle
        cx="17"
        cy="21"
        r="1"
      />
    </svg>
    <b
      id="floating-cart-count"
      class="floating-cart-count"
      aria-hidden="true"
      >{{ count }}</b
    >
  </RouterLink>
</template>

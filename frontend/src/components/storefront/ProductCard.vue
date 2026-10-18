<script setup lang="ts">
import { RouterLink } from 'vue-router';
import type { Product } from '@/types/api';
import { formatPrice, photoStyle } from '@/utils/format';
import PurchaseControl from './PurchaseControl.vue';
defineProps<{ product: Product; quantity: number }>();
const emit = defineEmits<{
  change: [id: number, delta: number];
  remove: [id: number];
}>();
</script>
<template>
  <article :data-id="product.id">
    <RouterLink
      :to="`/product/${product.id}`"
      :class="`product-photo q${product.photo || 0}`"
      :style="photoStyle(product)"
      role="img"
      :aria-label="product.name"
    ></RouterLink>
    <div class="category">{{ product.category }}</div>
    <RouterLink
      :to="`/product/${product.id}`"
      class="product-name"
      >{{ product.name }}</RouterLink
    >
    <div class="buy-row">
      <span class="price">{{ formatPrice(product.price) }}</span>
      <PurchaseControl
        :product="product"
        :quantity="quantity"
        @change="(id, delta) => emit('change', id, delta)"
        @remove="(id) => emit('remove', id)"
      />
    </div>
  </article>
</template>

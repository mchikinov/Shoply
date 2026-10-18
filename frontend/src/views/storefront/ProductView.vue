<script setup lang="ts">
import { computed } from 'vue';
import ProductDetail from '@/components/storefront/ProductDetail.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useCartStore } from '@/stores/cart';
import { useCartActions } from '@/composables/useCartActions';
const props = defineProps<{ id: string; inert?: boolean }>();
const catalog = useCatalogStore();
const cart = useCartStore();
const product = computed(() =>
  catalog.products.find((item) => item.id === Number(props.id)),
);
const { change, remove } = useCartActions();
</script>
<template>
  <ProductDetail
    v-if="product"
    :product="product"
    :quantity="cart.basket[product.id] || 0"
    :inert="inert"
    @change="change"
    @remove="remove"
  />
</template>

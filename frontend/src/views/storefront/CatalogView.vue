<script setup lang="ts">
import { storeToRefs } from 'pinia';
import ProductCatalog from '@/components/storefront/ProductCatalog.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useCartStore } from '@/stores/cart';
import { useCartActions } from '@/composables/useCartActions';
const { products, loading, search } = storeToRefs(useCatalogStore());
const { basket } = storeToRefs(useCartStore());
const { change, remove } = useCartActions();
</script>
<template>
  <ProductCatalog
    :products="products"
    :loading="loading"
    :search="search"
    :basket="basket"
    @change="change"
    @remove="remove"
    @reset="search = ''"
  />
</template>

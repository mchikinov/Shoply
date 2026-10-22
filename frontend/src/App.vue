<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterView } from 'vue-router';
import { storeToRefs } from 'pinia';
import StoreHeader from '@/components/storefront/StoreHeader.vue';
import StoreFooter from '@/components/storefront/StoreFooter.vue';
import CartDrawer from '@/components/storefront/CartDrawer.vue';
import StoreToast from '@/components/common/StoreToast.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useCartStore } from '@/stores/cart';
import { useNotificationsStore } from '@/stores/notifications';
import { useCartActions } from '@/composables/useCartActions';
import { useCartOverlay } from '@/composables/useCartOverlay';
import { useShopAppearance } from '@/composables/useShopAppearance';
const catalog = useCatalogStore();
const { note } = storeToRefs(catalog);
const { lines, count, total } = storeToRefs(useCartStore());
const { toast } = storeToRefs(useNotificationsStore());
const { change, remove } = useCartActions();
const content = ref<HTMLElement>();
const { displayRoute, cartOpen, closing, close } = useCartOverlay(content);
useShopAppearance();
onMounted(() => {
  void catalog.initialize();
});
</script>
<template>
  <div class="preview-bar">
    <div class="wrap">
      <span id="connection-note">{{ note }}</span>
    </div>
  </div>
  <StoreHeader :inert="cartOpen" />
  <main
    ref="content"
    class="wrap"
  >
    <RouterView
      v-slot="{ Component }"
      :route="displayRoute"
    >
      <KeepAlive include="CatalogView,CheckoutView">
        <component
          :is="Component"
          :key="displayRoute.name"
          :inert="cartOpen"
        />
      </KeepAlive>
    </RouterView>
    <CartDrawer
      v-if="cartOpen"
      :class="{ 'is-closing': closing }"
      :lines="lines"
      :count="count"
      :total="total"
      @close="close"
      @change="change"
      @remove="remove"
    />
  </main>
  <StoreFooter :cart-open="cartOpen" />
  <StoreToast
    v-bind="toast"
    @close="toast.text = ''"
  />
</template>

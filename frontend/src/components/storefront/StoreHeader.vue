<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { nextTick, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useCartStore } from '@/stores/cart';
import { useNotificationsStore } from '@/stores/notifications';
defineProps<{ inert: boolean }>();
const { settings, search, loading } = storeToRefs(useCatalogStore());
const { count } = storeToRefs(useCartStore());
const { notify } = useNotificationsStore();
const router = useRouter();
const searchInputElement = ref<HTMLInputElement>();
/** При поиске с другой страницы открывает каталог и возвращает фокус в поле. */
async function searchInput() {
  if (router.currentRoute.value.name !== 'catalog') {
    await router.push({ name: 'catalog' });
    await nextTick();
    searchInputElement.value?.focus();
  }
}
/** Открывает настроенный контакт поддержки или показывает уведомление. */
function support() {
  if (settings.value.telegram)
    window.open(settings.value.telegram, '_blank', 'noopener,noreferrer');
  else notify('Поддержка в Telegram пока не настроена.');
}
</script>
<template>
  <header :inert="inert">
    <div class="wrap header">
      <RouterLink
        to="/catalog"
        class="logo"
      >
        <img
          v-if="settings.logo"
          :src="settings.logo"
          :alt="settings.name"
          class="brand-logo"
        />
        <template v-else>{{ settings.name }}</template>
      </RouterLink>
      <label class="search">
        <svg viewBox="0 0 24 24">
          <circle
            cx="10"
            cy="10"
            r="6"
          />
          <path d="m15 15 5 5" />
        </svg>
        <input
          id="catalog-search"
          ref="searchInputElement"
          v-model="search"
          :disabled="loading"
          type="search"
          placeholder="Найти в Shoply"
          aria-label="Поиск по названию товара"
          @input="searchInput"
        />
      </label>
      <button
        id="support-link"
        class="header-link"
        aria-label="Поддержка в Telegram"
        @click="support"
      >
        <svg viewBox="0 0 24 24">
          <path d="m3 11 18-7-4 17-6-5-4 3 1-6 10-6-12 8Z" />
        </svg>
        <span>Поддержка</span>
      </button>
      <ThemeToggle />
      <RouterLink
        class="header-link"
        to="/cart"
      >
        <svg viewBox="0 0 24 24">
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
        <span>Корзина</span>
        <b id="basket-count">{{ count }}</b>
      </RouterLink>
    </div>
  </header>
</template>

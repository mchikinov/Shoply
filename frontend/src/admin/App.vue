<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import ThemeToggle from '../shared/components/ThemeToggle.vue';
import AdminLogin from './screens/AdminLogin.vue';
import AdminSettings from './screens/AdminSettings.vue';
import AdminProducts from './screens/AdminProducts.vue';
import AdminOrders from './screens/AdminOrders.vue';
import { provideAdmin } from './state/admin';

const { authenticated, ready, notice, start, logout } = provideAdmin();
type Tab = 'settings' | 'products' | 'orders';
const selected = ref<Tab>('settings');

/** Синхронизирует выбранный раздел с hash-адресом страницы. */
function select(tab: Tab) {
  selected.value = tab;
  location.hash = tab;
}

/** Восстанавливает раздел из URL и переводит фокус на его заголовок. */
async function route() {
  const hash = location.hash.slice(1);
  selected.value = ['settings', 'products', 'orders'].includes(hash)
    ? (hash as Tab)
    : 'settings';
  await nextTick();
  const heading = document.querySelector<HTMLElement>(
    '#' + selected.value + ' h1',
  );
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

onMounted(() => {
  void start();
  void route();
  window.addEventListener('hashchange', route);
});
onUnmounted(() => window.removeEventListener('hashchange', route));
</script>

<template>
  <header>
    <a
      href="index.html"
      class="brand"
    >Shoply<span>.</span>
    </a>
    <span>Управление магазином</span>
    <a href="index.html">Открыть магазин ↗</a>
    <ThemeToggle />
  </header>
  <main>
    <p
      id="notice"
      role="status"
      :class="{ error: notice.error }"
    >
      {{ notice.text }}
    </p>
    <p
      v-if="!ready"
      role="status"
    >Подключение к магазину…</p>
    <AdminLogin v-else-if="!authenticated" />
    <section
      v-else
      id="dashboard"
    >
      <nav>
        <button
          v-for="tab in ['settings', 'products', 'orders'] as const"
          :key="tab"
          :data-tab="tab"
          :class="{ active: selected === tab }"
          @click="select(tab)"
        >
          {{
            { settings: 'Оформление', products: 'Товары', orders: 'Заказы' }[
              tab
            ]
          }}
        </button>
        <button
          id="logout"
          class="plain"
          @click="logout"
        >Выйти</button>
      </nav>
      <AdminSettings v-show="selected === 'settings'" />
      <AdminProducts v-show="selected === 'products'" />
      <AdminOrders v-if="selected === 'orders'" />
    </section>
  </main>
</template>

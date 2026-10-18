<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import AdminLogin from '@/views/admin/AdminLogin.vue';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
const auth = useAuthStore();
const { authenticated, ready } = storeToRefs(auth);
const { notice } = storeToRefs(useNotificationsStore());
const route = useRoute();
const router = useRouter();
const dashboard = ref<HTMLElement>();
watch([() => route.fullPath, authenticated], async () => {
  await nextTick();
  const heading = dashboard.value?.querySelector<HTMLElement>('h1');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
});
onMounted(() => {
  void auth.start();
});
</script>
<template>
  <header>
    <a
      href="index.html"
      class="brand"
      >Shoply<span>.</span></a
    >
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
    >
      Подключение к магазину…
    </p>
    <AdminLogin v-else-if="!authenticated" />
    <section
      v-else
      id="dashboard"
      ref="dashboard"
    >
      <nav>
        <button
          v-for="tab in ['settings', 'products', 'orders'] as const"
          :key="tab"
          :data-tab="tab"
          :class="{ active: route.name === tab }"
          @click="router.push({ name: tab })"
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
          @click="auth.logout"
        >
          Выйти
        </button>
      </nav>
      <RouterView v-slot="{ Component }">
        <KeepAlive include="AdminSettings,AdminProducts">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </section>
  </main>
</template>

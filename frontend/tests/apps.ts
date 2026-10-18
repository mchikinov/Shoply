import { afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { getActivePinia } from 'pinia';
import type { Router } from 'vue-router';
import App from '@/App.vue';
import AdminApp from '@/AdminApp.vue';
import { createStorefrontRouter } from '@/router/storefront';
import { createAdminRouter } from '@/router/admin';
const routers: Router[] = [];
let storefrontRouter: Router;
/** Подключает настоящие Router и Pinia к интеграционному тесту витрины. */
export function mountStorefront(options: { attachTo?: HTMLElement } = {}) {
  const pinia = getActivePinia()!;
  storefrontRouter = createStorefrontRouter(pinia);
  routers.push(storefrontRouter);
  return mount(App, {
    ...options,
    global: { plugins: [pinia, storefrontRouter] },
  });
}
/** Подключает отдельный маршрутизатор админки. */
export function mountAdmin(options: { attachTo?: HTMLElement } = {}) {
  const router = createAdminRouter();
  routers.push(router);
  return mount(AdminApp, {
    ...options,
    global: { plugins: [getActivePinia()!, router] },
  });
}
/** Выполняет переход через настоящий маршрутизатор и ожидает завершения guard. */
export async function navigateStorefront(hash: string) {
  const path = hash.replace(/^#\/?/, '/');
  await storefrontRouter.push(path);
}
afterEach(() => {
  routers.splice(0).forEach((router) => router.options.history.destroy());
});

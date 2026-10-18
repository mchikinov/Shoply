import { createRouter, createWebHashHistory } from 'vue-router';
import AdminSettings from '@/views/admin/AdminSettings.vue';
import AdminProducts from '@/views/admin/AdminProducts.vue';
import AdminOrders from '@/views/admin/AdminOrders.vue';
import { normalizeLegacyHash, supportLegacyLinks } from './legacy';
/** Разделы админки; AdminApp показывает их только после проверки серверной сессии. */
export function createAdminRouter() {
  normalizeLegacyHash();
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', redirect: { name: 'settings' } },
      { path: '/settings', name: 'settings', component: AdminSettings },
      { path: '/products', name: 'products', component: AdminProducts },
      { path: '/orders', name: 'orders', component: AdminOrders },
      { path: '/:pathMatch(.*)*', redirect: { name: 'settings' } },
    ],
  });
  supportLegacyLinks(router);
  return router;
}

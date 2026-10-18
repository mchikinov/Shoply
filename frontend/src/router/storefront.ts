import { createRouter, createWebHashHistory } from 'vue-router';
import type { Pinia } from 'pinia';
import CatalogView from '@/views/storefront/CatalogView.vue';
import ProductView from '@/views/storefront/ProductView.vue';
import CheckoutView from '@/views/storefront/CheckoutView.vue';
import SuccessView from '@/views/storefront/SuccessView.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useCartStore } from '@/stores/cart';
import { useCheckoutStore } from '@/stores/checkout';
import { normalizeLegacyHash, supportLegacyLinks } from './legacy';

/** Создаёт маршрутизатор витрины с проверкой товара, корзины и подтверждения заказа. */
export function createStorefrontRouter(pinia: Pinia) {
  normalizeLegacyHash();
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', redirect: { name: 'catalog' } },
      { path: '/catalog', name: 'catalog', component: CatalogView },
      {
        path: '/product/:id',
        name: 'product',
        component: ProductView,
        props: true,
      },
      // При прямом открытии фон корзины — каталог; при переходе фон сохраняет useCartOverlay.
      { path: '/cart', name: 'cart', component: CatalogView },
      { path: '/checkout', name: 'checkout', component: CheckoutView },
      { path: '/success', name: 'success', component: SuccessView },
      { path: '/:pathMatch(.*)*', redirect: { name: 'catalog' } },
    ],
  });
  router.beforeEach(async (to) => {
    const catalog = useCatalogStore(pinia);
    await catalog.initialize();
    if (
      to.name === 'product' &&
      catalog.ready &&
      !catalog.products.some((product) => product.id === Number(to.params.id))
    )
      return { name: 'catalog', replace: true };
    if (to.name === 'checkout' && catalog.ready && !useCartStore(pinia).count)
      return { name: 'cart', replace: true };
    if (to.name === 'success' && !useCheckoutStore(pinia).receipt)
      return { name: 'catalog', replace: true };
  });
  supportLegacyLinks(router);
  return router;
}

import {
  computed,
  nextTick,
  onBeforeUnmount,
  shallowRef,
  ref,
  watch,
  type Ref,
} from 'vue';
import { useRouter, type RouteLocationNormalized } from 'vue-router';
import { animateAppearance } from '@/utils/motion';

/** Сохраняет страницу под корзиной, её прокрутку и фокус; URL управляет Vue Router. */
export function useCartOverlay(content: Ref<HTMLElement | undefined>) {
  const router = useRouter();
  const displayRoute = shallowRef<RouteLocationNormalized>({
    ...router.resolve('/catalog'),
    name: 'catalog',
  });
  const cartOpen = computed(() => router.currentRoute.value.name === 'cart');
  const closing = ref(false);
  let returnPath = '/catalog';
  let catalogScroll = 0;
  let trigger: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finishClosing: (() => void) | undefined;
  const scrollRestoration = history.scrollRestoration;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /** Завершает ожидающую анимацию при новой навигации или размонтировании. */
  function cancelClosing() {
    clearTimeout(timer);
    finishClosing?.();
    finishClosing = undefined;
    closing.value = false;
  }

  const removeGuard = router.beforeEach(async (to, from) => {
    cancelClosing();
    if (to.name === 'cart' && from.name !== 'cart') {
      trigger =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      returnPath = from.name ? from.fullPath : '/catalog';
    }
    if (
      from.name === 'cart' &&
      to.name !== 'cart' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      closing.value = true;
      await new Promise<void>((resolve) => {
        finishClosing = resolve;
        timer = setTimeout(resolve, 300);
      });
    }
  });

  watch(
    router.currentRoute,
    async (to, from) => {
      if (!to.name) return;
      const wasCart = from?.name === 'cart';
      if (from?.name === 'catalog' && to.name !== 'catalog')
        catalogScroll = window.scrollY;
      if (to.name !== 'cart') displayRoute.value = to;
      closing.value = false;
      document.documentElement.classList.toggle('cart-open', cartOpen.value);
      await nextTick();
      if (cartOpen.value) return;
      const heading = content.value?.querySelector<HTMLElement>('.screen h1');
      if (wasCart && to.fullPath === returnPath && trigger?.isConnected)
        trigger.focus({ preventScroll: true });
      else if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
      if (heading) document.title = 'Shoply — ' + heading.textContent;
      if (!wasCart || to.fullPath !== returnPath) {
        window.scrollTo(0, to.name === 'catalog' ? catalogScroll : 0);
        animateAppearance(
          content.value?.querySelector<HTMLElement>('.screen') ?? null,
        );
      }
    },
    { immediate: true, flush: 'post' },
  );

  /** Возвращает маршрут страницы, поверх которой была открыта корзина. */
  function close() {
    void router.push(returnPath);
  }

  onBeforeUnmount(() => {
    removeGuard();
    cancelClosing();
    document.documentElement.classList.remove('cart-open');
    if ('scrollRestoration' in history)
      history.scrollRestoration = scrollRestoration;
  });
  return { displayRoute, cartOpen, closing, close };
}

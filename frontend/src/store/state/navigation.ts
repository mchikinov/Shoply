import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import { animateAppearance } from '../../shared/motion';
import type { OrderReceipt, Product } from '../../shared/types';

export type Screen = 'catalog' | 'product' | 'cart' | 'checkout' | 'success';

/** Управляет hash-адресами, фоном модального окна, прокруткой и клавиатурным фокусом. */
export function useNavigation(
  products: Ref<Product[]>,
  ready: Ref<boolean>,
  count: Ref<number>,
  receipt: Ref<OrderReceipt | null>,
) {
  const screen = ref<Screen>('catalog');
  const productId = ref(0);
  const background = ref<Screen>('catalog');
  const cartOpen = ref(false);
  let returnHash = '#catalog';
  let scrollY = 0;
  let trigger: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout>;
  let transitioning = false;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /** Применяет hash-маршрут, проверяет доступность экрана и восстанавливает фокус и прокрутку. */
  async function apply() {
    const [name, id] = location.hash.slice(1).split('/');
    let next: Screen = [
      'catalog',
      'product',
      'cart',
      'checkout',
      'success',
    ].includes(name)
      ? (name as Screen)
      : 'catalog';
    if (
      next === 'product' &&
      ready.value &&
      !products.value.some((product) => product.id === Number(id))
    )
      next = 'catalog';
    if (next === 'checkout' && ready.value && !count.value) {
      location.replace('#cart');
      return;
    }
    if (next === 'success' && !receipt.value) {
      location.replace('#catalog');
      return;
    }
    const closing = cartOpen.value && next !== 'cart';
    if (
      closing &&
      !transitioning &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      document.querySelector('#cart')?.classList.add('is-closing');
      transitioning = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void apply();
      }, 300);
      return;
    }
    clearTimeout(timer);
    if (next === 'cart') {
      transitioning = false;
      document.querySelector('#cart')?.classList.remove('is-closing');
    }
    const previous = screen.value;
    const previousId = productId.value;
    if (next === 'cart' && !cartOpen.value) {
      trigger =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
    if (previous === 'catalog' && next !== previous) scrollY = window.scrollY;
    if (next === 'product') productId.value = Number(id || 0);
    screen.value = next;
    cartOpen.value = next === 'cart';
    if (next !== 'cart') {
      background.value = next;
    }
    document.documentElement.classList.toggle('cart-open', cartOpen.value);
    await nextTick();
    if (closing && location.hash === returnHash && trigger?.isConnected)
      trigger.focus({ preventScroll: true });
    else if (next !== 'cart') {
      const heading = document.querySelector<HTMLElement>('#' + next + ' h1');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
    const heading = document.querySelector('#' + next + ' h1');
    if (heading) document.title = 'Shoply — ' + heading.textContent;
    if (next !== 'cart') {
      returnHash = location.hash || '#catalog';
      if (
        next !== previous ||
        (next === 'product' && previousId !== productId.value)
      ) {
        window.scrollTo(0, next === 'catalog' ? scrollY : 0);
        animateAppearance(document.querySelector<HTMLElement>('#' + next));
      }
    }
    transitioning = false;
  }

  /** Возвращает URL экрана, поверх которого была открыта корзина. */
  const close = () => {
    location.hash = returnHash;
  };

  onMounted(() => {
    window.addEventListener('hashchange', apply);
    void apply();
  });
  watch(ready, () => {
    void apply();
  });
  onUnmounted(() => {
    window.removeEventListener('hashchange', apply);
    clearTimeout(timer);
    document.documentElement.classList.remove('cart-open');
  });
  return { screen, productId, background, cartOpen, close };
}

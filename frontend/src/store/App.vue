<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import type { Delivery, Product, Settings } from '../shared/types';
import { loadShop, message } from '../shared/api';
import { fmt, plural } from '../shared/format';
import ThemeToggle from '../shared/components/ThemeToggle.vue';
import StoreCatalog from './screens/StoreCatalog.vue';
import ProductDetail from './screens/ProductDetail.vue';
import StoreCheckout from './screens/StoreCheckout.vue';
import CartDrawer from './components/CartDrawer.vue';
import StoreToast from './components/StoreToast.vue';
import { useCart } from './state/cart';
import { useCheckout } from './state/checkout';
import { useNavigation } from './state/navigation';

const products = ref<Product[]>([]);
const ready = ref(false);
const loading = ref(true);
const search = ref('');
const settings = ref<Settings>({
  name: 'Shoply',
  logo: '',
  accent: '#2864e8',
  background: '#ffffff',
  text: '#182231',
  telegram: '',
});
const note = ref('Shoply · Подключение к магазину…');
const {
  basket,
  lines,
  count,
  total,
  change: changeCart,
  remove: removeCart,
  clear,
} = useCart(products);
const { submitting, receipt, submit } = useCheckout();
const { screen, productId, background, cartOpen, close } = useNavigation(
  products,
  ready,
  count,
  receipt,
);
const selected = computed(() =>
  products.value.find((product) => product.id === productId.value),
);
const toast = reactive({ text: '', detail: '', added: false, version: 0 });

/** Показывает новое уведомление; версия перезапускает таймер даже при одинаковом тексте. */
function notify(text: string, detail = '', added = false) {
  Object.assign(toast, { text, detail, added, version: toast.version + 1 });
}

/** Изменяет количество и сообщает результат, только если корзина действительно изменилась. */
function change(id: number, delta: number) {
  const before = basket[id] || 0;
  changeCart(id, delta);
  if ((basket[id] || 0) !== before)
    notify(
      delta > 0 ? 'Товар добавлен в корзину' : 'Товар удалён из корзины',
      basket[id] > 1 ? `В корзине: ${basket[id]} шт.` : '',
      delta > 0,
    );
}

/** Удаляет позицию из корзины и показывает подтверждение. */
function remove(id: number) {
  removeCart(id);
  notify('Товар удалён из корзины');
}

/** Открывает каталог и возвращает фокус в поиск после обновления DOM. */
async function searchInput() {
  if (screen.value !== 'catalog') {
    location.hash = 'catalog';
    await nextTick();
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>('#search-demo')?.focus(),
    );
  }
}

/** Открывает настроенный Telegram или сообщает об отсутствии контакта. */
function support() {
  if (settings.value.telegram)
    window.open(settings.value.telegram, '_blank', 'noopener,noreferrer');
  else notify('Поддержка в Telegram пока не настроена.');
}

/** Отправляет заказ; очищает корзину только после подтверждения сервера. */
async function placeOrder(fields: {
  fullname: string;
  phone: string;
  delivery: Delivery;
  address: string;
}) {
  if (!ready.value || !count.value) return;
  try {
    const saved = await submit({
      ...fields,
      items: lines.value.map((product) => ({ id: product.id, quantity: product.quantity })),
    });
    if (saved) {
      clear();
      location.hash = 'success';
    }
  } catch (error) {
    notify(message(error) + ' Данные формы и корзина сохранены.');
  }
}

onMounted(async () => {
  try {
    const shop = await loadShop();
    products.value = shop.products;
    settings.value = shop.settings;
    for (const [css, key] of [
      ['--color-accent', 'accent'],
      ['--color-bg', 'background'],
      ['--color-text', 'text'],
    ] as const)
      document.documentElement.style.setProperty(css, settings.value[key]);
    ready.value = true;
    note.value =
      'Онлайн-оплата пока недоступна. Заказы сохраняются в магазине.';
  } catch (error) {
    note.value =
      'Нет соединения с сервером. Оформление недоступно: ' + message(error);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="preview-bar">
    <div class="wrap">
      <span id="connection-note">{{ note }}</span>
    </div>
  </div>
  <header :inert="cartOpen">
    <div class="wrap header">
      <a
        href="#catalog"
        class="logo"
      >
        <img
          v-if="settings.logo"
          :src="settings.logo"
          :alt="settings.name"
          class="brand-logo"
        />
        <template v-else>{{ settings.name }}</template>
      </a>
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
          id="search-demo"
          :disabled="loading"
          v-model="search"
          type="search"
          placeholder="Найти в Shoply"
          aria-label="Поиск по названию товара"
          @input="searchInput"
        />
      </label>
      <button
        class="header-link"
        id="support-demo"
        aria-label="Поддержка в Telegram"
        @click="support"
      >
        <svg viewBox="0 0 24 24">
          <path d="m3 11 18-7-4 17-6-5-4 3 1-6 10-6-12 8Z" />
        </svg>
        <span>Поддержка</span>
      </button>
      <ThemeToggle />
      <a
        class="header-link"
        href="#cart"
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
      </a>
    </div>
  </header>
  <main class="wrap">
    <StoreCatalog
      v-show="background === 'catalog'"
      :inert="cartOpen"
      :products="products"
      :basket="basket"
      :loading="loading"
      :search="search"
      @reset="search = ''"
      @change="change"
      @remove="remove"
    />
    <ProductDetail
      v-if="selected && background === 'product'"
      :inert="cartOpen"
      :product="selected"
      :quantity="basket[selected.id] || 0"
      @change="change"
      @remove="remove"
    />
    <StoreCheckout
      v-if="!receipt || background === 'checkout'"
      v-show="background === 'checkout'"
      :inert="cartOpen"
      :lines="lines"
      :total="total"
      :ready="ready"
      :submitting="submitting"
      @submit="placeOrder"
    />
    <CartDrawer
      v-if="cartOpen"
      :lines="lines"
      :count="count"
      :total="total"
      @close="close"
      @change="change"
      @remove="remove"
    />
    <section
      v-if="receipt"
      v-show="background === 'success'"
      :inert="cartOpen"
      class="screen"
      id="success"
    >
      <div class="crumb">
        <a href="#catalog">Каталог</a> / Заказ оформлен
      </div>
      <div class="success-layout">
        <div>
          <span class="status">Ожидает оплаты</span>
          <h1>Заказ оформлен</h1>
          <p class="demo-number">
            Ваш заказ
            <b>№ <span id="order-number">{{ receipt.id }}</span>
            </b>
          </p>
          <p class="muted">
            Заказ принят и сохранён. Его состав и контакты доступны
            администратору.
          </p>
          <div class="success-note">
            Онлайн-оплата пока недоступна.
            <br />Статус заказа — «Ожидает
            оплаты».
          </div>
          <div class="success-meta">
            <span class="muted">Сумма товаров</span>
            <b>{{ fmt(receipt.total) }}</b>
          </div>
          <div class="success-meta">
            <span class="muted">Доставка</span>
            <span id="success-delivery">{{
              receipt.delivery === 'pickup' ? 'Самовывоз' : 'Почта'
            }}</span>
          </div>
          <a
            class="button"
            href="#catalog"
          >Вернуться в каталог</a>
          <p class="caption">
            Заказ сохранён в магазине. Оплата не выполнялась.
          </p>
        </div>
      </div>
    </section>
  </main>
  <footer
    class="wrap"
    :inert="cartOpen"
  >
    <span>Shoply</span>
    <span>
      <a href="admin.html">Админка</a>
    </span>
  </footer>
  <a
    v-show="!cartOpen"
    id="floating-cart"
    class="floating-cart"
    href="#cart"
    :aria-label="`Открыть корзину: ${count} ${plural(count)}`"
  >
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
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
    <b
      id="floating-cart-count"
      class="floating-cart-count"
      aria-hidden="true"
    >{{ count }}</b>
  </a>
  <StoreToast
    v-bind="toast"
    @close="toast.text = ''"
  />
</template>

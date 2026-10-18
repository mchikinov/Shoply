<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { onBeforeUnmount, ref, watch } from 'vue';
import type { Product } from '@/types/api';
import { formatPrice, photoStyle } from '@/utils/format';
import PurchaseControl from '@/components/storefront/PurchaseControl.vue';

const props = defineProps<{
  product: Product;
  quantity: number;
  inert?: boolean;
}>();
const emit = defineEmits<{
  change: [id: number, delta: number];
  remove: [id: number];
}>();
const index = ref(0);
const dialog = ref<HTMLDialogElement>();
let overflow = '';
let animation: Animation | undefined;

/** Заменяет анимацию фото с учётом направления и настройки уменьшенного движения. */
function animate(step = 0) {
  animation?.cancel();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  animation = dialog.value?.querySelector('img')?.animate?.(
    [
      {
        opacity: 0,
        transform: step ? `translateX(${step > 0 ? 40 : -40}px)` : 'scale(.94)',
      },
      { opacity: 1, transform: 'translateX(0) scale(1)' },
    ],
    { duration: step ? 240 : 280, easing: 'cubic-bezier(.2,.7,.2,1)' },
  );
}

/** Открывает галерею в модальном окне и временно блокирует прокрутку страницы. */
function open() {
  if (!props.product.photos.length || dialog.value?.open) return;
  overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  dialog.value?.showModal();
  animate();
}

/** Отменяет анимацию и восстанавливает прокрутку после закрытия галереи. */
function closed() {
  animation?.cancel();
  document.body.style.overflow = overflow;
}

/** Закрывает галерею, только если диалог открыт. */
function close() {
  if (dialog.value?.open) dialog.value.close();
}

/** Циклически переключает фотографию и запускает анимацию перехода. */
function step(delta: number) {
  index.value =
    (index.value + delta + props.product.photos.length) %
    props.product.photos.length;
  animate(delta);
}

watch(
  () => props.inert,
  (inert) => {
    if (inert) close();
  },
);
watch(
  () => props.product.id,
  () => {
    close();
    index.value = 0;
  },
);
onBeforeUnmount(() => {
  close();
});
</script>

<template>
  <section
    id="product"
    class="screen"
    :inert="inert"
  >
    <div class="crumb">
      <RouterLink to="/catalog">Каталог</RouterLink> /
      <span id="product-crumb"
        >{{ product.category }} / {{ product.name }}</span
      >
    </div>
    <div class="product-layout">
      <div class="product-media">
        <div
          id="product-gallery"
          class="product-gallery"
        >
          <button
            v-for="(url, i) in product.photos"
            :key="url + i"
            type="button"
            class="thumbnail"
            :aria-label="`Фото ${i + 1}`"
            @click="index = i"
          >
            <img
              :src="url"
              alt=""
            />
          </button>
        </div>
        <div
          id="product-visual"
          :class="`product-photo q${product.photo || 0}`"
          :style="photoStyle(product, index)"
          :role="product.photos.length ? 'button' : 'img'"
          :tabindex="product.photos.length ? 0 : -1"
          :aria-label="
            product.photos.length
              ? 'Открыть фотографии: ' + product.name
              : product.name + ' — демонстрационная иллюстрация'
          "
          @click="open"
          @keydown.enter.prevent="open"
          @keydown.space.prevent="open"
        ></div>
      </div>
      <div class="detail-copy">
        <span
          v-if="product.demo"
          class="demo"
          >Демонстрационный товар</span
        >
        <h1>{{ product.name }}</h1>
        <div class="price">{{ formatPrice(product.price) }}</div>
        <p class="description">
          {{ product.description || 'Описание пока не добавлено.' }}
        </p>
        <PurchaseControl
          :product="product"
          :quantity="quantity"
          detail
          @change="(id, delta) => emit('change', id, delta)"
          @remove="(id) => emit('remove', id)"
        />
        <h2>О товаре</h2>
        <dl class="specs">
          <div
            v-for="(property, i) in product.properties"
            :key="i"
          >
            <dt>{{ property.name }}</dt>
            <dd>{{ property.description }}</dd>
          </div>
        </dl>
        <p
          v-if="product.demo"
          class="caption"
        >
          Названия и значения свойств произвольные. Значения задаются в админке.
        </p>
      </div>
    </div>
  </section>
  <dialog
    id="photo-viewer"
    ref="dialog"
    class="photo-viewer"
    aria-label="Фотографии товара"
    @close="closed"
    @click="
      (event) => {
        if (event.target === dialog) close();
      }
    "
    @keydown.left.prevent.stop="step(-1)"
    @keydown.right.prevent.stop="step(1)"
  >
    <button
      type="button"
      class="photo-viewer-close"
      aria-label="Закрыть просмотр"
      autofocus
      @click="close"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </button>
    <button
      v-show="product.photos.length > 1"
      type="button"
      class="photo-viewer-prev"
      aria-label="Предыдущее фото"
      @click="step(-1)"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="m15 6-6 6 6 6" />
      </svg>
    </button>
    <img
      class="photo-viewer-image"
      :src="product.photos[index]"
      :alt="product.name + ' — фото ' + (index + 1)"
    />
    <button
      v-show="product.photos.length > 1"
      type="button"
      class="photo-viewer-next"
      aria-label="Следующее фото"
      @click="step(1)"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
    <div
      class="photo-viewer-count"
      role="status"
      aria-live="polite"
    >
      {{ index + 1 }} / {{ product.photos.length }}
    </div>
  </dialog>
</template>

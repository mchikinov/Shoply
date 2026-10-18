<script setup lang="ts">
import { reactive } from 'vue';
import type { Delivery, Product } from '../../shared/types';
import { fmt } from '../../shared/format';

const props = defineProps<{
  lines: (Product & { quantity: number })[];
  total: number;
  ready: boolean;
  submitting: boolean;
}>();
const emit = defineEmits<{
  submit: [
    fields: {
      fullname: string;
      phone: string;
      delivery: Delivery;
      address: string;
    },
  ];
}>();
const fields = reactive({
  fullname: '',
  phone: '',
  delivery: 'post' as Delivery,
  address: '',
});

/** Проверяет доступность оформления и форму; исключает адрес при самовывозе. */
function submit(event: Event) {
  if (
    !props.ready ||
    props.submitting ||
    !props.lines.length ||
    !(event.target as HTMLFormElement).reportValidity()
  )
    return;
  emit('submit', {
    ...fields,
    address: fields.delivery === 'pickup' ? '' : fields.address,
  });
}
</script>

<template>
  <section
    class="screen"
    id="checkout"
  >
    <div class="crumb">
      <a href="#catalog">Каталог</a> / <a href="#cart">Корзина</a> / Оформление
    </div>
    <h1>Оформление заказа</h1>
    <div class="split">
      <form
        class="checkout-form"
        id="demo-order"
        @submit.prevent="submit"
      >
        <fieldset
          id="order-fields"
          :disabled="!ready || submitting"
        >
          <h2>Контактные данные</h2>
          <label>ФИО
            <input
              v-model="fields.fullname"
              name="fullname"
              autocomplete="name"
              placeholder="Ваше полное имя"
              required
              maxlength="160"
            />
          </label>
          <label>Телефон
            <input
              v-model="fields.phone"
              name="phone"
              pattern="[+0-9 ()\-]{7,30}"
              type="tel"
              autocomplete="tel"
              placeholder="+7 (___) ___-__-__"
              required
              maxlength="30"
            />
          </label>
          <fieldset>
            <legend>Способ доставки</legend>
            <div class="delivery-options">
              <label class="radio">
                <input
                  v-model="fields.delivery"
                  name="delivery"
                  type="radio"
                  value="post"
                />Почта
              </label>
              <label class="radio">
                <input
                  v-model="fields.delivery"
                  name="delivery"
                  type="radio"
                  value="pickup"
                />Самовывоз
              </label>
            </div>
          </fieldset>
          <label
            v-show="fields.delivery === 'post'"
            id="address-field"
          >Адрес доставки
            <input
              v-model="fields.address"
              id="address-input"
              name="address"
              autocomplete="street-address"
              placeholder="Индекс, город, улица, дом, квартира"
              :required="fields.delivery === 'post'"
              :disabled="fields.delivery === 'pickup'"
              maxlength="400"
            />
          </label>
          <p class="small muted">Стоимость доставки уточнит менеджер.</p>
          <p class="caption">
            Заказ сохраняется в магазине. Онлайн-оплата пока недоступна.
          </p>
        </fieldset>
      </form>
      <div class="checkout-sidebar">
        <section
          class="summary checkout-products"
          aria-labelledby="checkout-products-title"
        >
          <h2 id="checkout-products-title">Товары из корзины</h2>
          <ul
            id="checkout-items"
            class="checkout-items"
          >
            <li
              v-for="product in lines"
              :key="product.id"
              class="checkout-item"
            >
              <div>
                <a :href="`#product/${product.id}`">{{ product.name }}</a>
                <div class="small muted">
                  {{ product.quantity }} шт. × {{ fmt(product.price) }}
                </div>
              </div>
              <b>{{ fmt(product.price * product.quantity) }}</b>
            </li>
          </ul>
        </section>
        <aside class="summary">
          <h2>Ваш заказ</h2>
          <div class="summary-row total">
            <span>Итого</span>
            <span>{{ fmt(total) }}</span>
          </div>
          <button
            class="button"
            form="demo-order"
            type="submit"
            :disabled="!ready || submitting || !lines.length"
          >
            {{ submitting ? 'Сохраняем…' : 'Оплатить' }}
          </button>
          <p class="small muted">
            Кнопка сохраняет заказ со статусом «Ожидает оплаты». Денежные
            средства не списываются.
          </p>
        </aside>
      </div>
    </div>
  </section>
</template>

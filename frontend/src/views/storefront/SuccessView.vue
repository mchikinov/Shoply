<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useCheckoutStore } from '@/stores/checkout';
import { formatPrice } from '@/utils/format';
const { receipt } = storeToRefs(useCheckoutStore());
</script>
<template>
  <section
    v-if="receipt"
    id="success"
    class="screen"
  >
    <div class="crumb">
      <RouterLink to="/catalog">Каталог</RouterLink> / Заказ оформлен
    </div>
    <div class="success-layout">
      <div>
        <span class="status">Ожидает оплаты</span>
        <h1>Заказ оформлен</h1>
        <p class="order-number">
          Ваш заказ
          <b
            >№ <span id="order-number">{{ receipt.id }}</span>
          </b>
        </p>
        <p class="muted">
          Заказ принят и сохранён. Его состав и контакты доступны
          администратору.
        </p>
        <div class="success-note">
          Онлайн-оплата пока недоступна.
          <br />Статус заказа — «Ожидает оплаты».
        </div>
        <div class="success-meta">
          <span class="muted">Сумма товаров</span>
          <b>{{ formatPrice(receipt.total) }}</b>
        </div>
        <div class="success-meta">
          <span class="muted">Доставка</span>
          <span id="success-delivery">{{
            receipt.delivery === 'pickup' ? 'Самовывоз' : 'Почта'
          }}</span>
        </div>
        <RouterLink
          class="button"
          to="/catalog"
          >Вернуться в каталог</RouterLink
        >
        <p class="caption">Заказ сохранён в магазине. Оплата не выполнялась.</p>
      </div>
    </div>
  </section>
</template>

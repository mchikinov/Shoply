<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { Order } from '@/types/api';
import { formatPrice } from '@/utils/format';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
import { fetchOrders, updateOrderStatus } from '@/services/orders';

const auth = useAuthStore();
const { announce: notify, fail } = useNotificationsStore();
const orders = ref<Order[]>([]);
const statuses = ref<string[]>([]);
const loading = ref(false);
const saving = ref(new Set<number>());

/** Загружает заказы и допустимые статусы, блокируя повторную загрузку. */
async function load() {
  if (loading.value) return;
  loading.value = true;
  try {
    const data = await auth.run(fetchOrders);
    orders.value = data.orders;
    statuses.value = data.statuses;
  } catch (error) {
    fail(error);
  } finally {
    loading.value = false;
  }
}

/** Сохраняет статус заказа; при ошибке восстанавливает прежнее значение поля. */
async function change(order: Order, event: Event) {
  const select = event.target as HTMLSelectElement;
  const previous = order.status;
  const next = select.value;
  saving.value.add(order.id);
  try {
    await auth.run(() => updateOrderStatus(order.id, next));
    order.status = next;
    notify('Статус заказа сохранён.');
  } catch (error) {
    select.value = previous;
    fail(error);
  } finally {
    saving.value.delete(order.id);
  }
}

onMounted(load);
</script>

<template>
  <section
    id="orders"
    class="tab"
  >
    <div class="title-row">
      <h1>Заказы</h1>
      <button
        id="refresh-orders"
        class="plain"
        :disabled="loading || saving.size > 0"
        @click="load"
      >
        Обновить
      </button>
    </div>
    <p
      v-if="loading"
      role="status"
    >
      Загружаем заказы…
    </p>
    <div id="order-list">
      <article
        v-for="order in orders"
        :key="order.id"
        class="order"
      >
        <div class="order-header">
          <h2>Заказ № {{ order.id }}</h2>
          <span class="muted">{{ order.created }} UTC</span>
          <label class="order-status"
            >Статус<select
              :data-order="order.id"
              :value="order.status"
              :disabled="saving.has(order.id)"
              @change="change(order, $event)"
            >
              <option
                v-for="status in statuses"
                :key="status"
              >
                {{ status }}
              </option>
            </select>
          </label>
        </div>
        <div class="order-info">
          <div>
            <p>
              <b>{{ order.customer.fullname }}</b>
            </p>
            <p>{{ order.customer.phone }}</p>
            <p>{{ order.delivery === 'pickup' ? 'Самовывоз' : 'Почта' }}</p>
            <p>{{ order.address }}</p>
            <p class="muted">Стоимость доставки уточняется отдельно.</p>
          </div>
          <div>
            <ul>
              <li
                v-for="product in order.items"
                :key="product.id"
              >
                {{ product.name }} × {{ product.quantity }} —
                {{ formatPrice(product.price * product.quantity) }}
              </li>
            </ul>
            <b>Итого: {{ formatPrice(order.total) }}</b>
          </div>
        </div>
      </article>
      <p
        v-if="!loading && !orders.length"
        class="empty"
      >
        Заказов пока нет.
      </p>
    </div>
  </section>
</template>

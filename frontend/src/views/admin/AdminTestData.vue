<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useCatalogStore } from '@/stores/catalog';
import { useNotificationsStore } from '@/stores/notifications';
import { createTestData, deleteTestData } from '@/services/testData';

const auth = useAuthStore();
const catalog = useCatalogStore();
const notifications = useNotificationsStore();
const count = ref<number | string>(1);
const busy = ref(false);
const validCount = computed(
  () =>
    Number.isInteger(Number(count.value)) &&
    Number(count.value) >= 1 &&
    Number(count.value) <= 100,
);

/** Блокирует повторные операции; результат записи не зависит от обновления каталога. */
async function execute(remove: boolean) {
  if (busy.value || (!remove && !validCount.value)) return;
  if (
    remove &&
    !confirm(
      'Удалить все тестовые товары, включая скрытые и отредактированные? Обычные товары и любые заказы сохранятся.',
    )
  )
    return;
  busy.value = true;
  try {
    const result = await auth.run(() =>
      remove ? deleteTestData() : createTestData(Number(count.value)),
    );
    notifications.notify(
      remove ? 'Тестовые данные удалены' : 'Тестовые данные созданы',
      `${remove ? 'Удалено' : 'Создано'} товаров: ${result.count}.`,
      true,
    );
    try {
      await catalog.refresh();
    } catch {
      notifications.announce(
        'Операция выполнена, но список товаров не обновился. Обновите страницу.',
        true,
      );
    }
  } catch (error) {
    notifications.fail(error);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section
    id="test-data"
    class="tab"
    :aria-busy="busy"
  >
    <h1>Тестовые данные</h1>
    <div class="panel test-data-panel">
      <h2>Создать товары</h2>
      <p class="muted">
        Товары с разными ценами, категориями и свойствами. У каждого — 2–3
        фотографии для проверки галереи.
      </p>
      <form @submit.prevent="execute(false)">
        <label for="test-product-count">Количество товаров</label>
        <div class="test-data-quantity">
          <button
            type="button"
            aria-label="Уменьшить количество"
            :disabled="busy || !validCount || Number(count) <= 1"
            @click="count = Number(count) - 1"
          >
            −
          </button>
          <input
            id="test-product-count"
            v-model.number="count"
            type="number"
            min="1"
            max="100"
            step="1"
            required
            :disabled="busy"
            aria-describedby="test-count-hint"
          />
          <button
            type="button"
            aria-label="Увеличить количество"
            :disabled="busy || !validCount || Number(count) >= 100"
            @click="count = Number(count) + 1"
          >
            +
          </button>
        </div>
        <p
          id="test-count-hint"
          class="muted"
        >
          От 1 до 100 товаров за один запуск.
        </p>
        <button
          id="create-test-data"
          type="submit"
          :disabled="busy || !validCount"
        >
          {{ busy ? 'Выполняется…' : 'Создать тестовые товары' }}
        </button>
      </form>
    </div>
    <div class="panel test-data-panel">
      <h2>Очистить тестовые данные</h2>
      <p class="muted">
        Удаляются все товары генератора, в том числе скрытые и
        отредактированные. Обычные товары и любые заказы сохраняются.
      </p>
      <button
        id="delete-test-data"
        class="danger"
        :disabled="busy"
        @click="execute(true)"
      >
        Удалить все тестовые данные
      </button>
    </div>
  </section>
</template>

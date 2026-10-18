<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
import type { Product, ProductInput } from '../../shared/types';
import { fmt } from '../../shared/format';
import { useAdmin } from '../state/admin';
import PhotoEditor from '../components/PhotoEditor.vue';

const { shop, request, refresh, notify, fail } = useAdmin();
const editing = ref(false);
const saving = ref(false);
const uploading = ref(false);
const formEl = ref<HTMLFormElement>();
type ProductDraft = Omit<ProductInput, 'price'> & { price: number | '' };

/** Создаёт пустой черновик с отдельными массивами для каждой новой формы. */
const createEmptyDraft = (): ProductDraft => ({
  id: null,
  name: '',
  category: '',
  price: '',
  description: '',
  demo: false,
  photo: 0,
  photos: [],
  properties: [],
});

/** Копирует вложенные данные, чтобы правки формы не меняли каталог до сохранения. */
function copyProductDraft(product: Product): ProductDraft {
  return {
    ...product,
    photos: [...product.photos],
    properties: product.properties.map((property) => ({ ...property })),
  };
}

const form = reactive<ProductDraft>(createEmptyDraft());
const categories = computed(() => [
  ...new Set(shop.value?.products.map((product) => product.category)),
]);

/** Создаёт независимый черновик товара и переводит фокус в открытую форму. */
async function edit(product?: Product) {
  if (uploading.value || saving.value) return;
  Object.assign(form, product ? copyProductDraft(product) : createEmptyDraft());
  editing.value = true;
  await nextTick();
  formEl.value?.querySelector<HTMLInputElement>('[name=name]')?.focus();
  formEl.value?.scrollIntoView({ block: 'start' });
}

/** Сохраняет черновик и перечитывает каталог; повторная отправка блокируется. */
async function save() {
  if (saving.value || uploading.value) return;
  saving.value = true;
  try {
    const saved = await request<{ id: number }>('/api/admin/products', {
      ...form,
      price: Number(form.price),
      photos: [...form.photos],
      properties: form.properties.map((product) => ({ ...product })),
    });
    await refresh();
    const product = shop.value?.products.find((product) => product.id === saved.id);
    if (product) Object.assign(form, copyProductDraft(product));
    notify('Товар сохранён.');
  } catch (error) {
    fail(error);
  } finally {
    saving.value = false;
  }
}

/** Удаляет товар после подтверждения, сохраняя состав ранее оформленных заказов. */
async function remove() {
  if (
    saving.value ||
    uploading.value ||
    form.id === null ||
    !confirm(
      'Удалить товар из каталога? Состав уже оформленных заказов сохранится.',
    )
  )
    return;
  saving.value = true;
  try {
    await request('/api/admin/products', { id: form.id }, 'DELETE');
    editing.value = false;
    await refresh();
    notify('Товар удалён из каталога.');
  } catch (error) {
    fail(error);
  } finally {
    saving.value = false;
  }
}

/** Добавляет пустое свойство в пределах серверного ограничения в 40 записей. */
function addProperty() {
  if (form.properties.length >= 40) notify('Максимум 40 свойств.', true);
  else form.properties.push({ name: '', description: '' });
}
</script>

<template>
  <section
    id="products"
    class="tab"
  >
    <div class="title-row">
      <h1>Товары</h1>
      <button
        id="new-product"
        :disabled="saving || uploading"
        @click="edit()"
      >
        Добавить товар
      </button>
    </div>
    <div class="product-admin">
      <div
        id="product-list"
        class="panel"
      >
        <div
          v-for="product in shop?.products"
          :key="product.id"
          class="product-row"
        >
          <div>
            <b>{{ product.name }}</b>
            <div class="muted">{{ product.category }} · {{ fmt(product.price) }}</div>
          </div>
          <button
            class="plain"
            :disabled="saving || uploading"
            @click="edit(product)"
          >
            Изменить
          </button>
        </div>
        <p
          v-if="!shop?.products.length"
          class="muted"
        >Товаров пока нет.</p>
      </div>
      <form
        v-if="editing"
        ref="formEl"
        id="product-form"
        class="panel"
        @submit.prevent="save"
      >
        <h2 id="product-form-title">
          {{ form.id === null ? 'Новый товар' : 'Редактирование товара' }}
        </h2>
        <input
          :value="form.id"
          name="id"
          type="hidden"
        />
        <input
          :value="form.photo"
          name="photo"
          type="hidden"
        />
        <label>Название
          <input
            v-model="form.name"
            name="name"
            required
            maxlength="160"
          />
        </label>
        <label>Категория
          <input
            v-model="form.category"
            name="category"
            required
            maxlength="100"
            list="category-list"
          />
        </label>
        <datalist id="category-list">
          <option
            v-for="category in categories"
            :key="category"
            :value="category"
          ></option>
        </datalist>
        <label>Цена, ₽
          <input
            v-model.number="form.price"
            name="price"
            type="number"
            min="0.01"
            max="100000000"
            step="0.01"
            required
          />
        </label>
        <label>Описание<textarea
            v-model="form.description"
            name="description"
            rows="5"
            maxlength="10000"
          ></textarea>
        </label>
        <label class="checkbox">
          <input
            v-model="form.demo"
            name="demo"
            type="checkbox"
          />Демонстрационный товар
        </label>
        <PhotoEditor
          v-model="form.photos"
          @busy="uploading = $event"
        />
        <h3>Произвольные свойства</h3>
        <div id="properties">
          <div
            v-for="(property, i) in form.properties"
            :key="i"
            class="property"
          >
            <input
              v-model="property.name"
              aria-label="Название свойства"
              placeholder="Название свойства"
              maxlength="100"
              required
            />
            <input
              v-model="property.description"
              aria-label="Описание свойства"
              placeholder="Описание"
              maxlength="2000"
            />
            <button
              type="button"
              class="danger"
              aria-label="Удалить свойство"
              @click="form.properties.splice(i, 1)"
            >
              ×
            </button>
          </div>
        </div>
        <button
          type="button"
          id="add-property"
          class="plain"
          @click="addProperty"
        >
          + Добавить свойство
        </button>
        <div class="actions">
          <button
            type="submit"
            :disabled="saving || uploading"
          >
            Сохранить товар</button>
          <button
            v-if="form.id !== null"
            type="button"
            id="delete-product"
            class="danger"
            :disabled="saving || uploading"
            @click="remove"
          >
            Удалить товар
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

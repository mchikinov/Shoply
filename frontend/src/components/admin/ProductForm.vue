<script setup lang="ts">
import { watch } from 'vue';
import type { Product } from '@/types/api';
import PhotoEditor from './PhotoEditor.vue';
import { useProductEditor } from '@/composables/useProductEditor';
const props = defineProps<{ product: Product | null }>();
const emit = defineEmits<{ busy: [value: boolean]; deleted: [] }>();
const {
  form,
  formEl,
  saving,
  uploading,
  categories,
  save,
  remove,
  addProperty,
} = useProductEditor(props.product, () => emit('deleted'));
watch([saving, uploading], ([saving, uploading]) =>
  emit('busy', saving || uploading),
);
</script>
<template>
  <form
    id="product-form"
    ref="formEl"
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
    <label
      >Название
      <input
        v-model="form.name"
        name="name"
        required
        maxlength="160"
      />
    </label>
    <label
      >Категория
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
    <label
      >Цена, ₽
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
    <label
      >Описание<textarea
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
      id="add-property"
      type="button"
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
        Сохранить товар
      </button>
      <button
        v-if="form.id !== null"
        id="delete-product"
        type="button"
        class="danger"
        :disabled="saving || uploading"
        @click="remove"
      >
        Удалить товар
      </button>
    </div>
  </form>
</template>

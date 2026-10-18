<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import { storeToRefs } from 'pinia';
import type { Product } from '@/types/api';
import { formatPrice } from '@/utils/format';
import { useCatalogStore } from '@/stores/catalog';
import ProductForm from '@/components/admin/ProductForm.vue';
const { products } = storeToRefs(useCatalogStore());
const selected = shallowRef<Product | null>(null);
const editing = ref(false);
const busy = ref(false);
const formVersion = ref(0);
/** Открывает новый независимый черновик; блокирует смену товара во время сохранения и загрузки. */
function edit(product?: Product) {
  if (busy.value) return;
  selected.value = product ?? null;
  formVersion.value++;
  editing.value = true;
}
/** Закрывает форму удалённого товара. */
function deleted() {
  editing.value = false;
  busy.value = false;
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
        :disabled="busy"
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
          v-for="product in products"
          :key="product.id"
          class="product-row"
        >
          <div>
            <b>{{ product.name }}</b>
            <div class="muted">
              {{ product.category }} · {{ formatPrice(product.price) }}
            </div>
          </div>
          <button
            class="plain"
            :disabled="busy"
            @click="edit(product)"
          >
            Изменить
          </button>
        </div>
        <p
          v-if="!products.length"
          class="muted"
        >
          Товаров пока нет.
        </p>
      </div>
      <ProductForm
        v-if="editing"
        :key="formVersion"
        :product="selected"
        @busy="busy = $event"
        @deleted="deleted"
      />
    </div>
  </section>
</template>

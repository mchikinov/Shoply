<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { Settings } from '../../shared/types';
import { readImageData } from '../../shared/api';
import { useAdmin } from '../state/admin';

const { shop, request, notify, fail } = useAdmin();
const form = reactive<Settings>({
  name: '',
  logo: '',
  accent: '#2864e8',
  background: '#ffffff',
  text: '#182231',
  telegram: '',
});
const saving = ref(false);
const uploading = ref(false);
watch(
  () => shop.value?.settings,
  (settings) => {
    if (settings) Object.assign(form, settings);
  },
  { immediate: true },
);

/** Сохраняет оформление, блокируя отправку во время загрузки логотипа. */
async function save() {
  if (saving.value || uploading.value) return;
  saving.value = true;
  try {
    await request('/api/admin/settings', { ...form });
    notify('Оформление сохранено. Обновите страницу магазина.');
  } catch (error) {
    fail(error);
  } finally {
    saving.value = false;
  }
}

/** Загружает логотип в черновик; для применения требуется сохранить оформление. */
async function uploadLogo(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const data = await readImageData(file);
    form.logo = (
      await request<{ path: string }>('/api/admin/upload', { data })
    ).path;
    notify('Логотип загружен. Сохраните оформление.');
  } catch (error) {
    fail(error);
  } finally {
    uploading.value = false;
    input.value = '';
  }
}
</script>

<template>
  <section
    id="settings"
    class="tab"
  >
    <h1>Оформление</h1>
    <form
      id="settings-form"
      class="panel"
      @submit.prevent="save"
    >
      <label>Название магазина
        <input
          v-model="form.name"
          name="name"
          required
          maxlength="80"
        />
      </label>
      <div class="color-row">
        <label>Основной цвет
          <input
            v-model="form.accent"
            name="accent"
            type="color"
          />
        </label>
        <label>Фон
          <input
            v-model="form.background"
            name="background"
            type="color"
          />
        </label>
        <label>Текст
          <input
            v-model="form.text"
            name="text"
            type="color"
          />
        </label>
      </div>
      <label>Поддержка в Telegram
        <input
          v-model="form.telegram"
          name="telegram"
          type="url"
          placeholder="https://t.me/username"
        />
      </label>
      <label>Логотип (PNG, JPEG, WebP, до 6 МБ)
        <input
          id="logo-file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          :disabled="uploading"
          @change="uploadLogo"
        />
      </label>
      <input
        v-model="form.logo"
        name="logo"
        type="hidden"
      />
      <div id="logo-preview">
        <img
          v-if="form.logo"
          :src="form.logo"
          alt="Логотип"
        />
      </div>
      <button
        type="button"
        id="clear-logo"
        class="plain"
        :disabled="uploading"
        @click="form.logo = ''"
      >
        Использовать текстовый логотип
      </button>
      <div class="actions">
        <button
          type="submit"
          :disabled="saving || uploading"
        >
          Сохранить оформление
        </button>
      </div>
    </form>
  </section>
</template>

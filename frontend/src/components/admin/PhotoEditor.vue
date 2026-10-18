<script setup lang="ts">
import { ref } from 'vue';
import { uploadImage } from '@/services/uploads';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';

const props = defineProps<{ modelValue: string[] }>();
const emit = defineEmits<{
  'update:modelValue': [photos: string[]];
  busy: [value: boolean];
}>();
const auth = useAuthStore();
const { announce: notify, fail } = useNotificationsStore();
const busy = ref(false);

/** Меняет порядок копии фотографий, не изменяя переданное родителем значение. */
function move(index: number, delta: number) {
  const photos = [...props.modelValue];
  const other = index + delta;
  if (other < 0 || other >= photos.length) return;
  [photos[index], photos[other]] = [photos[other], photos[index]];
  emit('update:modelValue', photos);
}

/** Последовательно загружает фото; при ошибке уже загруженные остаются в черновике. */
async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files || [])];
  if (!files.length || busy.value) return;
  if (props.modelValue.length + files.length > 12) {
    notify('Максимум 12 фотографий.', true);
    input.value = '';
    return;
  }
  busy.value = true;
  emit('busy', true);
  const photos = [...props.modelValue];
  try {
    for (const file of files) {
      photos.push(await auth.run(() => uploadImage(file)));
      emit('update:modelValue', [...photos]);
    }
    notify('Фотографии загружены. Сохраните товар.');
  } catch (error) {
    fail(error);
  } finally {
    busy.value = false;
    emit('busy', false);
    input.value = '';
  }
}
</script>

<template>
  <h3>Фотографии</h3>
  <p class="muted">
    До 12 фотографий. Первая используется в каталоге. Для изменения порядка
    используйте стрелки.
  </p>
  <input
    id="product-files"
    type="file"
    multiple
    accept="image/png,image/jpeg,image/webp"
    :disabled="busy"
    @change="upload"
  />
  <div
    id="photos"
    class="photos"
  >
    <div
      v-for="(path, i) in modelValue"
      :key="path + i"
      class="photo-item"
    >
      <img
        :src="path"
        :alt="`Фото ${i + 1}`"
      />
      <div class="photo-actions">
        <button
          type="button"
          :disabled="busy || i === 0"
          aria-label="Сдвинуть фото влево"
          @click="move(i, -1)"
        >
          ←
        </button>
        <button
          type="button"
          :disabled="busy || i === modelValue.length - 1"
          aria-label="Сдвинуть фото вправо"
          @click="move(i, 1)"
        >
          →
        </button>
        <button
          type="button"
          class="danger"
          :disabled="busy"
          aria-label="Удалить фото"
          @click="
            emit(
              'update:modelValue',
              modelValue.filter((_, index) => index !== i),
            )
          "
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

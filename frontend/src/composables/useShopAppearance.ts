import { watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useCatalogStore } from '@/stores/catalog';
/** Применяет серверные цвета только к витрине. */
export function useShopAppearance() {
  const { settings } = storeToRefs(useCatalogStore());
  watch(
    settings,
    (value) => {
      for (const [css, key] of [
        ['--color-accent', 'accent'],
        ['--color-bg', 'background'],
        ['--color-text', 'text'],
      ] as const)
        document.documentElement.style.setProperty(css, value[key]);
    },
    { immediate: true },
  );
}

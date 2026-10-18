import { onMounted, onUnmounted, ref } from 'vue';

/** Начальная тема установлена до CSS; Vue управляет переключением и синхронизацией вкладок. */
export function useTheme() {
  const dark = ref(document.documentElement.dataset.theme === 'dark');
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let saved: string | null = null;
  let timer: ReturnType<typeof setTimeout>;

  /** Читает допустимое предпочтение темы; недоступное хранилище означает системную тему. */
  const read = () => {
    try {
      saved = localStorage.getItem('shoply-theme');
    } catch {
      saved = null;
    }
    if (saved !== 'light' && saved !== 'dark') saved = null;
  };

  /** Применяет выбранную или системную тему и ограничивает время CSS-перехода. */
  const apply = () => {
    const theme = saved || (media.matches ? 'dark' : 'light');
    if (document.documentElement.dataset.theme !== theme) {
      document.documentElement.dataset.themeTransition = 'true';
      void document.documentElement.offsetWidth;
      clearTimeout(timer);
      timer = setTimeout(
        () => delete document.documentElement.dataset.themeTransition,
        360,
      );
    }
    document.documentElement.dataset.theme = theme;
    dark.value = theme === 'dark';
  };

  /** Синхронизирует тему при изменении настройки в другой вкладке. */
  const storage = (event: StorageEvent) => {
    if (event.key !== 'shoply-theme' && event.key !== null) return;
    read();
    apply();
  };

  /** Меняет тему и сохраняет выбор; при запрете хранилища выбор действует до перезагрузки. */
  const toggle = () => {
    saved = dark.value ? 'light' : 'dark';
    try {
      localStorage.setItem('shoply-theme', saved);
    } catch {
      /* Keep session-only preference. */
    }
    apply();
  };

  onMounted(() => {
    read();
    apply();
    media.addEventListener('change', apply);
    window.addEventListener('storage', storage);
  });
  onUnmounted(() => {
    clearTimeout(timer);
    media.removeEventListener('change', apply);
    window.removeEventListener('storage', storage);
  });
  return { dark, toggle };
}

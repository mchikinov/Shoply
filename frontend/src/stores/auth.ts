import { ref } from 'vue';
import { defineStore } from 'pinia';
import {
  fetchSession,
  signIn,
  signOut,
  type Credentials,
} from '@/services/auth';
import { ApiError } from '@/services/ApiError';
import { useCatalogStore } from './catalog';
import { useNotificationsStore } from './notifications';
/** Сессия администратора; секреты остаются в форме и серверной HttpOnly cookie. */
export const useAuthStore = defineStore('auth', () => {
  const authenticated = ref(false);
  const setup = ref(false);
  const ready = ref(false);
  const busy = ref(false);
  const catalog = useCatalogStore();
  const notifications = useNotificationsStore();
  /** Очищает данные после выхода или истечения серверной сессии. */
  function expire() {
    authenticated.value = false;
    setup.value = false;
    catalog.clear();
  }
  /** Выполняет защищённое действие; при 401 закрывает админку и передаёт ошибку вызывающему. */
  async function run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) expire();
      throw error;
    }
  }
  /** Проверяет сессию и загружает каталог до открытия панели. */
  async function start() {
    try {
      const session = await fetchSession();
      setup.value = session.setup;
      if (session.authenticated) {
        await catalog.refresh();
        authenticated.value = true;
      }
    } catch (error) {
      notifications.fail(error);
    } finally {
      ready.value = true;
    }
  }
  /** Выполняет вход или первую настройку; параллельная отправка блокируется. */
  async function login(credentials: Credentials) {
    if (busy.value) return false;
    busy.value = true;
    try {
      await signIn(credentials, setup.value);
      setup.value = false;
      await catalog.refresh();
      authenticated.value = true;
      notifications.announce('Вы вошли в админку.');
      return true;
    } catch (error) {
      notifications.fail(error);
      return false;
    } finally {
      busy.value = false;
    }
  }
  /** Очищает сессию после успешного выхода или подтверждённого 401. */
  async function logout() {
    try {
      await run(signOut);
      expire();
      notifications.announce('Вы вышли.');
    } catch (error) {
      notifications.fail(error);
    }
  }
  return { authenticated, setup, ready, busy, start, login, logout, run };
});

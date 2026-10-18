import { inject, provide, reactive, ref, type InjectionKey } from 'vue';
import { api, ApiError, loadShop, message } from '../../shared/api';
import type { Session, Shop } from '../../shared/types';

/** Объединяет состояние сессии, обновление каталога и уведомления одной админки. */
export function createAdmin() {
  const authenticated = ref(false);
  const setup = ref(false);
  const ready = ref(false);
  const busy = ref(false);
  const shop = ref<Shop | null>(null);
  const notice = reactive({ text: '', error: false });

  /** Обновляет общее уведомление админки и признак ошибки. */
  const notify = (text: string, error = false) =>
    Object.assign(notice, { text, error });

  /** Преобразует исключение в доступное пользователю сообщение. */
  const fail = (error: unknown) => notify(message(error), true);

  /** Выполняет запрос и сбрасывает локальную сессию при 401 вне формы входа. */
  async function request<T>(
    path: string,
    body?: object,
    method?: string,
  ): Promise<T> {
    try {
      return await api<T>(path, body, method);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        path !== '/api/login'
      ) {
        authenticated.value = false;
        setup.value = false;
        shop.value = null;
      }
      throw error;
    }
  }

  /** Заменяет локальный каталог проверенными данными сервера. */
  const refresh = async () => {
    shop.value = await loadShop();
  };

  /** Проверяет сессию и загружает каталог до открытия админки. */
  async function start() {
    try {
      const session = await request<Session>('/api/session');
      setup.value = session.setup;
      if (session.authenticated) {
        await refresh();
        authenticated.value = true;
      }
    } catch (error) {
      fail(error);
    } finally {
      ready.value = true;
    }
  }

  /** Выполняет вход или настройку; открывает админку после загрузки каталога. */
  async function login(credentials: { username: string; password: string }) {
    if (busy.value) return false;
    busy.value = true;
    try {
      await request(setup.value ? '/api/setup' : '/api/login', credentials);
      setup.value = false;
      await refresh();
      authenticated.value = true;
      notify('Вы вошли в админку.');
      return true;
    } catch (error) {
      fail(error);
      return false;
    } finally {
      busy.value = false;
    }
  }

  /** Завершает сессию и очищает локальные данные только после успешного ответа. */
  async function logout() {
    try {
      await request('/api/logout', {});
      authenticated.value = false;
      setup.value = false;
      shop.value = null;
      notify('Вы вышли.');
    } catch (error) {
      fail(error);
    }
  }

  return {
    authenticated,
    setup,
    ready,
    busy,
    shop,
    notice,
    notify,
    fail,
    request,
    refresh,
    start,
    login,
    logout,
  };
}

export type Admin = ReturnType<typeof createAdmin>;
const key: InjectionKey<Admin> = Symbol('shoply-admin');

/** Создаёт состояние админки и предоставляет его дочерним компонентам. */
export function provideAdmin() {
  const admin = createAdmin();
  provide(key, admin);
  return admin;
}

/** Возвращает состояние ближайшего провайдера; без него сообщает об ошибке подключения. */
export function useAdmin() {
  const admin = inject(key);
  if (!admin) throw new Error('Admin provider missing');
  return admin;
}

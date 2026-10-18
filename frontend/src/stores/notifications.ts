import { reactive } from 'vue';
import { defineStore } from 'pinia';
import { getErrorMessage } from '@/utils/errors';
/** Уведомления принадлежат экземпляру приложения; версия перезапускает таймер toast. */
export const useNotificationsStore = defineStore('notifications', () => {
  const toast = reactive({ text: '', detail: '', added: false, version: 0 });
  const notice = reactive({ text: '', error: false });
  /** Показывает уведомление витрины, в том числе повторно с тем же текстом. */
  function notify(text: string, detail = '', added = false) {
    Object.assign(toast, { text, detail, added, version: toast.version + 1 });
  }
  /** Обновляет постоянное сообщение админки. */
  function announce(text: string, error = false) {
    Object.assign(notice, { text, error });
  }
  /** Показывает ошибку действия администратора. */
  function fail(error: unknown) {
    announce(getErrorMessage(error), true);
  }
  return { toast, notice, notify, announce, fail };
});

import { useCartStore } from '@/stores/cart';
import { useNotificationsStore } from '@/stores/notifications';
import { getErrorMessage } from '@/utils/errors';
/** Связывает действия покупателя с корзиной и уведомлениями интерфейса. */
export function useCartActions() {
  const cart = useCartStore();
  const { notify } = useNotificationsStore();
  /** Сообщает результат только при действительном изменении количества. */
  async function change(id: number, delta: number) {
    const before = cart.basket[id] || 0;
    try {
      await cart.change(id, delta);
    } catch (error) {
      notify(getErrorMessage(error));
      return;
    }
    if ((cart.basket[id] || 0) !== before)
      notify(
        delta > 0 ? 'Товар добавлен в корзину' : 'Товар удалён из корзины',
        cart.basket[id] > 1 ? `В корзине: ${cart.basket[id]} шт.` : '',
        delta > 0,
      );
  }
  /** Удаляет позицию и подтверждает действие. */
  async function remove(id: number) {
    try {
      await cart.remove(id);
      notify('Товар удалён из корзины');
    } catch (error) {
      notify(getErrorMessage(error));
    }
  }
  return { change, remove };
}

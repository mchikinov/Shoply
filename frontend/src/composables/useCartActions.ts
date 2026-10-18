import { useCartStore } from '@/stores/cart';
import { useNotificationsStore } from '@/stores/notifications';
/** Связывает действия покупателя с корзиной и уведомлениями интерфейса. */
export function useCartActions() {
  const cart = useCartStore();
  const { notify } = useNotificationsStore();
  /** Сообщает результат только при действительном изменении количества. */
  function change(id: number, delta: number) {
    const before = cart.basket[id] || 0;
    cart.change(id, delta);
    if ((cart.basket[id] || 0) !== before)
      notify(
        delta > 0 ? 'Товар добавлен в корзину' : 'Товар удалён из корзины',
        cart.basket[id] > 1 ? `В корзине: ${cart.basket[id]} шт.` : '',
        delta > 0,
      );
  }
  /** Удаляет позицию и подтверждает действие. */
  function remove(id: number) {
    cart.remove(id);
    notify('Товар удалён из корзины');
  }
  return { change, remove };
}

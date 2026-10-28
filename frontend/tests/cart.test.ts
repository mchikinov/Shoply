import './setup';
import { describe, expect, it, vi } from 'vitest';
import { useCartStore } from '@/stores/cart';
import { useCheckoutStore } from '@/stores/checkout';
import { createPinia } from 'pinia';
import { product, response } from './fixtures';

const empty = { lines: [], count: 0, total: 0, version: 0, changes: [] };
const filled = {
  lines: [{ ...product, quantity: 2, subtotal: 123 }],
  count: 2,
  total: 123,
  version: 1,
  changes: [],
};

describe('Серверная корзина', () => {
  it('не теряет неподтверждённый заказ одной вкладки при повторе старого заказа в другой', async () => {
    const storage = () => {
      const values = new Map<string, string>([
        ['shoply-pending-token', 'old-order'],
      ]);
      return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      };
    };
    const firstStorage = storage();
    const secondStorage = storage();
    // Две вкладки могут унаследовать старую попытку при открытии из одной страницы.
    localStorage.setItem('shoply-pending-token', 'old-order');
    vi.stubGlobal('sessionStorage', firstStorage);
    const first = useCheckoutStore(createPinia());
    vi.stubGlobal('sessionStorage', secondStorage);
    const second = useCheckoutStore(createPinia());
    let newerToken = '';
    let loseAnswer = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_path: string, options?: RequestInit) => {
        const input = JSON.parse(String(options?.body));
        if (input.token !== 'old-order') {
          newerToken = input.token;
          if (loseAnswer) {
            loseAnswer = false;
            throw Error('Ответ нового заказа потерян');
          }
        }
        return response({
          id: input.token === 'old-order' ? 1 : 2,
          total: 100,
          delivery: 'pickup',
          cart: empty,
        });
      }),
    );
    const fields = {
      fullname: 'Покупатель',
      phone: '+79991234567',
      delivery: 'pickup' as const,
      address: '',
      cart_version: 0,
    };
    await first.submit(fields);
    await expect(first.submit(fields)).rejects.toThrow(
      'Ответ нового заказа потерян',
    );
    await second.submit(fields);
    vi.stubGlobal('sessionStorage', firstStorage);
    const reloaded = useCheckoutStore(createPinia());
    expect(reloaded.hasPending).toBe(true);
    expect(firstStorage.getItem('shoply-pending-token')).toBe(newerToken);
    expect((await reloaded.submit(fields))?.id).toBe(2);
  });

  it('отображает серверные количества и суммы без вычисления по каталогу', async () => {
    localStorage.setItem('shoply-basket', '{"0":99}');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(filled)),
    );
    const cart = useCartStore();
    await cart.load();
    expect(cart.count).toBe(2);
    expect(cart.total).toBe(123);
    expect(cart.lines[0].subtotal).toBe(123);
    expect(cart.basket).toEqual({ 0: 2 });
    expect(cart.ready).toBe(true);
  });

  it('подтверждает добавление только после ответа сервера', async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response(empty))
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        ),
    );
    const cart = useCartStore();
    await cart.load();
    const pending = cart.change(0, 1);
    await vi.waitFor(() => expect(cart.busy).toBe(true));
    expect(cart.count).toBe(0);
    finish(response(filled));
    await pending;
    expect(cart.count).toBe(2);
    expect(cart.busy).toBe(false);
  });

  it('различает ошибку чтения и успешно загруженную пустую корзину', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(Error('Нет связи'))
        .mockResolvedValueOnce(response(empty)),
    );
    const cart = useCartStore();
    await cart.load();
    expect(cart.ready).toBe(false);
    expect(cart.error).toContain('Нет связи');
    await cart.load();
    expect(cart.ready).toBe(true);
    expect(cart.error).toBe('');
    expect(cart.count).toBe(0);
  });

  it('повторяет неопределённую операцию с тем же ключом и не показывает ложный успех', async () => {
    const bodies: object[] = [];
    let fail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_path: string, options?: RequestInit) => {
        if (!options?.body) return response(empty);
        bodies.push(JSON.parse(String(options.body)));
        if (fail) throw Error('Ответ потерян');
        return response(filled);
      }),
    );
    const cart = useCartStore();
    await cart.load();
    await expect(cart.change(0, 1)).rejects.toThrow('Ответ потерян');
    expect(cart.count).toBe(0);
    fail = false;
    await cart.retry();
    expect(bodies[0]).toEqual(bodies[1]);
    expect(cart.count).toBe(2);
    expect(cart.uncertain).toBe(false);
  });

  it('применяет актуальную корзину при конфликте без автоматического повтора действия', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(empty))
      .mockResolvedValueOnce(
        response(
          { code: 'cart_changed', error: 'Корзина изменилась', cart: filled },
          409,
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const cart = useCartStore();
    await cart.load();
    await expect(cart.change(0, 1)).rejects.toThrow('Корзина изменилась');
    expect(cart.total).toBe(123);
    expect(cart.notice).toContain('Корзина изменилась');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cart.uncertain).toBe(false);
  });

  it('отклоняет некорректный снимок вместо выдачи его за пустую корзину', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ products: [product] })),
    );
    const cart = useCartStore();
    await cart.load();
    expect(cart.ready).toBe(false);
    expect(cart.error).toBeTruthy();
  });
});

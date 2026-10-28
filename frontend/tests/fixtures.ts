import type { Cart, Product, Settings } from '@/types/api';
export const product: Product = {
  id: 0,
  name: 'Лампа <Сфера>',
  price: 4900,
  category: 'Дом',
  photo: 0,
  photos: [],
  properties: [{ name: 'Материал', description: 'Металл' }],
  description: 'Описание лампы',
};
export const settings: Settings = {
  name: 'Shoply',
  logo: '',
  accent: '#2864e8',
  background: '#ffffff',
  text: '#182231',
  telegram: '',
};
export const response = (data: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
});

/** Изолированный HTTP-дубль корзины для интеграционных тестов интерфейса. */
export function createStorefrontFetch(
  onOrder?: (
    body: Record<string, unknown>,
  ) => Promise<ReturnType<typeof response>>,
) {
  const state: { cart: Cart } = {
    cart: { lines: [], count: 0, total: 0, version: 0, changes: [] },
  };
  const fetch = async (path: string, options?: RequestInit) => {
    if (path === '/api/shop')
      return response({ products: [product], settings });
    if (path === '/api/cart') return response(structuredClone(state.cart));
    const body = JSON.parse(String(options?.body));
    if (path.startsWith('/api/cart/items')) {
      const quantity =
        options?.method === 'DELETE'
          ? 0
          : (state.cart.lines[0]?.quantity ?? 0) +
            (body.quantity ?? body.delta);
      state.cart = {
        lines: quantity
          ? [{ ...product, quantity, subtotal: 4900 * quantity }]
          : [],
        count: quantity,
        total: 4900 * quantity,
        version: state.cart.version + 1,
        changes: [],
      };
      return response(structuredClone(state.cart));
    }
    if (path === '/api/orders' && onOrder) {
      const result = await onOrder(body);
      if (result.ok) {
        state.cart = {
          lines: [],
          count: 0,
          total: 0,
          version: state.cart.version + 1,
          changes: [],
        };
        return response(
          {
            ...((await result.json()) as object),
            cart: structuredClone(state.cart),
          },
          result.status,
        );
      }
      return result;
    }
    throw new Error(`Неожиданный тестовый запрос: ${path}`);
  };
  return { fetch, state };
}

import './setup';
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import App from '../src/admin/App.vue';
import { product, settings, response } from './fixtures';

function mockApi({ authenticated = false, setup = true } = {}) {
  let failStatus = false,
    expired = false;
  const requests: [string, RequestInit | undefined][] = [];
  let products = [structuredClone(product)];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, options?: RequestInit) => {
      requests.push([path, options]);
      if (expired && path.startsWith('/api/admin'))
        return response({ error: 'Войдите в админку.' }, 401);
      if (path === '/api/session') return response({ authenticated, setup });
      if (path === '/api/shop') return response({ products, settings });
      if (path === '/api/admin/products') {
        const body = JSON.parse(String(options?.body));
        if (options?.method === 'DELETE') {
          products = [];
          return response({ ok: true });
        }
        products = [{ ...body, id: body.id ?? 9 }];
        return response({ id: products[0].id });
      }
      if (path === '/api/admin/orders' && !options?.method)
        return response({
          orders: [
            {
              id: 7,
              created: '2026-10-11',
              status: 'Ожидает оплаты',
              customer: { fullname: '<Покупатель>', phone: '+79991234567' },
              items: [{ ...product, quantity: 1 }],
              total: 4900,
              delivery: 'pickup',
              address: '',
            },
          ],
          statuses: ['Ожидает оплаты', 'В работе', 'Отправлен'],
        });
      if (path === '/api/admin/orders' && failStatus)
        return response({ error: 'Ошибка статуса' }, 400);
      if (path === '/api/admin/upload')
        return response({ path: 'assets/uploads/test.png' }, 201);
      return response({ ok: true });
    }),
  );
  return {
    requests,
    failStatus: () => {
      failStatus = true;
    },
    expire: () => {
      expired = true;
    },
  };
}
async function tab(wrapper: ReturnType<typeof mount>, id: string) {
  await wrapper.get(`[data-tab="${id}"]`).trigger('click');
  await flushPromises();
}
describe('Админка', () => {
  it('создаёт администратора, входит и выходит через существующий API', async () => {
    const mock = mockApi();
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.get('#login-title').text()).toBe('Создайте администратора');
    await wrapper.get('[name=username]').setValue('test-admin');
    await wrapper.get('[name=password]').setValue('password123');
    await wrapper.get('#login-form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('#dashboard').exists()).toBe(true);
    expect(mock.requests.some(([url]) => url === '/api/setup')).toBe(true);
    await wrapper.get('#logout').trigger('click');
    await flushPromises();
    expect(wrapper.get('#login-title').text()).toBe('Вход в админку');
    await wrapper.get('#login-form').trigger('submit');
    await flushPromises();
    expect(mock.requests.some(([url]) => url === '/api/login')).toBe(true);
    wrapper.unmount();
  });

  it('сохраняет оформление и редактирует товар, фото и свойства', async () => {
    const mock = mockApi({ authenticated: true });
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    await wrapper.get('#settings-form [name=name]').setValue('Мой магазин');
    await wrapper.get('#settings-form').trigger('submit');
    await flushPromises();
    expect(
      JSON.parse(
        String(
          mock.requests.find(([url]) => url === '/api/admin/settings')![1]!
            .body,
        ),
      ).name,
    ).toBe('Мой магазин');
    await tab(wrapper, 'products');
    await wrapper.get('#product-list button').trigger('click');
    expect(wrapper.get('#product-form [name=name]').element).toHaveProperty(
      'value',
      product.name,
    );
    await wrapper.get('#product-form [name=name]').setValue('Новая лампа');
    await wrapper.get('#add-property').trigger('click');
    await wrapper
      .findAll('[aria-label="Название свойства"]')
      .at(-1)!
      .setValue('Цвет');
    await wrapper.get('#product-form').trigger('submit');
    await flushPromises();
    const saved = JSON.parse(
      String(
        mock.requests.find(([url]) => url === '/api/admin/products')![1]!.body,
      ),
    );
    expect(saved.name).toBe('Новая лампа');
    expect(saved.properties).toHaveLength(2);
    vi.stubGlobal('confirm', () => true);
    await wrapper.get('#delete-product').trigger('click');
    await flushPromises();
    expect(wrapper.get('#product-list').text()).toContain('Товаров пока нет.');
    wrapper.unmount();
  });

  it('экранирует текст заказа, откатывает ошибку статуса и обрабатывает 401', async () => {
    const mock = mockApi({ authenticated: true });
    const wrapper = mount(App);
    await flushPromises();
    await tab(wrapper, 'orders');
    expect(wrapper.get('#order-list').text()).toContain('<Покупатель>');
    expect(wrapper.get('#order-list').html()).toContain('&lt;Покупатель&gt;');
    const select = wrapper.get('[data-order="7"]');
    await select.setValue('В работе');
    await flushPromises();
    mock.failStatus();
    await select.setValue('Отправлен');
    await flushPromises();
    expect(select.element).toHaveProperty('value', 'В работе');
    expect(wrapper.get('#notice').text()).toBe('Ошибка статуса');
    mock.expire();
    await wrapper.get('#refresh-orders').trigger('click');
    await flushPromises();
    expect(wrapper.find('#dashboard').exists()).toBe(false);
    expect(wrapper.find('#login-form').exists()).toBe(true);
    wrapper.unmount();
  });

  it('загружает фотографию в JSON и сохраняет её порядок в форме', async () => {
    const mock = mockApi({ authenticated: true });
    const wrapper = mount(App);
    await flushPromises();
    await tab(wrapper, 'products');
    await wrapper.get('#new-product').trigger('click');
    const input = wrapper.get('#product-files');
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['test'], 'photo.png', { type: 'image/png' })],
    });
    await input.trigger('change');
    await vi.waitFor(() =>
      expect(wrapper.findAll('.photo-item')).toHaveLength(1),
    );
    expect(
      JSON.parse(
        String(
          mock.requests.find(([url]) => url === '/api/admin/upload')![1]!.body,
        ),
      ),
    ).toEqual({ data: 'dGVzdA==' });
    await wrapper.get('[aria-label="Удалить фото"]').trigger('click');
    expect(wrapper.findAll('.photo-item')).toHaveLength(0);
    wrapper.unmount();
  });
});

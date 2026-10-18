import './setup';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import Catalog from '@/components/storefront/ProductCatalog.vue';
import Checkout from '@/components/storefront/CheckoutForm.vue';
import ProductDetail from '@/components/storefront/ProductDetail.vue';
import { readBasket } from '@/utils/basketStorage';
import { useCartStore } from '@/stores/cart';
import { useCatalogStore } from '@/stores/catalog';
import { mountStorefront, navigateStorefront } from './apps';
import { product, settings, response } from './fixtures';

async function navigate(hash: string) {
  await navigateStorefront(hash);
  await flushPromises();
}
describe('Витрина', () => {
  it('сохраняет старую корзину, проверяет данные и ограничивает количество', () => {
    localStorage.setItem(
      'shoply-basket',
      JSON.stringify({ 0: 2, 1: -1, 2: 1000, x: 3 }),
    );
    expect(readBasket()).toEqual({ 0: 2 });
    useCatalogStore().products = [product];
    const cart = useCartStore();
    cart.change(0, 2000);
    expect(cart.count).toBe(999);
    expect(JSON.parse(localStorage.getItem('shoply-basket')!)[0]).toBe(999);
    cart.change(88, 1);
    expect(cart.basket[88]).toBeUndefined();
    cart.remove(0);
    expect(cart.total).toBe(0);
    localStorage.setItem('shoply-basket', 'broken');
    expect(readBasket()).toEqual({});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw Error('blocked');
    });
    expect(readBasket()).toEqual({});
  });

  it('фильтрует по поиску, категории, цене, сортирует и сбрасывает', async () => {
    const products = [
      product,
      {
        ...product,
        id: 1,
        name: 'Наушники',
        category: 'Электроника',
        price: 8900,
      },
    ];
    const wrapper = mount(Catalog, {
      global: { stubs: { RouterLink: RouterLinkStub } },
      props: { products, basket: {}, loading: false, search: '' },
    });
    expect(
      wrapper.findAll('article').map((n) => n.attributes('data-id')),
    ).toEqual(['1', '0']);
    await wrapper.get('#sort-demo').setValue('asc');
    expect(
      wrapper.findAll('article').map((n) => n.attributes('data-id')),
    ).toEqual(['0', '1']);
    await wrapper.setProps({ search: 'науш' });
    expect(wrapper.findAll('article')).toHaveLength(1);
    await wrapper.setProps({ search: '' });
    await wrapper
      .findAll('.chips button')
      .find((n) => n.text() === 'Дом')!
      .trigger('click');
    expect(wrapper.findAll('article')).toHaveLength(1);
    await wrapper.get('#min-demo').setValue('6000');
    expect(wrapper.findAll('article')).toHaveLength(0);
    await wrapper.get('#reset-demo').trigger('click');
    expect(wrapper.findAll('article')).toHaveLength(2);
    expect(wrapper.emitted('reset')).toHaveLength(1);
    wrapper.unmount();
  });

  it('согласует положение ползунков с асинхронно загруженным каталогом', async () => {
    const wrapper = mount(Catalog, {
      global: { stubs: { RouterLink: RouterLinkStub } },
      props: { products: [], basket: {}, loading: true, search: '' },
    });
    await wrapper.setProps({
      products: [product, { ...product, id: 1, price: 14900 }],
      loading: false,
    });
    expect(wrapper.get('#min-demo').element).toHaveProperty('value', '4900');
    expect(wrapper.get('#max-demo').element).toHaveProperty('value', '14900');
    await wrapper.get('#min-demo').setValue('10000');
    await wrapper.get('#max-demo').setValue('6000');
    expect(wrapper.get('#max-demo').element).toHaveProperty('value', '10000');
    wrapper.unmount();
  });

  it('повторяет заказ с тем же токеном, сохраняет форму после сбоя и подтверждает серверную сумму', async () => {
    let fail = true;
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path === '/api/shop')
          return response({ products: [product], settings });
        const body = JSON.parse(String(options?.body));
        requests.push(body);
        if (fail) throw Error('Потеря соединения');
        return response({ id: 41, total: 4700, delivery: 'pickup' }, 201);
      }),
    );
    const wrapper = mountStorefront({ attachTo: document.body });
    await flushPromises();
    await wrapper.get('[data-add="0"]').trigger('click');
    expect(wrapper.get('#max-demo').element).toHaveProperty('value', '4900');
    expect(wrapper.get('#basket-count').text()).toBe('1');
    await navigate('#checkout');
    await wrapper.get('[name=fullname]').setValue('Тестовый покупатель');
    await wrapper.get('[name=phone]').setValue('+79991234567');
    await wrapper.get('[value=pickup]').setValue();
    expect(wrapper.get('#address-input').attributes('disabled')).toBeDefined();
    await wrapper.get('#demo-order').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[name=fullname]').element).toHaveProperty(
      'value',
      'Тестовый покупатель',
    );
    expect(localStorage.getItem('shoply-pending-token')).toBeTruthy();
    expect(wrapper.get('#basket-count').text()).toBe('1');
    fail = false;
    await wrapper.get('#demo-order').trigger('submit');
    await flushPromises();
    await navigate('#success');
    expect(requests[0].token).toBe(requests[1].token);
    expect(wrapper.get('#order-number').text()).toBe('41');
    expect(wrapper.get('#success').text()).toContain('4 700 ₽');
    expect(wrapper.get('#success').text()).toContain('Ожидает оплаты');
    expect(wrapper.get('#basket-count').text()).toBe('0');
    expect(localStorage.getItem('shoply-pending-token')).toBeNull();
    await navigate('#catalog');
    await wrapper.get('[data-add="0"]').trigger('click');
    await navigate('#success');
    expect(wrapper.get('#success').text()).toContain('4 700 ₽');
    wrapper.unmount();
  });

  it('обрабатывает прямую ссылку, корзину поверх товара и возврат фокуса', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ products: [product], settings })),
    );
    window.history.replaceState({}, '', '/#product/0');
    const wrapper = mountStorefront({ attachTo: document.body });
    await flushPromises();
    expect(wrapper.get('#product h1').text()).toBe(product.name);
    expect(document.title).toBe('Shoply — ' + product.name);
    expect(document.activeElement).toBe(wrapper.get('#product h1').element);
    const link = wrapper.get('header a[href="#/cart"]');
    (link.element as HTMLElement).focus();
    await navigate('#cart');
    expect(wrapper.get('#product').isVisible()).toBe(true);
    expect(wrapper.find('#cart').exists()).toBe(true);
    expect(document.activeElement).toHaveProperty('className', 'cart-close');
    await wrapper.get('.cart-close').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await flushPromises();
    expect(wrapper.find('#cart').exists()).toBe(false);
    expect(document.activeElement).toBe(link.element);
    await navigate('#product/999');
    expect(wrapper.get('#catalog').isVisible()).toBe(true);
    wrapper.unmount();
  });

  it('не разрешает оформление без соединения и пустой корзины', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Error('offline');
      }),
    );
    const wrapper = mountStorefront();
    await flushPromises();
    expect(wrapper.get('#connection-note').text()).toContain('Нет соединения');
    await navigate('#checkout');
    expect(
      wrapper.get('[form="demo-order"]').attributes('disabled'),
    ).toBeDefined();
    wrapper.unmount();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ products: [product], settings })),
    );
    setActivePinia(createPinia());
    window.history.replaceState({}, '', '/#checkout');
    const empty = mountStorefront();
    await flushPromises();
    expect(location.hash).toBe('#/cart');
    empty.unmount();
  });

  it('не отправляет два параллельных заказа и сохраняет состав без клиентских цен', async () => {
    const { useCheckoutStore } = await import('@/stores/checkout');
    let resolve!: (value: unknown) => void;
    const fetcher = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const checkout = useCheckoutStore();
    const fields = {
      fullname: 'Тест',
      phone: '+79991234567',
      delivery: 'pickup' as const,
      address: '',
      items: [{ id: 0, quantity: 1 }],
    };
    const first = checkout.submit(fields);
    expect(await checkout.submit(fields)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve(response({ id: 7, total: 4900, delivery: 'pickup' }));
    await first;
    expect(checkout.submitting).toBe(false);
  });

  it('скрывает адрес при самовывозе и открывает галерею с клавиатуры', async () => {
    const checkout = mount(Checkout, {
      global: { stubs: { RouterLink: RouterLinkStub } },
      props: {
        lines: [{ ...product, quantity: 1 }],
        total: 4900,
        ready: true,
        submitting: false,
      },
    });
    await checkout.get('[value=pickup]').setValue();
    expect(checkout.get('#address-field').isVisible()).toBe(false);
    await checkout.get('[value=post]').setValue();
    expect(checkout.get('#address-input').attributes('required')).toBeDefined();
    checkout.unmount();
    const detail = mount(ProductDetail, {
      global: { stubs: { RouterLink: RouterLinkStub } },
      props: {
        product: { ...product, photos: ['/one.png', '/two.png'] },
        quantity: 0,
      },
      attachTo: document.body,
    });
    await detail.get('#product-visual').trigger('keydown', { key: 'Enter' });
    expect(detail.get('dialog').element).toHaveProperty('open', true);
    await detail.get('.photo-viewer-next').trigger('click');
    expect(detail.get('.photo-viewer-image').attributes('src')).toBe(
      '/two.png',
    );
    await detail.get('.photo-viewer-close').trigger('click');
    expect(document.body.style.overflow).toBe('');
    detail.unmount();
  });
});

describe('Маршруты и сохранение состояния', () => {
  it('принимает старые ссылки при открытии и после запуска, обрабатывает назад и вперёд', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ products: [product], settings })),
    );
    window.history.replaceState({}, '', '/#product/0');
    const wrapper = mountStorefront({ attachTo: document.body });
    await vi.waitFor(() =>
      expect(wrapper.find('#product').exists()).toBe(true),
    );
    expect(location.hash).toBe('#/product/0');
    window.location.hash = '#catalog';
    await vi.waitFor(() =>
      expect(wrapper.find('#catalog').exists()).toBe(true),
    );
    expect(location.hash).toBe('#/catalog');
    await wrapper.get('.product-name').trigger('click');
    await vi.waitFor(() => expect(location.hash).toBe('#/product/0'));
    history.back();
    await vi.waitFor(() =>
      expect(wrapper.find('#catalog').exists()).toBe(true),
    );
    history.forward();
    await vi.waitFor(() =>
      expect(wrapper.find('#product').exists()).toBe(true),
    );
    await navigate('#success');
    expect(location.hash).toBe('#/catalog');
    wrapper.unmount();
  });

  it('сохраняет фильтры и незавершённое оформление между страницами', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ products: [product], settings })),
    );
    const wrapper = mountStorefront();
    await flushPromises();
    await wrapper.get('#sort-demo').setValue('asc');
    await wrapper.get('[data-add="0"]').trigger('click');
    await navigate('#checkout');
    await wrapper.get('[name=fullname]').setValue('Черновик покупателя');
    await wrapper.get('[value=pickup]').setValue();
    await navigate('#catalog');
    expect(wrapper.get('#sort-demo').element).toHaveProperty('value', 'asc');
    await navigate('#checkout');
    expect(wrapper.get('[name=fullname]').element).toHaveProperty(
      'value',
      'Черновик покупателя',
    );
    expect(wrapper.get('[value=pickup]').element).toHaveProperty(
      'checked',
      true,
    );
    await navigate('#cart');
    await wrapper.get('.cart-close').trigger('click');
    await vi.waitFor(() => expect(wrapper.find('#cart').exists()).toBe(false));
    expect(location.hash).toBe('#/checkout');
    expect(wrapper.get('[name=fullname]').element).toHaveProperty(
      'value',
      'Черновик покупателя',
    );
    wrapper.unmount();
  });
});

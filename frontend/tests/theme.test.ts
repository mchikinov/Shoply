import './setup';
import { expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ThemeToggle from '../src/shared/components/ThemeToggle.vue';
import { media } from './setup';
it('выбирает системную тему, сохраняет выбор и синхронизирует вкладки', async () => {
  media.matches = true;
  const wrapper = mount(ThemeToggle);
  await flushPromises();
  expect(document.documentElement.dataset.theme).toBe('dark');
  await wrapper.get('button').trigger('click');
  expect(localStorage.getItem('shoply-theme')).toBe('light');
  localStorage.setItem('shoply-theme', 'dark');
  window.dispatchEvent(
    new StorageEvent('storage', { key: 'shoply-theme', newValue: 'dark' }),
  );
  await flushPromises();
  expect(wrapper.get('button').attributes('aria-pressed')).toBe('true');
  wrapper.unmount();
});
it('работает при недоступном хранилище', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('blocked');
  });
  const wrapper = mount(ThemeToggle);
  await wrapper.get('button').trigger('click');
  expect(document.documentElement.dataset.theme).toBe('dark');
  wrapper.unmount();
});

it('применяет тему до CSS на обеих HTML-точках входа', async () => {
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  for (const page of ['index', 'admin']) {
    const html = readFileSync(
      new URL('../' + page + '.html', import.meta.url),
      'utf8',
    );
    expect(html.indexOf('<script>')).toBeLessThan(
      html.indexOf('rel="stylesheet"'),
    );
    const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
    for (const saved of ['dark', 'light', 'invalid', null]) {
      const root = { dataset: {} as Record<string, string> };
      runInNewContext(script, {
        document: { documentElement: root },
        localStorage: { getItem: () => saved },
        matchMedia: () => ({ matches: true }),
      });
      expect(root.dataset.theme).toBe(saved === 'light' ? 'light' : 'dark');
    }
  }
});

import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, vi } from 'vitest';

export const media = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
let pinia: Pinia;
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  document.documentElement.dataset.theme = 'light';
  window.history.replaceState({}, '', '/');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => media,
  });
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  media.matches = false;
});
afterEach(() => {
  disposePinia(pinia);
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** Проверки общего переключателя темы витрины и админки. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/assets/js/theme.js'), 'utf8');
function boot({ saved = null, dark = false, blocked = false } = {}) {
  const storage = new Map(saved === null ? [] : [['shoply-theme', saved]]);
  const events = {}, attributes = {};
  const root = { dataset: {} };
  const button = {
    setAttribute(key, value) { attributes[key] = value; },
    addEventListener(type, handler) { this[type] = handler; },
  };
  const media = { matches: dark, addEventListener(type, handler) { this[type] = handler; } };
  const document = {
    documentElement: root,
    querySelector: () => button,
    addEventListener(type, handler) { events[type] = handler; },
  };
  vm.runInNewContext(source, {
    document,
    window: { matchMedia: () => media, addEventListener(type, handler) { events[type] = handler; } },
    localStorage: {
      getItem(key) { if (blocked) throw Error('Storage blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw Error('Storage blocked'); storage.set(key, value); },
    },
  });
  events.DOMContentLoaded();
  return { root, button, media, events, attributes, storage };
}
let app = boot({ dark: true });
assert.equal(app.root.dataset.theme, 'dark');
assert.equal(app.attributes['aria-pressed'], 'true');
app.media.matches = false;
app.media.change({ matches: false });
assert.equal(app.root.dataset.theme, 'light');
app.button.click();
assert.equal(app.storage.get('shoply-theme'), 'dark');
assert.equal(app.attributes['aria-label'], 'Включить светлую тему');
app.media.change({ matches: false });
assert.equal(app.root.dataset.theme, 'dark');
assert.equal(boot({ saved: app.storage.get('shoply-theme') }).root.dataset.theme, 'dark');
app.events.storage({ key: 'shoply-theme', newValue: 'light' });
assert.equal(app.root.dataset.theme, 'light');
app.events.storage({ key: 'shoply-theme', newValue: null });
app.media.change({ matches: true });
assert.equal(app.root.dataset.theme, 'dark');
app = boot({ saved: 'invalid', dark: false });
assert.equal(app.root.dataset.theme, 'light');
app = boot({ blocked: true });
app.button.click();
assert.equal(app.root.dataset.theme, 'dark');
app.button.click();
assert.equal(app.root.dataset.theme, 'light');
for (const page of ['index.html', 'admin.html']) {
  const html = fs.readFileSync(path.join(__dirname, '../public', page), 'utf8');
  assert.ok(html.indexOf('src="assets/js/theme.js"') < html.indexOf('rel="stylesheet"'));
  assert.equal((html.match(/id="theme-toggle"/g) || []).length, 1);
}
console.log('OK: системная тема, переключение, сохранение, синхронизация, недоступное хранилище, подключение на обеих страницах.');

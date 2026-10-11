/** Проверки загрузки админки, форм и отката статуса после ошибки сервера. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const publicDir = path.resolve(__dirname, "../public");

/** Исполнить реальные скрипты страницы с минимальной моделью DOM и API. */
async function run() {
  const nodes = new Map();
  const requests = [];
  let failStatus = false;
  const fields = Object.fromEntries(
    [
      "name",
      "logo",
      "accent",
      "background",
      "text",
      "telegram",
      "id",
      "photo",
      "category",
      "price",
      "description",
      "demo",
    ].map((key) => [key, { value: "", checked: false, focus() {} }]),
  );
  /** Получить стабильный элемент модели DOM по селектору. */
  function node(selector) {
    if (!nodes.has(selector))
      nodes.set(selector, {
        value: "",
        hidden: false,
        disabled: false,
        textContent: "",
        innerHTML: "",
        dataset: {},
        children: [],
        elements: fields,
        classList: { toggle() {} },
        addEventListener(type, callback) {
          this[type] = callback;
        },
        querySelector: node,
        reset() {},
        focus() {},
        scrollIntoView() {},
      });
    return nodes.get(selector);
  }
  const status = node("status");
  status.value = "Ожидает оплаты";
  status.dataset.order = "7";
  const context = {
    document: {
      querySelector: node,
      querySelectorAll(selector) {
        return selector === "[data-order]" ? [status] : [];
      },
      addEventListener() {},
    },
    location: { protocol: "http:", hash: "#settings" },
    FormData: function (form) {
      return Object.entries(form.values || {});
    },
    confirm: () => true,
    fetch: async (url, options) => {
      requests.push([url, options]);
      let data;
      if (url === "/api/session") data = { authenticated: false, setup: true };
      else if (url === "/api/shop")
        data = {
          products: [],
          settings: { name: "Shoply", accent: "#2864e8" },
        };
      else if (url === "/api/admin/orders" && !options?.method)
        data = {
          orders: [
            {
              id: 7,
              created: "2026-10-11",
              status: "Ожидает оплаты",
              customer: { fullname: "<Покупатель>", phone: "+79991234567" },
              items: [],
              total: 0,
              delivery: "pickup",
            },
          ],
          statuses: ["Ожидает оплаты", "В работе", "Отправлен"],
        };
      else data = { ok: true };
      const failed =
        url === "/api/admin/orders" && options?.method && failStatus;
      return {
        ok: !failed,
        status: failed ? 400 : 200,
        json: async () => (failed ? { error: "Ошибка статуса" } : data),
      };
    },
  };
  vm.createContext(context);
  const html = fs.readFileSync(path.join(publicDir, "admin.html"), "utf8");
  for (const match of html.matchAll(
    /<script[^>]*src="([^"]+)"[^>]*><\/script>/g,
  )) {
    vm.runInContext(
      fs.readFileSync(path.join(publicDir, match[1]), "utf8"),
      context,
      { filename: match[1] },
    );
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(node("#login-title").textContent, "Создайте администратора");
  const login = node("#login-form");
  login.values = { username: "admin", password: "password123" };
  await login.submit({ preventDefault() {}, target: login });
  assert.equal(node("#dashboard").hidden, false);
  assert.equal(fields.name.value, "Shoply");
  assert.ok(requests.some(([url]) => url === "/api/setup"));
  await vm.runInContext("loadOrders()", context);
  assert.ok(node("#order-list").innerHTML.includes("&lt;Покупатель&gt;"));
  status.value = "В работе";
  await status.onchange();
  failStatus = true;
  status.value = "Отправлен";
  await status.onchange();
  assert.equal(status.value, "В работе");
  assert.equal(status.disabled, false);
  assert.equal(node("#notice").textContent, "Ошибка статуса");
  await node("#logout").onclick();
  assert.equal(node("#login").hidden, false);
  console.log(
    "OK: загрузка админки, создание администратора, каталог, экранирование, статусы и выход.",
  );
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

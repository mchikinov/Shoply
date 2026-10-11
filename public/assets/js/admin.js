/** admin: admin.js; загружается в порядке, указанном в HTML. */
/** Показать результат действия или ошибку в админке. */
function notice(text, error = false) {
  $("#notice").textContent = text;
  $("#notice").classList.toggle("error", error);
}

/** Открыть раздел админки и загрузить заказы при необходимости. */
function tab(id) {
  document
    .querySelectorAll(".tab")
    .forEach(
      /** Применить операцию к очередному элементу списка. */ (el) =>
        (el.hidden = el.id !== id),
    );
  document
    .querySelectorAll("[data-tab]")
    .forEach(
      /** Применить операцию к очередному элементу списка. */ (el) =>
        el.classList.toggle("active", el.dataset.tab === id),
    );
  location.hash = id;
  if (id === "orders") loadOrders();
}

/** Загрузить товары и настройки и обновить формы админки. */
async function loadShop() {
  shop = await api("/api/shop");
  const form = $("#settings-form");
  for (const key of [
    "name",
    "logo",
    "accent",
    "background",
    "text",
    "telegram",
  ])
    form.elements[key].value = shop.settings[key] || "";
  logoPreview();
  renderProducts();
}

document
  .querySelectorAll("[data-tab]")
  .forEach(
    /** Применить операцию к очередному элементу списка. */ (el) =>
      (el.onclick =
        /** Обработать нажатие с данными выбранного элемента. */ () =>
          tab(el.dataset.tab)),
  );

/** Проверить сессию и открыть вход или панель управления. */
async function startAdmin() {
  if (location.protocol === "file:") {
    notice(
      "Запустите backend/server.py и откройте http://127.0.0.1:8765/admin.html.",
      true,
    );
    return;
  }
  try {
    const state = await api("/api/session");
    if (state.authenticated) await enter();
    else showLogin(state.setup);
  } catch (e) {
    notice(e.message, true);
  }
}

startAdmin();

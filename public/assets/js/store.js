/** store: store.js; загружается в порядке, указанном в HTML. */
/** Обработать покупку, изменение количества и выбор категории. */
function handleStoreClick(event) {
  let button = event.target.closest("[data-add]");
  if (button) {
    const id = Number(button.dataset.add);
    if (!products[id]) return;
    basket[id] = Math.min(999, (basket[id] || 0) + 1);
    sync();
    cartToast(basket[id], true);
  }
  button = event.target.closest("[data-quantity]");
  if (button) {
    const id = button.dataset.quantity;
    if (!products[id]) return;
    const previousQuantity = basket[id] || 0;
    basket[id] = Math.max(
      0,
      Math.min(999, (basket[id] || 0) + Number(button.dataset.delta)),
    );
    const quantity = basket[id];
    if (!quantity) delete basket[id];
    sync();
    if (quantity !== previousQuantity)
      cartToast(quantity, quantity > previousQuantity);
  }
  button = event.target.closest("[data-remove]");
  if (button) {
    const id = button.dataset.remove;
    if (!products[id] || !basket[id]) return;
    delete basket[id];
    sync();
    cartToast(0, false);
  }
  button = event.target.closest(".chips [data-category]");
  if (button) {
    category = button.dataset.category;
    document
      .querySelectorAll(".chips button")
      .forEach(
        /** Применить операцию к очередному элементу списка. */ (el) =>
          el.classList.toggle("active", el === button),
      );
    filter();
  }
}

document.addEventListener("click", handleStoreClick);

["search-demo", "min-demo", "max-demo"].forEach(
  /** Применить операцию к очередному элементу списка. */ (id) =>
    $("#" + id).addEventListener(
      "input",
      /** Обработать событие текущего элемента интерфейса. */ () => {
        if (id === "search-demo" && !["", "#catalog"].includes(location.hash)) {
          location.hash = "catalog";
          // При переходе из другого экрана поиск остаётся в фокусе.
          requestAnimationFrame(
            /** Восстановить фокус после обновления экрана. */ () =>
              $("#search-demo").focus(),
          );
        }
        if (id !== "search-demo") updatePriceRange(id);
        filter();
      },
    ),
);

$("#sort-demo").addEventListener("change", filter);

/** Сбросить фильтры и восстановить сортировку каталога. */
function resetFilters() {
  category = "Все";
  $("#search-demo").value = "";
  $("#min-demo").value = $("#min-demo").min;
  $("#max-demo").value = $("#max-demo").max;
  updatePriceRange();
  $("#sort-demo").value = "new";
  document
    .querySelectorAll(".chips button")
    .forEach(
      /** Применить операцию к очередному элементу списка. */ (el) =>
        el.classList.toggle("active", el.dataset.category === "Все"),
    );
  filter();
}

$("#reset-demo").onclick = resetFilters;

/** Открыть настроенную поддержку или показать уведомление. */
function openSupport() {
  if (settings.telegram)
    window.open(settings.telegram, "_blank", "noopener,noreferrer");
  else toast("Поддержка в Telegram пока не настроена.");
}

$("#support-demo").onclick = openSupport;

window.addEventListener("hashchange", screen);

/** Загрузить каталог и настройки, затем инициализировать витрину. */
async function start() {
  if (location.protocol === "file:") {
    $("#connection-note").textContent =
      "Для сохранения заказов запустите backend/server.py и откройте http://127.0.0.1:8765/. Сейчас доступен просмотр каталога.";
  } else {
    setCatalogLoading(true);
    try {
      const response = await fetch("/api/shop");
      if (!response.ok) throw new Error("Сервер недоступен.");
      const data = await response.json();
      products = Object.fromEntries(
        data.products.map(
          /** Преобразовать элемент в представление для текущего списка. */ (
            p,
          ) => [p.id, p],
        ),
      );
      settings = data.settings;
      serverReady = true;
      applyBranding();
      renderCatalog(data.products);
      $("#connection-note").textContent =
        "Онлайн-оплата пока недоступна. Заказы сохраняются в магазине.";
      $("#catalog .demo").hidden = !data.products.some(
        /** Проверить наличие элемента с указанным признаком. */ (p) => p.demo,
      );
    } catch (error) {
      $("#connection-note").textContent =
        "Нет соединения с сервером. Оформление недоступно: " + error.message;
    } finally {
      setCatalogLoading(false);
    }
  }
  $("#order-fields").disabled = !serverReady;
  sync();
  deliveryState();
  filter();
  screen();
}

start();

/** Применить цвета, название и логотип из серверных настроек. */
function applyBranding() {
  document.documentElement.style.setProperty("--color-accent", settings.accent);
  document.documentElement.style.setProperty("--color-bg", settings.background);
  document.documentElement.style.setProperty("--color-text", settings.text);
  const logo = $(".header .logo");
  logo.textContent = settings.name;
  if (settings.logo) {
    const img = document.createElement("img");
    img.src = settings.logo;
    img.alt = settings.name;
    img.className = "brand-logo";
    logo.replaceChildren(img);
  }
}

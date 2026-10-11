/** store: store-cart.js; загружается в порядке, указанном в HTML. */
/** Выбрать русскую форму слова «товар» для количества. */
function plural(n) {
  return n % 10 === 1 && n % 100 !== 11
    ? "товар"
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? "товара"
      : "товаров";
}

/** Показать временное уведомление покупателю. */
function toast(text) {
  $("#preview-toast").textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    /** Очистить уведомление после задержки. */ () =>
      ($("#preview-toast").textContent = ""),
    3000,
  );
}

/** Сохранить корзину, сохранив работоспособность при недоступном хранилище. */
function saveBasket() {
  try {
    localStorage.setItem("shoply-basket", JSON.stringify(basket));
  } catch (_) {}
}

/** Рассчитать строки, количество и сумму по актуальному каталогу. */
function cartState() {
  const lines = Object.entries(basket)
    .filter(
      /** Проверить, подходит ли элемент под условия отбора. */ ([id, n]) =>
        n > 0 && products[Number(id)],
    )
    .map(
      /** Преобразовать элемент в представление для текущего списка. */ ([
        id,
        quantity,
      ]) => ({ ...products[Number(id)], quantity }),
    );
  return {
    lines,
    count: lines.reduce(
      /** Добавить значение элемента к общему результату. */ (sum, p) =>
        sum + p.quantity,
      0,
    ),
    total: lines.reduce(
      /** Добавить значение элемента к общему результату. */ (sum, p) =>
        sum + p.price * p.quantity,
      0,
    ),
  };
}

/** Сформировать кнопку покупки или доступные элементы изменения количества. */
function purchaseControl(id, detail = false) {
  const p = products[id],
    quantity = basket[id] || 0;
  if (!quantity)
    return `<button class="button${detail ? "" : " secondary"}" data-add="${id}">${detail ? "Добавить в корзину" : "В корзину"}</button>`;
  return `<div class="qty purchase-qty" role="group" aria-label="Количество ${escapeHTML(p.name)} в корзине"><button type="button" data-quantity="${id}" data-delta="-1" aria-label="Уменьшить количество ${escapeHTML(p.name)}">−</button><span aria-live="polite" aria-atomic="true">${quantity}</span><button type="button" data-quantity="${id}" data-delta="1" aria-label="Увеличить количество ${escapeHTML(p.name)}" ${quantity >= 999 ? "disabled" : ""}>+</button></div>`;
}

/** Обновить корзину и элементы покупки, восстановить фокус и сохранить состояние. */
function sync() {
  const { focusHost, focusId, focusDelta } = purchaseFocus();
  const state = cartState();
  renderCartLines(state);
  renderCartSummary(state);
  restorePurchaseFocus(focusHost, focusId, focusDelta);
  document.querySelectorAll("#cart-lines .cart-line").forEach(
    /** Применить операцию к очередному элементу списка. */ (el, index) => {
      const p = state.lines[index];
      if (p.photos?.length) {
        const photo = el.querySelector(".product-photo");
        photo.style.backgroundImage =
          "url(" + JSON.stringify(p.photos[0]) + ")";
        photo.style.backgroundSize = "contain";
        photo.style.backgroundPosition = "center";
      }
    },
  );
  saveBasket();
}

/** Запомнить элемент управления количеством перед перерисовкой. */
function purchaseFocus() {
  const active = document.activeElement;
  const focusHost = active?.closest("[data-purchase], #cart-lines");
  const focusId = active?.dataset.quantity ?? active?.dataset.add;
  const focusDelta = active?.dataset.delta;
  return { focusHost, focusId, focusDelta };
}

/** Перерисовать элементы покупки и строки корзины. */
function renderCartLines(state) {
  document.querySelectorAll("[data-purchase]").forEach(
    /** Применить операцию к очередному элементу списка. */ (el) => {
      if (products[el.dataset.purchase])
        el.innerHTML = purchaseControl(
          el.dataset.purchase,
          el.classList.contains("detail-purchase"),
        );
    },
  );
  $("#cart-lines").innerHTML =
    state.lines
      .map(
        /** Преобразовать элемент в представление для текущего списка. */ (p) =>
          `<article class="cart-line"><a href="#product/${p.id}" class="product-photo q${p.photo}" role="img" aria-label="${escapeHTML(p.name)}"></a><div><h2><a href="#product/${p.id}">${escapeHTML(p.name)}</a></h2><div class="small muted">${fmt(p.price)} за штуку</div><div class="qty"><button data-quantity="${p.id}" data-delta="-1" aria-label="Уменьшить количество ${escapeHTML(p.name)}">−</button><span>${p.quantity}</span><button data-quantity="${p.id}" data-delta="1" aria-label="Увеличить количество ${escapeHTML(p.name)}" ${p.quantity >= 999 ? "disabled" : ""}>+</button></div></div><b class="price">${fmt(p.price * p.quantity)}</b></article>`,
      )
      .join("") ||
    '<p class="muted">Корзина пуста. <a href="#catalog">Перейти в каталог →</a></p>';
}

/** Обновить количество, сумму и доступность оформления. */
function renderCartSummary(state) {
  $("#basket-count").textContent = state.count;
  $("#cart-quantity").textContent = state.count + " " + plural(state.count);
  document
    .querySelectorAll("#cart [data-total], #checkout [data-total]")
    .forEach(
      /** Применить операцию к очередному элементу списка. */ (el) =>
        (el.textContent = fmt(state.total)),
    );
  $("#checkout-items").textContent = state.lines
    .map(
      /** Преобразовать элемент в представление для текущего списка. */ (p) =>
        p.name + " × " + p.quantity,
    )
    .join(" · ");
  $("#checkout-link").hidden = !state.count;
  document.querySelector('[form="demo-order"]').disabled =
    !state.count || !serverReady || submitting;
}

/** Вернуть фокус на доступный элемент после перерисовки корзины. */
function restorePurchaseFocus(focusHost, focusId, focusDelta) {
  if (focusId !== undefined) {
    const replacement =
      focusHost?.querySelector(
        `[data-quantity="${focusId}"][data-delta="${focusDelta || 1}"]:not(:disabled)`,
      ) ||
      focusHost?.querySelector(`[data-add="${focusId}"]`) ||
      focusHost?.querySelector("[data-quantity]:not(:disabled)") ||
      $("#cart-lines [data-quantity]") ||
      $("#cart-lines a");
    replacement?.focus({ preventScroll: true });
  }
}

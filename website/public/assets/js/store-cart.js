/** store: store-cart.js; загружается в порядке, указанном в HTML. */
/** Выбрать русскую форму слова «товар» для количества. */
function plural(n) {
  return n % 10 === 1 && n % 100 !== 11
    ? "товар"
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? "товара"
      : "товаров";
}

let toastHovered = false,
  toastFocused = false;

/** Скрыть уведомление и отменить его таймер. */
function dismissToast() {
  clearTimeout(toastTimer);
  $("#preview-toast").hidden = true;
}

/** Запустить отсчёт только когда пользователь не взаимодействует с карточкой. */
function scheduleToastDismissal() {
  clearTimeout(toastTimer);
  if (!toastHovered && !toastFocused)
    toastTimer = setTimeout(dismissToast, 4000);
}

/** Показать или обновить одну карточку уведомления без перемещения фокуса. */
function toast(text, detail = "", added = false, icon = "i") {
  $("#toast-message").textContent = text;
  $("#toast-detail").textContent = detail;
  $("#toast-detail").hidden = !detail;
  $("#preview-toast").dataset.tone = added ? "success" : "neutral";
  $("#preview-toast .toast-icon").textContent = icon;
  $("#preview-toast").hidden = false;
  scheduleToastDismissal();
}

/** Сообщить об изменении и количестве этого товара, если осталось больше одной штуки. */
function cartToast(quantity, added) {
  toast(
    added ? "Товар добавлен в корзину" : "Товар удалён из корзины",
    quantity > 1 ? `В корзине: ${quantity} шт.` : "",
    added,
    added ? "✓" : "−",
  );
}

$("#toast-close").addEventListener("click", dismissToast);
$("#preview-toast").addEventListener("mouseenter", () => {
  toastHovered = true;
  clearTimeout(toastTimer);
});
$("#preview-toast").addEventListener("mouseleave", () => {
  toastHovered = false;
  scheduleToastDismissal();
});
$("#preview-toast").addEventListener("focusin", () => {
  toastFocused = true;
  clearTimeout(toastTimer);
});
$("#preview-toast").addEventListener("focusout", () => {
  toastFocused = false;
  scheduleToastDismissal();
});
$("#preview-toast").addEventListener("keydown", (event) => {
  if (event.key === "Escape") dismissToast();
});

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
  return `<div class="purchase-actions"><button type="button" class="remove-product" data-remove="${id}" aria-label="Удалить ${escapeHTML(p.name)} из корзины" title="Удалить из корзины"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg></button><div class="qty purchase-qty" role="group" aria-label="Количество ${escapeHTML(p.name)} в корзине"><button type="button" data-quantity="${id}" data-delta="-1" aria-label="Уменьшить количество ${escapeHTML(p.name)}">−</button><span aria-live="polite" aria-atomic="true">${quantity}</span><button type="button" data-quantity="${id}" data-delta="1" aria-label="Увеличить количество ${escapeHTML(p.name)}" ${quantity >= 999 ? "disabled" : ""}>+</button></div></div>`;
}

/** Обновить корзину и элементы покупки, восстановить фокус и сохранить состояние. */
function sync() {
  const { focusHost, focusId, focusDelta } = purchaseFocus();
  const motion = capturePurchaseMotion();
  const state = cartState();
  renderCartLines(state);
  animatePurchaseMotion(motion);
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

/** Снять видимые размеры перед заменой элементов покупки. */
function capturePurchaseMotion() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return [];
  return [...document.querySelectorAll("[data-purchase], [data-cart-product]")]
    .map((host) => {
      const control = host.matches("[data-purchase]")
        ? host.firstElementChild
        : host.querySelector(".purchase-actions");
      if (!control || !control.getClientRects().length) return null;
      return {
        host,
        cartId: host.dataset.cartProduct,
        rect: control.getBoundingClientRect(),
        content: control.textContent,
      };
    }).filter(Boolean);
}

/** Плавно изменить габариты и подчеркнуть новое количество. */
function animatePurchaseMotion(snapshots) {
  for (const { host, cartId, rect, content } of snapshots) {
    const currentHost = cartId === undefined ? host
      : document.querySelector(`[data-cart-product="${cartId}"]`);
    const control = cartId === undefined ? currentHost?.firstElementChild
      : currentHost?.querySelector(".purchase-actions");
    if (!control || !control.animate || content === control.textContent) continue;
    const next = control.getBoundingClientRect();
    if (Math.abs(rect.width - next.width) > 1 || Math.abs(rect.height - next.height) > 1) {
      control.animate([
        { width: `${rect.width}px`, height: `${rect.height}px`, overflow: "hidden" },
        { width: `${next.width}px`, height: `${next.height}px`, overflow: "hidden" },
      ], { duration: 260, easing: "cubic-bezier(.22, 1, .36, 1)" });
    }
    const value = control.querySelector(".purchase-qty span") || control;
    value.animate([
      { opacity: .45, transform: "scale(.88)" },
      { opacity: 1, transform: "scale(1)" },
    ], { duration: 220, easing: "cubic-bezier(.22, 1, .36, 1)" });
  }
}

/** Запомнить элемент управления количеством перед перерисовкой. */
function purchaseFocus() {
  const active = document.activeElement;
  const focusHost = active?.closest("[data-purchase], #cart-lines");
  const focusId = active?.dataset.quantity ?? active?.dataset.add ?? active?.dataset.remove;
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
          `<article class="cart-line" data-cart-product="${p.id}"><a href="#product/${p.id}" class="product-photo q${p.photo}" role="img" aria-label="${escapeHTML(p.name)}"></a><div><h2><a href="#product/${p.id}">${escapeHTML(p.name)}</a></h2><div class="small muted">${fmt(p.price)} за штуку</div>${purchaseControl(p.id)}</div><b class="price">${fmt(p.price * p.quantity)}</b></article>`,
      )
      .join("") ||
    '<p class="muted">Корзина пуста. <a href="#catalog">Перейти в каталог →</a></p>';
}

/** Обновить количество, сумму и доступность оформления. */
function renderCartSummary(state) {
  $("#basket-count").textContent = state.count;
  $("#floating-cart-count").textContent = state.count;
  $("#floating-cart").setAttribute("aria-label", `Открыть корзину: ${state.count} ${plural(state.count)}`);
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

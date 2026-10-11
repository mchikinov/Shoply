/** store: store-navigation.js; загружается в порядке, указанном в HTML. */
let activeScreenKey = null;
let catalogScrollY = 0;
if (window.history && "scrollRestoration" in window.history)
  window.history.scrollRestoration = "manual";

let cartReturnHash = "#catalog";
let cartTrigger = null;
let cartIsOpen = false;
let cartCloseTimer = null;
let cartCloseFinished = false;

function closeCart() {
  location.hash = cartReturnHash;
}

/** Открыть экран по URL и проверить доступность оформления и подтверждения. */
function screen() {
  const parts = location.hash.slice(1).split("/");
  let id = ["catalog", "product", "cart", "checkout", "success"].includes(
    parts[0],
  )
    ? parts[0]
    : "catalog";
  if (id === "product" && !showProduct(Number(parts[1] || 0))) id = "catalog";
  if (id === "checkout" && !cartState().count) {
    location.replace("#cart");
    return;
  }
  if (id === "success" && !lastOrder) {
    location.replace("#catalog");
    return;
  }
  const screenKey = id === "product" ? `product/${parts[1]}` : id;
  const openingCart = id === "cart";
  const drawer = $("#cart");
  if (openingCart) {
    clearTimeout(cartCloseTimer);
    cartCloseTimer = null;
    cartCloseFinished = false;
    drawer.classList.toggle("is-closing", false);
  } else if (cartIsOpen && !cartCloseFinished &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    if (cartCloseTimer === null) {
      drawer.classList.toggle("is-closing", true);
      cartCloseTimer = setTimeout(() => {
        cartCloseTimer = null;
        cartCloseFinished = true;
        screen();
      }, 300);
    }
    return;
  }
  cartCloseFinished = false;
  drawer.classList.toggle("is-closing", false);
  if (!openingCart && screenKey !== activeScreenKey && activeScreenKey === "catalog")
    catalogScrollY = window.scrollY || 0;
  const wasCartOpen = cartIsOpen;
  const returningFromCart = wasCartOpen && location.hash === cartReturnHash;
  if (openingCart && !wasCartOpen) cartTrigger = document.activeElement;
  const backgroundId = openingCart ? cartReturnHash.slice(1).split("/")[0] : id;
  $("#cart").hidden = !openingCart;
  $("#floating-cart").hidden = openingCart;
  document.documentElement.classList.toggle("cart-open", openingCart);
  document.querySelectorAll("header, footer, .screen").forEach((el) => {
    el.inert = openingCart;
  });
  cartIsOpen = openingCart;
  if (!openingCart) cartReturnHash = location.hash || "#catalog";
  document
    .querySelectorAll(".screen")
    .forEach(
      /** Применить операцию к очередному элементу списка. */ (el) =>
        (el.hidden = el.id !== backgroundId),
    );
  document.title = "Shoply — " + $("#" + id + " h1").textContent;
  const heading = $("#" + id + " h1");
  heading.tabIndex = -1;
  if (openingCart) $(".cart-close").focus({ preventScroll: true });
  else if (returningFromCart && cartTrigger?.isConnected)
    cartTrigger.focus({ preventScroll: true });
  else heading.focus({ preventScroll: true });
  if (!openingCart && screenKey !== activeScreenKey) {
    window.scrollTo(0, id === "catalog" ? catalogScrollY : 0);
    animateAppearance($("#" + id));
    activeScreenKey = screenKey;
  }
}

// Закрытие по фону и Escape; клавиатурный фокус остаётся внутри панели.
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-cart]") || event.target === $("#cart"))
    closeCart();
});
document.addEventListener("keydown", (event) => {
  if (!cartIsOpen) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeCart();
  }
  if (event.key === "Tab") {
    const controls = [...$("#cart").querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')]
      .filter((el) => el.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});

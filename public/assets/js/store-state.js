/** store: store-state.js; загружается в порядке, указанном в HTML. */
let products = shopProducts;

let serverReady = false,
  submitting = false,
  orderToken = null,
  settings = {};

let basket = {},
  category = "Все",
  lastOrder = null,
  toastTimer;

try {
  const saved = JSON.parse(localStorage.getItem("shoply-basket") || "{}");
  for (const [id, quantity] of Object.entries(saved || {})) {
    if (
      Number.isInteger(Number(id)) &&
      Number(id) >= 0 &&
      Number.isInteger(quantity) &&
      quantity > 0 &&
      quantity <= 999
    )
      basket[id] = quantity;
  }
} catch (_) {
  /* Корзина работает в текущем сеансе, если хранение недоступно. */
}

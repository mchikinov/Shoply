/** store: store-checkout.js; загружается в порядке, указанном в HTML. */
/** Согласовать видимость и обязательность адреса со способом доставки. */
function deliveryState() {
  const pickup =
    document.querySelector('[name="delivery"]:checked').value === "pickup";
  $("#address-field").hidden = pickup;
  $("#address-input").disabled = pickup;
  $("#address-input").required = !pickup;
  return pickup ? "Самовывоз" : "Почта";
}

document
  .querySelectorAll('[name="delivery"]')
  .forEach(
    /** Применить операцию к очередному элементу списка. */ (el) =>
      el.addEventListener("change", deliveryState),
  );

/** Отправить заказ с повторяемым токеном и сохранить форму при ошибке. */
async function submitOrder(event) {
  event.preventDefault();
  const state = cartState(),
    form = event.currentTarget;
  if (submitting || !serverReady || !state.count || !form.reportValidity())
    return;
  submitting = true;
  sync();
  deliveryState();
  ensureOrderToken();
  try {
    const fields = new FormData(form);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: orderToken,
        fullname: fields.get("fullname"),
        phone: fields.get("phone"),
        delivery: fields.get("delivery"),
        address: fields.get("address") || "",
        items: state.lines.map(
          /** Преобразовать элемент в представление для текущего списка. */ (
            p,
          ) => ({ id: p.id, quantity: p.quantity }),
        ),
      }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Не удалось сохранить заказ.");
    completeOrder(data, state, form);
  } catch (error) {
    toast(error.message + " Данные формы и корзина сохранены.");
  } finally {
    submitting = false;
    sync();
  }
}

$("#demo-order").addEventListener("submit", submitOrder);

/** Получить или создать токен для безопасного повтора отправки заказа. */
function ensureOrderToken() {
  try {
    orderToken = localStorage.getItem("shoply-pending-token");
  } catch (_) {}
  if (!orderToken) orderToken = crypto.randomUUID();
  try {
    localStorage.setItem("shoply-pending-token", orderToken);
  } catch (_) {}
}

/** Показать подтверждение сервера и очистить успешно оформленную корзину. */
function completeOrder(data, state, form) {
  lastOrder = {
    number: data.id,
    total: data.total ?? state.total,
    delivery: data.delivery === "pickup" ? "Самовывоз" : "Почта",
  };
  $("#success [data-total]").textContent = fmt(lastOrder.total);
  $("#success-delivery").textContent = lastOrder.delivery;
  $("#order-number").textContent = lastOrder.number;
  basket = {};
  orderToken = null;
  try {
    localStorage.removeItem("shoply-pending-token");
  } catch (_) {}
  sync();
  form.reset();
  deliveryState();
  location.hash = "success";
}

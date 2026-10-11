/** admin: admin-orders.js; загружается в порядке, указанном в HTML. */
/** Загрузить заказы и подключить сохранение их статусов. */
async function loadOrders() {
  try {
    const data = await api("/api/admin/orders");
    $("#order-list").innerHTML =
      data.orders
        .map(
          /** Преобразовать элемент в представление для текущего списка. */ (
            o,
          ) =>
            `<article class="order"><div class="order-header"><h2>Заказ № ${o.id}</h2><span class="muted">${escapeHTML(o.created)} UTC</span><label class="order-status">Статус<select data-order="${o.id}">${data.statuses.map(/** Преобразовать элемент в представление для текущего списка. */ (s) => "<option " + (s === o.status ? "selected" : "") + ">" + escapeHTML(s) + "</option>").join("")}</select></label></div><div class="order-info"><div><p><b>${escapeHTML(o.customer.fullname)}</b></p><p>${escapeHTML(o.customer.phone)}</p><p>${o.delivery === "pickup" ? "Самовывоз" : "Почта"}</p><p>${escapeHTML(o.address || "")}</p><p class="muted">Стоимость доставки уточняется отдельно.</p></div><div><ul>${o.items.map(/** Преобразовать элемент в представление для текущего списка. */ (p) => "<li>" + escapeHTML(p.name) + " × " + p.quantity + " — " + (p.price * p.quantity).toLocaleString("ru-RU") + " ₽</li>").join("")}</ul><b>Итого: ${Number(o.total).toLocaleString("ru-RU")} ₽</b></div></div></article>`,
        )
        .join("") || '<p class="empty">Заказов пока нет.</p>';
    document.querySelectorAll("[data-order]").forEach(
      /** Применить операцию к очередному элементу списка. */ (el) => {
        let previous = el.value;
        el.onchange =
          /** Сохранить изменённое значение и восстановить его при ошибке. */ async () => {
            el.disabled = true;
            try {
              await api("/api/admin/orders", {
                id: Number(el.dataset.order),
                status: el.value,
              });
              previous = el.value;
              notice("Статус заказа сохранён.");
            } catch (e) {
              el.value = previous;
              notice(e.message, true);
            } finally {
              el.disabled = false;
            }
          };
      },
    );
  } catch (e) {
    notice(e.message, true);
  }
}

$("#refresh-orders").onclick = loadOrders;

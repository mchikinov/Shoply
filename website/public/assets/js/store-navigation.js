/** store: store-navigation.js; загружается в порядке, указанном в HTML. */
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
  document
    .querySelectorAll(".screen")
    .forEach(
      /** Применить операцию к очередному элементу списка. */ (el) =>
        (el.hidden = el.id !== id),
    );
  document.title = "Shoply — " + $("#" + id + " h1").textContent;
  const heading = $("#" + id + " h1");
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

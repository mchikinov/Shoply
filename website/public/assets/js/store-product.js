/** store: store-product.js; загружается в порядке, указанном в HTML. */
/** Показать сведения, фотографии и свойства выбранного товара. */
function showProduct(id) {
  const p = products[id];
  if (!p) return false;
  $("#product h1").textContent = p.name;
  $("#product-crumb").textContent = p.category + " / " + p.name;
  $("#product .price").textContent = fmt(p.price);
  const purchase = $("#product .detail-purchase");
  purchase.dataset.purchase = p.id;
  purchase.innerHTML = purchaseControl(p.id, true);
  const visual = $("#product-visual");
  visual.className = "product-photo q" + p.photo;
  visual.setAttribute("aria-label", p.name + " — демонстрационная иллюстрация");
  $("#product .description").textContent =
    p.description || "Описание пока не добавлено.";
  $("#product .demo").hidden = !p.demo;
  document
    .querySelectorAll("#product .caption")
    .forEach(
      /** Применить операцию к очередному элементу списка. */ (el) =>
        (el.hidden = !p.demo),
    );
  renderProductGallery(p, visual);
  $("#product .specs").innerHTML = (p.properties || [])
    .map(
      /** Преобразовать элемент в представление для текущего списка. */ (
        prop,
      ) =>
        "<div><dt>" +
        escapeHTML(prop.name) +
        "</dt><dd>" +
        escapeHTML(prop.description) +
        "</dd></div>",
    )
    .join("");
  return true;
}

/** Создать миниатюры и установить главную фотографию товара. */
function renderProductGallery(p, visual) {
  const gallery = $("#product-gallery");
  gallery.innerHTML = "";
  p.photos?.forEach(
    /** Применить операцию к очередному элементу списка. */ (url, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumbnail";
      button.setAttribute("aria-label", "Фото " + (index + 1));
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      button.append(image);
      button.onclick =
        /** Обработать нажатие с данными выбранного элемента. */ () => {
          visual.style.backgroundImage = "url(" + JSON.stringify(url) + ")";
          visual.style.backgroundSize = "contain";
          visual.style.backgroundPosition = "center";
        };
      gallery.append(button);
    },
  );
  visual.style.backgroundImage = p.photos?.length
    ? "url(" + JSON.stringify(p.photos[0]) + ")"
    : "";
  visual.style.backgroundSize = p.photos?.length ? "contain" : "";
  visual.style.backgroundPosition = p.photos?.length ? "center" : "";
}

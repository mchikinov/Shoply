/** Обновить подписи ползунков и не допустить пересечения границ. */
function updatePriceRange(changedId) {
  const min = $("#min-demo");
  const max = $("#max-demo");
  if (Number(min.value) > Number(max.value)) {
    if (changedId === "min-demo") min.value = max.value;
    else max.value = min.value;
  }
  const span = Number(max.max) - Number(min.min);
  const start = span > 0 ? (Number(min.value) - Number(min.min)) / span * 100 : 0;
  const end = span > 0 ? (Number(max.value) - Number(min.min)) / span * 100 : 100;
  $("#price-range-track").style.setProperty("--range-start", start + "%");
  $("#price-range-track").style.setProperty("--range-end", end + "%");
  // На правой границе нижний бегунок должен оставаться доступным.
  min.style.zIndex = Number(min.value) === Number(max.max) ? "2" : "1";
  $("#min-price-value").textContent = fmt(Number(min.value));
  $("#max-price-value").textContent = fmt(Number(max.value));
  min.setAttribute("aria-valuetext", fmt(Number(min.value)));
  max.setAttribute("aria-valuetext", fmt(Number(max.value)));
}

/** Взять границы цены из полного ассортимента. */
function initializePriceRange(prices) {
  const lower = prices.length ? Math.min(...prices) : 0;
  const upper = prices.length ? Math.max(...prices) : 0;
  ["min-demo", "max-demo"].forEach((id) => {
    const slider = $("#" + id);
    slider.min = lower;
    slider.max = upper;
    slider.value = id === "min-demo" ? lower : upper;
    slider.disabled = lower === upper;
  });
  updatePriceRange();
}

/** store: store-catalog.js; загружается в порядке, указанном в HTML. */
/** Применить поиск, категорию, диапазон цен и сортировку каталога. */
function filter() {
  const cards = [...document.querySelectorAll("#preview-products article")];
  let found = 0;
  cards.forEach(
    /** Применить операцию к очередному элементу списка. */ (el) => {
      const price = Number(el.dataset.price);
      el.hidden = !(
        (category === "Все" || el.dataset.category === category) &&
        el
          .querySelector(".product-name")
          .textContent.toLowerCase()
          .includes($("#search-demo").value.trim().toLowerCase()) &&
        (!$("#min-demo").value || price >= Number($("#min-demo").value)) &&
        (!$("#max-demo").value || price <= Number($("#max-demo").value))
      );
      if (!el.hidden) found++;
    },
  );
  const sort = $("#sort-demo").value;
  cards.sort(
    /** Сравнить элементы для выбранного порядка сортировки. */ (a, b) =>
      sort === "new"
        ? Number(b.dataset.id) - Number(a.dataset.id)
        : (sort === "asc" ? 1 : -1) *
          (Number(a.dataset.price) - Number(b.dataset.price)),
  );
  cards.forEach(
    /** Применить операцию к очередному элементу списка. */ (card) =>
      $("#preview-products").appendChild(card),
  );
  $("#found-demo").textContent = found + " " + plural(found);
  $("#no-products").hidden = found !== 0;
}

/** Построить карточки товаров и доступные категории каталога. */
function renderCatalog(list) {
  initializePriceRange(list.map((p) => Number(p.price)));
  $("#preview-products").innerHTML = list
    .map(
      /** Преобразовать элемент в представление для текущего списка. */ (p) =>
        `<article data-id="${p.id}" data-category="${escapeHTML(p.category)}" data-price="${p.price}"><a href="#product/${p.id}" class="product-photo q${p.photo || 0}" role="img" aria-label="${escapeHTML(p.name)}"></a><div class="category">${escapeHTML(p.category)}</div><a href="#product/${p.id}" class="product-name">${escapeHTML(p.name)}</a><div class="buy-row"><span class="price">${fmt(p.price)}</span><div data-purchase="${p.id}">${purchaseControl(p.id)}</div></div></article>`,
    )
    .join("");
  document.querySelectorAll("#preview-products article").forEach(
    /** Применить операцию к очередному элементу списка. */ (card) => {
      const p = products[Number(card.dataset.id)];
      const photo = card.querySelector(".product-photo");
      if (p.photos?.length) {
        photo.style.backgroundImage =
          "url(" + JSON.stringify(p.photos[0]) + ")";
        photo.style.backgroundSize = "contain";
        photo.style.backgroundPosition = "center";
      }
    },
  );
  $(".chips").innerHTML =
    '<button class="active" data-category="Все">Все товары</button>' +
    [
      ...new Set(
        list.map(
          /** Преобразовать элемент в представление для текущего списка. */ (
            p,
          ) => p.category,
        ),
      ),
    ]
      .map(
        /** Преобразовать элемент в представление для текущего списка. */ (c) =>
          `<button data-category="${escapeHTML(c)}">${escapeHTML(c)}</button>`,
      )
      .join("");
}

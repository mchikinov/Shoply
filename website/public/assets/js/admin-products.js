/** admin: admin-products.js; загружается в порядке, указанном в HTML. */
/** Прочитать выбранный файл и отправить изображение на сервер. */
async function upload(file) {
  if (file.size > 6000000) throw Error("Максимум 6 МБ на фотографию.");
  const data = await new Promise(
    /** Прочитать файл асинхронно и передать результат или ошибку. */ (
      resolve,
      reject,
    ) => {
      const reader = new FileReader();
      reader.onload =
        /** Передать содержимое успешно прочитанного файла. */ () =>
          resolve(reader.result.split(",")[1]);
      reader.onerror = /** Сообщить об ошибке чтения выбранного файла. */ () =>
        reject(Error("Не удалось прочитать файл."));
      reader.readAsDataURL(file);
    },
  );
  return (await api("/api/admin/upload", { data })).path;
}

/** Построить список редактирования товаров и подсказки категорий. */
function renderProducts() {
  const list = $("#product-list");
  list.innerHTML =
    shop.products
      .map(
        /** Преобразовать элемент в представление для текущего списка. */ (p) =>
          `<div class="product-row"><div><b>${escapeHTML(p.name)}</b><div class="muted">${escapeHTML(p.category)} · ${Number(p.price).toLocaleString("ru-RU")} ₽</div></div><button class="plain" data-edit="${p.id}">Изменить</button></div>`,
      )
      .join("") || '<p class="muted">Товаров пока нет.</p>';
  $("#category-list").innerHTML = [
    ...new Set(
      shop.products.map(
        /** Преобразовать элемент в представление для текущего списка. */ (p) =>
          p.category,
      ),
    ),
  ]
    .map(
      /** Преобразовать элемент в представление для текущего списка. */ (c) =>
        '<option value="' + escapeHTML(c) + '">',
    )
    .join("");
}

/** Добавить редактируемую строку произвольного свойства товара. */
function property(name = "", description = "") {
  const el = document.createElement("div");
  el.className = "property";
  el.innerHTML =
    '<input aria-label="Название свойства" placeholder="Название свойства" maxlength="100" required><input aria-label="Описание свойства" placeholder="Описание" maxlength="2000"><button type="button" class="danger" aria-label="Удалить свойство">×</button>';
  el.children[0].value = name;
  el.children[1].value = description;
  el.children[2].onclick =
    /** Обработать нажатие с данными выбранного элемента. */ () => el.remove();
  $("#properties").append(el);
}

/** Показать фотографии товара с действиями перестановки и удаления. */
function renderPhotos() {
  $("#photos").innerHTML = photos
    .map(
      /** Преобразовать элемент в представление для текущего списка. */ (
        path,
        i,
      ) =>
        `<div class="photo-item"><img src="${escapeHTML(path)}" alt="Фото ${i + 1}"><div class="photo-actions"><button type="button" data-photo="${i}" data-action="left" aria-label="Сдвинуть фото влево" ${i === 0 ? "disabled" : ""}>←</button><button type="button" data-photo="${i}" data-action="right" aria-label="Сдвинуть фото вправо" ${i === photos.length - 1 ? "disabled" : ""}>→</button><button type="button" class="danger" data-photo="${i}" data-action="remove" aria-label="Удалить фото">×</button></div></div>`,
    )
    .join("");
}

/** Заполнить форму существующим товаром или подготовить создание нового. */
function edit(p) {
  const form = $("#product-form");
  form.hidden = false;
  form.reset();
  form.elements.id.value = p?.id ?? "";
  form.elements.photo.value = p?.photo ?? 0;
  for (const key of ["name", "category", "price", "description"])
    form.elements[key].value = p?.[key] ?? "";
  form.elements.demo.checked = p?.demo ?? false;
  $("#product-form-title").textContent = p
    ? "Редактирование товара"
    : "Новый товар";
  $("#delete-product").hidden = !p;
  photos = [...(p?.photos || [])];
  renderPhotos();
  $("#properties").innerHTML = "";
  (p?.properties || []).forEach(
    /** Применить операцию к очередному элементу списка. */ (prop) =>
      property(prop.name, prop.description),
  );
  form.elements.name.focus();
  form.scrollIntoView({ block: "start" });
}

/** Открыть пустую форму создания товара. */
function newProduct() {
  return edit(null);
}

$("#new-product").onclick = newProduct;

/** Последовательно загрузить фотографии с проверкой лимита. */
async function uploadProductPhotos(e) {
  if (uploading) return;
  const files = [...e.target.files];
  if (photos.length + files.length > 12)
    return notice("Максимум 12 фотографий.", true);
  uploading = true;
  $("#product-form [type=submit]").disabled = true;
  try {
    for (const file of files) {
      photos.push(await upload(file));
      renderPhotos();
    }
    notice("Фотографии загружены. Сохраните товар.");
  } catch (e) {
    notice(e.message, true);
  } finally {
    uploading = false;
    $("#product-form [type=submit]").disabled = false;
    e.target.value = "";
  }
}

$("#product-files").onchange = uploadProductPhotos;

/** Открыть редактирование товара или изменить порядок фотографий. */
function handleProductClick(e) {
  let b = e.target.closest("[data-edit]");
  if (b)
    edit(
      shop.products.find(
        /** Найти элемент, соответствующий выбранному идентификатору. */ (p) =>
          p.id === Number(b.dataset.edit),
      ),
    );
  b = e.target.closest("[data-photo]");
  if (b) {
    const i = Number(b.dataset.photo),
      action = b.dataset.action;
    if (action === "remove") photos.splice(i, 1);
    else {
      const j = i + (action === "left" ? -1 : 1);
      if (j >= 0 && j < photos.length)
        [photos[i], photos[j]] = [photos[j], photos[i]];
    }
    renderPhotos();
  }
}

document.addEventListener("click", handleProductClick);

/** Собрать данные формы, сохранить товар и обновить каталог. */
async function submitProduct(e) {
  e.preventDefault();
  if (uploading) return;
  const form = e.target,
    button = form.querySelector("[type=submit]");
  button.disabled = true;
  const values = productFormValues(form);
  try {
    const saved = await api("/api/admin/products", values);
    await loadShop();
    edit(
      shop.products.find(
        /** Найти элемент, соответствующий выбранному идентификатору. */ (p) =>
          p.id === saved.id,
      ),
    );
    notice("Товар сохранён.");
  } catch (e) {
    notice(e.message, true);
  } finally {
    button.disabled = false;
  }
}

$("#product-form").onsubmit = submitProduct;

/** После подтверждения скрыть товар из каталога. */
async function deleteProduct() {
  if (
    !confirm(
      "Удалить товар из каталога? Состав уже оформленных заказов сохранится.",
    )
  )
    return;
  try {
    await api(
      "/api/admin/products",
      { id: Number($("#product-form [name=id]").value) },
      "DELETE",
    );
    $("#product-form").hidden = true;
    await loadShop();
    notice("Товар удалён из каталога.");
  } catch (e) {
    notice(e.message, true);
  }
}

$("#delete-product").onclick = deleteProduct;

/** Собрать типизированные поля, фото и свойства из формы товара. */
function productFormValues(form) {
  const values = Object.fromEntries(new FormData(form));
  values.id = values.id === "" ? null : Number(values.id);
  values.price = Number(values.price);
  values.photo = Number(values.photo);
  values.demo = form.elements.demo.checked;
  values.photos = photos;
  values.properties = [...$("#properties").children].map(
    /** Преобразовать элемент в представление для текущего списка. */ (el) => ({
      name: el.children[0].value,
      description: el.children[1].value,
    }),
  );
  return values;
}

/** Добавить свойство, если лимит строк ещё не достигнут. */
function addProperty() {
  if ($("#properties").children.length >= 40)
    return notice("Максимум 40 свойств.", true);
  property();
}

$("#add-property").onclick = addProperty;

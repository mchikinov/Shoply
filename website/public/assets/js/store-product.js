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
  closePhotoViewer();
  productPhotos = p.photos || [];
  productPhotoIndex = 0;
  productPhotoName = p.name;
  visual.setAttribute("role", productPhotos.length ? "button" : "img");
  visual.tabIndex = productPhotos.length ? 0 : -1;
  visual.setAttribute("aria-label", productPhotos.length ? "Открыть фотографии: " + p.name : p.name + " — демонстрационная иллюстрация");
  visual.onclick = productPhotos.length ? openPhotoViewer : null;
  visual.onkeydown = (event) => {
    if (productPhotos.length && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openPhotoViewer();
    }
  };
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
          productPhotoIndex = index;
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

let productPhotos = [];
let productPhotoIndex = 0;
let productPhotoName = "";
let photoViewerScroll = "";
const photoViewer = $("#photo-viewer");
let photoAnimation = null;

function animateViewerPhoto(step = 0) {
  photoAnimation?.cancel();
  const image = photoViewer.querySelector("img");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  photoAnimation = image.animate(
    [
      { opacity: 0, transform: step ? "translateX(" + (step > 0 ? 40 : -40) + "px)" : "scale(.94)" },
      { opacity: 1, transform: "translateX(0) scale(1)" },
    ],
    { duration: step ? 240 : 280, easing: "cubic-bezier(.2,.7,.2,1)" },
  );
}

function updatePhotoViewer() {
  const image = photoViewer.querySelector("img");
  image.src = productPhotos[productPhotoIndex];
  image.alt = productPhotoName + " — фото " + (productPhotoIndex + 1);
  photoViewer.querySelector(".photo-viewer-count").textContent =
    (productPhotoIndex + 1) + " / " + productPhotos.length;
  photoViewer.querySelector(".photo-viewer-prev").hidden = productPhotos.length < 2;
  photoViewer.querySelector(".photo-viewer-next").hidden = productPhotos.length < 2;
}

function openPhotoViewer() {
  if (!productPhotos.length || photoViewer.open) return;
  updatePhotoViewer();
  photoViewerScroll = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  photoViewer.showModal();
  animateViewerPhoto();
}

function closePhotoViewer() {
  if (photoViewer.open) photoViewer.close();
}

function stepPhotoViewer(step) {
  if (!photoViewer.open || productPhotos.length < 2) return;
  productPhotoIndex = (productPhotoIndex + step + productPhotos.length) % productPhotos.length;
  updatePhotoViewer();
  animateViewerPhoto(step);
  $("#product-gallery").children[productPhotoIndex]?.click();
}

photoViewer.querySelector(".photo-viewer-close").onclick = closePhotoViewer;
photoViewer.querySelector(".photo-viewer-prev").onclick = () => stepPhotoViewer(-1);
photoViewer.querySelector(".photo-viewer-next").onclick = () => stepPhotoViewer(1);
photoViewer.addEventListener("close", () => {
  photoAnimation?.cancel();
  document.body.style.overflow = photoViewerScroll;
});
photoViewer.addEventListener("click", (event) => {
  if (event.target === photoViewer) closePhotoViewer();
});
photoViewer.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    event.stopPropagation();
    stepPhotoViewer(event.key === "ArrowLeft" ? -1 : 1);
  }
});
window.addEventListener("hashchange", closePhotoViewer);

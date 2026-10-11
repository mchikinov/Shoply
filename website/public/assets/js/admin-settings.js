/** admin: admin-settings.js; загружается в порядке, указанном в HTML. */
/** Обновить предварительный просмотр логотипа из поля настроек. */
function logoPreview() {
  const path = $("#settings-form [name=logo]").value;
  $("#logo-preview").innerHTML = path
    ? '<img src="' + escapeHTML(path) + '" alt="Логотип">'
    : "";
}

/** Загрузить выбранный логотип и обновить предварительный просмотр. */
async function uploadLogo(e) {
  const file = e.target.files[0];
  if (!file) return;
  const button = $("#settings-form [type=submit]");
  button.disabled = true;
  try {
    $("#settings-form [name=logo]").value = await upload(file);
    logoPreview();
    notice("Логотип загружен. Сохраните оформление.");
  } catch (e) {
    notice(e.message, true);
  } finally {
    button.disabled = false;
    e.target.value = "";
  }
}

$("#logo-file").onchange = uploadLogo;

/** Очистить поле логотипа и предварительный просмотр. */
function clearLogo() {
  $("#settings-form [name=logo]").value = "";
  logoPreview();
}

$("#clear-logo").onclick = clearLogo;

/** Сохранить настройки оформления с блокировкой повторной отправки. */
async function submitSettings(e) {
  e.preventDefault();
  const button = e.target.querySelector("[type=submit]");
  button.disabled = true;
  try {
    await api(
      "/api/admin/settings",
      Object.fromEntries(new FormData(e.target)),
    );
    notice("Оформление сохранено. Обновите страницу магазина.");
  } catch (e) {
    notice(e.message, true);
  } finally {
    button.disabled = false;
  }
}

$("#settings-form").onsubmit = submitSettings;

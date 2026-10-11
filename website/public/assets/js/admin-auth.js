/** admin: admin-auth.js; загружается в порядке, указанном в HTML. */
/** Выполнить JSON-запрос и обработать ошибку или истечение сессии. */
async function api(path, body, method = "POST") {
  const response = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path != "/api/login") {
      showLogin(false);
    }
    throw Error(data.error || "Ошибка запроса.");
  }
  return data;
}

/** Настроить форму входа или первичного создания администратора. */
function showLogin(first) {
  setup = first;
  $("#login").hidden = false;
  $("#dashboard").hidden = true;
  $("#login-title").textContent = first
    ? "Создайте администратора"
    : "Вход в админку";
  $("#login-help").textContent = first
    ? "Задайте логин и пароль (минимум 10 символов). В магазине будет один администратор."
    : "Введите логин и пароль администратора.";
  $("#login-button").textContent = first ? "Создать администратора" : "Войти";
  $("#login-button").disabled = false;
  $("#login-form [name=password]").minLength = first ? 10 : 1;
  $("#login-form [name=password]").autocomplete = first
    ? "new-password"
    : "current-password";
}

/** Загрузить данные и открыть выбранный раздел после входа. */
async function enter() {
  await loadShop();
  $("#login").hidden = true;
  $("#dashboard").hidden = false;
  tab(
    ["settings", "products", "orders"].includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "settings",
  );
}

/** Создать администратора или войти и открыть панель управления. */
async function submitLogin(e) {
  e.preventDefault();
  const button = $("#login-button");
  button.disabled = true;
  try {
    await api(
      setup ? "/api/setup" : "/api/login",
      Object.fromEntries(new FormData(e.target)),
    );
    e.target.reset();
    notice("Вы вошли в админку.");
    await enter();
  } catch (error) {
    notice(error.message, true);
  } finally {
    button.disabled = false;
  }
}

$("#login-form").addEventListener("submit", submitLogin);

/** Завершить сессию и вернуть форму входа. */
async function logout() {
  try {
    await api("/api/logout", {});
    showLogin(false);
    notice("Вы вышли.");
  } catch (e) {
    notice(e.message, true);
  }
}

$("#logout").onclick = logout;

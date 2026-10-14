"""Создать первого администратора через HTTPS, не записывая секреты в аргументы CLI."""

import getpass
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener
from no_redirect import NoRedirect


def main():
    """Запросить адрес, секрет и пароль; не выводить возвращаемый cookie сессии."""
    origin = input("HTTPS-адрес магазина: ").strip().rstrip("/")
    parsed = urlsplit(origin)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path
        or parsed.query
        or parsed.fragment
    ):
        raise SystemExit("Укажите HTTPS-адрес без пути, например https://shop.example.com")
    token = getpass.getpass("Секрет SHOPLY_SETUP_TOKEN: ")
    username = input("Логин администратора: ").strip()
    password = getpass.getpass("Пароль администратора (минимум 10 символов): ")
    if password != getpass.getpass("Повторите пароль: "):
        raise SystemExit("Пароли не совпадают.")
    request = Request(
        origin + "/api/setup",
        data=json.dumps(dict(username=username, password=password)).encode(),
        headers={"Content-Type": "application/json", "X-Shoply-Setup-Token": token},
    )
    try:
        with build_opener(NoRedirect()).open(request, timeout=30) as result:
            json.load(result)
    except HTTPError as exc:
        with exc:
            try:
                message = json.load(exc).get("error", "Ошибка настройки.")
            except (ValueError, AttributeError):
                message = f"Ошибка настройки: HTTP {exc.code}."
        raise SystemExit(message) from None
    except URLError:
        raise SystemExit("Не удалось подключиться к магазину по HTTPS.") from None
    print("Администратор создан. Войдите через /admin.html.")


if __name__ == "__main__":
    main()

"""HTTP-адаптер локального магазина."""

import json
import mimetypes
import sqlite3
import time
from http.server import BaseHTTPRequestHandler
from http.cookies import SimpleCookie
from urllib.parse import urlsplit, unquote
from config import PUBLIC, STATUSES, SESSIONS
from database import connect, config
from auth_service import sign_in
from order_service import create_order, update_status, list_orders
from product_service import save_product, list_products
from settings_service import save_settings
from upload_service import upload_image
from response import response


class Handler(BaseHTTPRequestHandler):
    """Адаптировать HTTP-запросы к сервисам и раздавать только публичные ресурсы."""

    def log_message(self, *args):
        """Отключить стандартный журнал запросов локального сервера."""
        pass

    def json(self, code, body, cookie=None):
        """Отправить JSON-ответ с защитными заголовками и необязательным cookie."""
        raw = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(raw)

    def authenticated(self):
        """Проверить срок действия сессии из cookie."""
        try:
            cookies = SimpleCookie(self.headers.get("Cookie", ""))
            token = cookies["shoply_session"].value
            return SESSIONS.get(token, 0) > time.time()
        except (KeyError, ValueError):
            return False

    def do_GET(self):
        """Обработать чтение API или безопасную раздачу публичного файла."""
        path = unquote(urlsplit(self.path).path)
        with connect() as db:
            if path == "/api/shop":
                products = list_products(db)
                return self.json(
                    200, dict(products=products, settings=config(db, "settings"))
                )
            if path == "/api/session":
                return self.json(
                    200,
                    dict(
                        authenticated=self.authenticated(),
                        setup=config(db, "admin") is None,
                    ),
                )
            if path == "/api/admin/orders":
                if not self.authenticated():
                    return self.json(401, dict(error="Войдите в админку."))
                return self.json(200, dict(orders=list_orders(db), statuses=STATUSES))
        if path.startswith("/api/"):
            return self.json(404, dict(error="Не найдено."))
        return self.serve_static(path)

    def do_POST(self):
        """Передать POST-запрос обработчику изменений."""
        self.mutate()

    def do_DELETE(self):
        """Передать DELETE-запрос обработчику изменений."""
        self.mutate()

    def mutate(self):
        """Проверить HTTP-запрос, вызвать сервис и преобразовать ошибки в ответ."""
        try:
            body = self.read_mutation()
            if isinstance(body, tuple):
                return self.json(*body)
            return self.json(*self.route_mutation(body))
        except (ValueError, TypeError, KeyError, AttributeError, OverflowError) as exc:
            return self.json(
                400,
                dict(
                    error=(
                        str(exc)
                        if isinstance(exc, ValueError)
                        else "Проверьте данные запроса."
                    )
                ),
            )
        except sqlite3.IntegrityError:
            return self.json(409, dict(error="Повторный запрос. Обновите страницу."))
        except Exception:
            return self.json(500, dict(error="Ошибка сохранения. Попробуйте ещё раз."))

    def serve_static(self, path):
        """Раздать разрешённый публичный файл с проверкой границ директории."""
        relative = "index.html" if path == "/" else path.lstrip("/")
        allowed = relative in {"index.html", "admin.html"} or (
            relative.startswith("assets/")
            and relative.endswith((".css", ".js", ".png", ".jpg", ".webp", ".woff2"))
        )
        file = (PUBLIC / relative).resolve()
        if not allowed or not file.is_relative_to(PUBLIC) or (not file.is_file()):
            return self.json(404, dict(error="Не найдено."))
        raw = file.read_bytes()
        self.send_response(200)
        self.send_header(
            "Content-Type",
            mimetypes.guess_type(str(file))[0] or "application/octet-stream",
        )
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.end_headers()
        self.wfile.write(raw)

    def read_mutation(self):
        """Проверить источник, тип и размер запроса и прочитать JSON-объект."""
        host = self.headers.get("Host", "")
        if host not in {
            f"127.0.0.1:{self.server.server_port}",
            f"localhost:{self.server.server_port}",
        }:
            return (403, dict(error="Недопустимый адрес сервера."), None)
        origin = self.headers.get("Origin")
        if origin and origin != "http://" + host:
            return (403, dict(error="Недопустимый источник запроса."), None)
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            return (415, dict(error="Ожидается JSON."), None)
        size = int(self.headers.get("Content-Length", "0"))
        if size < 1 or size > 9000000:
            return (413, dict(error="Слишком большой запрос."), None)
        body = json.loads(self.rfile.read(size))
        if not isinstance(body, dict):
            raise ValueError("Ожидается объект.")
        return body

    def route_mutation(self, body):
        """Вызвать сервис маршрута внутри транзакции после проверки доступа."""
        path = urlsplit(self.path).path
        with connect() as db:
            ip = self.client_address[0]
            method = self.command
            if path in ("/api/setup", "/api/login"):
                return response(*sign_in(db, body, path, ip))
            if path == "/api/orders":
                return response(*create_order(db, body))
            if not self.authenticated():
                return response(401, dict(error="Войдите в админку."))
            if path == "/api/logout":
                c = SimpleCookie(self.headers.get("Cookie", ""))
                SESSIONS.pop(c["shoply_session"].value, None)
                return response(
                    200,
                    dict(ok=True),
                    "shoply_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
                )
            if path == "/api/admin/settings":
                return response(*save_settings(db, body))
            if path == "/api/admin/products":
                return response(*save_product(db, body, method))
            if path == "/api/admin/orders":
                return response(*update_status(db, body))
            if path == "/api/admin/upload":
                return response(*upload_image(body))
            return response(404, dict(error="Не найдено."))

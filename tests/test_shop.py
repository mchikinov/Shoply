"""Интеграционная проверка HTTP API и сохранения данных при перезапуске."""

import http.cookiejar
import json
import os
import re
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from urllib.request import build_opener, HTTPCookieProcessor, Request, urlopen
from unittest.mock import patch
from urllib.error import HTTPError
from test_cart import CartTest

ROOT = Path(__file__).resolve().parents[1]


class ShopTest(unittest.TestCase):
    """Проверить жизненный цикл магазина на изолированной временной базе."""

    def test_migration_and_atomic_generation(self):
        """Старая база сохраняется; ошибка внутри набора откатывает все вставки."""
        sys.path.insert(0, str(ROOT / "backend"))
        import database
        import test_data_service
        with tempfile.TemporaryDirectory() as data:
            path = Path(data)
            with sqlite3.connect(path / "shoply.sqlite3") as db:
                db.execute("CREATE TABLE products(id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)")
                db.execute("INSERT INTO products(body) VALUES(?)", ('{"name":"Существующий товар"}',))
            with patch.object(database, "DATA", path):
                database.init()
                database.init()
                with database.connect() as db:
                    old = db.execute("SELECT * FROM products").fetchone()
                    self.assertEqual(old["is_test"], 0)
                    self.assertEqual(json.loads(old["body"])["name"], "Существующий товар")
                    db.execute("CREATE TRIGGER fail_second BEFORE INSERT ON products WHEN (SELECT count(*) FROM products WHERE is_test=1) >= 1 BEGIN SELECT RAISE(ABORT, 'test failure'); END")
                with self.assertRaises(sqlite3.IntegrityError):
                    with database.connect() as db:
                        test_data_service.create_test_products(db, 3)
                with database.connect() as db:
                    self.assertEqual(db.execute("SELECT count(*) FROM products").fetchone()[0], 1)
                    self.assertEqual(test_data_service.delete_test_products(db)[1]["count"], 0)

    def test_full_shop_and_restart(self):
        """Проверить доступ, каталог, загрузки, заказы и устойчивость данных к перезапуску."""
        with tempfile.TemporaryDirectory() as data:
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                port = sock.getsockname()[1]
            base = f"http://127.0.0.1:{port}"
            env = dict(os.environ, SHOPLY_DATA_DIR=data, SHOPLY_PORT=str(port))
            process = None
            uploaded = None
            opener = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))

            def start():
                """Запустить тестовый сервер и дождаться готовности HTTP API."""
                p = subprocess.Popen(
                    [sys.executable, str(ROOT / "backend/server.py")],
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                )
                for _ in range(100):
                    try:
                        with urlopen(base + "/api/session", timeout=0.2):
                            return p
                    except Exception:
                        if p.poll() is not None:
                            raise RuntimeError(p.stderr.read().decode())
                        time.sleep(0.03)
                p.terminate()
                raise RuntimeError("Server startup timeout")

            def call(path, body=None, auth=True, method=None, origin=None):
                """Выполнить HTTP-запрос с тестовой сессией и прочитать JSON-ответ."""
                headers = {"Content-Type": "application/json"}
                if origin:
                    headers["Origin"] = origin
                req = Request(
                    base + path,
                    data=json.dumps(body).encode() if body is not None else None,
                    headers=headers,
                    method=method,
                )
                try:
                    with opener.open(req) if auth else urlopen(req) as r:
                        return (r.status, json.load(r))
                except HTTPError as e:
                    return (e.code, json.load(e))

            def put_in_cart(pid, quantity, request_id):
                """Подготовить серверную корзину того же HTTP-клиента для заказа."""
                cart = call("/api/cart")[1]
                code, cart = call("/api/cart/items", dict(id=pid, quantity=quantity,
                                  request_id=request_id, version=cart["version"]))
                self.assertEqual(code, 200)
                return cart["version"]

            try:
                process = start()
                self.assertEqual(call("/api/admin/orders", auth=False)[0], 401)
                # Каждая новая зависимость HTML должна реально раздаваться сервером.
                for page in ("index.html", "admin.html"):
                    markup = (ROOT / "public" / page).read_text()
                    for script in re.findall(
                        r'<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"', markup
                    ):
                        with urlopen(base + "/" + script.lstrip("/")) as resource:
                            self.assertEqual(resource.status, 200)
                # Ошибки HTTP-проверки не должны попадать в сервисы изменений.
                for raw, headers, expected in [
                    (b"{}", {"Content-Type": "text/plain"}, 415),
                    (b"", {"Content-Type": "application/json"}, 413),
                    (b"{", {"Content-Type": "application/json"}, 400),
                    (b"[]", {"Content-Type": "application/json"}, 400),
                    (
                        b"{}",
                        {"Content-Type": "application/json", "Host": "evil.example"},
                        403,
                    ),
                ]:
                    with self.subTest(raw=raw, headers=headers):
                        request = Request(
                            base + "/api/setup", data=raw, headers=headers
                        )
                        with self.assertRaises(HTTPError) as rejected:
                            urlopen(request)
                        self.assertEqual(rejected.exception.code, expected)
                        rejected.exception.close()

                self.assertEqual(call("/data/shoply.sqlite3", auth=False)[0], 404)
                self.assertEqual(call("/server.py", auth=False)[0], 404)
                for path in [
                    "/backend/server.py",
                    "/var/data/shoply.sqlite3",
                    "/codex/BRIEF.md",
                    "/assets/fonts/InterVariable.woff2",
                    "/assets/images/product-placeholder.svg",
                ]:
                    if path.startswith("/assets/"):
                        with urlopen(base + path) as resource:
                            self.assertEqual(resource.status, 200)
                    else:
                        self.assertEqual(call(path, auth=False)[0], 404)
                self.assertEqual(
                    call(
                        "/api/setup",
                        {"username": "тест-админ", "password": "test-password-123"},
                        origin="https://evil.example",
                    )[0],
                    403,
                )
                self.assertEqual(
                    call(
                        "/api/setup",
                        {"username": "тест-админ", "password": "test-password-123"},
                    )[0],
                    200,
                )
                self.assertEqual(
                    call(
                        "/api/setup",
                        {"username": "other", "password": "test-password-123"},
                    )[0],
                    409,
                )
                self.assertEqual(call("/api/shop")[1]["products"], [])
                for method in ("POST", "DELETE"):
                    self.assertEqual(call("/api/admin/test-data", {"count": 1}, auth=False, method=method)[0], 401)
                for count in (0, 101, -1, 1.5, True, "2"):
                    self.assertEqual(call("/api/admin/test-data", {"count": count})[0], 400)

                p = dict(
                    name="Тестовый товар",
                    is_test=True,
                    category="Новая категория",
                    price=123.45,
                    description="<script>test</script>",
                    properties=[
                        dict(name="Любое свойство", description="Любое описание")
                    ],
                    photos=[],
                )
                code, saved = call("/api/admin/products", p)
                self.assertEqual(code, 200)
                pid = saved["id"]
                p["id"] = pid
                p["price"] = 99.5
                self.assertEqual(call("/api/admin/products", p)[0], 200)
                # PNG 1×1: тест загрузки не зависит от картинок витрины.
                image = (
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwC"
                    "AAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII="
                )
                code, uploaded = call("/api/admin/upload", {"data": image})
                self.assertEqual(code, 201)
                p["photos"] = [uploaded["path"]]
                self.assertEqual(call("/api/admin/products", p)[0], 200)
                settings = dict(
                    name="Shoply Test",
                    logo=uploaded["path"],
                    accent="#0066ff",
                    background="#ffffff",
                    text="#222222",
                    telegram="https://t.me/test",
                )
                self.assertEqual(call("/api/admin/settings", settings)[0], 200)
                bad = dict(settings, telegram="javascript:alert(1)")
                self.assertEqual(call("/api/admin/settings", bad)[0], 400)
                self.assertEqual(call("/api/admin/test-data", {"count": 100})[1]["count"], 100)
                self.assertEqual(call("/api/admin/test-data", {"count": 1})[1]["count"], 1)
                generated = [x for x in call("/api/shop")[1]["products"] if x["id"] != pid]
                self.assertEqual(len(generated), 101)
                for item in generated:
                    self.assertNotIn("is_test", item)
                    self.assertIn(len(item["photos"]), (2, 3))
                    self.assertEqual(len(item["photos"]), len(set(item["photos"])))
                    for photo in item["photos"]:
                        with urlopen(base + "/" + photo) as image:
                            self.assertEqual(image.status, 200)
                edited = dict(generated[0], name="Отредактированный товар", is_test=False)
                self.assertEqual(call("/api/admin/products", edited)[0], 200)
                self.assertEqual(call("/api/admin/products", {"id": generated[1]["id"]}, method="DELETE")[0], 200)
                test_order = dict(token="generated-order", fullname="Покупатель", phone="+79991234567", delivery="pickup", cart_version=put_in_cart(edited["id"], 1, "generated-cart"))
                self.assertEqual(call("/api/orders", test_order)[0], 201)
                before_cleanup = call("/api/admin/orders")[1]["orders"]
                self.assertEqual(call("/api/admin/test-data", {}, method="DELETE")[1]["count"], 101)
                self.assertEqual(call("/api/admin/test-data", {}, method="DELETE")[1]["count"], 0)
                self.assertEqual(call("/api/admin/orders")[1]["orders"], before_cleanup)
                self.assertEqual([x["id"] for x in call("/api/shop")[1]["products"]], [pid])
                self.assertEqual(call("/api/admin/products", edited)[0], 400)
                order = dict(
                    token="test-request-123",
                    fullname="Тестовый покупатель",
                    phone="+7 999 123 45 67",
                    delivery="pickup",
                    address="Не сохранять",
                    items=[dict(id=pid, quantity=2, price=0.01)],
                    total=0.02,
                    cart_version=put_in_cart(pid, 2, "regular-cart"),
                )
                code, created = call("/api/orders", order)
                self.assertEqual(code, 201)
                oid = created["id"]
                self.assertEqual(created["total"], 199)
                retry = call(
                    "/api/orders",
                    dict(order, delivery="post", address="Другой адрес"),
                )[1]
                self.assertEqual(retry["id"], oid)
                self.assertEqual(retry["total"], 199)
                self.assertEqual(retry["delivery"], "pickup")
                orders = call("/api/admin/orders")[1]["orders"]
                self.assertEqual(len(orders), 2)
                self.assertEqual(orders[0]["address"], "")
                self.assertEqual(orders[0]["total"], 199)
                self.assertEqual(
                    call("/api/admin/orders", {"id": oid, "status": "В работе"})[0], 200
                )
                invalid = dict(order, token="other", delivery="post", address="")
                self.assertEqual(call("/api/orders", invalid)[0], 400)
                self.assertEqual(
                    call("/api/admin/products", {"id": pid}, method="DELETE")[0], 200
                )
                self.assertEqual(
                    call("/api/admin/orders")[1]["orders"][0]["items"][0]["name"],
                    "Тестовый товар",
                )
                process.terminate()
                process.wait()
                process.stderr.close()
                process = start()
                self.assertEqual(call("/api/admin/orders")[0], 401)
                self.assertEqual(
                    call(
                        "/api/login",
                        {"username": "тест-админ", "password": "test-password-123"},
                    )[0],
                    200,
                )
                self.assertEqual(
                    call("/api/shop")[1]["settings"]["name"], "Shoply Test"
                )
                self.assertEqual(
                    call("/api/admin/orders")[1]["orders"][0]["status"], "В работе"
                )
                self.assertNotIn(
                    pid, [p["id"] for p in call("/api/shop")[1]["products"]]
                )
                self.assertEqual(call("/api/shop")[1]["products"], [])
                self.assertEqual(call("/api/logout", {})[0], 200)
                self.assertEqual(call("/api/admin/orders")[0], 401)
            finally:
                if process:
                    process.terminate()
                    process.wait()
                    process.stderr.close()
                if uploaded and "path" in uploaded:
                    (ROOT / "public" / uploaded["path"]).unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()

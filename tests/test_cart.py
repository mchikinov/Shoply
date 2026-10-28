"""HTTP-проверки серверной корзины на отдельной временной SQLite."""

import http.cookiejar
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener, urlopen

ROOT = Path(__file__).resolve().parents[1]


class CartTest(unittest.TestCase):
    """Каждый сценарий получает свой сервер, товары и независимые cookie-клиенты."""

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.db_path = Path(self.directory.name) / "shoply.sqlite3"
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        self.base = f"http://127.0.0.1:{port}"
        self.env = dict(os.environ, SHOPLY_DATA_DIR=self.directory.name,
                        SHOPLY_PORT=str(port), SHOPLY_PUBLIC_ORIGIN="", SHOPLY_HOST="127.0.0.1")
        self.client = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.start()
        self.addCleanup(self.stop)
        with sqlite3.connect(self.db_path) as db:
            for pid in (1, 2):
                product = dict(name=f"Товар {pid}", price=100.25, category="Дом",
                               photos=[], photo=0, properties=[], description="")
                db.execute("INSERT INTO products(id,body) VALUES(?,?)", (pid, json.dumps(product)))

    def start(self):
        """Запустить сервер с той же временной базой, в том числе после остановки."""
        self.process = subprocess.Popen([sys.executable, str(ROOT / "backend/server.py")],
                                        env=self.env, stdout=subprocess.DEVNULL,
                                        stderr=subprocess.PIPE)
        for _ in range(100):
            try:
                with urlopen(self.base + "/api/health", timeout=0.2):
                    return
            except OSError:
                if self.process.poll() is not None:
                    raise RuntimeError(self.process.stderr.read().decode())
                time.sleep(0.03)
        self.stop()
        raise AssertionError("Сервер не запустился")

    def stop(self):
        """Освободить тестовый процесс и его канал диагностики."""
        self.process.terminate()
        self.process.wait(timeout=10)
        self.process.stderr.close()

    def call(self, path="/api/cart", body=None, method=None, client=None, headers=None):
        """Выполнить реальный HTTP-запрос с выбранной cookie-корзиной."""
        req = Request(self.base + path,
                      data=json.dumps(body).encode() if body is not None else None,
                      method=method, headers={"Content-Type": "application/json", **(headers or {})})
        try:
            result = (client or self.client).open(req)
        except HTTPError as error:
            result = error
        with result:
            return result.status, json.load(result), result.headers

    def cart(self):
        """Получить актуальное состояние тестового клиента."""
        code, cart, _ = self.call()
        self.assertEqual(code, 200)
        return cart

    def add(self, pid=1, quantity=1, request_id="add-1", version=None):
        """Добавить позицию с версией, ранее показанной покупателю."""
        if version is None:
            version = self.cart()["version"]
        return self.call("/api/cart/items", dict(id=pid, quantity=quantity,
                         request_id=request_id, version=version))

    def order(self, version, token="order-1", client=None):
        """Оформить серверную корзину без клиентских позиций и цен."""
        return self.call("/api/orders", dict(token=token, cart_version=version,
                         fullname="Покупатель", phone="+79991234567", delivery="pickup"),
                         client=client)

    def update_product(self, pid=1, **changes):
        """Изменить каталог вне клиента, имитируя действие администратора."""
        with sqlite3.connect(self.db_path) as db:
            product = json.loads(db.execute("SELECT body FROM products WHERE id=?", (pid,)).fetchone()[0])
            product.update(changes)
            db.execute("UPDATE products SET body=? WHERE id=?", (json.dumps(product), pid))

    def test_operations_isolation_limits_and_restart(self):
        empty = self.cart()
        self.assertEqual((empty["lines"], empty["count"], empty["total"]), ([], 0, 0))
        _, added, headers = self.add(quantity=2)
        self.assertEqual((added["count"], added["total"], added["lines"][0]["subtotal"]), (2, 200.5, 200.5))
        self.assertIn("no-store", headers["Cache-Control"])
        other = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.assertEqual(self.call(client=other)[1]["count"], 0)
        self.stop()
        self.start()
        self.assertEqual(self.cart()["count"], 2)
        changed = self.call("/api/cart/items/1", dict(quantity=3, version=added["version"], request_id="set"), "PATCH")
        self.assertEqual(changed[1]["total"], 300.75)
        down = self.call("/api/cart/items/1", dict(delta=-1, version=changed[1]["version"], request_id="down"), "PATCH")
        self.assertEqual(down[1]["count"], 2)
        deleted = self.call("/api/cart/items/1", dict(version=down[1]["version"], request_id="remove"), "DELETE")
        self.assertEqual(deleted[1]["count"], 0)
        self.assertEqual(self.add(quantity=1000, request_id="over")[0], 400)
        self.assertEqual(self.add(quantity=True, request_id="bool")[0], 400)
        added = self.add(quantity=999, request_id="max")[1]
        self.assertEqual(self.add(request_id="extra", version=added["version"])[0], 400)
        cleared = self.call("/api/cart/items", dict(version=added["version"], request_id="clear"), "DELETE")
        self.assertEqual(cleared[1]["lines"], [])

    def test_idempotent_add_conflicting_key_and_stale_mutation(self):
        version = self.cart()["version"]
        first = self.add(version=version)[1]
        self.assertEqual(self.add(version=version)[1]["count"], 1)
        self.assertEqual(self.add(quantity=2, version=version)[0], 409)
        code, conflict, _ = self.add(request_id="different", version=version)
        self.assertEqual(code, 409)
        self.assertEqual(conflict["code"], "cart_changed")
        self.assertEqual(conflict["cart"]["version"], first["version"])
        self.assertEqual(self.cart()["count"], 1)

    def test_parallel_add_requests_do_not_duplicate_or_lose_updates(self):
        seen = self.add()[1]
        # Два независимых HTTP-клиента используют cookie одного покупателя.
        jar = next(handler.cookiejar for handler in self.client.handlers if isinstance(handler, HTTPCookieProcessor))
        cookie_header = "; ".join(f"{cookie.name}={cookie.value}" for cookie in jar)
        def add_parallel(request_id):
            return self.call("/api/cart/items", dict(id=1, quantity=1,
                             version=seen["version"], request_id=request_id),
                             client=build_opener(), headers={"Cookie": cookie_header})
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(add_parallel, ["parallel-a", "parallel-b"]))
        self.assertEqual(sorted(result[0] for result in results), [200, 409])
        self.assertEqual(self.cart()["count"], 2)

    def test_catalog_reconciliation_and_stable_read_version(self):
        initial = self.add()[1]
        self.assertEqual(self.cart()["version"], initial["version"])
        self.update_product(price=77.1)
        updated = self.cart()
        self.assertEqual(updated["total"], 77.1)
        self.assertGreater(updated["version"], initial["version"])
        self.assertEqual(updated["changes"][0]["reason"], "price_changed")
        self.assertEqual(self.cart()["version"], updated["version"])
        with sqlite3.connect(self.db_path) as db:
            db.execute("UPDATE products SET active=0 WHERE id=1")
        removed = self.cart()
        self.assertEqual(removed["count"], 0)
        self.assertEqual(removed["changes"][0]["reason"], "unavailable")

    def test_checkout_price_conflict_even_after_another_read_and_confirmation(self):
        seen = self.add()[1]
        self.update_product(price=150)
        fresh = self.cart()
        code, conflict, _ = self.order(seen["version"])
        self.assertEqual(code, 409)
        self.assertEqual(conflict["code"], "cart_changed")
        self.assertEqual(conflict["cart"]["total"], 150)
        with sqlite3.connect(self.db_path) as db:
            self.assertEqual(db.execute("SELECT count(*) FROM orders").fetchone()[0], 0)
        code, receipt, _ = self.order(fresh["version"])
        self.assertEqual(code, 201)
        self.assertEqual((receipt["total"], receipt["status"], receipt["cart"]["count"]), (150, "Ожидает оплаты", 0))
        new = self.add(pid=2, request_id="after-order")[1]
        code, retry, _ = self.order(fresh["version"])
        self.assertEqual(code, 200)
        self.assertEqual(retry["id"], receipt["id"])
        self.assertEqual(retry["cart"]["count"], new["count"])
        outsider = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.assertEqual(self.order(0, client=outsider)[0], 409)

    def test_checkout_removed_product_empty_and_stale_composition(self):
        seen = self.add()[1]
        with sqlite3.connect(self.db_path) as db:
            db.execute("DELETE FROM products WHERE id=1")
        code, conflict, _ = self.order(seen["version"])
        self.assertEqual(code, 409)
        self.assertEqual(conflict["cart"]["lines"], [])
        self.assertEqual(self.order(conflict["cart"]["version"])[0], 400)
        seen = self.add(pid=2, request_id="second")[1]
        self.add(pid=2, request_id="second-more")
        self.assertEqual(self.order(seen["version"])[0], 409)

    def test_order_and_cart_cleanup_rollback_together(self):
        seen = self.add()[1]
        with sqlite3.connect(self.db_path) as db:
            db.execute("CREATE TRIGGER fail_cleanup BEFORE UPDATE ON carts WHEN NEW.body='[]' BEGIN SELECT RAISE(ABORT, 'cleanup failure'); END")
        self.assertEqual(self.order(seen["version"])[0], 409)
        with sqlite3.connect(self.db_path) as db:
            self.assertEqual(db.execute("SELECT count(*) FROM orders").fetchone()[0], 0)
            db.execute("DROP TRIGGER fail_cleanup")
        self.assertEqual(self.cart()["count"], 1)
        self.assertEqual(self.order(seen["version"])[0], 201)

    def test_cookie_security_patch_origin_and_no_legacy_checkout(self):
        _, _, headers = self.call()
        cookie = headers["Set-Cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Strict", cookie)
        self.assertEqual(self.call("/api/cart/items/1", dict(quantity=1, version=0, request_id="evil"),
                                   "PATCH", headers={"Origin": "https://evil.example"})[0], 403)
        self.assertEqual(self.call("/api/cart/items/1", dict(quantity=1, version=0, request_id="evil"),
                                   "PATCH", headers={"Host": "evil.example"})[0], 403)
        self.assertEqual(self.call("/api/orders", dict(token="legacy", fullname="Покупатель",
                         phone="+79991234567", delivery="pickup", items=[dict(id=1, quantity=1)]))[0], 400)
        spec = self.call("/openapi.json")[1]
        self.assertIn("patch", spec["paths"]["/api/cart/items/{product_id}"])


if __name__ == "__main__":
    unittest.main()

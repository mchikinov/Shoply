"""Проверить публичный режим и сохранность данных локально или в Docker на временных томах."""

import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


class DeploymentTest(unittest.TestCase):
    """Проверить HTTPS-настройки за прокси без обращения к реальному домену."""

    def test_public_runtime_and_recreate(self):
        """Проверить защиту setup, Host/Origin, cookie, заказы и фото после замены процесса."""
        image = os.environ.get("SHOPLY_TEST_IMAGE")
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary) / "data"
            uploads = Path(temporary) / "uploads"
            for directory in (data, uploads):
                directory.mkdir()
                directory.chmod(0o777)  # Изолированные тестовые тома для UID контейнера.
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                port = sock.getsockname()[1]
            base = f"http://127.0.0.1:{port}"
            origin = "https://shop.example.test"
            token = "test-setup-secret-" + "x" * 32
            runtime = dict(
                SHOPLY_HOST="0.0.0.0" if image else "127.0.0.1",
                SHOPLY_PORT="8765" if image else str(port),
                SHOPLY_DATA_DIR="/app/var/data" if image else str(data),
                SHOPLY_PUBLIC_ORIGIN=origin,
                SHOPLY_SETUP_TOKEN=token,
            )
            process = None
            container = None
            uploaded = None

            def call(path, body=None, headers=None):
                """Имитировать прокси: публичный Host и HTTP на внутреннем соединении."""
                request = Request(
                    base + path,
                    data=json.dumps(body).encode() if body is not None else None,
                    headers={"Host": "shop.example.test", "Content-Type": "application/json", **(headers or {})},
                )
                try:
                    response = urlopen(request, timeout=3)
                except HTTPError as exc:
                    response = exc
                with response:
                    raw = response.read()
                    payload = json.loads(raw) if response.headers.get_content_type() == "application/json" else raw
                    return response.status, payload, response.headers

            def start():
                """Запустить новую копию с теми же данными и дождаться проверки готовности."""
                nonlocal process, container
                if image:
                    command = ["docker", "run", "-d", "-p", f"127.0.0.1:{port}:8765"]
                    for key, value in runtime.items():
                        command += ["-e", f"{key}={value}"]
                    command += ["-v", f"{data}:/app/var/data", "-v", f"{uploads}:/app/public/assets/uploads", image]
                    container = subprocess.check_output(command, text=True).strip()
                else:
                    process = subprocess.Popen(
                        [sys.executable, str(ROOT / "backend/server.py")],
                        env={**os.environ, **runtime}, stdout=subprocess.DEVNULL,
                    )
                for _ in range(100):
                    try:
                        if call("/api/health")[0] == 200:
                            return
                    except OSError:
                        pass
                    time.sleep(0.1)
                raise AssertionError("Приложение не запустилось")

            def stop():
                """Удалить контейнер, сохранив временные тома, или остановить локальный процесс."""
                nonlocal process, container
                if container:
                    subprocess.run(["docker", "rm", "-f", container], check=True, stdout=subprocess.DEVNULL)
                    container = None
                if process:
                    process.terminate()
                    process.wait(timeout=10)
                    process = None

            credentials = {"username": "deploy-admin", "password": "test-password-123"}
            try:
                start()
                self.assertEqual(call("/api/setup", credentials)[0], 403)
                self.assertEqual(call("/api/setup", credentials, {"X-Shoply-Setup-Token": "wrong"})[0], 403)
                for headers in (
                    {"Host": "evil.example"},
                    {"Host": f"localhost:{port}"},
                    {"Origin": "https://evil.example"},
                    {"Origin": "http://shop.example.test"},
                ):
                    self.assertEqual(call("/api/setup", credentials, headers)[0], 403)
                status, _, headers = call("/api/setup", credentials, {"X-Shoply-Setup-Token": token, "Origin": origin})
                self.assertEqual(status, 200)
                self.assertIn("; Secure", headers["Set-Cookie"])
                self.assertIn("HttpOnly", headers["Set-Cookie"])
                cookie = {"Cookie": headers["Set-Cookie"].split(";", 1)[0]}
                self.assertEqual(call("/api/setup", credentials, {"X-Shoply-Setup-Token": token})[0], 409)
                photo = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII="
                status, uploaded, _ = call("/api/admin/upload", {"data": photo}, cookie)
                self.assertEqual(status, 201)
                photo_bytes = call("/" + uploaded["path"])[1]
                self.assertIsInstance(photo_bytes, bytes)
                self.assertEqual(call("/api/shop")[1]["products"], [])
                status, saved, _ = call(
                    "/api/admin/products",
                    {"name": "Товар проверки", "category": "Проверка", "price": 100},
                    cookie,
                )
                self.assertEqual(status, 200)
                product = call("/api/shop")[1]["products"][0]
                self.assertEqual(product["id"], saved["id"])
                status, cart, headers = call("/api/cart")
                self.assertEqual(status, 200)
                self.assertIn("; Secure", headers["Set-Cookie"])
                guest = {"Cookie": headers["Set-Cookie"].split(";", 1)[0], "Origin": origin}
                status, cart, _ = call("/api/cart/items", {
                    "id": product["id"], "quantity": 1,
                    "version": cart["version"], "request_id": "deployment-cart",
                }, guest)
                self.assertEqual(status, 200)
                status, order, _ = call("/api/orders", {
                    "token": "deployment-order-test", "fullname": "Test Buyer",
                    "phone": "+7 999 123 45 67", "delivery": "pickup",
                    "cart_version": cart["version"],
                }, guest)
                self.assertEqual(status, 201)
                stop()
                runtime["SHOPLY_SETUP_TOKEN"] = ""  # После создания администратора секрет можно удалить.
                start()
                self.assertEqual(call("/api/admin/orders", headers=cookie)[0], 401)
                status, _, headers = call("/api/login", credentials, {"Origin": origin})
                self.assertEqual(status, 200)
                cookie = {"Cookie": headers["Set-Cookie"].split(";", 1)[0]}
                self.assertEqual(call("/api/admin/orders", headers=cookie)[1]["orders"][0]["id"], order["id"])
                self.assertEqual(call("/" + uploaded["path"])[1], photo_bytes)
                self.assertIn("; Secure", call("/api/logout", {}, cookie)[2]["Set-Cookie"])
            finally:
                stop()
                if uploaded and not image:
                    (ROOT / "public" / uploaded["path"]).unlink(missing_ok=True)

    def test_unsafe_configuration(self):
        """Отклонить внешний запуск без HTTPS и публичный setup без секрета."""
        for overrides in (
            {"SHOPLY_HOST": "0.0.0.0"},
            {"SHOPLY_PUBLIC_ORIGIN": "https://shop.example/path"},
            {"SHOPLY_PUBLIC_ORIGIN": "https://shop.example"},
        ):
            with self.subTest(overrides=overrides), tempfile.TemporaryDirectory() as data:
                result = subprocess.run(
                    [sys.executable, str(ROOT / "backend/server.py")],
                    env={**os.environ, "SHOPLY_HOST": "127.0.0.1", "SHOPLY_PUBLIC_ORIGIN": "", "SHOPLY_SETUP_TOKEN": "", "SHOPLY_DATA_DIR": data, **overrides},
                    capture_output=True, timeout=5,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(b"ValueError", result.stderr)


if __name__ == "__main__":
    unittest.main()

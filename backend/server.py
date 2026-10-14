#!/usr/bin/env python3
"""Точка запуска Shoply локально или за HTTPS-прокси; стандартная библиотека Python."""

import os
from http.server import ThreadingHTTPServer
from database import init, connect, config
from handler import Handler
from config import HOST, PUBLIC_ORIGIN, SETUP_TOKEN, validate_runtime


def main():
    """Проверить настройки и запустить магазин; локально использовать loopback."""
    validate_runtime()
    init()
    if PUBLIC_ORIGIN:
        with connect() as db:
            if config(db, "admin") is None and len(SETUP_TOKEN) < 32:
                raise ValueError(
                    "До создания администратора задайте SHOPLY_SETUP_TOKEN (от 32 символов)."
                )
    port = int(os.environ.get("SHOPLY_PORT", "8765"))
    server = ThreadingHTTPServer((HOST, port), Handler)
    print(f"Shoply: {PUBLIC_ORIGIN or f'http://{HOST}:{port}'}/  Админка: /admin.html", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

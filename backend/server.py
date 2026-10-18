#!/usr/bin/env python3
"""Точка запуска FastAPI-приложения Shoply локально или за HTTPS-прокси."""

import os
import uvicorn

from app import app
from database import config, connect, init
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
    print(f"Shoply: {PUBLIC_ORIGIN or f'http://{HOST}:{port}'}/  Админка: /admin.html", flush=True)
    uvicorn.run(app, host=HOST, port=port, proxy_headers=False)


if __name__ == "__main__":
    main()

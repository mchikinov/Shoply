#!/usr/bin/env python3
"""Точка запуска локального Shoply; только стандартная библиотека Python 3.10+."""

import os
from http.server import ThreadingHTTPServer
from database import init
from handler import Handler


def main():
    """Подготовить базу и запустить HTTP-сервер на loopback-интерфейсе."""
    init()
    port = int(os.environ.get("SHOPLY_PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Shoply: http://127.0.0.1:{port}/  Админка: /admin.html", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

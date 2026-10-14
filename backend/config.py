"""Пути приложения, начальные настройки и состояние локальных сессий."""

import os
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
DATA = Path(os.environ.get("SHOPLY_DATA_DIR", str(ROOT / "var/data")))
HOST = os.environ.get("SHOPLY_HOST", "127.0.0.1")
PUBLIC_ORIGIN = os.environ.get("SHOPLY_PUBLIC_ORIGIN", "").rstrip("/")
SETUP_TOKEN = os.environ.get("SHOPLY_SETUP_TOKEN", "")
SECURE_COOKIE = PUBLIC_ORIGIN.startswith("https://")
STATUSES = ["Ожидает оплаты", "В работе", "Отправлен", "Завершён", "Отменён"]
SESSIONS, ATTEMPTS = ({}, {})
DEFAULT = dict(
    name="Shoply",
    logo="",
    accent="#2864e8",
    background="#ffffff",
    text="#182231",
    telegram="",
)


def validate_runtime():
    """Отклонить небезопасный внешний запуск и адреса с путём или credentials."""
    if PUBLIC_ORIGIN:
        parsed = urlsplit(PUBLIC_ORIGIN)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("SHOPLY_PUBLIC_ORIGIN должен содержать только схему и домен.")
        # Обращение к port также проверяет корректность номера порта.
        parsed.port
    if HOST not in {"127.0.0.1", "localhost", "::1"} and not SECURE_COOKIE:
        raise ValueError("Для внешнего запуска задайте SHOPLY_PUBLIC_ORIGIN с HTTPS.")

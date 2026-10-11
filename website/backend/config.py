"""Пути приложения, начальные настройки и состояние локальных сессий."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
DATA = Path(os.environ.get("SHOPLY_DATA_DIR", str(ROOT / "var/data")))
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

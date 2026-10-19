"""Создание базы и доступ к общим настройкам SQLite."""

import json
from contextlib import contextmanager
import sqlite3
from config import DATA, DEFAULT


@contextmanager
def connect():
    """Открыть транзакцию SQLite и закрыть соединение после commit или rollback."""
    db = sqlite3.connect(DATA / "shoply.sqlite3", timeout=15)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()


def init():
    """Создать схему и начальные настройки; новый каталог остаётся пустым."""
    DATA.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript(
            "CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, value TEXT NOT NULL);\n        CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);\n        CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"
        )
        if not db.execute("SELECT 1 FROM config WHERE key='settings'").fetchone():
            db.execute(
                "INSERT INTO config VALUES(?,?)", ("settings", json.dumps(DEFAULT))
            )


def config(db, key):
    """Прочитать JSON-настройку по ключу; вернуть None при отсутствии."""
    row = db.execute("SELECT value FROM config WHERE key=?", (key,)).fetchone()
    return json.loads(row["value"]) if row else None

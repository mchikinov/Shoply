"""Создать администратора или проверить пароль и выдать локальную сессию."""

import hashlib
import hmac
import json
import secrets
import time
from config import SESSIONS, ATTEMPTS, SECURE_COOKIE
from database import config
from validation import text
from response import response


def sign_in(db, body, path, ip):
    """Создать администратора или проверить пароль и выдать локальную сессию."""
    now = time.time()
    attempts = [t for t in ATTEMPTS.get(ip, []) if t > now - 300]
    if len(attempts) >= 10:
        return response(
            429, dict(error="Слишком много попыток. Повторите через 5 минут.")
        )
    ATTEMPTS[ip] = attempts + [now]
    admin = config(db, "admin")
    password = text(body.get("password"), 256, True)
    username = text(body.get("username"), 80, True)
    if path == "/api/setup":
        if admin:
            return response(409, dict(error="Администратор уже создан."))
        if len(password) < 10:
            raise ValueError("Пароль должен содержать минимум 10 символов.")
        salt = secrets.token_hex(16)
        digest = password_digest(password, salt)
        db.execute(
            "INSERT INTO config VALUES('admin',?)",
            (json.dumps(dict(username=username, salt=salt, digest=digest)),),
        )
    elif (
        not admin
        or not hmac.compare_digest(username.encode(), admin["username"].encode())
        or (
            not hmac.compare_digest(
                password_digest(password, admin["salt"]), admin["digest"]
            )
        )
    ):
        return response(401, dict(error="Неверный логин или пароль."))
    ATTEMPTS.pop(ip, None)
    token = secrets.token_urlsafe(32)
    SESSIONS[token] = now + 43200
    return response(
        200,
        dict(ok=True),
        f"shoply_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200"
        + ("; Secure" if SECURE_COOKIE else ""),
    )


def password_digest(password, salt):
    """Вычислить scrypt-хеш пароля с сохранённой случайной солью."""
    return hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1
    ).hex()

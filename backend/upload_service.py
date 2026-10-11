"""Проверить размер и сигнатуру изображения и сохранить под случайным именем."""

import base64
import secrets
from config import PUBLIC
from response import response


def upload_image(body):
    """Проверить размер и сигнатуру изображения и сохранить под случайным именем."""
    raw = base64.b64decode(body.get("data", ""), validate=True)
    if len(raw) > 6000000:
        raise ValueError("Максимальный размер фото — 6 МБ.")
    ext = (
        "png"
        if raw.startswith(b"\x89PNG\r\n\x1a\n")
        else (
            "jpg"
            if raw.startswith(b"\xff\xd8\xff")
            else "webp" if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP" else None
        )
    )
    if not ext:
        raise ValueError("Поддерживаются PNG, JPEG и WebP.")
    name = f"assets/uploads/{secrets.token_hex(16)}.{ext}"
    (PUBLIC / "assets/uploads").mkdir(exist_ok=True)
    (PUBLIC / name).write_bytes(raw)
    return response(201, dict(path=name))

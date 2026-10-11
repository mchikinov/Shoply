"""Проверить оформление магазина и сохранить настройки."""

import json
import re
from validation import text, image_path
from response import response


def save_settings(db, body):
    """Проверить оформление магазина и сохранить настройки."""
    settings = dict(
        name=text(body.get("name"), 80, True),
        logo=image_path(body.get("logo", "")),
        telegram=text(body.get("telegram", ""), 200),
    )
    if settings["telegram"] and (
        not re.fullmatch("https://t\\.me/[A-Za-z0-9_+/-]+", settings["telegram"])
    ):
        raise ValueError("Ссылка поддержки должна начинаться с https://t.me/.")
    for key in ("accent", "background", "text"):
        value = body.get(key, "")
        if not isinstance(value, str) or not re.fullmatch("#[0-9a-fA-F]{6}", value):
            raise ValueError("Некорректный цвет.")
        settings[key] = value
    db.execute(
        "UPDATE config SET value=? WHERE key='settings'",
        (json.dumps(settings, ensure_ascii=False),),
    )
    return response(200, dict(ok=True))

"""Проверка входных данных магазина до сохранения."""

import re


def text(value, limit=1000, required=False):
    """Проверить тип, длину и обязательность текста и удалить внешние пробелы."""
    if (
        not isinstance(value, str)
        or len(value) > limit
        or (required and (not value.strip()))
    ):
        raise ValueError("Проверьте обязательные поля и длину текста.")
    return value.strip()


def image_path(value):
    """Разрешить только локальные пути к поддерживаемым изображениям."""
    value = text(value, 300)
    if value and (
        not re.fullmatch(
            "assets/(?:uploads/[a-f0-9]+|images/[a-z0-9-]+)\\.(?:png|jpg|webp)", value
        )
    ):
        raise ValueError("Недопустимый путь изображения.")
    return value


def product_body(body):
    """Проверить поля товара и собрать сохраняемое представление."""
    p = dict(
        name=text(body.get("name"), 160, True),
        category=text(body.get("category"), 100, True),
        description=text(body.get("description", ""), 10000),
    )
    price = body.get("price")
    if (
        isinstance(price, bool)
        or not isinstance(price, (int, float))
        or (not 0 < price <= 100000000)
        or (round(price, 2) != price)
    ):
        raise ValueError(
            "Цена должна быть положительной, максимум два знака после запятой."
        )
    p["price"] = price
    p["photo"] = int(body.get("photo", 0)) % 4
    photos, props = (body.get("photos", []), body.get("properties", []))
    if (
        not isinstance(photos, list)
        or len(photos) > 12
        or (not isinstance(props, list))
        or (len(props) > 40)
    ):
        raise ValueError("Максимум 12 фото и 40 свойств.")
    p["photos"] = [image_path(x) for x in photos if x]
    p["properties"] = [
        {
            "name": text(x.get("name"), 100, True),
            "description": text(x.get("description", ""), 2000),
        }
        for x in props
    ]
    return p

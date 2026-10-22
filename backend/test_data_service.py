"""Генерация обычных товаров со служебной отметкой для последующей очистки."""

import json
import random
from uuid import uuid4

from response import response
from validation import product_body

PHOTOS = tuple(f"assets/images/test-product-{i}.jpg" for i in range(1, 11))
PRODUCTS = (
    ("Беспроводные наушники", "Электроника", "Для музыки, звонков и прогулок."),
    ("Портативная колонка", "Электроника", "Компактный звук для дома и поездок."),
    ("Плёночная камера", "Электроника", "Для путешествий и памятных кадров."),
    ("Городские кроссовки", "Обувь", "Удобная пара для повседневных маршрутов."),
    ("Спортивные кеды", "Обувь", "Лёгкая обувь для активного дня."),
    ("Керамическая кружка", "Для дома", "Для любимых напитков и уютных вечеров."),
    ("Настольная лампа", "Для дома", "Мягкий свет для чтения и работы."),
    ("Городской рюкзак", "Аксессуары", "Для необходимых вещей на каждый день."),
    ("Наручные часы", "Аксессуары", "Лаконичная деталь повседневного образа."),
    ("Дорожная сумка", "Аксессуары", "Для коротких поездок и новых маршрутов."),
)


def create_test_products(db, count):
    """Добавить 1–100 товаров; транзакцией и rollback управляет вызывающий код.

    Снимки выбираются без повторов внутри товара. Происхождение хранится вне
    JSON товара, поэтому публичное API и обычное редактирование его не меняют.
    """
    if type(count) is not int or not 1 <= count <= 100:
        raise ValueError("Укажите целое количество товаров от 1 до 100.")
    batch = uuid4().hex[:8]
    for index in range(count):
        name, category, description = random.choice(PRODUCTS)
        body = product_body(dict(
            name=f"{name} {random.choice(('Classic', 'Air', 'Urban', 'Mini'))} {batch}-{index + 1}",
            category=category,
            description=description,
            price=random.randrange(30, 1500) * 10,
            photos=random.sample(PHOTOS, random.choice((2, 3))),
            properties=[
                dict(name="Цвет", description=random.choice(("Чёрный", "Белый", "Синий", "Песочный"))),
                dict(name="Коллекция", description=random.choice(("Город", "Путешествия", "Комфорт"))),
            ],
        ))
        db.execute(
            "INSERT INTO products(body, is_test) VALUES(?, 1)",
            (json.dumps(body, ensure_ascii=False),),
        )
    return response(201, dict(ok=True, count=count))


def delete_test_products(db):
    """Физически удалить отмеченные товары, включая скрытые; заказы не менять.

    Общие фотографии и пользовательские загрузки остаются на диске.
    """
    result = db.execute("DELETE FROM products WHERE is_test=1")
    return response(200, dict(ok=True, count=result.rowcount))

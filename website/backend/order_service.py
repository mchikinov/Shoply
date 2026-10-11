"""Создать заказ по серверным ценам или вернуть результат повторного запроса."""

import json
import re
from config import STATUSES
from validation import text
from response import response


def create_order(db, body):
    """Создать заказ по серверным ценам или вернуть результат повторного запроса."""
    token = text(body.get("token"), 100, True)
    existing = db.execute(
        "SELECT id,status,body FROM orders WHERE token=?", (token,)
    ).fetchone()
    if existing:
        saved = json.loads(existing["body"])
        return response(
            200,
            dict(
                id=existing["id"],
                status=existing["status"],
                total=saved["total"],
                delivery=saved["delivery"],
            ),
        )
    customer, delivery, address = customer_details(body)
    lines = order_lines(db, body.get("items"))
    total = round(sum((p["price"] * p["quantity"] for p in lines)), 2)
    order = dict(
        customer=customer, delivery=delivery, address=address, items=lines, total=total
    )
    cur = db.execute(
        "INSERT INTO orders(token,body,status) VALUES(?,?,?)",
        (token, json.dumps(order, ensure_ascii=False), STATUSES[0]),
    )
    return response(
        201, dict(id=cur.lastrowid, status=STATUSES[0], total=total, delivery=delivery)
    )


def update_status(db, body):
    """Проверить допустимый статус и обновить заказ."""
    status = body.get("status")
    if status not in STATUSES:
        raise ValueError("Недопустимый статус.")
    db.execute("UPDATE orders SET status=? WHERE id=?", (status, body.get("id")))
    return response(200, dict(ok=True))


def list_orders(db):
    """Прочитать историю заказов с сохранёнными контактами и составом."""
    return [
        dict(
            id=row["id"],
            status=row["status"],
            created=row["created"],
            **json.loads(row["body"])
        )
        for row in db.execute("SELECT * FROM orders ORDER BY id DESC")
    ]


def customer_details(body):
    """Проверить контакты и доставку; исключить адрес при самовывозе."""
    customer = dict(
        fullname=text(body.get("fullname"), 160, True),
        phone=text(body.get("phone"), 30, True),
    )
    if not 7 <= len(re.sub("\\D", "", customer["phone"])) <= 15:
        raise ValueError("Укажите корректный номер телефона.")
    delivery = body.get("delivery")
    if delivery not in ("post", "pickup"):
        raise ValueError("Выберите способ доставки.")
    address = (
        text(body.get("address", ""), 400, delivery == "post")
        if delivery == "post"
        else ""
    )
    return (customer, delivery, address)


def order_lines(db, requested):
    """Проверить корзину и взять названия и цены только из активного каталога."""
    lines = []
    seen = set()
    if not isinstance(requested, list) or not 1 <= len(requested) <= 100:
        raise ValueError("Корзина пуста или слишком велика.")
    for item in requested:
        pid = item.get("id")
        qty = item.get("quantity")
        if (
            type(pid) is not int
            or type(qty) is not int
            or (not 1 <= qty <= 999)
            or (pid in seen)
        ):
            raise ValueError("Некорректный состав заказа.")
        seen.add(pid)
        row = db.execute(
            "SELECT body FROM products WHERE id=? AND active=1", (pid,)
        ).fetchone()
        if not row:
            raise ValueError("Один из товаров недоступен. Обновите каталог.")
        p = json.loads(row["body"])
        lines.append(dict(id=pid, name=p["name"], price=p["price"], quantity=qty))
    return lines

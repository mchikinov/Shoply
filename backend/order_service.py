"""Создать заказ по серверным ценам или вернуть результат повторного запроса."""

import json
import re
from config import STATUSES
from validation import text
from response import response
from cart_service import get_cart, save_lines, cart_conflict


def create_order(db, body, cart_id):
    """Оформить показанную версию корзины в транзакции с блокировкой записи.

    Принятый токен возвращает исходный заказ только владельцу корзины.
    Повтор не изменяет текущую корзину, включая добавленные после заказа товары.
    """
    token = text(body.get("token"), 100, True)
    existing = db.execute(
        "SELECT id,status,body,cart_id FROM orders WHERE token=?", (token,)
    ).fetchone()
    if existing:
        if existing["cart_id"] != cart_id:
            return response(409, dict(code="order_token_conflict", error="Токен заказа уже использован."))
        saved = json.loads(existing["body"])
        return response(
            200,
            dict(
                id=existing["id"],
                status=existing["status"],
                total=saved["total"],
                delivery=saved["delivery"],
                cart=get_cart(db, cart_id),
            ),
        )
    customer, delivery, address = customer_details(body)
    cart = get_cart(db, cart_id)
    if cart["version"] != body["cart_version"]:
        return cart_conflict(cart)
    if not cart["lines"]:
        raise ValueError("Корзина пуста.")
    lines = [dict(id=p["id"], name=p["name"], price=p["price"], quantity=p["quantity"])
             for p in cart["lines"]]
    total = cart["total"]
    order = dict(
        customer=customer, delivery=delivery, address=address, items=lines, total=total
    )
    cur = db.execute(
        "INSERT INTO orders(token,body,status,cart_id) VALUES(?,?,?,?)",
        (token, json.dumps(order, ensure_ascii=False), STATUSES[0], cart_id),
    )
    save_lines(db, cart_id, [])
    return response(
        201, dict(id=cur.lastrowid, status=STATUSES[0], total=total, delivery=delivery,
                  cart=get_cart(db, cart_id))
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

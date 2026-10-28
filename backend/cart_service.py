"""Серверные правила корзины; все вызовы выполняются в транзакции адаптера."""

from decimal import Decimal, ROUND_HALF_UP
import json

from response import response


def money(value):
    """Округлить денежную сумму до копеек без двоичной ошибки промежуточных сумм."""
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def save_lines(db, cart_id, lines):
    """Сохранить новый снимок, увеличив версию только при изменении данных."""
    encoded = json.dumps(lines, ensure_ascii=False, sort_keys=True)
    row = db.execute("SELECT body FROM carts WHERE id=?", (cart_id,)).fetchone()
    if json.loads(row["body"]) != lines:
        db.execute("UPDATE carts SET body=?,version=version+1 WHERE id=?", (encoded, cart_id))


def get_cart(db, cart_id):
    """Актуализировать позиции по каталогу; вернуть снимок и изменения этого чтения.

    Версия монотонна и хранится в SQLite: чтение другим клиентом не делает
    старую версию пригодной для оформления. Недоступные позиции исключаются.
    """
    row = db.execute("SELECT body FROM carts WHERE id=?", (cart_id,)).fetchone()
    previous = json.loads(row["body"])
    lines, changes = [], []
    for old in previous:
        product = db.execute("SELECT body FROM products WHERE id=? AND active=1", (old["id"],)).fetchone()
        if not product:
            changes.append(dict(id=old["id"], name=old["name"], reason="unavailable"))
            continue
        current = json.loads(product["body"])
        if current["price"] != old["price"]:
            changes.append(dict(id=old["id"], name=current["name"], reason="price_changed",
                                old_price=old["price"], price=current["price"]))
        lines.append(dict(current, id=old["id"], quantity=old["quantity"],
                          subtotal=money(Decimal(str(current["price"])) * old["quantity"])))
    save_lines(db, cart_id, lines)
    version = db.execute("SELECT version FROM carts WHERE id=?", (cart_id,)).fetchone()["version"]
    return dict(lines=lines, count=sum(line["quantity"] for line in lines),
                total=money(sum((Decimal(str(line["subtotal"])) for line in lines), Decimal(0))),
                version=version, changes=changes)


def cart_conflict(cart):
    """Отказать в действии по устаревшей версии, сохранив актуализацию транзакции."""
    return response(409, dict(code="cart_changed", error="Корзина изменилась. Проверьте актуальные товары и цены.", cart=cart))


def mutate_cart(db, cart_id, action, product_id, body):
    """Применить действие один раз и вернуть актуальную корзину.

    Идентификатор запроса привязан к его полному содержимому. Повтор успешного
    действия возвращает текущее состояние, даже если корзина уже менялась.
    Устаревшее действие не применяется, но актуализация сохраняется.
    """
    fingerprint = json.dumps([action, product_id, body], sort_keys=True)
    previous = db.execute("SELECT fingerprint FROM cart_operations WHERE cart_id=? AND request_id=?",
                          (cart_id, body["request_id"])).fetchone()
    cart = get_cart(db, cart_id)
    if previous:
        if previous["fingerprint"] != fingerprint:
            return response(409, dict(code="request_conflict", error="Идентификатор запроса уже использован.", cart=cart))
        return response(200, cart)
    if cart["version"] != body["version"]:
        return cart_conflict(cart)
    lines = cart["lines"]
    line = next((item for item in lines if item["id"] == product_id), None)
    if action in {"add", "set"}:
        if action == "add":
            quantity = (line["quantity"] if line else 0) + body["quantity"]
        else:
            absolute, delta = body.get("quantity"), body.get("delta")
            if (absolute is None) == (delta is None):
                raise ValueError("Передайте количество либо его изменение.")
            if not line:
                return cart_conflict(cart)
            quantity = absolute if absolute is not None else line["quantity"] + delta
        if not 0 <= quantity <= 999:
            raise ValueError("Количество товара должно быть от 0 до 999.")
        if not line:
            product = db.execute("SELECT body FROM products WHERE id=? AND active=1", (product_id,)).fetchone()
            if not product:
                return response(409, dict(code="product_unavailable", error="Товар больше недоступен.", cart=cart))
            if len(lines) >= 100:
                raise ValueError("В корзине может быть не более 100 разных товаров.")
            line = dict(json.loads(product["body"]), id=product_id)
            lines.append(line)
        line["quantity"] = quantity
        line["subtotal"] = money(Decimal(str(line["price"])) * quantity)
        lines = [item for item in lines if item["quantity"] > 0]
    elif action == "remove":
        lines = [item for item in lines if item["id"] != product_id]
    elif action == "clear":
        lines = []
    else:
        raise ValueError("Неизвестная операция корзины.")
    save_lines(db, cart_id, lines)
    db.execute("INSERT INTO cart_operations(cart_id,request_id,fingerprint) VALUES(?,?,?)",
               (cart_id, body["request_id"], fingerprint))
    updated = get_cart(db, cart_id)
    updated["changes"] = cart["changes"]
    return response(200, updated)

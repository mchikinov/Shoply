"""Создать, обновить или скрыть товар, сохранив историю заказов."""

import json
from validation import product_body
from response import response


def save_product(db, body, method):
    """Создать, обновить или скрыть товар, сохранив историю заказов."""
    pid = body.get("id")
    if method == "DELETE":
        db.execute("UPDATE products SET active=0 WHERE id=?", (pid,))
        return response(200, dict(ok=True))
    p = product_body(body)
    if pid is None:
        cur = db.execute(
            "INSERT INTO products(body) VALUES(?)", (json.dumps(p, ensure_ascii=False),)
        )
        pid = cur.lastrowid
    else:
        if not db.execute(
            "SELECT 1 FROM products WHERE id=? AND active=1", (pid,)
        ).fetchone():
            raise ValueError("Товар не найден.")
        db.execute(
            "UPDATE products SET body=? WHERE id=?",
            (json.dumps(p, ensure_ascii=False), pid),
        )
    return response(200, dict(ok=True, id=pid))


def list_products(db):
    """Прочитать активный каталог в порядке добавления новых товаров."""
    return [
        dict(json.loads(row["body"]), id=row["id"])
        for row in db.execute(
            "SELECT id,body FROM products WHERE active=1 ORDER BY id DESC"
        )
    ]

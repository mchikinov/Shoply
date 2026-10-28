"""HTTP-адаптер гостевой корзины; стандартные cookie пригодны для любых HTTP-клиентов."""

from contextlib import contextmanager
import hashlib
import secrets

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from cart_service import get_cart, mutate_cart
from config import SECURE_COOKIE
from database import connect
from schemas import CartAdd, CartMutation, CartSet, CartResponse, CartError

router = APIRouter(prefix="/api/cart", tags=["cart"])
ERRORS = {400: {"model": CartError}, 409: {"model": CartError}}


@contextmanager
def cart_connection(request):
    """Захватить запись до чтения каталога; получить корзину по секретной cookie.

    В базе хранится SHA-256 случайного секрета, а не сам секрет. Отсутствующая
    или неизвестная cookie создаёт новую изолированную корзину. Cookie не
    требует JavaScript и может сохраняться cookie-хранилищем мобильного клиента.
    """
    token = request.cookies.get("shoply_cart", "")
    cookie = None
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        cart_id = hashlib.sha256(token.encode()).hexdigest()
        found = db.execute("SELECT 1 FROM carts WHERE id=?", (cart_id,)).fetchone() if token else None
        if not found:
            token = secrets.token_urlsafe(32)
            cart_id = hashlib.sha256(token.encode()).hexdigest()
            db.execute("INSERT INTO carts(id) VALUES(?)", (cart_id,))
            cookie = f"shoply_cart={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000"
            if SECURE_COOKIE:
                cookie += "; Secure"
        yield db, cart_id, cookie


def cart_response(result, cookie=None):
    """Отправить результат после commit без кэширования персональной корзины."""
    code, body, _ = result
    headers = {"Cache-Control": "no-store"}
    if cookie:
        headers["Set-Cookie"] = cookie
    return JSONResponse(body, status_code=code, headers=headers)


@router.get("", response_model=CartResponse)
def read_cart(request: Request):
    """Получить актуальный состав, суммы и версию; при первом чтении создать cookie."""
    with cart_connection(request) as (db, cart_id, cookie):
        result = (200, get_cart(db, cart_id), None)
    return cart_response(result, cookie)


def apply_mutation(request, body, action, product_id=None):
    """Сохранить операцию и только затем подтвердить результат HTTP-клиенту."""
    with cart_connection(request) as (db, cart_id, cookie):
        result = mutate_cart(db, cart_id, action, product_id, body.model_dump())
    return cart_response(result, cookie)


@router.post("/items", response_model=CartResponse, responses=ERRORS)
def add_item(request: Request, body: CartAdd):
    """Увеличить количество; request_id делает повтор после потери ответа безопасным."""
    return apply_mutation(request, body, "add", body.id)


@router.patch("/items/{product_id}", response_model=CartResponse, responses=ERRORS)
def set_item(product_id: int, request: Request, body: CartSet):
    """Установить quantity либо применить delta; нулевое количество удаляет позицию."""
    return apply_mutation(request, body, "set", product_id)


@router.delete("/items/{product_id}", response_model=CartResponse, responses=ERRORS)
def remove_item(product_id: int, request: Request, body: CartMutation):
    """Удалить целую позицию из подтверждаемой версии корзины."""
    return apply_mutation(request, body, "remove", product_id)


@router.delete("/items", response_model=CartResponse, responses=ERRORS)
def clear_items(request: Request, body: CartMutation):
    """Очистить подтверждаемую корзину целиком."""
    return apply_mutation(request, body, "clear")

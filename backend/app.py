"""FastAPI-приложение Shoply: API, защита запросов и публичные файлы."""

from contextlib import asynccontextmanager
import hmac
import sqlite3
import time
from urllib.parse import unquote, urlsplit

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse

from auth_service import sign_in
from config import PUBLIC, PUBLIC_ORIGIN, SECURE_COOKIE, SESSIONS, SETUP_TOKEN, STATUSES
from database import config, connect, init
from order_service import create_order, list_orders, update_status
from product_service import list_products, save_product
from schemas import (
    Credentials,
    HealthResponse,
    ImageUpload,
    OrderCreate,
    OrderResponse,
    OrderStatusWrite,
    ProductDelete,
    ProductWrite,
    SettingsWrite,
    SessionResponse,
    ShopResponse,
)
from settings_service import save_settings
from upload_service import upload_image


def api_response(result):
    """Преобразовать результат сервиса в JSON, сохранив статус и cookie."""
    code, body, cookie = result
    headers = {"Set-Cookie": cookie} if cookie else None
    return JSONResponse(body, status_code=code, headers=headers)


def authenticated(request):
    """Проверить срок действия серверной сессии администратора."""
    return SESSIONS.get(request.cookies.get("shoply_session", ""), 0) > time.time()


def require_admin(request):
    """Вернуть единый ответ об отсутствии административной сессии."""
    if not authenticated(request):
        return JSONResponse({"error": "Войдите в админку."}, status_code=401)
    return None


@asynccontextmanager
async def lifespan(_app):
    """Создать базу до приёма первого запроса."""
    init()
    yield


app = FastAPI(
    title="Shoply API",
    version="1.0.0",
    description="Каталог, гостевое оформление заказов и управление магазином.",
    lifespan=lifespan,
)


@app.middleware("http")
async def protect_mutations(request, call_next):
    """Сохранить проверки Host, Origin, типа и размера изменяющих запросов."""
    if request.method not in {"POST", "DELETE"}:
        return await call_next(request)
    host = request.headers.get("host", "")
    port = request.url.port
    allowed_hosts = {urlsplit(PUBLIC_ORIGIN).netloc} if PUBLIC_ORIGIN else {
        f"127.0.0.1:{port}",
        f"localhost:{port}",
    }
    if host not in allowed_hosts:
        return JSONResponse({"error": "Недопустимый адрес сервера."}, status_code=403)
    origin = request.headers.get("origin")
    if origin and origin != (PUBLIC_ORIGIN or "http://" + host):
        return JSONResponse({"error": "Недопустимый источник запроса."}, status_code=403)
    if request.url.path == "/api/setup" and SETUP_TOKEN:
        supplied = request.headers.get("x-shoply-setup-token", "")
        if not hmac.compare_digest(supplied.encode(), SETUP_TOKEN.encode()):
            return JSONResponse(
                {"error": "Требуется секрет первоначальной настройки."},
                status_code=403,
            )
    if not request.headers.get("content-type", "").startswith("application/json"):
        return JSONResponse({"error": "Ожидается JSON."}, status_code=415)
    try:
        size = int(request.headers.get("content-length", "0"))
    except ValueError:
        size = 0
    if size < 1 or size > 9_000_000:
        return JSONResponse({"error": "Слишком большой запрос."}, status_code=413)
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_error(_request, _error):
    """Сохранить прежний формат ошибок вместо стандартного ответа FastAPI."""
    return JSONResponse({"error": "Проверьте данные запроса."}, status_code=400)


@app.exception_handler(sqlite3.IntegrityError)
async def integrity_error(_request, _error):
    """Преобразовать конфликт SQLite в прежний ответ API."""
    return JSONResponse(
        {"error": "Повторный запрос. Обновите страницу."}, status_code=409
    )


@app.exception_handler(Exception)
async def application_error(_request, error):
    """Не раскрывать внутренние исключения клиенту API."""
    if isinstance(error, (ValueError, TypeError, KeyError, AttributeError, OverflowError)):
        message = str(error) if isinstance(error, ValueError) else "Проверьте данные запроса."
        return JSONResponse({"error": message}, status_code=400)
    return JSONResponse({"error": "Ошибка сохранения. Попробуйте ещё раз."}, status_code=500)


@app.get("/api/health", tags=["public"], response_model=HealthResponse)
def health():
    """Проверить доступность приложения и чтение SQLite."""
    with connect() as db:
        db.execute("SELECT 1 FROM config LIMIT 1").fetchone()
    return {"ok": True}


@app.get("/api/shop", tags=["public"], response_model=ShopResponse)
def shop():
    """Вернуть активный каталог и оформление магазина."""
    with connect() as db:
        return {"products": list_products(db), "settings": config(db, "settings")}


@app.post(
    "/api/orders",
    tags=["public"],
    status_code=201,
    response_model=OrderResponse,
    responses={200: {"model": OrderResponse, "description": "Повтор ранее принятого заказа"}},
)
def create_guest_order(body: OrderCreate):
    """Создать гостевой заказ; итог рассчитать по ценам SQLite."""
    with connect() as db:
        return api_response(create_order(db, body.model_dump()))


@app.get("/api/session", tags=["admin"], response_model=SessionResponse)
def session(request: Request):
    """Сообщить состояние сессии и первой настройки администратора."""
    with connect() as db:
        return {
            "authenticated": authenticated(request),
            "setup": config(db, "admin") is None,
        }


def authenticate(request, body, path):
    """Создать администратора или открыть сессию существующего."""
    ip = request.client.host if request.client else ""
    with connect() as db:
        return api_response(sign_in(db, body.model_dump(), path, ip))


@app.post("/api/setup", tags=["admin"])
def setup(request: Request, body: Credentials):
    """Создать единственного администратора."""
    return authenticate(request, body, "/api/setup")


@app.post("/api/login", tags=["admin"])
def login(request: Request, body: Credentials):
    """Открыть административную сессию."""
    return authenticate(request, body, "/api/login")


@app.post("/api/logout", tags=["admin"])
def logout(request: Request):
    """Закрыть текущую административную сессию."""
    denied = require_admin(request)
    if denied:
        return denied
    SESSIONS.pop(request.cookies.get("shoply_session", ""), None)
    cookie = "shoply_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
    if SECURE_COOKIE:
        cookie += "; Secure"
    return JSONResponse({"ok": True}, headers={"Set-Cookie": cookie})


@app.get("/api/admin/orders", tags=["admin"])
def admin_orders(request: Request):
    """Вернуть заказы и допустимые статусы."""
    denied = require_admin(request)
    if denied:
        return denied
    with connect() as db:
        return {"orders": list_orders(db), "statuses": STATUSES}


@app.post("/api/admin/orders", tags=["admin"])
def change_order_status(request: Request, body: OrderStatusWrite):
    """Изменить статус заказа."""
    denied = require_admin(request)
    if denied:
        return denied
    with connect() as db:
        return api_response(update_status(db, body.model_dump()))


@app.post("/api/admin/products", tags=["admin"])
def write_product(request: Request, body: ProductWrite):
    """Создать или изменить товар."""
    denied = require_admin(request)
    if denied:
        return denied
    with connect() as db:
        return api_response(save_product(db, body.model_dump(), "POST"))


@app.delete("/api/admin/products", tags=["admin"])
def delete_product(request: Request, body: ProductDelete):
    """Скрыть товар, сохранив его в истории заказов."""
    denied = require_admin(request)
    if denied:
        return denied
    with connect() as db:
        return api_response(save_product(db, body.model_dump(), "DELETE"))


@app.post("/api/admin/settings", tags=["admin"])
def write_settings(request: Request, body: SettingsWrite):
    """Сохранить оформление магазина."""
    denied = require_admin(request)
    if denied:
        return denied
    with connect() as db:
        return api_response(save_settings(db, body.model_dump()))


@app.post("/api/admin/upload", tags=["admin"], status_code=201)
def upload(request: Request, body: ImageUpload):
    """Сохранить PNG, JPEG или WebP из строки base64."""
    denied = require_admin(request)
    if denied:
        return denied
    return api_response(upload_image(body.model_dump()))


@app.api_route("/api/{path:path}", methods=["GET", "POST", "DELETE"], include_in_schema=False)
def missing_api(path):
    """Вернуть прежний JSON-ответ для неизвестного API-маршрута."""
    return JSONResponse({"error": "Не найдено."}, status_code=404)


@app.get("/{path:path}", include_in_schema=False)
def static_file(path):
    """Раздать только разрешённый файл из каталога public."""
    relative = "index.html" if not path else unquote(path).lstrip("/")
    allowed = relative in {"index.html", "admin.html"} or (
        relative.startswith("assets/")
        and relative.endswith((".css", ".js", ".png", ".jpg", ".webp", ".woff2"))
    )
    file = (PUBLIC / relative).resolve()
    if not allowed or not file.is_relative_to(PUBLIC) or not file.is_file():
        return JSONResponse({"error": "Не найдено."}, status_code=404)
    return FileResponse(
        file,
        headers={"Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin"},
    )

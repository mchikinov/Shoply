"""Схемы публичных и административных запросов Shoply для OpenAPI."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class RequestModel(BaseModel):
    """Сохранить дополнительные поля для совместимости со старыми клиентами."""

    model_config = ConfigDict(extra="allow", strict=True)


class Credentials(RequestModel):
    """Логин и пароль администратора."""

    username: str
    password: str


class OrderCreate(RequestModel):
    """Гостевой заказ с токеном безопасного повтора запроса."""

    token: str
    fullname: str
    phone: str
    delivery: Literal["post", "pickup"]
    address: str = ""
    cart_version: int = Field(ge=0)


class CartMutation(BaseModel):
    """Версия показанной корзины и ключ безопасного повтора операции."""

    model_config = ConfigDict(strict=True, extra="forbid")
    version: int = Field(ge=0)
    request_id: str = Field(min_length=1, max_length=100)


class CartAdd(CartMutation):
    """Добавляемое количество, которое сервер прибавит к текущему."""

    id: int = Field(ge=0)
    quantity: int = Field(ge=1, le=999)


class CartSet(CartMutation):
    """Один из вариантов: абсолютное количество или относительное изменение."""

    quantity: int | None = Field(default=None, ge=0, le=999)
    delta: int | None = Field(default=None, ge=-999, le=999)


class ProductWrite(RequestModel):
    """Создаваемый или изменяемый товар."""

    id: int | None = None
    name: str
    category: str
    price: int | float
    description: str = ""
    photo: int = 0
    photos: list[str] = Field(default_factory=list)
    properties: list[dict[str, Any]] = Field(default_factory=list)


class ProductDelete(RequestModel):
    """Идентификатор скрываемого товара."""

    id: int


class SettingsWrite(RequestModel):
    """Название, контакты и цвета магазина."""

    name: str
    logo: str = ""
    telegram: str = ""
    accent: str
    background: str
    text: str


class OrderStatusWrite(RequestModel):
    """Новый статус существующего заказа."""

    id: int
    status: str


class ImageUpload(RequestModel):
    """Изображение в кодировке base64."""

    data: str


class HealthResponse(BaseModel):
    """Результат проверки готовности сервера и базы."""

    ok: bool


class SettingsResponse(BaseModel):
    """Публичные настройки оформления магазина."""

    name: str
    logo: str
    telegram: str
    accent: str
    background: str
    text: str


class ProductResponse(RequestModel):
    """Товар публичного каталога."""

    id: int
    name: str
    category: str
    price: int | float
    description: str
    photo: int
    photos: list[str]
    properties: list[dict[str, Any]]


class ShopResponse(BaseModel):
    """Каталог и оформление для витрины или мобильного приложения."""

    products: list[ProductResponse]
    settings: SettingsResponse


class CartLine(ProductResponse):
    """Актуальная позиция с рассчитанной сервером стоимостью."""

    quantity: int
    subtotal: int | float


class CartChange(BaseModel):
    """Изменение каталога при актуализации корзины."""

    id: int
    name: str
    reason: Literal["price_changed", "unavailable"]
    old_price: int | float | None = None
    price: int | float | None = None


class CartResponse(BaseModel):
    """Полный серверный снимок; version используется при изменении и оформлении."""

    lines: list[CartLine]
    count: int
    total: int | float
    version: int
    changes: list[CartChange]


class CartError(BaseModel):
    """Ошибка корзины; конфликт содержит актуальный снимок для клиента."""

    error: str
    code: str | None = None
    cart: CartResponse | None = None


class OrderResponse(BaseModel):
    """Подтверждение созданного или ранее принятого заказа."""

    id: int
    status: str
    total: int | float
    delivery: Literal["post", "pickup"]
    cart: CartResponse


class SessionResponse(BaseModel):
    """Состояние входа и первой настройки администратора."""

    authenticated: bool
    setup: bool


class TestDataCreate(RequestModel):
    """Количество товаров генератора; bool и дробные значения запрещены."""

    count: int = Field(ge=1, le=100)

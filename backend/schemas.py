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


class OrderItem(RequestModel):
    """Позиция корзины; цену сервер всегда читает из каталога."""

    id: int
    quantity: int


class OrderCreate(RequestModel):
    """Гостевой заказ с токеном безопасного повтора запроса."""

    token: str
    fullname: str
    phone: str
    delivery: Literal["post", "pickup"]
    address: str = ""
    items: list[OrderItem]


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


class OrderResponse(BaseModel):
    """Подтверждение созданного или ранее принятого заказа."""

    id: int
    status: str
    total: int | float
    delivery: Literal["post", "pickup"]


class SessionResponse(BaseModel):
    """Состояние входа и первой настройки администратора."""

    authenticated: bool
    setup: bool


class TestDataCreate(RequestModel):
    """Количество товаров генератора; bool и дробные значения запрещены."""

    count: int = Field(ge=1, le=100)

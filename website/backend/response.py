"""Результат API без зависимости от HTTP-обработчика."""


def response(code, body, cookie=None):
    """Вернуть статус, JSON-данные и необязательный cookie для HTTP-адаптера."""
    return code, body, cookie

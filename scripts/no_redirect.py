"""HTTP-клиент служебных команд: секреты нельзя пересылать при перенаправлении."""

from urllib.request import HTTPRedirectHandler


class NoRedirect(HTTPRedirectHandler):
    """Возвращать ошибку на redirect вместо отправки секретных заголовков другому адресу."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        """Запретить автоматический повтор запроса по адресу из Location."""
        return None

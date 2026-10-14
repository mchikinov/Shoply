"""Запросить деплой в Dokploy из CI; принятие запроса не означает готовность сайта."""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener
from no_redirect import NoRedirect


def main():
    """Отправить один запрос без повторов и не раскрывать API-токен или ответ сервера."""
    origin = os.environ["DOKPLOY_URL"].rstrip("/")
    parsed = urlsplit(origin)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path
        or parsed.query
        or parsed.fragment
    ):
        raise SystemExit("DOKPLOY_URL должен быть HTTPS-адресом панели без пути.")
    request = Request(
        origin + "/api/application.deploy",
        data=json.dumps({"applicationId": os.environ["DOKPLOY_APPLICATION_ID"]}).encode(),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-api-key": os.environ["DOKPLOY_API_KEY"],
        },
    )
    try:
        with build_opener(NoRedirect()).open(request, timeout=30) as result:
            if not 200 <= result.status < 300:
                raise SystemExit("Dokploy не принял запрос деплоя.")
    except HTTPError as exc:
        code = exc.code
        exc.close()
        raise SystemExit(f"Dokploy отклонил запрос: HTTP {code}.") from None
    except URLError:
        raise SystemExit("Не удалось связаться с Dokploy; проверьте состояние деплоя в панели.") from None
    print("Dokploy принял запрос. Результат сборки и запуска смотрите в Deployments.")


if __name__ == "__main__":
    main()

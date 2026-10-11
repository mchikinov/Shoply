# Продолжение работы

## Актуальная структура после подготовки к GitHub
Приложение — website/, материалы Codex — codex/. Публичная директория website/public; сервер website/backend/server.py. В корне README, .gitignore, .editorconfig, .gitattributes и GitHub Actions.

Запуск из корня: python3 website/backend/server.py. На macOS: website/scripts/start.command. Магазин http://127.0.0.1:8765/, админка /admin.html. Сервер по-прежнему слушает только 127.0.0.1.

Тесты: python3 website/tests/test_shop.py и node website/tests/test_frontend.cjs. CSS и JS разложены по public/assets/css и public/assets/js, демо-фото и Inter — assets/images и assets/fonts. Пользовательские фото — assets/uploads. Пути настроек и товаров в существующей базе обновлены после переноса.

База и её копия до переноса — website/var/data; пользовательские фото — website/public/assets/uploads. Эти данные не входят в Git, но сохранены локально. В чистом клоне создаются 22 демо-товара и форма создания администратора. Исторические копии и примеры — codex/archive, также исключены из Git.

Визуальные образцы находятся в codex/previews. Основной результат — website/public/index.html через сервер. Первоначальные инструкции и скиллы перенесены без изменения содержимого в codex/AGENTS.md и codex/.agents/skills. Исторический MANIFEST исходной среды — codex/archive/template-MANIFEST.json.

Требования остаются в BRIEF.md; оформление в DESIGN.md; результаты в REVIEW.md. Онлайн-оплата, хостинг и визуальная браузерная проверка остаются отдельными этапами. Репозиторий подготовлен локально, публикация в GitHub не выполнялась.

Плавающая кнопка корзины добавлена в index.html, стили — store.css. Счётчик синхронизируется в renderCartSummary, скрытие при открытой корзине — в screen(). Проверка node website/tests/test_frontend.cjs и git diff --check прошла; визуальная проверка этой правки в браузере не выполнялась.


## Анимация витрины — 11 октября 2026
Добавлены появление экранов, скелетоны во время /api/shop, короткое появление первых карточек при фильтрации и восстановление прокрутки каталога. Reduced motion отключает эффекты. Пройдены test_frontend.cjs, test_shop.py, проверка синтаксиса JS и git diff --check. В локальном браузере проверены загрузившийся каталог, открытие товара, возврат в каталог с восстановлением scrollY=882; ошибок в консоли нет. Медленная сеть и мобильные размеры отдельно в браузере не проверялись.

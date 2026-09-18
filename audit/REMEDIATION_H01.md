# H01 — безопасное отображение данных в админке

Дата: 17 сентября 2026. Ветка: `codex/systematic-repair`; база: `0f655e2`.
Проверки выполнены на рабочем дереве до коммита; манифест сохраняет этот снимок.
Push и deploy в рамках H01 не выполнялись.
Статус: **VERIFIED локально**. H01 исправлен и проверен; deployment smoke остаётся NOT_RUN до отдельного выпуска.

## Причина и правило исправления

Имена, email, сообщения и screen из API попадали в `innerHTML`. Admin CSP
разрешал inline scripts и event handlers. Сохранённая строка могла стать DOM
с исполняемым обработчиком в origin админки, где доступен admin token.

Правило: **любое значение из API остаётся данными, а структура DOM, классы и
обработчики определяются кодом**. CSP служит дополнительным барьером. Данные
не очищаются при записи: старые записи, Unicode, кавычки и буквальная разметка
должны отображаться корректно без повторного decoding/encoding.

## Реализация

- `server/routes/admin/dashboardPage.js` теперь содержит статическую HTML-оболочку. Script и CSS вынесены в `server/public/admin/dashboard.js` и `dashboard.css`.
- Все динамические HTML-вставки заменены на `createElement`, `textContent`, `append` и `replaceChildren`, включая статистику, пустые состояния и пагинацию.
- Кнопки используют `addEventListener`. Статусы берутся из фиксированного списка; ID остаётся в замыкании и кодируется как отдельный сегмент URL.
- Общий middleware `server/middleware/securityHeaders.js` используется в настоящем сервере и тестах. Удалено admin-исключение `unsafe-inline`; `script-src-attr 'none'`. Прежний nonce для invite сохранён.
- Удалены две неиспользуемые HTML-функции и их badge CSS вместе с заменённой реализацией. Пустой ответ таблицы теперь очищает старую пагинацию; количество колонок users исправлено на четыре.
- Добавлены закреплённая devDependency Playwright, browser regression и тесты реального пути записи/чтения. Обычный backend Jest не требует браузера.

Миграция БД, новый API-контракт и новая сборка iPhone для H01 не нужны. Vercel
уже включает `public/**`; deployed assets и headers всё равно требуют smoke
при будущем выпуске.

## Доказательства и проверки

Среда: Node `20.19.2`, Playwright `1.62.1`, Chrome `148.0.7778.167`, macOS.
Только синтетические данные, изолированные browser profiles и тестовые HTTP
listeners. Настоящий PostgreSQL и production не использовались.

| Проверка | Фактический результат |
|---|---|
| Исходный renderer без CSP | FAIL по исходному дефекту: API payload создал **13 HTML-элементов** вместо нуля. Ошибка запуска sandbox учитывалась отдельно, не как воспроизведение XSS. |
| Тот же класс payload после исправления, CSP отключена только в fixture | PASS: строки буквальные; внедрённых элементов и handlers нет, marker не выполняется. Небезопасный ID остаётся данными при клике. |
| Настоящий CSP middleware + реальные page/assets | PASS: assets 200 с правильным MIME; CSS применён; inline script/handler заблокированы; nonce script работает, nonce следующего ответа отличается. |
| Login / Enter / reload / pagination / status / Refresh / empty / logout / GET401 | PASS в Chrome. Браузерный набор содержит 4 сценария с отдельными DOM/HTTP assertions. |
| Авторизованные profile PUT + report POST → SQLite → настоящие admin API | PASS, 6 тестов; литералы сохраняются, unauthorized записи/чтения отклоняются. Email с HTML — явно seeded legacy fixture. |
| Сохранённые записи → настоящая страница в Chrome с CSP | PASS: 5 вариантов сохранённых данных (image, SVG, разрыв table/script, Unicode/entities, legacy email fallback), реальные API/SQL/UI login, без подмены JSON. Opt-in набор: 6/6, включая отдельный API authorization test. |
| Backend baseline до изменения | PASS: 30 suites / 338 tests. |
| Backend после реализации | PASS: 31 suites / 344 tests. |
| TypeScript baseline | PASS; mobile source в H01 не менялся. |
| `git diff --check`, проверка синтаксиса admin JS | PASS. |
| Независимый review diff | Подтверждённых новых дефектов не найдено; проверены все sinks, ID/pagination closures, assets, CSP/nonce и deployment includeFiles. |

Команды повторения browser проверок: [README тестов](../rehearsal-calendar-native/server/__tests__/browser/README.md).
Baseline и границы мока БД: [R0](notes-r0-test-safety.md).
Матрица независимой проверки: [H01 acceptance](notes-h01-review-plan.md).

Сохранённые результаты: [до исправления](evidence/H01/browser-before.txt),
[browser после](evidence/H01/browser-after.txt),
[сохранённые данные в browser](evidence/H01/stored-browser.txt),
[backend после](evidence/H01/backend-after.txt),
[вид админки на синтетических данных](evidence/H01/dashboard.png).
[Манифест](evidence/H01/manifest.json) фиксирует хеши проверенных исходников и тестов
рабочего дерева, а не только исходный commit.

При проверке npm-команды один запуск выбрал Node с ABI 137 при установленном
SQLite binary для ABI 115. Это отдельный FAIL окружения, не новый дефект H01;
[лог](evidence/H01/npm-node-mismatch.txt) сохранён. Обе npm-команды проверены
повторно с явным PATH на Node 20.19.2 и прошли. Не пересобирать native зависимости
под случайно выбранный другой Node; использовать одинаковую версию при install
и run. Исключения sandbox при запуске браузера/HTTP listeners также не считались
провалами исправления.

## Границы результата и ручная приёмка выпуска

H01 касается admin rendering. **A02, H02, H04 и остальные находки не закрыты.**
GET500/PATCH401, stale responses и полнота admin error UI остаются отдельной
работой; существующее хранение token в localStorage здесь не менялось.

На этом этапе устройство и помощь человека не нужны: уязвимый код исполняется
в веб-админке. Перед разрешённым выпуском в тестовом deployment нужно:

1. Проверить `/admin` и `/admin/`, hard reload, CSP без `unsafe-inline`, оба assets с 200 и верным MIME. При нарушении headers/packaging выпуск не считать принятым.
2. В тестовом аккаунте сохранить безвредные HTML-подобные имя и обращение; открыть админку и убедиться, что виден буквальный текст, а из него не появились элементы.
3. Проверить вход, Refresh, обе пагинации, смену статуса и выход; сохранить результат без паролей/token и реальных пользовательских данных.

Это будущий deployment smoke, сейчас **NOT_RUN**. Автоматические локальные
проверки не доказывают состояние production/CDN. При проблеме не возвращать
старый уязвимый renderer: ограничить доступ к админке и сделать forward fix.

На момент завершения H01 R0 ещё был IN_PROGRESS, что нарушило ожидаемый
пользователем порядок. После замечания сначала завершён [R0](REMEDIATION_R0.md).
Следующий отдельный пункт R1 — A02, необработанные async-ошибки в auth
middleware/admin login; в H01 и R0 его лечение не начиналось. H01 manifest
сохраняет snapshot до последующего выделения app factory в R0; новый snapshot
и повторные HTTP/backend проверки находятся в отчёте R0.

# Участок F — адаптер и базовая схема

2026-09-08. Полностью прочитаны `server/database/db.js` (161), `server/database/init-native-schema.sql` (303), `server/package.json` (44); адресно перечитаны SQL consumers/CLAUDE database setup и тестовые гарантии. Миграции полностью читает отдельный проход notes-migrations.md, tooling — notes-database-tooling.md; потребители — notes-database-consumers.md. Бинарный data.sqlite не открывался. Ни один запрос/код/тест/миграция не запускались.

## F01 — High — инструкция развёртывания новой БД использует несовместимую смесь SQL-диалектов

`database/init-native-schema.sql:39` и ещё восемь PK: `id INTEGER PRIMARY KEY AUTOINCREMENT`; временные поля :122-123 — `DATETIME`. При этом :229 используются `SERIAL`, :234 `TIMESTAMPTZ`, :265 `JSONB`, :270 `DEFAULT NOW()`. `CLAUDE.md:719-720` предписывает `psql ... -f database/init-native-schema.sql`, затем baseline. В `db.js` вообще нет загрузки/преобразования схемы; runtime PostgreSQL transform :38-40 касается только знаков параметров.

Сценарий: создать новый PostgreSQL environment по документации. PostgreSQL не принимает SQLite AUTOINCREMENT и тип DATETIME, основные таблицы не создаются. psql без ON_ERROR_STOP может продолжить оставшиеся statements, что дополнительно создаёт неполное состояние. Последующий baseline отметит миграции выполненными без проверки таблиц. Сервер может установить SELECT1 соединение, но login/projects/availability будут500 из-за отсутствующих объектов. Утверждение header «verified against production» означает сравнение описания, а не доказанную исполнимость файла.

Минимум: отдельный валидный PostgreSQL bootstrap с identity/serial, timestamptz и boolean defaults, documented stop-on-error/transaction (0.5–1 день; быстро даёт рабочий new environment, нужно вручную сверить с live schema). Правильно: воспроизводимая версия bootstrap для каждой реально поддерживаемой БД, автоматическая проверка clean install → schema parity перед baseline (1–2 дня; повторяемость и обнаружение drift, потребует isolated DB проверки после разрешения запусков).

## F02 — High — baseline пропускает обязательный unique index доступности

`init-native-schema.sql:155-172` определяет availability без UNIQUE(user_id,external_event_id,source); весь index section :285-300 его также не содержит. Индекс добавляет только `migrations/005-unique-imported-event.sql:25-26`. Однако `scripts/migrate.js:115-124` при baseline лишь записывает **все** pending filenames. `routes/native/availability.js:143`: `ON CONFLICT (user_id, external_event_id, source) DO NOTHING` обязателен для каждой bulk записи, даже manual с NULL external id.

Сценарий: после устранения диалекта F01 оператор создаёт новую БД из base и выполняет baseline по инструкции. Все bulk save/import запросы отклоняются: указанному conflict target не соответствует unique constraint. Наличие/отсутствие фактического дубля на это не влияет. PostgreSQL требует подходящий unique index при inference, иначе выдаёт ошибку ([официальная документация INSERT](https://www.postgresql.org/docs/current/sql-insert.html)). Production, где005 уже применена, этой конкретной ошибкой не затронут; текущий live catalog не проверялся.

Другие проявления того же schema parity gap: базовая схема не включает003 индексы notification user+created/unread; migrated production их получает, fresh baseline — нет. Поэтому при большом inbox возможны сканы общей таблицы. Не выдавать это за отсутствие индексов во всех средах. Календарные connection/mapping unique scope из тестовой схемы также не виден в базе (проверка ниже/consumers), но runtime SELECT→INSERT не требует ONCONFLICT там. **SlotService book/ensure не использует ONCONFLICT:** отсутствие005 не вызывает у него аналогичную ошибку, лишь лишает constraint защиты от дублей.

Минимум: добавить все обязательные постмиграционные объекты в bootstrap; перед baseline проверять обязательный unique availability index и остальные postconditions (2–4 ч; быстро разблокирует bulk, ручной список может снова устареть). Правильно: генерировать/проверять canonical schema от миграций, baseline только до определённой версии с проверкой checksum/postconditions (1–2 дня; предотвращает drift, нужно наладить provisioning workflow).

## F03 — Medium — заявленный SQLite режим не запускается штатной командой и не поддерживает SQL приложения

`db.js:114`: `path.join(process.cwd(), 'server', 'database', 'data.sqlite')`; `server/package.json:8-9` start/dev запускают server.js из каталога server. В результате путь становится server/server/database/data.sqlite, каталога в inventory нет; фактический файл расположен server/database/data.sqlite. Даже при запуске из корня native-проекта `db.js:119,123,126` отдаёт SQL напрямую sqlite.prepare без transform, тогда как реальный create rehearsal (`rehearsalService.js:385-386`) содержит `$4::timestamptz` и `NOW()`, availability bulk:115 содержит `AT TIME ZONE`. Это PostgreSQL синтаксис, SQLite его не исполняет. Тестовый harness трансформирует его, runtime adapter — нет.

Сценарий: разработчик использует заявленный SQLite fallback без DATABASE_URL (CLAUDE:136/782). `npm start` из server сначала падает на открытии неверного пути; после локального исправления пути ключевые API всё равно отказывают на SQL. Дополнительно `db.js:31-34` при неуспешном подключении **заданного** PostgreSQL автоматически выбирает этот SQLite путь. Таким образом fallback не обеспечивает сохранение доступности и может направить частично совместимые запросы в другую локальную БД. Реальная запись в fallback/состояние файла не проверялись и не утверждаются.

Минимум: путь относительно import.meta.url; при заданном DATABASE_URL завершать startup с ошибкой, явно документировать PostgreSQL-only пока SQL не портирован (2–4 ч; убирает скрытый другой storage и ложное обещание, SQLite dev временно ограничен). Правильно: явный DB engine config, отдельные SQL реализации/параметры и schema для каждого поддерживаемого engine; HTTP integration через настоящий adapter в обеих средах (2–4 дня; реальная переносимость, больше поддержки).

## F04 — предположение, не подтверждённая finding — async SQLite transaction не закрепляет владельца connection

`db.js:132-140`: `BEGIN; const result = await fn(db); COMMIT`, где `db` — тот же общий объект с доступной для всех sqlite connection; внешние run/get/all ничем не блокируются. `await` оставляет транзакцию открытой между продолжениями. Вторая transaction может упасть на BEGIN, но обычная UPDATE/INSERT B выполняется внутри транзакции A.

Условный сценарий для API адаптера: callback A после BEGIN ожидает реально незавершённую внешнюю Promise; B в это время делает обычную запись; A бросает ошибку, ROLLBACK отменяет также B. Однако дополнительная сверка всех трёх текущих production transaction callers (availability bulk, slot rebuild, account deletion) не нашла внутри внешнего I/O: они await только синхронные SQLite db calls. Microtask yield сам по себе не доказывает, что соседний HTTP callback успеет вклиниться. Поэтому реальная достижимость в нынешнем приложении НЕ подтверждена: пункт не включать в таблицу подтверждённых findings. Проверить контракт через controlled concurrent calls и при расширении transaction callbacks. Это не утверждение о broken PostgreSQL transaction: её :77-110 использует выделенный client и scoped helpers, что соответствует [документации node-postgres](https://node-postgres.com/features/transactions).

Минимум: сериализовать ВСЕ SQLite операции с учётом владельца transaction либо сделать SQLite transaction целиком синхронной и запретить Promise callback (0.5–1 день; понятная изоляция, придётся адаптировать async consumers). Правильно: единый engine-specific unit-of-work, scoped connection и очередь запросов без reentry другого owner; проверять real adapter двух конкурентных handlers (1–2 дня; явные гарантии, больше адаптации). Пока SQLite основной flow не работает F03, F04 сохраняется условной находкой, не production High.

## F05 — Low — adapter теряет число изменённых строк

`db.js:50,84`: `return { lastInsertId: res.rows[0]?.id };`, SQLite :120 возвращает только lastInsertRowid. `routes/native/availability.js:214,249,293` читают `result.changes || 0`, поэтому deletedCount/updatedCount всегда0 после реально выполненных действий. `utils/accountLinking.js:205` проверяет `result.changes === 0`; undefined никогда не0, и отсутствующий provider не даёт обещанную ошибку. Это не доказанный обход авторизации: guard количества методов остаётся, а unlink в A имеет отдельные проблемы.

Сценарий: удалить N импортированных строк через API; удаление выполнено, ответ заявляет0. Или при двух существующих auth methods unlink третьего отсутствующего provider сообщает успех. Тестовый setup возвращает changes, скрывая отличие production adapter.

Минимум: возвращать changes из pg rowCount / sqlite info.changes и дать общий DTO run result (1–2 ч; малое изменение, надо сверить callers). Правильно: отдельные typed results insert/execute с явным rowCount и contract tests реальных engines (0.5 дня; устраняет неоднозначность, небольшой API рефактор).

## Проверенные стыки/исключения

- D ends_at>starts_at подтверждён и base:137, и migration migrate-rehearsals-to-timestamptz:37-39; same-day ограничения нет. DF04 overnight serializer создаёт неупорядоченные timestamps, PostgreSQL CHECK отклоняет, routes/rehearsals:125-128,190-193 отдаёт500. DD02 multiday stored scenario поддерживается.
- A04 backfill email provider — только разовая migration001; trigger отсутствует в firstparty SQL. Поэтому новые password accounts по-прежнему не добавляют registry автоматически. provider_user_id base:66 nullable соответствует email model; mock schema с NOTNULL расходится.
- Нельзя объявлять отключённые SQLite FK лишь потому, что db.js не вызывает PRAGMA. Проверен конкретный locked better-sqlite3 **12.4.1** (lock:2041-2042): [официальные compile defines](https://raw.githubusercontent.com/WiseLibs/better-sqlite3/v12.4.1/deps/defines.gypi) включают SQLITE_DEFAULT_FOREIGN_KEYS=1. Общая SQLite default документация здесь не доказывает fail-open. Custom native build требует runtime PRAGMA проверки, но отдельной finding нет.
- Pool rollback failure catch проглатывает ошибку, release без error аргумента; повреждённый client/idle pool error и actual pool lifecycle требуют fault injection. Нет доказанного connection leak из обычного transaction happy/error пути (finally.release присутствует).
- Параметры SQL transform заменяет все `?`, включая потенциальные строковые literals/operators. В текущих проверенных firstparty запросах конфликтующих literals не найдено; hypothetical SQL injection не начисляется.
- Проверка health через SELECT1 доказывает только соединение, не наличие актуальной схемы. Это усиливает F01/F02, не самостоятельный ID.

Самостоятельный count: F01/F02 High, F03 Medium, F05 Low. F04 — только предположение/проверка границ API, не подтверждённая пользовательская finding. Existing production schema/data и migrate ledger не запрашивались.

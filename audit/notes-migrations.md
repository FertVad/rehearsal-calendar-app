# Участок F: SQL migrations

Статус: готов, все 23 SQL полностью прочитаны (887 строк). 2026-09-08. Только статическое чтение. Ни одна миграция, SQL-запрос, runner, тест или приложение не запускались.

## FM01 — Medium — Историческая конверсия UTC зависит от session timezone

**Код:** `rehearsal-calendar-native/server/migrations/migrate-rehearsals-to-timestamptz.sql:15-20` обещает, что существующие date/time — UTC, но выполняет:

```sql
starts_at = (date + start_time)::TIMESTAMPTZ,
ends_at = (date + end_time)::TIMESTAMPTZ
```

Аналогично `migrate-availability-to-timestamptz.sql:19-25`: date::TIMESTAMPTZ и (date+time)::TIMESTAMPTZ без `AT TIME ZONE 'UTC'` либо `SET LOCAL TIME ZONE`. Cast timestamp-without-timezone→timestamptz интерпретирует часы в session timezone. `fix-date-column-types.sql:5-10` выполняет обратное `date::DATE` тоже в session zone и может сдвинуть календарную дату старого TIMESTAMPTZ.

**Условие/сценарий:** legacy database ещё содержит старые date/start_time/end_time, миграция применяется **впервые** в соединении с TimeZone='Asia/Jerusalem'. Старое UTC 10 сентября 10:00 становится 07:00Z (при UTC+3), хотя комментарий обещает 10:00Z. All-day UTC-midnight также сдвигается и перестаёт соответствовать календарной конвенции клиента. В среде UTC ошибка не проявляется. Фактическая timezone исторического production migration session не известна; текущая порча данных не утверждается.

Семантика casts дополнительно проверена по [официальной документации PostgreSQL Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html): отсутствие zone в timestamptz input означает timezone текущей сессии. Это подтверждает условный механизм, не фактическую настройку production.

**Последствие:** массовое смещение исторической доступности/репетиций/напоминаний при восстановлении или upgrade legacy базы. Последующие drop-old migrations удаляют исходные date/time, оставляя только ошибочно конвертированные instant values.

**Минимум:** явный `(date + start_time) AT TIME ZONE 'UTC'` и симметричное правило для ends/all-day, либо transaction с SET LOCAL TIME ZONE UTC после проверки source semantics (2–4 часа; быстро/детерминированно, предполагает что source действительно UTC). **Правильно:** документированная source timezone, preflight выборки и round-trip сверка каждой migrated группы до drop-old, утверждённый backup/rollback (0.5–1 дня; позволяет обнаружить реальные legacy неоднородности, дороже подготовки). Для уже применённой миграции нельзя просто повторно прибавить offset: сначала установить, когда/как она выполнялась.

## FM02 — Low — Повторный OAuth backfill создаёт дубли email-provider

**Код:** `rehearsal-calendar-native/server/migrations/001-add-oauth-providers.sql:23` задаёт `UNIQUE(provider_type, provider_user_id)`, provider_user_id допускает NULL (`16`). Backfill (`77-94`) выполняет `INSERT OR IGNORE ... SELECT id,'email',email,...` без provider_user_id и без `WHERE NOT EXISTS` по user_id/provider_type.

**Условие/сценарий:** backfill запускают повторно на поддерживаемом SQLite SQL пути (ручное восстановление/повтор после partial failure). Каждая email запись опять имеет provider_user_id=NULL; NULL значения не конфликтуют с UNIQUE, INSERT OR IGNORE ничего не игнорирует, появляются повторные email-provider для одного пользователя. Обычный runner с корректно записанным native_migrations filename эту миграцию повторно не применит; актуальные duplicates в production не подтверждены.

**Последствие:** provider model теряет «один email method на пользователя», UI/счётчики методов получают дубли. Влияние на конкретный unlink/security сценарий не приписывается без дополнительной проверки; связь с A04 существования/backfill email-provider передана основному аудитору.

**Минимум:** добавить NOT EXISTS(user_id,provider_type='email') в backfill (до 1 часа; достаточно последовательного запуска, concurrent backfill всё ещё гонка). **Правильно:** уникальность (user_id,provider_type) или отдельный partial unique email index после детерминированной дедупликации + transactional upsert (2–4 часа; DB обеспечивает инвариант, нужно проверить допустимость нескольких OAuth accounts одного provider).

## Подтверждённые межмодульные стыки, без повторного count

1. **A04 email provider:** единственный явный SQL backfill — `001-add-oauth-providers.sql:77-94`, только существующие password_hash NOT NULL/непустые; active SQL использует SQLite AUTOINCREMENT/INSERT OR IGNORE (`13,77`). PostgreSQL версия DDL и INSERT показана только в комментариях (`27-41,96-99`). Новые register пользователи этим backfill не охватываются автоматически. Реальный register/provider lifecycle разобран в A; не считать ещё раз.
2. **D ends constraints:** `migrate-rehearsals-to-timestamptz.sql:37-39` создаёт `CHECK (ends_at > starts_at)`, а availability миграция `44-46` — аналогичный CHECK. Ограничения **не запрещают разные календарные даты**, только неположительную длительность. Presence на реально используемой schema зависит от применённых migrations/base schema (root проверяет F02), live database не исследована.
3. **E unique imported scope:** `005-unique-imported-event.sql:17-23` перед индексом удаляет все строки кроме минимального id по `(user_id,external_event_id,source)`; `25-26` unique scope ровно такой же, без calendar/device/connection. Если external IDs повторяются между календарями/устройствами, dedup удалит самостоятельную запись, а unique запретит хранить обе. Это часть существующей E scope finding; не новый F count. Комментарий «rows identical apart from id» (`16`) SQL не проверяет: title/time/calendar не сравниваются.
4. **E mapping scope:** `adapt-calendar-tables-for-expo.sql:19-21` добавляет device_calendar_id/name, но не device identity; `51-59` добавляет только обычные indexes connection_id, (event_type,internal_event_id), external_event_id. Уникальные ограничения базовых mapping tables проверяет root; этой миграцией ambiguity разных connections не закрывается.
5. **F01 mixed dialect / runner order:** SQL 001 активен только для SQLite, остальные unsuffixed включают PG DO blocks, ALTER COLUMN, COMMENT, TIMESTAMPTZ. Runner, по сверке с scripts аудитором, фильтрует только engine suffix и затем sort; unsuffixed файлы идут в обе СУБД. Это объединено с root F01 fresh-schema/dialect проблемой, без дубля.
6. **F02 schema omissions/baseline:** индексы notifications существуют в `003-notifications-timestamptz.sql:16-20`: `(user_id,created_at DESC)` и partial `(user_id) WHERE read_at IS NULL`. Imported unique — `005:25-26`. Root подтвердил отсутствие их в base schema и baseline, помечающий все migrations как выполненные; новая база не получит эти изменения. Root ведёт отдельную F02 finding.
7. **FT02 runner retry/transaction:** отдельные файлы здесь без явного BEGIN/COMMIT; некоторые не replay-safe (`ADD CONSTRAINT` в `006:30,34`, `adapt-calendar:46`, timed migrations; `ADD COLUMN` без IF в token-version/week-start). Scripts аудитор ведёт exec→record gap и применяет engine-specific transaction semantics. Отсутствие IF NOT EXISTS само по себе отдельной finding не начисляется: нормальный мигратор должен исполнять каждый файл один раз.

## Порядок зависимостей и безопасное применение

- `add-is-all-day-flag.sql` должен выполняться до `migrate-availability-to-timestamptz.sql`: первая миграция использует старые start_time/end_time (`12-13`), вторая читает is_all_day (`20,24`). Потом `drop-old-availability-columns.sql` удаляет исходные поля (`39-42`). Обычный лексикографический порядок drop-old раньше migrate; существующие проверки в drop-old (`14-28`) остановят его, если starts/ends ещё нет/NULL, но полного topological runner order эти файлы не задают.
- Аналогично `migrate-rehearsals-to-timestamptz` → `drop-old-rehearsal-columns`; `fix-date-column-types` работает только до удаления date.
- `add-rehearsal-responses-table.sql` → `add-pending-response-status.sql`; в plain sort add-pending идёт раньше create-table, если таблицы нет в baseline.
- `002-create-push-tokens-postgres.sql` (либо `create-push-reminders-table.sql`) создаёт per-rehearsal claim key; `006-per-recipient-reminder-claims.sql` меняет на `(rehearsal_id,user_id,reminder_type)`. Поздний CREATE IF NOT EXISTS старой формы не исправляет уже созданную таблицу. Root/schema проверяет current baseline, а не полагается на комментарий старой create migration.
- `006:14-16` предполагает пустую production claim table; `24` фактически удаляет **все прежние claims**, поскольку новая user_id у них NULL. Для непустой legacy базы upgrade забывает сведения о ранее отправленных напоминаниях и допускает повторные рассылки в открытом временном окне. Это условный legacy migration риск, не подтверждение повторных production уведомлений; нужен preflight row count/согласованный backfill или отдельное окно запуска.
- `003-notifications-timestamptz.sql:9-12` не является произвольно replay-safe conversion: повторный USING `timestamptz AT TIME ZONE 'UTC'` на уже конвертированной колонке создаёт timestamp без zone, который снова приводится к target в session zone. Поэтому нельзя «на всякий случай» повторять файл на уже обновлённой non-UTC session базе; runner history обязателен.
- В migrate-to-timestamptz backfill WHERE starts_at IS NULL (`availability:27`, `rehearsals:21`) не чинит row с заполненным starts_at и NULL ends_at; последующий SET NOT NULL останавливает миграцию, это fail-closed поведение. Если legacy end_time<=start_time, CHECK тоже остановится; автоматический перенос на следующий день не предусмотрен.
- Drop-old checks подтверждают наличие двух columns и отсутствие NULL, но не равенство legacy/new значений. Без отдельной верификации FM01 может пройти checks. Их rollback в комментариях приводит timestamp к UTC (`drop-old-*:78-80`), корректность зависит от исходной legacy timezone.

## Полное покрытие

Прочитаны все файлы `rehearsal-calendar-native/server/migrations/*.sql`, ничего не исключалось как слишком старое (объём 887 строк):

- 001-add-oauth-providers.sql; 002-create-push-tokens-postgres.sql; 002-create-push-tokens-sqlite.sql;
- 003-notifications-timestamptz.sql; 004-trim-user-names.sql; 005-unique-imported-event.sql; 006-per-recipient-reminder-claims.sql;
- adapt-calendar-tables-for-expo.sql; add-is-all-day-flag.sql; add-is-all-day-to-rehearsals.sql; add-onboarding-completed.sql;
- add-pending-response-status.sql; add-rehearsal-responses-table.sql; add-rehearsal-title-description.sql; add-token-version.sql;
- add-week-start-preference-sqlite.sql; add-week-start-preference.sql; create-push-reminders-table.sql;
- drop-old-availability-columns.sql; drop-old-rehearsal-columns.sql; fix-date-column-types.sql;
- migrate-availability-to-timestamptz.sql; migrate-rehearsals-to-timestamptz.sql.

db.js/init-native-schema.sql и scripts/runtime tests прочитаны другими F аудиторами. Live native_migrations ledger, DB timezone, applied constraints, реальное содержимое legacy таблиц и backup restoration не проверялись: пользователь запретил запуск. Для ручной проверки после согласования: взять копию legacy fixture, провести migration в UTC и non-UTC sessions, сверить instant/date round trips, повторить failure→retry через runner, сравнить schema/catalog после init+baseline с актуальной migration history и проверить uniqueness scopes.

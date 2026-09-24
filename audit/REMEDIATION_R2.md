# R2 — схема и мигратор (F01/F02/FT01/FT02/FM01/FM02)

24 сентября 2026. Ветка `claude/systematic-repair`. База `aa00ffd`; незаконченный
R2 предыдущего агента сохранён без изменений в **`dd886ea`** — это граница
первого ревью. Проверенный исходник **`eb24c624cc5a3f8a1d1fea9698d50f8641524ec1`**,
tree `00c2e731552293462204ec39e48c218fb4535253`. Node 22.16.0, PostgreSQL 15.13
(одноразовый Docker на loopback). Production не затрагивался.

**Итог:** F01, F02, FT01, FT02 — VERIFIED локально. FM01, FM02 — READY_FOR_CHECK:
отказ по умолчанию доказан, условие в production (исторические данные) — NOT_RUN,
карточка OPS-R2-DATA. Вместе с F03/F05 из [R2 foundation](REMEDIATION_R2_FOUNDATION.md)
пакет закрыт, кроме этой карточки.

| ID | Коммит | До: старый инструмент `aa00ffd` | После / регресс | Мутация | Статус |
|---|---|---|---|---|---|
| F01 High | `dd886ea`, `f4a7eeb` | bootstrap на PostgreSQL: `42601` на `AUTOINCREMENT` | `--fresh` → 19 таблиц, каталог = дескриптор; HTTP-контракты на fresh и upgraded схемах | `AUTOINCREMENT` в bootstrap → сьют падает на fresh | VERIFIED |
| F02 High | `dd886ea`, `f4a7eeb` | `--baseline` пишет `005` в журнал без индекса → маршрут bulk: `42P10`, HTTP 500 | в fresh ключ есть; `--baseline` отклонён; база без ключа отклонена профилем по умолчанию; явный `pre-import-key` + `--apply` создаёт ключ, строки целы, дубли запрещают | bootstrap без ключа → `POSTCONDITION_FAILED`; чекер без требования ключа → падает «missing conflict target» | VERIFIED |
| FT01 Low | `dd886ea` | `--dry` создаёт `native_migrations`; `--dry --baseline` пишет 24 файла | dry в `READ ONLY`, ничего не создаёт; `--dry --baseline` → `BASELINE_UNSUPPORTED` | dry с записью журнала → падает «dry absent history» | VERIFIED |
| FT02 Medium | `dd886ea` | отказ записи в журнал: SQL уже закоммичен, файл не записан, «resume» падает на `already exists` | отказ записи откатывает шаг вместе с историей; повтор применяет один раз; потерянный ответ на COMMIT → `COMMIT_OUTCOME_UNKNOWN` | COMMIT после каждого шага → падает «real ledger INSERT failure» | VERIFIED |
| FM01 Medium, усл. | `eb24c62` | старый раннер в сессии `Asia/Jerusalem`: 10:00Z → 07:00Z, all-day → 21:00Z предыдущего дня; контроль в UTC верен | DATE+TIME-раскладка отклонена dry/adopt×3/apply/fresh в не-UTC сессии, строки и объекты не изменились | не требуется (Medium) | READY_FOR_CHECK |
| FM02 Low, усл. | `eb24c62` | SQLite-путь: запись журнала потеряна → «resume» повторяет бэкфилл, email-провайдеров 2 → 4 | SQLite-пути нет (не-PG цели → `CONFIG_INVALID`); `001` не исполняемый шаг и на PG не парсится (`42601`) | не требуется (Low) | READY_FOR_CHECK |

## Что сделано

- `dd886ea` (код предыдущего агента, без изменений): каноничный PostgreSQL
  bootstrap, мигратор с одной транзакцией на вызов, `native_schema_history`,
  профили adopt, отказ от `--baseline`, dry в `READ ONLY`.
- `a68a433`: исключение сканера для одноразового пароля контейнера в черновике.
- `f4a7eeb`: HTTP-контракты каноничной схемы расширены — профиль (CHECK
  week_start), приглашение, RSVP, планировщик, правка репетиции с сохранением
  ответов, статистика админки, удаление участника, аккаунта и репетиции (каскады).
- `eb24c62`: регрессы FM01/FM02; README у исторических файлов, раздел в
  [server-migrations.md](../rehearsal-calendar-native/docs/server-migrations.md),
  строка в CLAUDE.md.

## Нестандартное

**WIP проверен, не переписан.** Прочитаны core/history/artifacts/sql/cli,
инспектор, манифест и bootstrap; дефектов, требующих правки кода, не найдено.
Тесты агента проверяют то, что заявляют (реальные триггеры-отказы, `READ ONLY`,
advisory lock). Недостаток был в покрытии приложения на каноничной схеме — закрыт
`f4a7eeb`. Мутации бьют именно по механизмам из `dd886ea`.

**FM01/FM02 закрыты отказом, а не переходами из черновика.** Черновик агента
(`audit/drafts/R2-legacy/`) предлагает явные legacy-профили с сохранением исходных
колонок. Базы в DATE+TIME-раскладке нигде не известно: production
конвертирован вручную, fresh ставится из каноничного снимка, а выбрать профиль
черновик сам предлагает только по данным production. Поэтому исторические файлы
оставлены байт-в-байт (план R2: не переписывать применённые миграции), ни один
не исполним, legacy-раскладка отклоняется всеми режимами. Понадобится
конвертация — черновик станет отправной точкой. Инвариант «один email на
пользователя» — это A04/R3.

**Что не доказано:** каталог, версия и TLS production; адаптация production
профилем `domain13` (при первом контакте вероятны расхождения — это отказ, не
порча); только PostgreSQL 15.13 — вывод `pg_get_expr` другой мажорной версии не
сверялся; исторические данные production (FM01/FM02).

## Карточки владельцу

**OPS-R2-DATA** — FM01/FM02, только чтение, только счётчики, одна строка ответа.

24.09 первый вариант карточки дал `old_all_day = 0` при отсечке `2025-12-11`:
свидетелей нет. Отсечка была узкой: 2025-12-10 — дата написания SQL, а история
git начинается 2026-01-16 и уже содержит конвертацию, новый код и drop-old.
Применить её могли в любой день до этого. Уточнённый запрос:

```sql
SELECT
  (SELECT count(*) FROM native_rehearsals
     WHERE created_at < '2026-01-17' OR created_at IS NULL) AS rehearsals_old,
  (SELECT count(*) FROM native_user_availability
     WHERE created_at < '2026-01-17' OR created_at IS NULL) AS availability_old,
  (SELECT count(*) FROM native_user_availability
     WHERE is_all_day AND (starts_at AT TIME ZONE 'UTC')::time <> '00:00') AS all_day_off_utc_midnight,
  (SELECT count(*) FROM (SELECT user_id FROM native_auth_providers
     WHERE provider_type = 'email' GROUP BY user_id HAVING count(*) > 1) d) AS users_with_duplicate_email_provider;
```

- Первые три — 0: ни одна строка, прошедшая конвертацию, не дожила, и ни одна
  all-day строка сейчас не сдвинута. FM01 VERIFIED.
- `all_day_off_utc_midnight > 0`: сдвинутые all-day строки есть (FM01 или
  клиентская ошибка) — нужен отдельный проверяемый шаг данных.
- Старые строки есть, сдвинутых all-day нет: сдвиг timed-строк по данным не
  установить. Это прошлые записи (до 2026-01-17), решает владелец.
- `users_with_duplicate_email_provider = 0` — FM02 VERIFIED; иначе дедупликация
  в A04/R3.

Ничего не исправлять прибавлением часов или удалением «лишних» строк.

**OPS-R2-ADOPT** — до деплоя сервера, которому нужны 007/008 (B03/B04): с
разрешения владельца выполнить `npm run migrate -- --dry` против production
(read-only, в выводе только коды и имена объектов) и по результату решить,
подходит ли `rehearsly-pg-domain13-v1` или нужен новый именованный профиль.

## Доказательства

[before-after.mjs](evidence/R2/before-after.mjs) → [before-after.txt](evidence/R2/before-after.txt)
(59/59), [mutations.mjs](evidence/R2/mutations.mjs) → [mutations.txt](evidence/R2/mutations.txt)
(контроль + 5 мутаций), [postgres-security.txt](evidence/R2/postgres-security.txt)
(CI-набор: controls, A02, B03, B04, H04, IS02, R2_ADAPTER, R2_STARTUP, F05,
R2_SCHEMA, R2_MIGRATIONS), [check-final.txt](evidence/R2/check-final.txt)
(`npm run check` с `--silent`: секреты, типы, Jest 88/1270, браузерные 7+18+11,
stored 6). Все exit 0. Команды и хеши — [manifest.json](evidence/R2/manifest.json).
Старый инструмент запускался из временных корней без `.env`; `server/.env` не читался.

Следующий пакет — R3.

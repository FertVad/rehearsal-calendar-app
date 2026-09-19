# R2 — PostgreSQL runtime и affected rows (F03/F05)

Дата: 19 сентября 2026. Ветка `codex/systematic-repair`.
**F03 и F05 VERIFIED локально**; весь R2 остаётся IN_PROGRESS.
База `66246511b33062912679c9c3ea9289e1ccc05a51`.
Runtime source `986acbd0cc72435b36a0f0c9e89396944606252b`.
Финальный проверенный source, включая исправление browser cleanup:
`573608cd47c24a605ccae00be0161545619caae7`, tree
`a0b9b38b6dff5db2b37bf40e08522e939b2f1dfd`.
Отчёт/evidence фиксируются отдельным docs commit.

## F03 — явный runtime и отказ БД

Вадим согласовал PostgreSQL как единственную серверную БД. SQLite остаётся
изолированным тестовым движком. `db.js` больше не читает `.env`, не создаёт
файл SQLite и не публикует fallback после ошибки PostgreSQL. URL проверяется
до подключения; кандидат pool становится рабочим только после настоящего
`SELECT 1`. Одновременная инициализация использует один кандидат, неудачный
кандидат закрывается; явная повторная инициализация допустима.

Настройки сервера поступают из process environment либо явно выбранного
абсолютного `SERVER_ENV_FILE`. Внешние переменные имеют приоритет. Неверный
выбранный файл — ошибка, а не повод читать другой `.env`. Security configuration
по-прежнему проверяется до создания приложения.

Entrypoint экспортирует Express app; listener открывается только при прямом
standalone запуске вне Vercel. Публичные страницы, assets и `/api/health`
не инициируют БД. Первый DB-запрос запускает одну общую попытку инициализации;
при отказе DB API отвечает generic503/no-store, публичная часть продолжает
работать. Отказ этой попытки запоминается до перезапуска или явного восстановления
adapter; автоматического retry по трафику и polling нет.
`/api/ready` выполняет живой ограниченный probe, поэтому его нельзя опрашивать
в production по расписанию. `req.db` читает текущий adapter после lazy init.

Pool ограничен 10 соединениями и 100 ожидающими запросами; получение connection
и startup/readiness probe имеют каждый свою границу 2 секунды. Их сумма
не является единым двухсекундным HTTP deadline. Это не общий deadline
для всех бизнес-SQL. Закрытие запрещает новые операции, дожидается уже выданных
leases и очереди, сохраняет PostgreSQL dialect для завершающихся транзакций.
Зависший пользовательский JS callback не отменяется автоматически.

Transaction использует один client и отдельный scoped `tx`; после callback
handle недействителен. Ошибка SQL, проглоченная внутри callback, не превращает
ответ PostgreSQL `ROLLBACK` на COMMIT в успех. Неудачный rollback/сломанный
client отбрасывается. Добавлено наблюдение connection errors, включая разрыв
между выдачей lease и установкой обработчика операции.

Гарантия доступности публичных страниц относится к отказу БД при валидной
security configuration. После успешной инициализации обычные ошибки SQL/схемы
проходят через существующие route handlers; не все они превращены в503.
Исправление entrypoint проверено на его точной временной копии, а не на Vercel.

## F05 — результат операции соответствует БД

Обычный `run` и `tx.run` возвращают PostgreSQL `rowCount` как `changes`,
сохраняя `lastInsertId`. Реальные INSERT/UPDATE/DELETE и конфликт без записи
проверяют 0/1/N; независимый SELECT подтверждает конечное состояние.

Четыре существующих HTTP-потребителя проверены на настоящем PostgreSQL:
batch update, batch delete, delete all imported и unlink provider. Ответы
содержат правильные counts, повторное удаление даёт0, отсутствующий provider —
404 без записи. Manual availability и данные другого пользователя не меняются.
Последний способ входа по-прежнему защищён существующим guard; конкурентный
unlink и общий identity registry относятся к R3 и здесь не закрыты.

## Доказательства

| Проверка | Фактический результат |
|---|---|
| Старый adapter, byte-identical baseline | 3 ожидаемых FAIL: потерянные ordinary/tx counts и созданный SQLite fallback; exit1 |
| Старый copied entrypoint, owned protocol refusal | 3 ожидаемых FAIL; exit1; это транспортная failure fixture, не healthy PG |
| Новый copied entrypoint | 11/11 Jest PASS: public/API failure, import/listener, explicit env, redaction/boundaries/cleanup |
| Реальный adapter PostgreSQL | 14 контрактов PASS: init/retry/timeout, row counts, rollback, разрывы, очередь, drain/close |
| Healthy copied entrypoint PostgreSQL | PASS: public requests до DB connection, readiness probe, password login, JWT TTL и authenticated profile |
| F05 через HTTP и PostgreSQL | PASS: 0/1/N и независимые сохранённые строки |
| Полный `npm run check` на573608c | exit0: scanner33, TypeScript, 88 suites/1270 Jest, dashboard4+cleanup3, admin errors18, invite11, persisted6 |
| Полный disposable PostgreSQL на573608c | exit0: controls/A02/B03/B04/H04/IS02/R2_ADAPTER/R2_STARTUP/F05; F01/B02/D01 остаются known defects |
| Production/Vercel smoke и production schema/ledger | NOT_RUN |

[Команды](evidence/R2-foundation/commands.txt),
[полный check](evidence/R2-foundation/check-final.txt),
[PostgreSQL](evidence/R2-foundation/postgres-final.txt),
[runtime](evidence/R2-foundation/runtime.json),
[независимый review](evidence/R2-foundation/independent-review.txt),
[manifest](evidence/R2-foundation/manifest.json).
Browser cleanup имеет [отдельный отчёт](REMEDIATION_IS02_CI_FOLLOWUP.md).

Actual in-flight timeout проверяется отправленным `SELECT 1`, наблюдением
`pg_stat_activity` независимым соединением и остановкой чтения принадлежащего
фикстуре сокета. Это отдельная проверка от барьера перед startup probe.
Queue test проверяет исчезновение waiters и отсутствие поздних записей.
HTTP F05 provider uniqueness — свойство fixture, не заявление о production.

## Продолжение и эксплуатационные границы

Старый мигратор и смешанный bootstrap ещё не исправлены; их запуск недопустим
как способ подготовки новой БД. Следующая работа: F01/F02 и FT01/FT02 —
canonical PostgreSQL schema, проверяемый adoption, настоящий read-only dry,
атомарный SQL+ledger и один исполнитель. FM01/FM02 потребуют отдельных
проверяемых переходов старых данных; отказ от распознавания legacy не считается
лечением этих пунктов. Старые SQL и historical manifests не переписывались.

Ни `server/.env`, ни checkout entrypoint/старый migrator не выполнялись.
Child fixtures копируют известные исходники и синтетические настройки; разрешены
только собственные loopback endpoints. Docker удалён после проверки. Production,
Vercel env, deployment и reminders не затронуты; DEV-15/OPS-IA01/OPS-IS02 открыты.
Будущий deployment smoke требует решения Вадима по
[карточкам](PRODUCTION_ACCESS.md); [оценка Neon](NEON_COST_ESTIMATE_2026-09-19.md)
не является измерением счёта аккаунта. Локальный прогон Neon не использует.

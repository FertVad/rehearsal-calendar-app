# R2 schema — implementation and focused verification

Дата: 2026-09-19. Source commit / final exact-source verification: **PENDING**.
Эта записка фиксирует работу владельца schema/checker/tests. Root отдельно
закрепляет итоговый source commit, полный regression run и общий manifest.

Свежий bootstrap теперь представляет PostgreSQL schema из 19 application
tables, с int4 database-generated IDs, TIMESTAMPTZ для instant values,
обязательным availability conflict key и пропущенными индексами/ограничениями.
В нём нет DROP существующих таблиц или исторической очистки данных. Fresh
provider metadata — TEXT; bug report created_at — TIMESTAMPTZ. Existing values
не приводятся к этим типам автоматически.

Catalog checker проверяет реальные column/default/generator semantics,
validated constraints, FK actions и enforcement, index keys/order/predicate/
operator-class/collation/NULL/immediacy/validity. Unknown restrictive objects,
incoming FK из других или retired tables, RLS, user triggers и отключённые
внутренние FK-триггеры вызывают отказ. Reserved repair-name collision также
выявляется до DDL. Gate count сверяется одним snapshot statement на группу.

Поддержаны три явно названных modern profiles. Adoption записывает проверенный
profile и сохраняет старую native_migrations как unverified evidence. Отдельный
apply создаёт отсутствующий availability key только при отсутствии дублей,
затем устанавливает отсутствующие whole groups 007/008/009. Repair не удаляет
строки. Partial groups и неизвестные legacy shapes не принимаются молча.

Manifest содержит literal hashes для каждого profile checker/descriptor и
реально выполняемого SQL. Все v1 artifact paths после подтверждённого commit
остаются immutable. Последующие версии получают новые paths; добавление
другого fresh default не должно менять проверку или план существующей lineage.

Focused PostgreSQL suite использует настоящий runMigrations с canonical
manifest и checker: fresh, explicit pre-import-key adoption, repair-first batch,
повторный apply и adoption с единственной отсутствующей группой 008. Проверены
catalog parity, сохранение пользовательских строк и старого ledger, отсутствие
ложных записей об исполнении исторических SQL. Actual missing-key INSERT с
ON CONFLICT даёт `42P10`; duplicates остаются нетронутыми и запрещают repair.

Drift controls включают wrong/partial/deferrable/NULLS NOT DISTINCT unique,
невалидный индекс после реальной ошибки CREATE INDEX CONCURRENTLY, неверные FK
actions, непроверенный CHECK, notification ordering/predicate, лишний unique,
expression index, trigger, RLS, reserved relation names и incoming FK с внешним
sentinel. Отдельный контроль отключает внутренние FK triggers: orphan INSERT
реально проходит при сохранённом convalidated, checker отказывает, transaction
целиком откатывается.

На fresh и upgraded schema выполнены настоящие HTTP register/login/profile,
project/member/rehearsal, manual/imported availability bulk, notification
inbox/read, calendar connection/mapping, bug report/admin read и push-token
upsert. Проверены два разных reminder recipient claim через SQL; scheduler
и push delivery не запускались. Instants сохраняются при non-UTC DB session.

Границы: проверен owned PostgreSQL 15.13, а не production schema/version/data.
JSONB provider metadata требует отдельного named compatible variant с proof;
исторические date/time conversions, retained source fields, старые reminders
и OAuth backfill относятся к последующим FM01/FM02 transition packages. Этот
modern пакет не объявляет весь R2 или production adoption завершёнными.

Логи: [35 checks до последнего review](focused-schema-before-trigger-review.txt),
[окончательный focused run](focused-schema-after.txt),
[точные команды и исходный F01 evidence](commands-schema.md).
Никакого production доступа, загрузки checkout `.env`, запуска current
`server.js`, включения напоминаний или самостоятельного commit не было.

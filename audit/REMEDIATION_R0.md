# R0 — исходное состояние и фундамент проверок

17 сентября 2026. Ветка `codex/systematic-repair`, база `0f655e2`; проверки
выполнены на рабочем дереве до коммита, без развёртывания. Манифест ниже сохраняет
именно этот снимок проверки. **R0 COMPLETE в оговорённом объёме подготовки.**
H01 был выполнен преждевременно; после замечания пользователя работа вернулась
к R0. Другие findings здесь не исправлялись.

Снимок R0 впоследствии зафиксирован в `be18763`. После него выполнено
[дополнение H01](REMEDIATION_H01_FOLLOWUP.md) на commit `c43a0df`: оно меняет
test scripts и порядок admin/static middleware. Манифест R0 остаётся историческим
baseline и не заявляет совпадение с последующими версиями этих файлов.

18 сентября [A02 исправлен отдельным этапом](REMEDIATION_A02.md), commit `7e1eefa`.
Его PG probe теперь требует безопасного ответа и восстановления вместо crash.
Результаты исходного воспроизведения ниже остаются историческими; B02/D01/F01
по-прежнему не исправлены.

## Критерии этапа

| Критерий R0 | Результат |
|---|---|
| Сверить аудит, текущую ветку и diff | База `0f655e2`; H01 учтён отдельно, mobile source не менялся. |
| Карта окружений и безопасный baseline | Локальный checkout, изолированные SQLite/PG fixtures и синтетические accounts; реальные staging/production/device не использовались. |
| Реальные PostgreSQL и HTTP handlers | PostgreSQL **15.13**, отдельный новый Docker container, tmpfs, random credentials, только loopback. Реальные `createApp`, auth/routes/services и `database/db.js`. |
| Отделить приложение от запуска | `app.js:createApp()` не загружает `.env`, не init DB и не listen. Startup остался в `server.js`. Целевой import/create test PASS. |
| Воспроизводимые seed/schema/version | `__tests__/postgres/fixture.sql`: owner 1, member 2, outsider 3, project 1. PG types без SQL-перевода. Версия, image ID и hashes сохранены. |
| Отказ, rollback, права | A02/B02/D01 воспроизведены реальными запросами/SQL. Успешные controls и настоящая adapter transaction проверены отдельно. |
| Первичная инвентаризация | Два Knip JSON-прохода, ручная классификация entrypoints/deps/aliases и UI-дублей; удаления не выполнялись. |
| Подготовка следующего пакета и tx API | Контракты R1/R2 зафиксированы ниже. Доменные/product решения отложены до зависимых этапов, без преждевременной реализации. |

## Проверки и найденное состояние

| Проверка | Результат |
|---|---|
| Backend исходный | 30 suites / 338 tests PASS до H01. |
| Backend после H01 | 31 suites / 344 tests PASS. |
| Backend после выделения createApp | **32 suites / 345 tests PASS**, exit 0. |
| Frontend baseline | **37 suites / 518 tests PASS**, exit 0. |
| Type-check | PASS ранее в этой ветке; TypeScript source не менялся. |
| Lint | **0 errors / 322 warnings**, exit 0. Старые warnings не исправлялись и не подавлялись. |
| Import/createApp | Не было `.env` loading, DB init, socket connect или listen. |
| PG normal controls | Project + owner создаются; member получает 403 без записи; разрешённый roster создаёт busy row и inbox; rollback даёт 0 строк, commit — 1 при чтении другой connection. |
| A02, действующая ошибка | После реального DB error `42P01` в auth строгий worker завершается с exit 1 вместо контролируемого HTTP 5xx. |
| B02, действующая ошибка | Триггер отклоняет второй write: HTTP 500, но **1 project row без owner** остаётся. |
| D01, действующая ошибка | Чужой participant ID получает HTTP 201, **1 invitation и 1 busy row**, хотя membership нет. |
| F01, действующая ошибка | Исходный bootstrap на настоящем PG падает с `42601` на `AUTOINCREMENT`; transaction откатывается. |
| Cleanup | Одноразовый контейнер удалён; последующий список контейнеров с label `rehearsly.r0` пуст. |

**PASS диагностического runner означает корректное воспроизведение дефектов,
а не успешное лечение A02/B02/D01/F01.** Их статусы остаются TODO. В следующих
этапах regression должен требовать правильный результат и сначала падать на
нынешнем коде; assertions на дефектное состояние нельзя оставить release gate.

## Окружение и ограничения

| Среда | Что известно / что разрешено |
|---|---|
| Local checkout | `/Users/vadimfertik/Desktop/reh_app`, Node 20.19.2. `.env` не считается тестовым и тестами не загружается. |
| Jest fixtures | Моки + SQLite `:memory:`; их успех не доказывает PG semantics. |
| R0 PostgreSQL | Docker Desktop 28.0.4, PostgreSQL 15.13; image `sha256:b8e11f8a8b383e19589a086a78b10f9ca69a39d6c9dcdd9342a8697544e8b3a0`. Port временный, указан в логе, после cleanup недействителен. |
| Schema | Native PG diagnostic subset + отдельный запуск исходного bootstrap для F01. Это **не** подтверждение полного fresh install/upgrade; F01/F02 остаются R2. |
| Staging | Адрес/доступ/схема не подтверждены; никаких запросов. Проверяется перед будущим deployment smoke. |
| Production | Версия PG/схема/runtime не проверялись, данные не читались/не менялись. Нельзя переносить выводы fixture на существующую БД. |
| Живое устройство | Тестовая сборка и native permissions не проверены; DEV-карточки остаются NOT_RUN. Для R0 серверного стенда устройство не требуется. |

Для R0 был запущен установленный Docker Desktop. Сам daemon не останавливался,
чтобы не затронуть другие локальные задачи; тестовый PostgreSQL удалён. Образ
уже был локально: tag-inspect сначала дал `No such image`, разрешение через
найденный image ID сработало. Эта ошибка подготовки сохранена отдельно.
В workers запрещены любые socket connections, кроме выделенных localhost DB/HTTP
портов; число попыток внешних соединений в контролях — 0.

Из-за отсутствия shutdown API у текущего DB module каждый probe использует
отдельный процесс. Его завершение закрывает pool. Это ограничение текущего
адаптера, а не добавленный production `process.exit`. Возможный SQLite fallback
не может записать в repository: worker cwd — новая пустая временная папка,
успех требует `isPostgres === true`. Сам fallback исправляется в R2.

## Решения для следующих шагов

Техническая основа: PostgreSQL — целевой engine серверных проверок. Поддержка
SQLite пока не отменяется; её runtime-контракт решается отдельно в R2.
Источники пользовательских данных, public API и существующие JWT/RSVP смыслы
не менялись. Этот этап не требует решения владельца продукта о новых функциях.

**R1:** следующим отдельным лечением остаётся A02. Все async failures должны
попадать в общий error handler, завершать запрос и оставлять процесс живым.
Сначала desired-behavior regression для DB rejection и неверного admin password
body, затем общий механизм и проверка остальных handlers. Нормальный login,
401/403 и валидные mutations должны сохраниться. H01 уже имеет отдельную приёмку;
H02/H04/B03/B04/IA01/ID01/IS01/IS02 продолжают собственные критерии.

**R2 — проект transaction API:** `db.transaction(async tx => …)` выделяет одну
connection; все helpers операции принимают тот же `tx` с `get/all/run`. Запрещён
общий `db.*` внутри такой операции и частичный commit. `run` должен отдавать
явный affected-row count и отдельный inserted ID; это ещё не реализовано.
Connection освобождается в finally; успешный commit предшествует внешней доставке.
Нужны fail-closed initialization, close/dispose, rollback + connection reuse,
fresh/upgrade schema parity, отсутствие записей в dry-run и tests на двух
соединениях. Контроль текущей transaction уже работает на реальном PG, но
F05/FT02 и атомарность бизнес-операций этим не закрываются.

Email recovery/legacy conflicts, DST policy, открытая самозапись, Android channel
и полноценная offline queue требуют отдельных решений перед R3/R4/R6/R8.
Их нельзя молча менять в подготовительном этапе; они не блокируют A02 и R0.

## Доказательства и повторение

- [PG probes и версии](evidence/R0/postgres-probes.txt), [инструкция и границы runner](../rehearsal-calendar-native/server/__tests__/postgres/README.md).
- [Backend после app factory](evidence/R0/backend-after-app-factory.txt), [frontend/lint](notes-r0-frontend-baseline.md).
- [Инвентаризация и решения по кандидатам](notes-r0-cleanup-inventory.md).
- [Ошибка поиска image по tag](evidence/R0/postgres-image-lookup-failure.txt).
- [Манифест проверенного рабочего дерева](evidence/R0/manifest.json).

Изменение `server.js` здесь — выделение factory; старые маршруты, invite HTML,
limiter/CORS/error policy перенесены без лечения соседних findings. Invite route
сверен с исходным после нормализации отступов; остальные маршруты проверены
backend suite и настоящим HTTP app на PG. Push/почта/OAuth во внешние сервисы
не отправлялись. Следующее лечение начинается отдельным пунктом после этого отчёта.

# F — миграционный runner, seed и тестовый адаптер

Статический аудит 2026-09-08, основа HEAD `8de99ab`; исходники и данные не изменялись, команды проекта не запускались. Все file refs ниже от `rehearsal-calendar-native/`.

## Покрытие

Полностью прочитаны `server/scripts/migrate.js` (182 строки), `server/scripts/seed-demo.mjs` (322), `server/__tests__/database/transaction.test.js` (95), `server/__tests__/integration/setup.js` (356), `server/__tests__/setup.js` (12), `server/package.json` (43). Из root package.json прочитаны только relevant script entrypoints через поиск. Никакие миграции/seed/test не исполнялись; actual DB не открывалась. Production db adapter и schema проверяются основным аудитором F; 23 SQL миграции — другим аудитором F.

Прочитан текущий чужой рабочий diff `server/__tests__/integration/setup.js`: единственное изменение к HEAD добавляет native_auth_providers (`:167-178`) с provider_user_id NOT NULL и UNIQUE(provider_type,provider_user_id). Файл только читался. Остальные появившиеся mailer/mailTokens файлы в этот участок не входят и не читались.

## FT01 — Low — режим --dry делает записи в БД; с --baseline вообще меняет историю миграций

Категория: служебный режим / расхождение с обещанием.

Цитата `server/scripts/migrate.js:7`: `npm run migrate -- --dry   list what would be applied, change nothing`. Фактически `:109-112` сначала connect и engine.applied. PostgreSQL applied `:71-76` делает `CREATE TABLE IF NOT EXISTS native_migrations`; SQLite connect `:89` открывает/создаёт `database/data.sqlite`, а applied `:94-99` также делает CREATE TABLE. Проверка dryRun появляется только `:149-153`.

Сценарий: оператор запускает --dry на ещё не инициализированной БД, ожидая read-only просмотр. Появляется таблица ledger, а SQLite может создать файл БД. Если передать одновременно --dry --baseline, ветка baseline `:115-124` выполняется раньше и записывает все pending filenames в ledger, хотя SQL не применялись. Это может скрыть настоящие pending изменения при последующем запуске. Обычный --dry на уже существующем ledger не применяет SQL — не преувеличивать scope.

Минимум: отклонять несовместимые --dry/--baseline, реализовать read-only чтение ledger с отсутствующей таблицей как пустым набором, не открывать SQLite с create в dry. Плюс — маленький предсказуемый fix; минус — отдельный read-only код подключения. Правильно: сначала строить чистый migration plan, отдельно применять baseline/apply с явным режимом и транзакцией. Плюс — все операции reviewable; минус — рефактор runner. Effort: 2–4 часа / 1 день.

## FT02 — Medium — SQL миграции и её запись в журнал не атомарны

Категория: целостность schema/history / recovery.

`server/scripts/migrate.js:155-160`: `await engine.exec(sql); await engine.record(file);` — отдельные операции. SQLite exec `:92` вызывает обычный db.exec без BEGIN/ROLLBACK; PG exec `:69` и record `:80-83` используют независимые pool.query. В runner нет transaction wrapper. При failure сообщение `:165-167` обещает, что повторный запуск продолжится с этого же файла, поскольку он не recorded, но не откатывает уже выполненные эффекты.

Сценарий A: SQL успешно применился, а запись filename не удалась (обрыв подключения, остановка процесса между двумя await). Файл останется pending и применится повторно, что ломает неидемпотентные ALTER/перезапись данных. Сценарий B для SQLite: первая команда файла успешна, следующая падает, ранее выполненные команды остаются; повтор на том же файле снова падает на уже добавленном объекте. Для PostgreSQL нельзя обобщать B на каждый файл: один multi-statement pool.query без внутренних COMMIT может быть атомарен на уровне server implicit transaction, однако разрыв SQL↔ledger A остаётся в любом случае.

SQL-аудитор подтвердил, что сами 23 скрипта не содержат общей BEGIN и есть неидемпотентные ADD CONSTRAINT/преобразования (точные file refs добавляются после сверки). Это усиливает проблему неполного recovery, а не объявляет любой migration rerun разрушающим.

Минимум: привязанный к одному connection transaction объединяет SQL файла и INSERT ledger; для SQLite BEGIN/COMMIT вокруг обоих, rollback по любому failure. Плюс — сохраняет существующий формат; минус — нужно явно выделить DDL, который не допускается в transaction, если такой появится. Правильно: transactional migration runner с immutable checksum, advisory lock/единственным исполнителем и отдельными documented nontransactional steps. Плюс — защищает history, параллельный старт и редактирование применённого файла; минус — более широкая реализация. Effort: 0.5–1 день / 1–2 дня.

## Что тесты фактически проверяют

`server/__tests__/database/transaction.test.js:20-26` получает db от setupIntegrationDb, а не импортирует production `server/database/db.js`. `setup.js:245-280` создаёт отдельный mockDb, и его transaction `:265-278` реализован собственными BEGIN/COMMIT/ROLLBACK на единственном in-memory SQLite connection. Поэтому шесть тестов transaction.test действительно проверяют commit, rollback, return/error propagation этого тестового helper и форму контракта callback, но не реальное удержание pg pool client, release на ошибках, isolation от соседнего request и не реализацию production SQLite wrapper. Комментарий `transaction.test.js:16-18` честно говорит об SQLite; вводить читателя отчёта в заблуждение названием «db.transaction tests passed» нельзя, тем более тесты сейчас не запускались.

`setupIntegrationDb` создаёт упрощённую независимую схему `:23-193`, не читает production schema/migrations. `toSqlite` `:210-218` намеренно удаляет AT TIME ZONE, а `:229-232` снимает casts и заменяет NOW. Тесты на этом helper не способны подтвердить PostgreSQL timezone boundaries, фактический upgrade path, отдельные types/check constraints. Schema parity/PG behavior — отдельные необходимые проверки, а не автоматическое следствие integration suite.

`server/__tests__/setup.js` задаёт тестовый JWT_SECRET и NODE_ENV=test; `server/package.json:10-13` имеет отдельный explicit migrate entrypoint и jest scripts, без автоматического запуска migrate из start. Jest testMatch охватывает `__tests__/**/*.test.js`; общий environment setup wiring не проверялся вне выбранных entrypoints, поэтому наличие файла setup.js само по себе не объявляется доказательством запуска его на каждом тесте.

Это пробелы тестовых гарантий, без самостоятельного finding о production транзакциях: конкретные проблемы адаптера записывает основной аудитор F.

## Стыки, ожидающие ответа основного аудитора/SQL-аудитора

- Fresh DB guidance `migrate.js:127-137`: сначала `database/init-native-schema.sql`, затем `--baseline`, который помечает все текущие SQL как выполненные, не применяя их (`:121`). Основной аудитор подтвердил, что base schema не включает additions 005/003; ложный baseline входит в его F02, mixed syntax base — в F01, здесь не дублируется. SQL order/dialect: только suffix -postgres/-sqlite фильтруется (`:49-55`), unsuffixed SQL идут на обоих движках в лексикографическом порядке. Конкретные несовместимости/порядок записывает SQL-аудитор.
- `seed-demo.mjs:102-104` INSERT native_auth_providers не передаёт provider_user_id. Текущая изменённая test schema `integration/setup.js:172` требует NOT NULL, но основной аудитор подтвердил: production base schema `init-native-schema.sql:66` и migration001 разрешают NULL для email providers. Поэтому подозрение на невозможность fresh seed именно из-за этого поля исключено; подтверждено расхождение test fixture с production nullable semantics, которое должно учитываться при тестировании email-provider flow.
- Seed destructive cleanup `:50-76` и дальнейшие INSERT не объединены в transaction; после сбоя возможно частично подготовленное demo. Удаляются проекты, владельцы которых demo-аккаунты, включая участие возможных обычных пользователей в этих проектах; обещание «ничего вне demo» (`:11-13`) требует осторожной интерпретации scope. Это служебный явный wipe, не автоматическое пользовательское действие.
- Existing demo account branch `seed-demo.mjs:85-91` не восстанавливает password_hash, тогда как окончание `:317-319` выводит фиксированный ожидаемый логин/пароль. Если demo пароль ранее изменён, сообщение «готов» не доказывает работоспособный reviewer login. Значение пароля в notes/отчёт не переносится; оно намеренно существует как демо-credential в исходнике, не объявлено production secret.
- Demo time generator `seed-demo.mjs:43-47` использует timezone машины запуска, хотя default profile/project timezone Europe/Berlin, один проект America/Los_Angeles (`:84,109,197`). Это может менять расписание скриншотов между окружениями; для correctness production business flow не обобщается.

Итог: FT01 Low, FT02 Medium; coverage выделенных файлов полный. Schema-стыки сверены с основным аудитором; bootstrap/dialect findings не дублируются. Неподтверждённые предположения о seed не превращены в findings. Проверка реальных PG транзакций и запуска миграций остаётся ручной, запусков нет.

Root сверка 9 сентября: проход завершён, все ожидавшиеся контракты получены. Fresh bootstrap и пропущенный005 index подтверждены F01/F02. production base provider_user_id:66 nullable, миграция001 тоже nullable, поэтому seed INSERT без этого поля сам по себе НЕ доказанная production ошибка; NOTNULL в новой локальной test fixture — расхождение fixtures, не переносить на production. FT02 non-replay примеры: migrations/006-per-recipient-reminder-claims.sql:30,34 ADD CONSTRAINT, add-token-version.sql ADD COLUMN без IF NOT EXISTS. Исторические зависимости/диалекты сохранены в notes-migrations.md. Demo credential drift и partial reseed остаются ограничениями служебного сценария, не самостоятельными finding IDs.

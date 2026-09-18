# R0 — безопасность backend baseline и результат

**Обновление root:** этот документ сохраняет первоначальный baseline. Затем
выполнены frontend/lint, выделен createApp и запущен настоящий PostgreSQL harness:
[итог R0](REMEDIATION_R0.md). Отметки PostgreSQL NOT_RUN и план ниже относятся
к моменту исходного baseline, не к текущему состоянию R0.

Дата: 2026-09-17. Ветка лечения — `codex/systematic-repair` от аудированного `0f655e2` (ветка сообщена координатором). Эта подзадача не меняла исходники и не выполняла миграции, установку зависимостей, запуск production server или подключения к production. После статической проверки по явному поручению повторён только существующий backend Jest baseline: итог предыдущей сессии был потерян, поэтому она не считается доказательством pass/fail.

## Выполненный запуск

Рабочий каталог: `/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server`.

```sh
env -i PATH=/usr/bin:/bin TZ=UTC NODE_ENV=test JWT_SECRET=r0-local-test-only DATABASE_URL= POSTGRES_URL= RESEND_API_KEY= /Users/vadimfertik/.nvm/versions/node/v20.19.2/bin/node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config ../jest.config.js --selectProjects backend --runInBand --no-cache > /tmp/reh-h01-backend-baseline.log 2>&1
```

**Результат: exit 0; 30/30 suites, 338/338 tests passed; snapshots 0; Jest time 3.49 s.** Полный stdout/stderr сохранён в [reh-h01-backend-baseline.log](/tmp/reh-h01-backend-baseline.log). Это временный локальный лог, его нельзя считать долговременным CI-артефактом. В логе есть ожидаемые сообщения негативных сценариев (`Expo is down` из mock rejection, неверный OAuth issuer) и предупреждение Node о VM Modules; они не сопровождались падением тестов. Секреты production не передавались: окружение очищено, JWT secret синтетический, DB URLs и mail key пусты.

Запуск получил инструментальное разрешение `require_escalated`, необходимое для временных сокетов Supertest. Сам по себе `env -i` не является сетевым firewall: безопасность текущего запуска опирается также на проверенные импорты и mocks ниже. Это разрешение нельзя распространять на произвольно добавленные тесты без повторной проверки их внешних эффектов.

Typecheck и отдельный предыдущий запуск `htmlEscaping` по поручению повторно не выполнялись. Существующий `htmlEscaping` естественно входит в полный backend baseline. Новые browser tests H01 и изменения admin-страницы другого исполнителя этой подзадачей не редактировались и не проверялись.

## Почему существующие suites пригодны для этого локального запуска

- [jest.config.js](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/jest.config.js:45) содержит отдельный `backend` project с Node environment и `transform: {}`. Команда выбирает только его; frontend suites не запускаются. Ни здесь, ни в `server/package.json` не подключён `server/__tests__/setup.js`; поэтому тестовый `JWT_SECRET` и `NODE_ENV` заданы явно до импортов.
- Тесты не импортируют `server.js` или `config/env.js` и не вызывают настоящий `initDatabase()`. Нельзя заменять их входом через [server.js](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:1): он загружает `server/.env`, вызывает `initDatabase()` на верхнем уровне и запускает listener. Содержимое `.env` для этой проверки не читалось.
- [integration/setup.js](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/__tests__/integration/setup.js:18) создаёт `new Database(':memory:')`. Route suites регистрируют `jest.unstable_mockModule('../../database/db.js', ...)` до динамических импортов middleware/routers. Последующие DELETE и INSERT действуют на эту тестовую БД. Закрытие выполняется через `closeIntegrationDb()`.
- Отдельные unit suites заменяют БД функциями `jest.fn()`. `googleAudience.test.js` подменяет `google-auth-library` до импорта OAuth wrapper; реальный Google token/JWKS запрос не вызывается. Apple wrapper импортируется транзитивно, но Apple verification эти тесты не вызывают. `mailTokens.test.js` проверяет подписи синтетических JWT и не отправляет письма.
- Route suites с мутациями и notifications подменяют `pushNotificationService`; `reminderScheduler.integration.test.js` подменяет обе notify-функции. В `pushTokenOwnership` настоящий Expo используется для локальной проверки формата токена, отправки push в этом router нет. В `projectsInviteCode` настоящий push module импортируется через projects router, но все четыре сценария выполняют только GET списка и не вызывают отправку. Добавление mutation-сценария в этот suite потребует явного mock транспорта.
- `authLogin` и `accountDeletionCleanup` импортируют настоящий auth router после mock БД/push. Их текущие сценарии вызывают password login/unlink/account deletion, не OAuth provider verification. Внешняя почта ими не вызывается; `RESEND_API_KEY` дополнительно пуст.
- Supertest обслуживает отдельные Express apps из routers, а не приложение на production порту. В установленном `supertest/lib/test.js:63,69` он использует `app.listen(0)` и URL `127.0.0.1`. Это временный socket, но host для listener не задан: не следует утверждать, что bind ограничен loopback. При дальнейшем выделении harness можно явно привязать listener к loopback.
- Старый `__tests__/utils/testHelpers.js` способен создавать дисковый `__tests__/test.sqlite`, однако ни один текущий `.test.js` его не импортирует. Его наличие не доказывает использование дисковой БД в baseline.

Статически проверены конфигурация, setup/helper, импорты всех 30 suites, mock ordering, внешние вызовы и соответствующие границы production modules. Полностью повторно перечитаны не все тела старых assertions; задача была проверить безопасность запуска, а не повторить аудит корректности каждого теста. Итоговый Jest лог фиксирует фактически выполненные 30 suites.

## Покрытие и ограничения

| Группа | Что запускалось | Что этот pass не доказывает |
| --- | --- | --- |
| Pure/unit | `htmlEscaping`, `names`, `mailTokens`, `googleAudience`, `jwtMiddleware`, `timezone` | Реальный браузерный DOM/CSP H01, provider verification, реальная доставка email, полный auth proof flow |
| Routers + mock/SQLite | `authLogin`, `accountDeletionCleanup`, `authorization`, `availabilityBulk`, `calendarMappingLookup`, `memberRemoval`, `membersAvailabilityRange`, `membershipNotifications`, `notifications`, `projectDeletionCleanup`, `projectsInviteCode`, `pushTokenOwnership`, `rehearsalById`, `rehearsalNotifications` | Настоящий PostgreSQL, concurrent transactions, transport/receipt outcome, схемы живого окружения |
| Services/SQL fixture | 9 suites из `integration` плюс `database/transaction` | SQL fixture не всегда вызывает production handler; SQLite dialect translation и hand-written schema не являются production миграциями |

**PostgreSQL — NOT RUN.** `database/transaction.test.js` проверяет transaction implementation тестового SQLite helper, не настоящий PG pool/adapter. `integration/setup.js` упрощает схему, переписывает SQL и убирает `AT TIME ZONE`; его pass не закрывает F01/F02, PG rowCount, блокировки, race cases, UTC/DST migration behavior. В `rehearsalParticipants.integration.test.js` mock transaction лишь вызывает callback — rollback/atomicity этот suite также не доказывает. Existing green tests не закрывают автоматически ни одну находку аудита.

## Минимальный путь к real PostgreSQL harness — только план, не выполнен

При read-only проверке PATH найден `/usr/local/bin/docker` (symlink в Docker.app); `psql`, `postgres`, `pg_ctl`, `initdb`, `podman` в PATH не найдены. Это не утверждение об отсутствии их на всём диске. Docker daemon, context, containers и PostgreSQL соединения не проверялись и не запускались.

1. В отдельном согласованном шаге проверить, что выбран именно локальный Docker context, и создать одноразовый локальный PG с отдельными credentials/именем БД/портом и без production mounts. Не наследовать `DATABASE_URL`, не подключать живую БД и не устанавливать/запускать PG в рамках текущего H01 baseline.
2. Добавить явный test harness для реального adapter и production routers без импорта `server.js`/dotenv. Перед подключением проверять назначение одноразовой БД; при ошибке PG запрещать SQLite fallback. Нужны явные cleanup/close handles. Bootstrap/migrations должны быть настоящими, а не SQLite schema; известные F01/F02 — отдельный обязательный шаг, а не повод скрыто подменить схему и объявить provisioning проверенным.
3. Первыми выполнить realPG contract/rollback/rowCount, bootstrap-vs-upgrade и два независимых соединения с детерминированными barriers. Подменять внешние email/OAuth/Expo transport boundaries; сохранять реальные middleware, policy, services и транзакции. Пока harness и эти проверки отсутствуют, R0 realPG gate остаётся NOT RUN.

Связанный план проверок: [notes-remediation-server.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-remediation-server.md). Этот документ не разрешает production действия и не отмечает H01 исправленным: root ведёт его отдельную реализацию и browser evidence.

# T-043 — что удалено из `rehearsal-calendar-native/server`

Инструменты: knip 5.71.0 из клиентского `node_modules`, конфиг
`knip.server.json` (здесь же; в репозиторий сервера не добавлен). Точки входа:
`server.js` и `app.js` (production; `vercel.json` строит только `server.js`),
`scripts/**` (все `npm run` сервера идут через `scripts/` или `server.js`),
`__tests__/**`. `index.js` и `api/` в сервере нет. `public/` и `migrations/` —
вне проекта. Для имён внутри модуля — ESLint проекта (`lint-unused.mjs`).
До — `before.txt`, после — `after.txt`.

## Файлы
| Что | Почему мёртвое |
|---|---|
| `utils/mailer.js` | knip: ни одного импорта. `git grep mailer` — только аудит-заметки и строка в `docs/services.md`. Почту отправляет `services/email/transport.js` (его импортируют `auth`, `emailVerification`, `passwordReset`, `emailChange`). |
| `utils/mailTokens.js` и его тест `__tests__/utils/mailTokens.test.js` | knip `--production`: файл достижим только из своего теста. `git grep mailTokens` по `server/` — только этот тест. Коды из письма делает `services/email/codes.js`; JWT-ссылки для сброса пароля и подтверждения почты ни один маршрут не выдаёт и не читает. Поведение входа и сессий не меняется — модуль не был подключён. |

## Маршруты
| Что | Доказательство |
|---|---|
| `GET /api/native/push-tokens` («debug», `routes/native/pushTokens.js`) | `git grep "push-tokens"` по `src/`, `server/public/`, `e2e/`, `.github/`, `server/scripts/`: приложение вызывает только `POST` и `DELETE` (`src/shared/services/api.ts:298,304`), e2e — `POST` (`38-switch-account-push-answer-late.yaml`), тесты и PG-сценарии — `POST`. `git log -G "get\(['\"]/native/push-tokens" -- src` пуст: ни одна версия приложения его не вызывала. В `docs/api-documentation.md` не описан. |

## Неиспользуемые импорты, локальные и экспорты — ESLint + knip + grep
- `routes/native/availability.js`: импорты `formatAvailabilitySlotsResponse`,
  `AVAILABILITY_TYPES`; в `GET /` — `const timezone = await getUserTimezone(userId)`,
  значение не читалось (лишний запрос к `native_users`; ответ не меняется).
  `getUserTimezone` остаётся — им пользуются `PUT /days`, `POST /bulk`, `DELETE /:date`.
- `utils/timezone.js`: `formatAvailabilitySlotsResponse` — единственный импорт был
  неиспользуемым выше; `git grep` по `server/` других обращений нет.

## Документация
`docs/services.md`, раздел «Resend»: ссылка вела на удалённый `mailer.js`. Теперь —
на `services/email/transport.js` и его переменные (`EMAIL_TRANSPORT`,
`RESEND_API_KEY`, `EMAIL_FROM`) и поведение без ключа (503), как в шапке transport.js.

## Оставлено намеренно
- Маршруты, которые текущее приложение не вызывает, но вызывают его прежние
  версии — их сохраняет сам репозиторий (`docs/api-documentation.md:1400,1410,1652,2162,2170`;
  коммит 16c6723 убрал вызовы из `api.ts`, маршруты оставил):
  `DELETE`/`PUT /native/availability/imported/batch`,
  `GET /native/calendar-sync/mappings/by-event/:eventType/:internalEventId`,
  `DELETE /native/calendar-sync/mappings/:id`, `POST /native/projects/:code/join`,
  алиас `/native/invite/:projectId/invite`, корневой `/api/availability`
  («backward compatibility», `app.js:142`; его проверяют `f05.mjs`, `probe.mjs`).
  Удалить их — решение владельца о поддержке старых сборок, не чистка.
- `rehearsals.js`, смонтированный и под `/projects`, и под `/rehearsals` — лишние
  пути у живых обработчиков; убрать их — разделить роутер, это рефакторинг.
- `database/migrations/*.mjs`, `database/schema/{inspect,manifest}.mjs` — knip
  `--production` их не видит, потому что их запускают `scripts/migrate.js` и
  PG-тесты. `schemaTableNames` в `inspect.mjs` не используется, но файл под хешем
  манифеста (`database/schema/README.md:96`, «immutable») — не тронут.
- `closeDatabase`, `respondToRehearsal` — пользуются только тесты (PG-адаптер,
  RSVP-сервис); тесты по задаче — точки входа.
- `authenticateToken|requireAuth` (дубль-экспорт), `err` в `jwtMiddleware.js:56` —
  авторизация, вне задачи.
- Неиспользуемые имена в тестах (13) — не код сервера.
- «Unlisted dependencies» (`@jest/globals`, `node-fetch` в тестах) — правка
  `package.json`, вне задачи.

# Участок A: серверная аутентификация

Прочитаны полностью: routes/auth.js (563 строки), middleware/jwtMiddleware.js, middleware/adminAuth.js, utils/accountLinking.js, utils/oauthVerification.js, constants/googleClients.js, utils/userSerializer.js, utils/names.js; authLogin и jwtMiddleware тесты. Серверная обвязка/rate-limit прочитана до mount routes; остальное отдельно H/I. Клиент — notes-auth-client.md.

## A01 — High — предварительный захват аккаунта через email/OAuth

Доказательства: `server/routes/auth.js:20-37` проверяет только truthiness, сразу записывает email/password и выдаёт JWT (43); подтверждения владения email нет. `server/utils/accountLinking.js:74-90`: `SELECT id FROM native_users WHERE email = $1` → INSERT provider в найденный аккаунт. Старый password_hash и token_version не меняются.

Ключевое условие auto-link, `server/utils/accountLinking.js:74–80`:

```js
  if (email && emailVerified) {
    const existingUser = await db.get(
      'SELECT id FROM native_users WHERE email = $1',
      [email]
    );

    if (existingUser) {
```

Сессия выдаётся сразу после INSERT, `server/routes/auth.js:42–43`:

```js
    // New users start with token_version = 1 (DB default)
    const { accessToken, refreshToken } = generateTokens(userId, 1);
```

Сценарий: злоумышленник первым регистрирует чужой email со своим паролем; владелец адреса позже входит Google/Apple с verified email; оба оказываются одним пользователем. Атакующий продолжает входить своим паролем и имеет ранее выданную сессию. Доступ к проектам и личной доступности жертвы после её начала работы. Не требует подделки OAuth.

Минимум: запретить авто-link в неподтверждённый password-аккаунт и не выдавать ему рабочую сессию до подтверждения (1–2 дня, понадобится flow подтверждения). Правильно: подтверждение email + linking из уже аутентифицированной сессии с повторной проверкой способов входа, отзыв старых сессий при разрешении коллизии (3–5 дней). Нельзя просто снять password_hash без отзыва уже выданных токенов.

Минимум: **+** закрывает именно предварительный захват неподтверждённого адреса; **−** добавляет обязательную доставку подтверждения и требует понятного восстановления для уже существующих коллизий. Правильное решение: **+** связывает методы входа только с доказанным владельцем и отзывает прежний доступ; **−** затрагивает регистрацию, linking, delivery, миграцию старых accounts и UX повторной проверки.

## A02 — High — необработанные async-исключения в auth middleware/admin login

`server/middleware/jwtMiddleware.js:58-75`: async handler делает `await db.get` без try/catch/next(err). `server/middleware/adminAuth.js:9-22`: `await bcrypt.compare(password, passwordHash)` без проверки типа и catch. Express 4 (`server/package.json:23`) не оборачивает отвергнутые promise автоматически. При сбое БД любой защищённый запрос; при ADMIN_PASSWORD_HASH запрос `{}`/нестроковый password к публичному admin login → rejected promise; ответ зависает либо процесс завершается (зависит от Node/runtime политики unhandled rejection). По коду нет глобального адаптера promises. Минимум: try/catch(next) + validate password (1–3 ч). Правильно: общий async wrapper всех middleware/handlers и error-boundary, тест отказа БД и неверного JSON (0.5–1 день). Запуск не производился.

Отвергаемая операция middleware, `server/middleware/jwtMiddleware.js:72–75`:

```js
  const user = await db.get(
    'SELECT token_version FROM native_users WHERE id = $1',
    [decoded.userId]
  );
```

Вход admin передаёт непроверенный request value в bcrypt, `server/middleware/adminAuth.js:17–22`:

```js
  const { password } = req.body;

  // Prefer bcrypt hash; fall back to plaintext for backwards compatibility
  const isValid = passwordHash
    ? await bcrypt.compare(password, passwordHash)
    : password === passwordPlain;
```

Минимум: **+** небольшой локальный фикс с гарантированным HTTP-ответом; **−** ручные catch легко пропустить в других async handlers. Правильное решение: **+** единое поведение Express 4 при rejected Promise и общие проверки отказов; **−** требуется подключить wrapper ко всем соответствующим mounts и согласовать error responses.

## A03 — Medium — backend не применяет правила пароля и профильные типы

`server/routes/auth.js:20-31`, `:301-321`, `:337-349`: регистрация принимает любой непустой пароль, PUT допускает пустую строку в bcrypt, нет ограничения bcrypt 72 bytes, firstName/timezone/locale/booleans без валидации. Обход UI прямым API создаёт слабый пароль; профиль принимает несуществующую timezone, что ломает downstream date conversion (стык проверить C/D/G). Минимум: типы, длины, allowlist locale и валидная IANA timezone, единая политика пароля для register/update (0.5–1 день). Правильно: единая входная схема и согласованные 400 + контрактные тесты (1–2 дня). Не выдавать все невалидные типы за эскалацию прав.

Регистрация проверяет только наличие, `server/routes/auth.js:20–22`:

```js
    if (!email || !password || !firstName) {
      return res.status(400).json({ error: 'Email, password and first name are required' });
    }
```

Правило PUT password, `server/routes/auth.js:318–322`:

```js
  password: {
    dbColumn: 'password_hash',
    validate: null,
    transform: async (value) => await bcrypt.hash(value, 10)
  }
```

Минимум: **+** блокирует конкретные некорректные значения до SQL/bcrypt и приводит сервер к требованиям UI; **−** остаётся ручное дублирование правил между register/update/другими входами. Правильное решение: **+** один проверяемый контракт типов и одинаковые 400 вместо downstream 500; **−** изменение правил может потребовать обработки уже сохранённых невалидных профилей и обновления клиентов.

## A04 — Medium — способы входа расходятся с реальными credentials

`server/routes/auth.js:34-43` создаёт password-аккаунт без native_auth_providers; PUT password `:318-321,369-372` тоже не синхронизирует provider. `utils/accountLinking.js:190-196` считает только строки providers. Новая email-регистрация → список providers пуст; после Google → одна строка, unlink Google запрещён несмотря на рабочий пароль. Отдельно check-then-delete `:190-203` без блокировки: два конкурентных unlink для двух OAuth providers могут пройти last-method guard. Требуется сверить отсутствие triggers в F. Минимум: учитывать password_hash и транзакционно создавать email provider, блокировать user row на unlink (0.5–1 день). Правильно: единый credential registry и инвариант последнего способа входа (1–2 дня). Авто-link по email также может вернуть только что удалённый OAuth при следующем входе; уточнить ожидаемый смысл unlink.

Guard опирается только на registry, `server/utils/accountLinking.js:190–197`:

```js
  const providers = await db.all(
    'SELECT provider_type FROM native_auth_providers WHERE user_id = $1',
    [userId]
  );

  if (providers.length <= 1) {
    throw new Error('Cannot unlink the last authentication method');
  }
```

Последующий отдельный DELETE, `server/utils/accountLinking.js:200–203`:

```js
  const result = await db.run(
    'DELETE FROM native_auth_providers WHERE user_id = $1 AND provider_type = $2',
    [userId, providerType]
  );
```

F подтвердил: backfill одноразовый, triggers нет; I delta не меняет production credential registry (см. notes-final-delta.md). Минимум: **+** восстанавливает соответствие password/registry и сериализует unlink; **−** отдельно потребуется нормализовать уже существующие аккаунты без email provider. Правильное решение: **+** инвариант последнего действующего способа входа проверяется во всех операциях; **−** затрагивает register, password updates, OAuth linking/unlinking и восстановление исторических данных.

## На проверку / стыки

- `oauthVerification.js:104-106`: APPLE_CLIENT_ID может отсутствовать; startup проверяет только JWT/CRON/admin. Проверить primary-source семантику verifyIdToken без audience в участке I; пока условный риск, не доказанный обход конкретной production-конфигурации.
- Account deletion каскады и orphaned-project выборка: проверить со схемой и удалением участников B/F.
- Refresh выдаёт новую пару, старый refresh остаётся живым 90 дней; документированный tv revoke работает. Не называть rotation уже реализованной.
- PII в logger.info accountLinking (82,118): передать в сквозной I.

Положительное: SQL-параметры, whitelist колонок PUT, проверка типа JWT и token_version, audience/issuer Google, generic login error для OAuth-only, account deletion transaction, unlink email удаляет password_hash. Не запускались никакие проверки.

Внешняя сверка A02: официальная документация Express 4 прямо подтверждает необходимость catch/next для async promise rejection: https://expressjs.com/en/4x/guide/error-handling/ (прочитано 2026-09-06). Источник Apple описывает audience как optional option: https://github.com/A-Tokyo/apple-signin-auth/blob/main/README.md ; lock фиксирует 1.7.9 (`server/package-lock.json:1823`), поэтому точный source этой версии ещё проверить I. Также полностью прочитаны accountDeletionCleanup.test.js и utils/{googleAudience,names}.test.js; устаревший вводный комментарий accountDeletionCleanup говорит о сохранении проекта с другим admin, но актуальные assertions и код требуют удаления owner-проекта.

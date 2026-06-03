# Аудит безопасности и качества

## КРИТИЧНО (исправить немедленно)

### 1. XSS через параметр `expoHost` в deep link HTML-странице
**Файл:** `server/server.js`, строки 129–229

Маршрут `GET /invite/:code` генерирует HTML, напрямую вставляя `expoHost` из query-параметра в `<script>`:
```js
${expoHost ? `const expoHost = '${expoHost}';` : 'const expoHost = null;'}
```
Запрос `GET /invite/abc?expoHost=';alert(document.cookie);//` выполнит произвольный JS.

**Риск:** Reflected XSS. Злоумышленник формирует вредоносную ссылку вида `https://yourserver.com/invite/valid_code?expoHost=...` и похищает токены пользователей.

**Исправление:** Экранировать через `JSON.stringify(expoHost)` или валидировать как `hostname:port` (whitelist формат). Добавить `Content-Security-Policy` заголовок.

---

### 2. Webhook: полный обход верификации подписи в test mode
**Файл:** `server/routes/native/subscriptions/webhook.js`, строки 34–55

Если `ALLPAY_TEST_MODE=true` (включая staging или production где забыли убрать):
- Отсутствие подписи не возвращает 400 — выполнение продолжается
- `processWebhookEvent` вызывается с фиктивной строкой `'test-mode-skip-signature'`
- В `allpayClient.js:91`: `if (receivedSignature === 'test-mode-skip-signature' && isTestMode()) { return true; }` — верификация полностью пропускается

**Риск:** Злоумышленник отправляет POST на `/api/native/subscriptions/webhook` с `status=1` и произвольным `userId/planId` → подписка создаётся без оплаты.

**Исправление:** Добавить при старте сервера: `if (process.env.NODE_ENV === 'production' && process.env.ALLPAY_TEST_MODE === 'true') { throw new Error('ALLPAY_TEST_MODE cannot be true in production!'); }`

---

### 3. Утечка деталей ошибок клиентам (information disclosure)
**Файлы:**
- `server/routes/auth.js:163–165` — `res.status(500).json({ error: '...', details: err.message, name: err.name })` — комментарий `// TEMPORARY: Return detailed error for debugging` так и остался
- `server/routes/native/subscriptions/checkout.js:123,240` — `details: error.message`
- `server/routes/native/subscriptions/index.js:86` — `details: error.message`
- `server/server.js:234` — глобальный обработчик возвращает `details: String(err)`

**Риск:** Раскрытие имён таблиц/полей БД, путей к файлам, стека трейса, версий зависимостей — помогает атакующему.

**Исправление:** В production всегда возвращать только `{ error: 'Internal server error' }`. Детали логировать на сервере через logger.

---

### 4. console.log логирует req.body с паролями в plaintext
**Файл:** `server/routes/auth.js:303`
```js
console.log('[Auth] Update user request body:', req.body)
```
Если запрос содержит `{ "password": "newpass123" }` — пароль попадает в логи в открытом виде.

**Риск:** Утечка паролей в логи (особенно если логи идут во внешний сервис).

**Исправление:** Удалить эту строку или добавить sanitization: логировать только безопасные поля (не `password`, не `token`).

---

### 5. Нет rate limiting на auth/admin endpoints → брутфорс паролей
**Файл:** `server/server.js` (глобальная конфигурация), `server/routes/auth.js`, `server/routes/admin.js`

Нет ни одного rate limiter на:
- `POST /api/auth/login` — брутфорс паролей пользователей
- `POST /api/auth/register` — спам-регистрация
- `POST /admin/api/login` — брутфорс admin-пароля

**Отягчающее обстоятельство:** Admin-пароль сравнивается в plaintext без bcrypt (`server/middleware/adminAuth.js:14`: `if (password !== pw)`), что делает брутфорс ещё проще.

**Исправление:** Добавить `express-rate-limit` (10 req/min на `/api/auth/*`, 5 попыток/15 мин на admin login). Также перейти на bcrypt для ADMIN_PASSWORD.

---

### 6. Cron endpoint открыт при отсутствии CRON_SECRET
**Файл:** `server/routes/cron.js:31`
```js
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) { ... }
```
Если `CRON_SECRET` не задан — `cronSecret` равен `undefined`, условие `cronSecret &&` ложное, авторизация пропускается полностью. Любой может вызвать `GET /api/cron/recurring-billing` и триггернуть списания.

**Риск:** Внешний злоумышленник инициирует charge для всех активных подписок.

**Исправление:** Изменить логику на fail-closed:
```js
if (!cronSecret) { return res.status(503).json({ error: 'CRON_SECRET not configured' }); }
if (authHeader !== `Bearer ${cronSecret}`) { return res.status(401).json({ error: 'Unauthorized' }); }
```

---

## ВАЖНО (исправить в ближайшем релизе)

### 7. Admin-пароль сравнивается в plaintext
**Файл:** `server/middleware/adminAuth.js:9,14`
```js
const pw = process.env.ADMIN_PASSWORD;
if (password !== pw) { ... }
```
Нет bcrypt, нет защиты от timing attacks. JWT secret строится как `admin-panel-${pw}` — знание пароля = знание JWT secret.

**Исправление:** Хранить bcrypt-хэш в `ADMIN_PASSWORD_HASH`, сравнивать через `bcrypt.compare()`.

---

### 8. Критические env-переменные не задокументированы в .env.example
Используются в коде, но отсутствуют в документации окружения:
- `CRON_SECRET` — без него cron открыт (см. пункт 6)
- `ADMIN_PASSWORD` — без него admin защита не работает
- `ALLPAY_WEBHOOK_SECRET` — без него верификация webhook пропускается
- `BASE_URL` — захардкожен в 2 файлах как fallback
- `HOST` — используется в server.js

**Риск:** При деплое на новый сервер эти переменные легко пропустить. Fail-fast при старте отсутствует.

**Исправление:** Добавить все переменные в `.env.example`. Добавить startup validation для критических секретов.

---

### 9. CORS открыт для всех источников
**Файл:** `server/server.js:52` — `app.use(cors())`

Без конфигурации разрешает запросы с любого origin. Сейчас смягчается тем что auth через JWT headers, но плохая практика.

**Исправление:** `cors({ origin: ['https://yourapp.com', 'rehearsalapp://'] })`

---

### 10. Отсутствует заголовок `helmet` (security headers)
**Файл:** `server/server.js`

Нет `helmet` middleware — не устанавливаются: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `X-XSS-Protection`, `Content-Security-Policy`.

**Исправление:** `npm install helmet && app.use(helmet())`

---

### 11. JWT с длинным сроком жизни без механизма отзыва
**Файл:** `server/middleware/jwtMiddleware.js:24–25`

Access token: 30 дней, Refresh token: 90 дней. Нет blacklist/revocation. После logout или смены пароля старые токены валидны до истечения срока.

**Исправление:** Сократить access token до 15–60 минут, добавить токен ротацию. Или хранить список отозванных токенов в БД.

---

### 12. SELECT * в нескольких запросах может случайно раскрыть чувствительные поля
**Файлы:**
- `server/routes/native/projects.js` — строки 94, 101, 133, 147
- `server/routes/native/members.js` — строки 203, 281, 337
- `server/routes/native/invites.js` — строки 55, 103, 164, 198

`SELECT *` может вернуть `invite_code`, внутренние флаги и другие поля которые не должны идти клиенту.

---

## УЛУЧШЕНИЕ (хорошие практики)

### 13. TypeScript `as any` в критических путях
- `src/shared/services/calendar/import.ts:197,214,325` — `as any` при работе с данными синхронизации
- `src/features/calendar/hooks/useAddRehearsalForm.ts:250` — `@ts-ignore` при навигации
- `src/features/calendar/screens/CalendarScreen.tsx:123,315` — `as any` и `@ts-ignore` в navigation

В import.ts строка 325: `availabilityAPI.bulkSet(chunk as any)` — если структура данных не соответствует, ошибка только в runtime.

### 14. Webhook: идемпотентность управляется данными из запроса
**Файл:** `server/services/subscriptionService.js:496`
`idempotencyKey = ${payload.order_id}-${payloadStatus}` — ключ из полей которые контролирует отправитель. Умеренный риск при специфических сценариях.

### 15. Production URL захардкожен в клиентском api.ts
**Файл:** `src/shared/services/api.ts:20` — `'https://server-fertvads-projects.vercel.app/api'`
При смене хостинга клиенты со старыми версиями приложения сломаются. Нужен `EXPO_PUBLIC_API_URL`.

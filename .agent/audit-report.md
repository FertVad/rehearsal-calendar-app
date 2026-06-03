# Полный аудит кодовой базы
_Дата: 2026-04-10 | Модель: Claude Sonnet 4.6 / Haiku 4.5_

---

## 🚨 Критично (исправить немедленно)

### 1. XSS через `expoHost` query-параметр
**Файл:** `server/server.js:199`

`expoHost` из URL вставляется напрямую в `<script>` без экранирования:
```js
const expoHost = '${expoHost}';  // ← XSS
```
Запрос `GET /invite/code?expoHost=';alert(1);//` выполняет произвольный JS у жертвы.

**Исправление:**
```js
const safeExpoHost = JSON.stringify(expoHost || null);
// В шаблоне: const expoHost = ${safeExpoHost};
```

---

### 2. Webhook bypass в test mode → создание подписок без оплаты
**Файл:** `server/routes/native/subscriptions/webhook.js:34–55`

Если `ALLPAY_TEST_MODE=true` оказывается в production (забыли убрать), верификация подписи полностью пропускается. Любой POST на `/api/native/subscriptions/webhook` создаёт подписку без оплаты.

**Исправление:** В `server.js` при старте:
```js
if (process.env.NODE_ENV === 'production' && process.env.ALLPAY_TEST_MODE === 'true') {
  throw new Error('FATAL: ALLPAY_TEST_MODE cannot be true in production!');
}
```

---

### 3. Cron endpoint открыт без CRON_SECRET → любой может триггернуть списания
**Файл:** `server/routes/cron.js:31`

```js
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) { ... }  // ← если cronSecret=undefined, авторизация пропускается!
```

**Исправление:**
```js
if (!cronSecret) return res.status(503).json({ error: 'CRON_SECRET not configured' });
if (authHeader !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });
```

---

### 4. console.log логирует пароли пользователей в plaintext
**Файл:** `server/routes/auth.js:303`

```js
console.log('[Auth] Update user request body:', req.body)
// Если req.body = { "password": "newpass123" } → пароль в логах
```

**Исправление:** Удалить эту строку. Комментарий "TEMPORARY: Return detailed error for debugging" (строка 160) тоже остался — убрать.

---

### 5. Нет rate limiting на auth/admin endpoints → брутфорс паролей
**Файл:** `server/server.js`

Нет ограничений на: `POST /api/auth/login`, `POST /api/auth/register`, `POST /admin/api/login`.
Admin-пароль сравнивается plaintext без bcrypt (`adminAuth.js:14`), что делает брутфорс trivial.

**Исправление:**
```bash
npm install express-rate-limit --save
```
```js
// server.js
import rateLimit from 'express-rate-limit';
app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 10 }));
app.use('/admin/api/login', rateLimit({ windowMs: 15 * 60_000, max: 5 }));
```

---

### 6. `getPaymentStatus` и `testConfig` вызывают несуществующие роуты
**Файл:** `src/shared/services/api.ts:410,418`

Два метода API-клиента обращаются к роутам которых нет на сервере. В production это silent errors.

**Исправление:** Удалить `subscriptionsAPI.getPaymentStatus` и `subscriptionsAPI.testConfig` из api.ts.

---

## 🗑️ Можно удалить сейчас (безопасно)

### npm-пакеты frontend (i18n):
```bash
cd rehearsal-calendar-native
npm uninstall i18next react-i18next
```
Проект использует собственный `I18nContext.tsx`. Эти пакеты нигде не импортируются. Экономия: **~1.7 MB**.

---

### Мёртвые компоненты (нет ни одного импорта в продакшн-коде):
```
src/shared/components/animations/AnimatedListItem.tsx
src/shared/components/animations/FadeInView.tsx
src/features/availability/components/calendar/CalendarLegend.tsx
src/features/availability/components/editor/PastDateWarning.tsx
src/features/calendar/components/ParticipantsModal.tsx  (только в тестах)
```

---

### Мёртвые экспорты (нигде не вызываются):
- `src/shared/utils/haptics.ts` — `hapticHeavy`, `hapticWarning`, `hapticError`, `hapticSelection`
- `src/shared/utils/availability.ts` — алиасы `toMinutes`, `toTimeString`
- `src/shared/services/googleAuth.ts` — `isGoogleAuthConfigured`, `getGoogleAuthError`
- `server/utils/timezone.js:8` — мёртвые импорты `toZonedTime`, `formatInTimeZone` из date-fns-tz

---

### Мёртвые API-методы в `src/shared/services/api.ts`:
Определены, но UI их никогда не вызывает:
- `authAPI.getAuthProviders`
- `authAPI.unlinkAuthProvider`
- `invitesAPI.getInvite`
- `invitesAPI.revokeInvite`
- `calendarSyncAPI.deleteConnection`
- `calendarSyncAPI.updateSyncTime`

> Роуты на сервере для этих методов существуют. Если функциональность планируется — задача не удалять, а подключить UI. Если нет — удалять и роуты и методы.

---

## ⚠️ Под вопросом (проверить вручную)

### allpayHostedFields.ts / allpayWebViewHandler.ts
**Файл:** `src/features/subscriptions/templates/`

Субагент не смог однозначно определить используются ли в текущем платёжном флоу. Нужно проверить в `SubscriptionScreen.tsx` — если WebView открывается через эти шаблоны, они нужны. Если checkout идёт через backend `checkout-page` роут — могут быть мертвы.

### `src/features/subscriptions/components/PaymentCard.tsx`
Используется в `SubscriptionManagement.tsx` при специфических условиях. Проверить отображается ли реально в UI.

### Роуты без frontend-вызовов (возможно запланированные фичи):
- `GET /api/auth/me/providers` + `DELETE /api/auth/me/providers/:provider` — управление провайдерами OAuth (нет UI)
- `GET /api/native/projects/:id/invite` + `DELETE` — получение/отзыв инвайта (нет UI)
- `DELETE /api/native/calendar-sync/connections/:id` — удаление связи с календарём (нет UI)
- `POST /api/native/calendar-sync/connections/:id/update-sync-time` — нет UI

Если функции не планируются в ближайшее время — роуты и API-методы лучше удалить.

---

## 📋 Технический долг (исправить постепенно)

### Высокий приоритет

| Задача | Файлы | Оценка |
|--------|-------|--------|
| Убрать ~130 console.log из продакшн-путей (заменить на logger.debug) | export.ts, CalendarSyncSettings, useAutoCalendarSync, rehearsalService.js и др. | 1–2 часа |
| Вынести SQL-запрос проверки прав в хелпер (copy-paste в 6 местах) | invites.js, members.js, projects.js | 30 мин |
| Убрать утечку деталей ошибок клиентам | auth.js:163, checkout.js:123, server.js:234 | 30 мин |
| Добавить все критические env-переменные в .env.example + startup validation | CRON_SECRET, ADMIN_PASSWORD, ALLPAY_WEBHOOK_SECRET, BASE_URL | 30 мин |
| Исправить хардкод `'Asia/Jerusalem'` → `DEFAULT_TIMEZONE` (константа уже есть!) | projects.js, members.js, rehearsalService.js | 15 мин |

### Средний приоритет

| Задача | Файлы | Оценка |
|--------|-------|--------|
| Удалить хардкод production URL → вынести в env | checkout.js:22, invites.js:23, api.ts:20 | 20 мин |
| Добавить `helmet` middleware (security headers) | server.js | 10 мин |
| Исправить CORS whitelist (сейчас открыт для всех) | server.js:52 | 15 мин |
| Admin-пароль: перейти с plaintext сравнения на bcrypt | adminAuth.js | 30 мин |
| Унифицировать дублирующиеся функции форматирования дат | rehearsalFormatters.ts, slotHelpers.ts → time.ts | 1 час |
| Захардкоженные рабочие часы `'09:00'`/`'23:00'` → использовать WORKDAY_START/END | slotGenerator.ts, SlotItem.tsx | 20 мин |
| Убрать `as any` и `@ts-ignore` в calendar/import.ts и CalendarScreen | import.ts:197,214,325; CalendarScreen:123,315 | 1–2 часа |

### Низкий приоритет

| Задача | Файлы | Оценка |
|--------|-------|--------|
| Вынести rgba-цвета фиолетового в Colors (30 хардкодов) | calendarScreenStyles.ts, projectsScreenStyles.ts и др. | 2 часа |
| Вынести loadingState/errorState/emptyState стили в commonStyles.ts | projectsScreenStyles.ts, calendarScreenStyles.ts | 1 час |
| Убрать inline-стили из CalendarScreen в StyleSheet | CalendarScreen.tsx:387–449 | 30 мин |
| Убрать русские строки из push-уведомлений на сервере | rehearsals.js:150–153 | 30 мин |
| Унифицировать timezone-конвертацию на backend (использовать date-fns-tz как на frontend) | server/utils/timezone.js | 1 час |
| Сократить срок жизни JWT access токена (сейчас 30 дней) | jwtMiddleware.js:24 | 15 мин + риск |
| Заменить SELECT * на конкретные поля в 12+ местах | projects.js, members.js, invites.js | 1 час |

---

## 💾 Потенциальная экономия

- **npm bundle:** удаление `i18next` + `react-i18next` → ~1.7 MB из node_modules
- **Строк кода:** ~5 мёртвых компонентов (~200–400 строк) + ~15 мёртвых API-методов (~60 строк) + ~130 console.log → **~600–700 строк мусора**
- **Дублирование:** 6 copy-paste SQL запросов → 1 хелпер; 3 реализации форматирования дат → 1 модуль

---

## ✅ Что хорошо (не трогать)

- **Backend архитектура:** Чёткое разделение routes / services / middleware / utils. Все зависимости используются.
- **Система авторизации:** `requireAuth` middleware везде применён корректно, `req.userId` паттерн соблюдён.
- **Вебхук идемпотентность:** UPDATE вместо INSERT дублей реализован (после фикса 2026-02-13).
- **Timezone в БД:** `SET timezone = 'UTC'` + `::timestamptz AT TIME ZONE 'UTC'` костыль задокументирован и работает.
- **i18n система:** Собственный `I18nContext` работает, все строки в переводах (`ru`/`en`), `t.xxx` паттерн соблюдён.
- **Структура проекта:** Feature-based архитектура чистая, shared/ правильно изолирован.
- **TypeScript:** В большинстве мест типы корректные, `any` — исключения, не правило.
- **Тестирование:** Jest тесты есть как для frontend так и для backend, покрытие ключевых сервисов.
- **Документация:** CLAUDE.md и docs/ актуальны и содержательны.
- **AllPay интеграция:** Сложный платёжный пайплайн задокументирован, основные edge cases покрыты.
- **knip.json:** Конфиг для проверки неиспользуемых зависимостей уже подготовлен.
- **Push-уведомления:** try/catch защита на симулятор реализована правильно.
- **CalendarSync:** Batch processing (10 параллельных, chunks по 50) — хорошая оптимизация.

---

## Детальные отчёты

- [audit-deps.md](audit-deps.md) — зависимости npm
- [audit-files.md](audit-files.md) — мёртвые файлы
- [audit-deadcode.md](audit-deadcode.md) — мёртвый код внутри файлов
- [audit-duplication.md](audit-duplication.md) — дублирование и технический долг
- [audit-security.md](audit-security.md) — безопасность и качество

# Аудит мёртвого кода

## Неиспользуемые экспорты (функции/типы/константы)

### src/shared/utils/haptics.ts — 4 мёртвых экспорта
- `haptics.ts:27` — `hapticHeavy` — нигде не вызывается
- `haptics.ts:43` — `hapticWarning` — нигде не вызывается
- `haptics.ts:51` — `hapticError` — нигде не вызывается
- `haptics.ts:59` — `hapticSelection` — нигде не вызывается

### src/shared/utils/time.ts
- `time.ts:5` — `parseDateString` — используется только внутри time.ts, не вызывается снаружи (можно сделать приватной)

### src/shared/utils/availability.ts — 2 мёртвых реэкспорта
- `availability.ts:17` — `toMinutes` (реэкспорт `timeToMinutes`) — нигде не используется как `toMinutes`
- `availability.ts:18` — `toTimeString` (реэкспорт `minutesToTime`) — нигде не используется как `toTimeString`

### src/shared/services/googleAuth.ts — 2 мёртвых экспорта
- `googleAuth.ts:77` — `isGoogleAuthConfigured` — объявлена, нигде не вызывается
- `googleAuth.ts:87` — `getGoogleAuthError` — объявлена, нигде не вызывается

### src/shared/components/animations/ — 2 мёртвых компонента
- `animations/AnimatedListItem.tsx` — экспортируется через index.ts, нигде не используется в продакшн-коде
- `animations/FadeInView.tsx` — экспортируется через index.ts, нигде не используется в продакшн-коде

### server/utils/timezone.js — 2 мёртвых импорта
- `timezone.js:8` — `toZonedTime` импортируется из date-fns-tz, нигде в файле не используется
- `timezone.js:8` — `formatInTimeZone` импортируется из date-fns-tz, нигде в файле не используется

## Мёртвые API-методы в src/shared/services/api.ts

### Вызывают несуществующие роуты на сервере (КРИТИЧНО):
- `api.ts:410` — `subscriptionsAPI.getPaymentStatus` — вызывает `/native/subscriptions/status/:orderId` (роута НЕТ на сервере!)
- `api.ts:418` — `subscriptionsAPI.testConfig` — вызывает `/native/subscriptions/test-config` (роута НЕТ на сервере!)

### Определены в api.ts но из UI никогда не вызываются:
- `api.ts:179` — `authAPI.getAuthProviders` — роут есть (`GET /api/auth/me/providers`), но UI не использует
- `api.ts:182` — `authAPI.unlinkAuthProvider` — роут есть, UI не использует
- `api.ts:292` — `invitesAPI.getInvite` — роут есть, UI не использует
- `api.ts:295` — `invitesAPI.revokeInvite` — роут есть, UI не использует
- `api.ts:353` — `calendarSyncAPI.deleteConnection` — роут есть, UI не использует
- `api.ts:357` — `calendarSyncAPI.updateSyncTime` — роут есть, UI не использует

## Закомментированный код
Блоков закомментированного кода не найдено. Код чистый.

## TODO/FIXME (технический долг)
Явных TODO, FIXME, HACK, XXX, BUG комментариев не найдено.

## console.log — отладочный мусор

### src/ — критические пути (~90+ вызовов):
- `src/shared/services/calendar/export.ts` — ~25 console.log с emoji в критическом пути создания событий
- `src/features/profile/screens/CalendarSyncSettingsScreen.tsx` — ~25 console.log в процессе синхронизации
- `src/shared/hooks/useAutoCalendarSync.ts` — ~15 console.log в логике автосинхронизации
- `src/features/calendar/hooks/useCalendarSync.ts:88,90` — явный debug блок `[DEBUG] 📅 Total calendars found`
- `src/features/availability/hooks/useAvailabilityData.ts:27,28,107,158,159` — логирование данных
- `src/features/calendar/hooks/useAddRehearsalSubmit.ts:86–112` — логирование проверки настроек
- `src/features/calendar/components/RehearsalDetailsModal.tsx:80,91,99` — логирование API-ответа
- `src/features/subscriptions/screens/SubscriptionScreen.tsx:172,187,373,377` — `[DEBUG] Checkout created`
- `src/features/calendar/hooks/useRehearsals.ts:64` — кэш статус лог
- `src/shared/services/notifications.ts:27,38,52,62,85,108` — 6 console.log
- `src/shared/hooks/useNotifications.ts:32,43,54,65,78,125` — 6 console.log

### server/ — критические (~40+ вызовов):
- `server/services/rehearsals/rehearsalService.js` — ~25 console.log (трейсинг каждого шага)
- `server/services/rehearsals/slotService.js:25–87` — 8 console.log
- `server/routes/auth.js:303` — ВНИМАНИЕ: логирует весь `req.body` включая пароли!
- `server/utils/oauthVerification.js:28,39,40` — 3 console.log
- `server/utils/allpayClient.js:181` — AllPay API ответ
- `server/routes/native/members.js:76` — 1 console.log
- `server/routes/native/rehearsals.js:60,66,70,73` — 4 console.log
- `server/services/rehearsals/rsvpService.js:129` — 1 console.log

> Примечание: logger.debug в IS_DEV обёртке уже есть в обоих слоях. Прямые console.log нужно либо заменить на logger.debug, либо удалить.

## Backend роуты без frontend вызовов

| Роут | Статус |
|------|--------|
| `GET /api/native/subscriptions/status/:orderId` | **Роут ОТСУТСТВУЕТ на сервере**, но api.ts его вызывает — ghost method |
| `GET /api/native/subscriptions/test-config` | **Роут ОТСУТСТВУЕТ на сервере**, api.ts — ghost method |
| `GET /api/auth/me/providers` | Роут есть, но UI **не вызывает** |
| `DELETE /api/auth/me/providers/:provider` | Роут есть, UI **не вызывает** |
| `DELETE /api/native/projects/:id/invite` | Роут есть, UI **не вызывает** |
| `GET /api/native/projects/:id/invite` | Роут есть, UI **не вызывает** |
| `DELETE /api/native/calendar-sync/connections/:id` | Роут есть, UI **не вызывает** |
| `POST /api/native/calendar-sync/connections/:id/update-sync-time` | Роут есть, UI **не вызывает** |

## Приоритет исправлений

**Критично:**
1. `subscriptionsAPI.getPaymentStatus` и `subscriptionsAPI.testConfig` — вызывают несуществующие роуты. Удалить методы.
2. `server/routes/auth.js:303` — console.log логирует req.body с паролями в plaintext!
3. ~130+ прямых console.log в продакшн-путях — заменить на logger.debug/удалить

**Средне:**
4. 4 неиспользуемых haptic-функции — удалить
5. 2 мёртвых компонента (AnimatedListItem, FadeInView) — удалить
6. 8 мёртвых API-методов в api.ts — удалить или подключить UI

**Низко:**
7. toMinutes/toTimeString реэкспорты в availability.ts — мёртвые алиасы
8. isGoogleAuthConfigured, getGoogleAuthError в googleAuth.ts
9. Мёртвые импорты toZonedTime, formatInTimeZone в server/utils/timezone.js

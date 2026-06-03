# Аудит дублирования и технического долга

## Высокий приоритет

### 1. Три независимых реализации форматирования времени
**Файлы:**
- `src/features/calendar/utils/rehearsalFormatters.ts` — `formatDate()`, `formatTime()`, `parseTimeString()`
- `src/features/availability/utils/slotHelpers.ts` — `parseTimeToDate()`, `formatDateToTime()`
- `src/shared/utils/time.ts` — `formatDateToString()`, `timeToMinutes()`, `minutesToTime()`

**Описание:** `formatDate()` в rehearsalFormatters.ts делает то же что `formatDateToString()` в time.ts. `parseTimeToDate()` в slotHelpers.ts идентична `parseTimeString()` в rehearsalFormatters.ts. При изменении логики форматирования нужно менять 3 файла.

**Решение:** Перенести все функции форматирования в `src/shared/utils/time.ts`, в feature-файлах оставить только re-export.

---

### 2. Хардкод `'Asia/Jerusalem'` в 6+ местах вместо константы
**Файлы:**
- `server/routes/native/projects.js` — строки 30, 54, 73, 112 (4 раза: `|| 'Asia/Jerusalem'`)
- `server/routes/native/members.js` — строка 74
- `server/services/rehearsals/rehearsalService.js` — строка 185
- Константа `DEFAULT_TIMEZONE` уже есть в `server/constants/timezone.js` — просто не используется!

**Решение:** Заменить все `|| 'Asia/Jerusalem'` на `|| DEFAULT_TIMEZONE` с импортом из `server/constants/timezone.js`.

---

### 3. Дублирующийся SQL-запрос проверки прав (copy-paste в 6 местах)
**Файлы:**
- `server/routes/native/invites.js` — строки 38, 93, 137 (3 раза дословно)
- `server/routes/native/members.js` — строки 272, 328
- `server/routes/native/projects.js` — строки 92–95, 132–135

**Описание:** Дословно одинаковый SQL:
```sql
SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND role IN ('owner', 'admin') AND status = 'active'
```
Нет централизованного helper для проверки прав.

**Решение:** Выделить `checkUserIsAdmin(db, projectId, userId)` хелпер в `server/utils/projectHelpers.js` и переиспользовать.

---

### 4. Хардкод рабочих часов `'09:00'` / `'23:00'` без использования существующих констант
**Файлы:**
- `src/shared/utils/availability.ts` — `WORKDAY_START = '09:00'`, `WORKDAY_END = '23:00'` (константы определены здесь)
- `src/features/smart-planner/utils/slotGenerator.ts` — строки 13, 181, 182 — дефолты `'09:00'`/`'23:00'` захардкожены
- `src/features/smart-planner/components/SlotItem.tsx` — строка 40 — `slot.startTime === '09:00' && slot.endTime === '23:00'`

**Решение:** Импортировать `WORKDAY_START`/`WORKDAY_END` из `shared/utils/availability.ts` вместо повторения строк.

---

## Средний приоритет

### 5. Production URL захардкожен в трёх местах
**Файлы:**
- `server/routes/native/subscriptions/checkout.js:22` — `'https://server-fertvads-projects.vercel.app'`
- `server/routes/native/invites.js:23` — `'https://server-fertvads-projects.vercel.app/invite/'`
- `src/shared/services/api.ts:20` — `'https://server-fertvads-projects.vercel.app/api'`

**Решение:** Вынести в `process.env.BASE_URL` / `EXPO_PUBLIC_API_URL`. При смене хостинга сейчас нужно менять код, а не только env.

---

### 6. ~30 хардкодов rgba фиолетового вместо цветовой системы
**Файлы (частичный список):**
- `src/features/calendar/styles/calendarScreenStyles.ts` — строки 54, 91, 105, 114, 305, 307
- `src/features/projects/styles/projectsScreenStyles.ts` — строки 75, 110, 134
- `src/features/smart-planner/components/SlotItem.tsx:98` — `#9333ea`
- `src/features/profile/styles/calendarSyncSettingsScreenStyles.ts` — строки 129, 204, 280

**Описание:** `Colors.accent.purpleDark` (`#9333EA`) и `Colors.accent.purple` (`#A855F7`) продолжают захардкоживаться как rgba-строки вместо использования существующего `colors.ts`. Цвета `#f9fafb` и `#9ca3af` вообще отсутствуют в системе.

**Решение:** Добавить в Colors полупрозрачные варианты (`purpleAlpha10`, `purpleAlpha20`, `purpleAlpha30`).

---

### 7. Дублирующиеся паттерны loadingState / errorState / emptyState в стилях каждого экрана
**Файлы:**
- `src/features/projects/styles/projectsScreenStyles.ts` — loadingState, errorState, emptyState
- `src/features/calendar/styles/calendarScreenStyles.ts` — loadingState, loadingText, errorState, emptyState

**Решение:** Вынести в `src/shared/styles/commonStyles.ts` или общий компонент `StateCard`.

---

### 8. Строки на русском захардкожены в push-уведомлениях
**Файл:** `server/routes/native/rehearsals.js`, строки 150–153
```js
if (req.body.startsAt || req.body.endsAt) changes.push('дата/время');
if (req.body.location) changes.push('место');
if (req.body.title) changes.push('название');
```
При добавлении англоязычных пользователей уведомления будут по-русски.

---

### 9. Два независимых подхода к timezone-конвертации (frontend vs backend)
**Файлы:**
- `src/shared/utils/time.ts` — использует `date-fns-tz` (`toZonedTime + format`)
- `server/utils/timezone.js` — использует `Intl.DateTimeFormat.formatToParts` с ручным костылём для `hour === '24'`

**Описание:** Backend реализует то же самое что frontend, но низкоуровнево и с костылями. Расхождение в реализациях.

**Решение:** На backend унифицировать — использовать `toZonedTime + format` из date-fns-tz.

---

## Низкий приоритет

### 10. console.log вместо централизованного logger в route-файлах
**Файлы:** Все 7 файлов в `server/routes/native/` — суммарно ~50 вызовов console.log.
В проекте есть `server/utils/logger.js`, используется только в `subscriptions/checkout.js`.

### 11. Inline-стили в CalendarScreen вместо StyleSheet
**Файл:** `src/features/calendar/screens/CalendarScreen.tsx`, строки 387–449
Несколько `<View style={{ flexDirection: 'row', ... }}>` прямо в JSX — создаёт новые объекты на каждый ре-рендер.

### 12. DEFAULT_SLOT захардкожен без константы
**Файл:** `src/features/availability/hooks/useAvailabilityData.ts:10`
`{ start: '10:00', end: '18:00' }` определён локально в хуке вместо shared-константы.

# T-042 — что удалено из `rehearsal-calendar-native/src`

Инструменты: knip 5.71.0 (`knip.json` переписан под Expo: точки входа `index.ts`,
`App.tsx`, тесты и `src/__tests__`, `e2e/**`; плагины expo/metro/jest), для стилей —
TypeScript `findReferences` (`unused-styles.mjs`), для имён внутри модуля — ESLint
проекта (`lint-unused.mjs`). Каждое имя дополнительно проверено поиском по `src`,
`e2e`, `server` (`before-*.txt`, `grep-keys.mjs`). До — `before-*.txt`, после — `after.txt`.

## Файлы
Нет: knip не нашёл ни одного неиспользуемого файла (и в режиме `--production`).

## Экспорты (функции, константы) — knip + grep
| Что | Где |
|---|---|
| `getWeekStart` | `src/hooks/useWeekStart.ts` |
| `getDayOffset` (жил только ради `getWeekStart`; knip нашёл вторым проходом) | `src/hooks/useWeekStart.ts` |
| `GO_BACK` (в тестах — литерал `{ type: 'GO_BACK' }`, не константа) | `src/shared/hooks/useLeaveGuard.ts` |
| `getCalendarEvents` и его реэкспорт | `src/shared/services/calendar/import.ts`, `.../calendar/index.ts` |
| `onClockOf` | `src/shared/utils/time.ts` |

## Типы, компоненты, хуки
Неиспользуемых экспортов типов, компонентов и хуков knip не нашёл.

## Ключи `StyleSheet.create` — 51
- `profile/styles/calendarSyncSettingsScreenStyles.ts` — 39: `permissionGranted`,
  `settingRight`, `settingValue`, `settingHint`, `intervalButtonsContainer`,
  `intervalButton`, `intervalButtonActive`, `intervalButtonText`,
  `intervalButtonTextActive`, `syncHint`, `statusCard`, `statusRow`, `statusLabel`,
  `statusValue`, `errorContainer`, `errorText`, `modalOverlay`, `modalContainer`,
  `modalContent`, `modalHeader`, `modalTitle`, `calendarList`, `calendarItem`,
  `calendarItemSelected`, `calendarItemLeft`, `calendarIcon`, `calendarInfo`,
  `calendarName`, `calendarMeta`, `calendarColor`, `calendarDetails`, `calendarTitle`,
  `calendarTitleSelected`, `calendarSource`, `writableBadge`, `writableText`,
  `emptyState`, `modalFooter`, `modalSaveButton`
- `availability/styles/availabilityScreenStyles.ts` — 5: `saveHeaderButton`,
  `saveHeaderButtonText`, `saveHeaderButtonDisabled`, `modeInfo`, `modeInfoText`
- `auth/styles/registerScreenStyles.ts` — 3: `divider`, `dividerLine`, `dividerText`
- `projects/styles/projectsScreenStyles.ts` — 2: `loadingState`, `loadingText`
- `calendar/styles/calendarScreenStyles.ts` — 1: `loadingText`
- `calendar/styles/addRehearsalScreenStyles.ts` — 1: `projectName`

## Неиспользуемые импорты и локальные константы — ESLint + grep
- импорты: `DayMode`, `TimeSlot` (`availability/utils/slotHelpers.ts`); `useRef`
  (`calendar/screens/CalendarScreen.tsx`); тип `Project`
  (`calendar/screens/RehearsalDetailsScreen.tsx`); `useEffect`
  (`onboarding/screens/CalendarSyncScreen.tsx`); `BottomTabScreenProps`,
  `CompositeScreenProps` (`profile/screens/ProfileScreen.tsx`); `FlatList`
  (`projects/screens/ProjectDetailScreen.tsx`); `Alert` (`navigation/index.tsx`);
  `Colors` (`shared/components/UserAvatar.tsx`); `Dimensions`
  (`calendar/styles/calendarScreenStyles.ts`)
- локальные: `UPCOMING_CARD_WIDTH`, `SCREEN_WIDTH` (`calendarScreenStyles.ts`);
  `DAY_END` (`shared/utils/availability.ts`); неиспользуемое `language` из `useI18n()`
  в `useAddRehearsalForm.ts` и `navigation/index.tsx` (`ActionSheetWrapper`)

## Оставлено намеренно
- Экспорты, которыми пользуются только тесты (`--production`: `localDate`,
  `resetSessionForTests`, `clearAllMappings`, `DATE_FORMATS`, `isStartOfDayInTimezone`,
  `isEndOfDayInTimezone`) — тесты по задаче точки входа.
- Неиспользуемые props `availability` (`CalendarMonth`) и `onSlotChange`
  (`TimeSlotsEditor`) — удаление меняет интерфейс компонента, это рефакторинг.
- Неиспользуемые имена в тестах и моках (28) — не код приложения.
- `expo-linear-gradient` в `package.json` нигде не импортируется — вне `src/`, не тронут.
- `src/i18n` — в T-045.

Маршруты, `testID` и имена из строк: ни одно удалённое имя не маршрут и не `testID`;
grep по `e2e/` и `server/` строковых обращений к ним не нашёл.

## Среда
`node_modules/@oxc-resolver/binding-darwin-arm64` (нативный резолвер knip) был обрезан
на диске, knip не запускался. Переустановлен закреплённый 11.15.0 через
`npm install --no-save`; `package.json` и `package-lock.json` не менялись.

# R0 — первичная инвентаризация неиспользуемого кода и зависимостей

Дата: 2026-09-17. Первичная инвентаризация R0 завершена в указанном ниже охвате. В этой подзадаче код и зависимости не удалялись; production и `.env` не читались/не запускались. Использован установленный Knip 5.71.0 без установки, сети, `--fix` и кэша. Сырой вывод и дополнительные аналитические конфигурации находятся в `audit/evidence/R0`. Подготовку прервал лимит агента; классификацию завершил root по сохранённым результатам и дополнительному чтению исходников.

Исходная `rehearsal-calendar-native/knip.json` задаёт `index.ts`, `App.tsx`, `server/server.js` как entrypoints; project ограничен `src/**/*.{ts,tsx}` и `server/**/*.{js,ts}`, тесты игнорируются, а некоторые зависимости вручную исключены. Это не полный граф build/native/static-assets/операционных scripts. Кандидаты требуют ручной классификации, особенно nested server package и scripts/assets, достижимые вне JS import graph.

## Прогоны и границы

1. Обычный compact reporter завершился ошибкой на undefined path. [Trace](evidence/R0/knip-existing-config.txt) сохранён; это ошибка инструмента, не доказательство чистоты кода.
2. JSON reporter с исходной конфигурацией вернул issue exit 1. [Результат](evidence/R0/knip-existing-config.json): пять файлов-кандидатов, unlisted в 24 файлах, один export и один alias-duplicate. Nested server dependencies ошибочно сравниваются с root manifest.
3. Дополнительный [audit-only config](evidence/R0/knip.inventory.json) описывает два package workspaces, scripts, public JS и tests как entrypoints. [Результат](evidence/R0/knip-inventory.json): те же пять файлов, unlisted в 28 файлах (в основном `@jest/globals`), один export, один alias и ложный unused `ts-jest`. Исходный `knip.json` не менялся. Это стартовый snapshot до добавления R0 runner/app factory, а не финальный R9-проход.

Повтор JSON из каталога приложения:

```sh
node node_modules/knip/bin/knip.js --config ../audit/evidence/R0/knip.inventory.json --reporter json --no-progress
```

Охват: TypeScript/JavaScript import/export graph, package scripts, Jest/Expo/ESLint config, статические admin/public entrypoints, выборочные native references в Podfile.lock. Полный clone detector, native build и проверка динамических загрузок здесь не выполнялись. Отсутствие findings не доказывает отсутствие дублирования.

## Решения по кандидатам

| Кандидат | Доказательство и ограничение | Решение / пакет |
|---|---|---|
| `server/utils/mailer.js` | `sendMail/mailIsConfigured` определены, вызовы из routes/services не найдены. Файл описывает почтовый транспорт, но A01 требует ещё построить proof flow. | CANDIDATE; сначала R3: либо подключить как проверяемый transport с честным результатом, либо удалить заменённую реализацию. Не считать email verification уже реализованным. |
| `server/__tests__/setup.js` | Ни root Jest backend project, ни server Jest config не подключают setup; тестовый JWT сейчас задаётся явным env. | CANDIDATE, R9: подключить осознанно либо убрать устаревший файл/комментарий. |
| `server/__tests__/utils/testHelpers.js` | Старый disk-SQLite helper, импорты действующими suites не обнаружены; текущие integration suites используют другой memory helper. | CANDIDATE, R9; проверить все scripts и удалить отдельно после закрепления PG harness. |
| `src/__tests__/utils/mockData.ts`, `testUtils.tsx` | Knip не нашёл потребителей; действующие suites имеют собственные fixtures/render setup. | CANDIDATE, R9; оценить полезность общей fixture, не удалять вслепую. |
| `getCalendarEvents` в `shared/services/calendar/import.ts` | Только definition и barrel re-export; основной import flow использует другой внутренний reader. | CANDIDATE, R7: проверить публичные/динамические потребители перед удалением export/helper. |
| `ModeSelector`, `TimeSlotsEditor`, `TimePickerModal` | Есть отдельные components/exports/tests; `AvailabilityScreen.tsx` рисует собственные mode controls, slots и native DateTimePicker. Tests/barrels могут сохранять узлы в графе Knip. | CANDIDATE, R6/R9: сравнить поведение и выбрать одну реализацию после исправлений editor; не объединять по одному сходству имени. |
| `authenticateToken` / `requireAuth` | `requireAuth` — явный compatibility alias той же функции, используемый routers. Knip называет это duplicate export. | RETAINED; это не две независимые реализации. A02 исправляется в общей функции/границе. |
| `ts-jest` | Явно задан transformer в `jest.config.js`; frontend 518 tests прошли с ним. Audit config отключает Jest plugin. | RETAINED: ложный unused candidate. |
| `react-native-gesture-handler` | `NotificationsScreen.tsx` импортирует Swipeable и GestureTouchable; Podfile.lock содержит RNGestureHandler. | RETAINED, runtime/native dependency. |
| `date-fns-tz` | Реальные импорты в `shared/utils/time.ts`; backend также использует временные функции. | RETAINED. Отдельный `date-fns` из ignore list нельзя удалять из server: это другой package manifest. |
| `@eslint/js` | Прямой require в `eslint.config.js`, но отсутствует как прямая devDependency root package. Сейчас доступен транзитивно; lint запускается. | NEEDS_CHECK, R9: исправление metadata/reproducibility, не unused dependency. |
| `@jest/globals` | Прямые imports многих backend tests, доступен через Jest, не объявлен отдельно в server devDependencies. | NEEDS_CHECK, R9: решение о прямой devDependency; не удалять imports ради зелёного Knip. |
| `expo-updates`, `expo-system-ui` | Knip Expo helper выводит зависимости по `updates.enabled !== false` и Android `userInterfaceStyle`; прямых imports нет. В `app.json` нет explicit updates config, есть dark interface. | NEEDS_CHECK, R8/R9 с native/build config; это heuristic findings, не автоматически missing package и не команда на установку. |
| Server dependencies, `public/**/*.js`, `scripts/migrate.js`, новые admin assets | Отдельный server/package.json, HTML/script entrypoints и operational scripts. Одного JS import graph недостаточно. | RETAINED; workspace-aware graph нужен до решений. |

Ни одна установленная зависимость этим проходом не признана безопасной для
немедленного удаления. В R0 фиксируется исходное состояние; локальная очистка
заменённых реализаций идёт в соответствующем лечении, общий повтор — R9.

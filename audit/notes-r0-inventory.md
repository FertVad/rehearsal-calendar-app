# R0 — начальная инвентаризация и границы окружения

17 сентября 2026. Ветка `codex/systematic-repair`, база `0f655e2`.
Это историческая начальная запись перед полным выполнением R0. После замечания
пользователя порядок восстановлен: R0 **COMPLETE**, подготовлены настоящий PG
harness и примеры A02/B02/D01. Актуальные результаты — в [отчёте R0](REMEDIATION_R0.md),
расширенная первичная инвентаризация — [здесь](notes-r0-cleanup-inventory.md).

## Окружения и baseline

- Рабочий checkout: `/Users/vadimfertik/Desktop/reh_app`; приложение не запускалось через `server.js`, локальный `.env` не загружался тестами.
- Unit/HTTP baseline: очищенное окружение, моки и SQLite `:memory:`, только временные HTTP listeners. До H01: 30 suites / 338 tests PASS; type-check PASS. Подробнее: [журнал безопасности тестов](notes-r0-test-safety.md).
- H01 browser: Chrome с отдельным временным профилем, синтетические данные и localhost. Production security middleware используется напрямую без bootstrap приложения.
- На момент этой начальной записи PostgreSQL был NOT_RUN; теперь PostgreSQL 15.13 проверен в одноразовом контейнере (см. отчёт R0). Staging, production и приложение на устройстве остаются NOT_RUN; реальные credentials не использовались.

## Кандидаты на очистку

Использован статический поиск определений/импортов/вызовов через `rg`, чтение
admin template, availability components и конфигурации Knip. Полный Knip,
dependency graph и native build в этой итерации не запускались.

| Кандидат | Наблюдение | Решение |
|---|---|---|
| `server/routes/admin/dashboardPage.js`: `statusBadge`, `bugStatusBadge` и `.badge*` CSS | В старой странице два определения без вызовов; классы использовались только этими helper. HTML helpers не нужны после безопасного DOM rendering. | REMOVED внутри H01. Новая страница, actions и browser regressions проверены вместе с заменой. |
| Старые admin inline script/style и `relaxedCsp` | Полностью заменяются static assets и общим строгим middleware; параллельная старая реализация оставила бы опасный путь исполнения. | REMOVED внутри H01; сохранён один renderer и один CSP middleware. |
| Availability `ModeSelector`, `TimeSlotsEditor`, `TimePickerModal` | Отдельные файлы, barrel exports и тесты; текущий экран содержит собственную реализацию соответствующего UI. Это повод проверить расходящиеся обязанности и реальные entry points. | CANDIDATE для R6/R9. Не удалять до проверки всех imports, динамических/native usage и поведения экрана. |
| Зависимости из `knip.json.ignoreDependencies` | `@react-navigation/stack`, `react-native-gesture-handler`, `i18next`, `react-i18next`, `date-fns` исключены из отчёта инструмента. | NEEDS_CHECK в R9: отсутствие в отчёте не является доказательством использования или неиспользования. |
| Новый `server/public/admin/dashboard.js` | Загружается HTML через `<script src>`, не через JS import; CSS аналогично. Vercel `includeFiles: public/**` включает оба assets. | RETAINED: реальные browser entry points; не удалять по одному отчёту static import graph. |
| `playwright` | Новая devDependency, зафиксирована в lockfile; два явных browser test scripts. Не runtime-зависимость приложения. | RETAINED: используется для H01 regression; Node 20+ для browser test tooling. |

Все решения относятся к указанному охвату. Общая чистка проекта и изменение
зависимостей, не связанных с H01, в этот пакет не входят.

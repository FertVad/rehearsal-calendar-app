# Прогресс аудита

Основа: HEAD `8de99ab`, 2026-09-06. См. `map.md`, `inventory.md`.

Продолжение 2026-09-07: HEAD тот же; появились не наши изменения `server/__tests__/integration/setup.js` и новые `server/utils/{mailTokens,mailer}.js`, `server/__tests__/utils/mailTokens.test.js`. Аудит их не создавал и не менял. Проверить этот delta отдельно в I после основной очереди; до этого выводы A основаны на прочитанном исходном коде.

Продолжение 2026-09-08: git status не изменился относительно 7 сентября. E продолжается; server API/test reading сохранено в notes-calendar-api.md, клиентские проходы в работе. Runtime запрет сохранён.

Продолжение 2026-09-09: HEAD 8de99ab, тот же source delta. E завершён, F сведён. F04 SQLite async transaction — снят с confirmed: current callers не дают доказанного external I/O overlap; оставить manual contract check. SQLite foreign_keys disabled hypothesis исключена: locked better-sqlite3 включает SQLITE_DEFAULT_FOREIGN_KEYS=1.

| Участок | Статус | Заметки |
|---|---|---|
| Разведка и карта | готов | map.md, inventory.md |
| A — аутентификация и сессия | готов | notes-auth.md, notes-auth-client.md; чтение завершено, Apple source закрыт в I, условный IA01 |
| B — проекты и права | готов | notes-projects.md, notes-projects-client.md; стыки D/G закрыты |
| C — доступность | готов | notes-availability.md, notes-availability-client.md; 10 findings после объединения дубля |
| D — репетиции и планировщик | готов | notes-rehearsals-server/forms/display.md, notes-smart-planner.md; 15 новых подтверждённых, 1 условный timezone, date-only дубль объединить с C; выделенные styles пропущены |
| E — синхронизация календаря | готов | notes-calendar-api/export/import/storage/orchestration.md; 16 новых подтверждённых после ES03→EO04 merge; переводы частично, native SDK/runtime исключены |
| F — БД и миграции | готов | notes-database.md, notes-migrations.md, notes-database-tooling/consumers.md; 6 обычных +2 условных legacy findings; F04 hypothesis внеcount; все23SQL прочитаны |
| G — уведомления и cron | готов | notes-notifications-delivery/client/inbox.md, notes-reminders.md; 16 новых findings, включая 1 High; FC01→G01 merge, B01 privacy стык закрыт; SDK/доставка/runtime не проверялись |
| H — общий клиент и UI | готов | notes-public-admin/profile-onboarding/navigation-contexts/common-client.md; 14 новых findings (1 High), date-only дубль CC01; feature translations structural/частично, styles/assets не проверены визуально |
| I — конфиги и сквозная безопасность | готов | notes-configuration/dependencies/global-security/final-delta/api-documentation и coverage supplements; 6 findings, включая условные IA01 High и IS02 Medium; advisory sweep выборочный |
| Итоговый отчёт | готов | AUDIT_REPORT.md:102карточки, полный реестр, 8требуемых разделов, ссылки/числа/исключения проверены |
| Зависимости/артефакты/бинарные БД/ассеты | пропущен | Причины в map.md; оба lock-файла прочитаны как metadata в I; bodies зависимостей пропущены |

Тесты и команды приложения не запускались и не будут запускаться по требованию пользователя.

2026-09-10: HEAD 8de99ab, исходный source delta не изменился. G завершён; этап H разбит на navigation/contexts, profile/onboarding, common utilities/i18n и public/admin/bug reports внутри одного текущего участка.

2026-09-11: HEAD теперь 25475e8 (чужие commits93fba60,ff97189,25475e8), рабочее дерево содержит только audit/. Diff к8de99ab: CLAUDE.md, integration/setup, accountDeletionCleanup/authLogin tests, mailTokens/mailer и mailTokens.test — 7файлов. Production проверенных A–H файлов не менялся; новые mail utilities и весь delta проверить I. Аудит commits/исходники не создавал.

2026-09-16: HEAD 0f655e2, tracked source чист. Дельта workflow/docs прочитана: GitHub schedule отключён, manual dispatch остаётся; внешний cron и deployment env не проверены. I закрыт. Apple exact source1.7.9 подтвердил условный IA01. Всего102 отдельных findings:15High/69Medium/18Low, включая5условных; Critical не установлен. Сборка и редакторская сверка завершены; исходники не изменены, runtime проверки не выполнялись.

Завершение 2026-09-16: 102 уникальных ID; 97 подтверждены для описанных путей кода и5условных (DF01,FM01,FM02,IS02,IA01). Critical0, High15 (из них1условный), Medium69 (из них3условных), Low18 (из них1условный). Таблица и карточки совпадают; каждый блок содержит точный code excerpt, ссылку на существующий файл/строку, сценарий и два варианта исправления с effort. Все8разделов отчёта присутствуют. git diff tracked пуст; единственные новые материалы — audit/*.md и AUDIT_REPORT.md.

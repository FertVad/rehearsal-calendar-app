# Карта проекта и очередь аудита

Дата: 2026-09-06. Исходный HEAD: `8de99ab`. Рабочее дерево до аудита чистое. Тегов релизов нет.

Режим: только статическое чтение; единственные записи — `audit/*` и итоговый `AUDIT_REPORT.md`. Код, миграции, тесты, сборки, установка и служебные скрипты проекта не запускаются.

## Назначение по коду

Rehearsly объединяет театральные проекты, участников и их роли; хранит личную доступность, выбирает время репетиций, приглашает участников, собирает RSVP. Мобильный клиент синхронизирует события календаря устройства и получает уведомления. Отдельный веб-интерфейс администратора показывает пользователей и обращения. Платёжных роутов и зависимостей в первичной карте нет; устаревший комментарий об iframe сам по себе не является платёжной реализацией.

## Стек и точки входа

- `rehearsal-calendar-native/index.ts` → `App.tsx` → контексты и `src/navigation`: Expo 54, React 19.1, React Native 0.81.5, TypeScript, React Navigation, Axios, AsyncStorage.
- `server/server.js`: ESM Node, Express 4, Helmet, CORS, express-rate-limit; сначала `config/env.js`, затем инициализация БД. Vercel через `server/vercel.json`.
- Данные: PostgreSQL при DATABASE_URL/POSTGRES_URL, иначе SQLite (`server/database/db.js`). Схема в `init-native-schema.sql`, 23 миграции, исполнитель `scripts/migrate.js`.
- Интеграции: Google/Apple вход, Expo Calendar, Expo Push. Напоминания через `/api/cron/reminders`; GitHub workflow с периодом 15 минут, в комментариях внешний cron-job.org.
- iOS/Android: нативные проекты, настройки разрешений, deep links и сборки; Pods/build/генерированные артефакты исключены.

## Слои и API

- Авторизация: `/api/auth/{register,login,google,apple,refresh,me,logout}`, `/me/providers`; `middleware/{jwtMiddleware,adminAuth}`, `utils/{accountLinking,oauthVerification,projectAuth}`.
- Проекты и права: `/api/native/projects`, `/:projectId`, `/members`, `/members/availability`, изменение ролей и удаление участников; `/projects/:projectId/invite`, `/invite/:code`, `/invite/:code/join`.
- Доступность: `/api/availability` и alias `/api/native/availability`; чтение, bulk, удаление дня, imported batch/all.
- Репетиции: `/api/native/projects/:projectId/rehearsals`, PUT/DELETE по id; `/api/native/rehearsals/batch`, `/:id`, respond/responses/my-response. Сервисы rehearsal/slot/rsvp.
- Синхронизация: `/api/native/calendar-sync/connections`, mappings, lookup by event, update-sync-time; клиент `shared/services/calendar` и hooks.
- Уведомления: `/api/native/push-tokens`, `/notifications`, unread-count/read; notificationStore, pushNotificationService, reminderScheduler.
- Обращения и админ: `/api/native/bug-reports`, `/admin/api/{login,stats,users,bug-reports}`.
- Публичные страницы: `server/public`, `/invite/:code`, `/api/health`, association/deep-link endpoints (проверка далее).

## Схема (группы таблиц)

`native_users` → `native_auth_providers`; `native_projects` → `native_project_members` → пользователи; `native_rehearsals` → `native_rehearsal_responses`; `native_user_availability`; `native_calendar_connections` → `native_calendar_event_mappings`; `native_push_tokens`, `native_push_reminders`, `native_notifications`, `native_bug_reports`. Ограничения и соответствие адаптеров проверяются отдельным участком.

## Конфигурация

NODE_ENV, DATABASE_URL/POSTGRES_URL, JWT_SECRET, CRON_SECRET, ADMIN_PASSWORD/ADMIN_PASSWORD_HASH, BASE_URL/VERCEL_URL, PORT, DEBUG/LOG_REQUESTS; OAuth client identifiers и EXPO_PUBLIC_* уточняются при сквозном поиске. Значения секретов в отчёт не переносятся.

## Очередь по риску (участки проходят последовательно)

1. A — аутентификация, сессия, OAuth, административный вход (сервер + клиент).
2. B — проекты, роли, приглашения и доступ к участникам.
3. C — доступность и обработка ввода (сервер + клиент).
4. D — репетиции, RSVP, подбор времени (сервер + клиент).
5. E — календари и сохранение файлов/состояния устройства.
6. F — БД, схема, миграции, транзакции.
7. G — push, inbox, напоминания и фоновые задачи.
8. H — общий клиент, UI, навигация, локализация, onboarding, profile, публичный и административный UI.
9. I — конфиги, native build settings, документация, тестовые гарантии, зависимости; сквозной поиск секретов и опасных вызовов.

Внутри одного текущего участка допустим независимый второй взгляд на его клиентскую или серверную часть; другие участки до его закрытия не аудируются.

## Исключения

`node_modules`, `ios/Pods`, `ios/build`, `.expo`, `.git`-объекты, бинарные SQLite/DB, ассеты и скриншоты, минифицированные/генерированные артефакты, snapshots. Полная метадата в `inventory.md`. Lock-файлы проверяются как метаданные зависимостей; локальные БД не открываются. Миграций немного: планируется прочитать все, без применения.

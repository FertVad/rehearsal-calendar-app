# Участок F — SQL consumers, связи и ограничения данных

Сохранено 2026-09-09 по чтению 2026-09-08. Только статическое чтение/поиск; исходники не менялись, SQL/EXPLAIN/тесты/скрипты не запускались. Пути относительно `rehearsal-calendar-native/`. Эта записка дополняет основной аудит схемы/адаптера F и аудит миграций, не повторяет их findings.

## Честное покрытие

Полностью прочитаны:

- `server/services/rehearsals/slotService.js` — 152 строки.
- `server/services/rehearsals/rsvpService.js` — 165 строк.
- `server/services/notifications/notificationStore.js` — 206 строк.
- `server/routes/native/pushTokens.js` — 127 строк.

Итого 4 файла / 650 строк полного чтения.

Адресно прочитаны блоки, не весь файл:

- `server/database/init-native-schema.sql:62–76,98–225,228–240,243–303` — auth provider/проектные связи, roster/busy, connections/mappings, push/notifications и список индексов. Всю схему проверяет основной аудитор.
- `server/services/rehearsals/rehearsalService.js:50–160,352–587` — batched query списка и writes create/update/delete. Вне этих границ полный файл этим проходом не заявляется; раздел D прочитан основным аудитором ранее.
- `server/utils/accountLinking.js:160–224` — providers read/unlink.
- `server/routes/native/calendarSync.js:230–300` — ownership connection и SELECT→INSERT mapping.
- `server/routes/native/members.js:96–145` — batched availability query.
- `server/services/notifications/pushNotificationService.js:17–51` — выбор получателей push.

Поисковое покрытие (не полное чтение): SQL/циклы/LIMIT во всех файлах `server/routes/native/`, `server/services/`, а также `server/routes/{auth,admin,cron,native}.js`, `server/utils/`, `server/scripts/`, `server/database/db.js`. Отдельный поиск `CREATE ... INDEX`, `native_notifications`, `DELETE FROM native_notifications` во всех first-party server, исключая tests, использован для проверки наличия индексов/retention. Native зависимости, реальная БД, планы запросов и объёмы данных не доступны в рамках этого read-only аудита; миграции поштучно полностью читает другой аудитор F.

## Матрица инвариантов и связей

| Связь/инвариант | Что реально обеспечивает схема | Что обеспечивают consumers и стык отчёта |
|---|---|---|
| Auth provider → user | FK `native_auth_providers.user_id → native_users.id ON DELETE CASCADE`, UNIQUE(provider_type,provider_user_id), CHECK provider_type; schema:62–74 | Удаление user убирает providers. Согласованность password_hash и email-provider, наличие последнего метода входа не следуют из FK. `accountLinking.js:190–215` считает providers, затем удаляет без row lock; password credential обновляется отдельно. Это доказательства A04, не новая находка F. |
| Project member → user/project | FK user/project CASCADE, UNIQUE(user_id,project_id); schema:98–113 | Нет декларативной гарантии «в проекте остаётся owner» или связи role с creator. Project/member многошаговые writes рассмотрены B01/B02. FK не делают эти последовательности атомарными. |
| Rehearsal → project/creator | project CASCADE, created_by SET NULL, CHECK ends_at>starts_at; schema:117–137 | Удаление project каскадирует rehearsal и через него responses/reminders. `source='rehearsal'` busy не имеет FK на rehearsal и требует ручного cleanup (`slotService.js:127–134`, B project/member/account cleanup). |
| Roster/response → rehearsal/user | FK обоих родителей CASCADE, UNIQUE(rehearsal_id,user_id); schema:141–151 | Нет FK или CHECK, что user — active member того же проекта; root D01/D02 уже показывает reachable нарушение через supplied participant_ids/respond. `rsvpService.js:45–50,85–100` фильтрует active membership при чтении статистики, а `slotService.js:29–48` бронирует всех из roster без membership join. Это поясняет скрытую неконсистентность: лишний busy существует, статистика его не показывает. |
| Availability → user / rehearsal | user FK CASCADE, CHECK ends_at>starts_at; source/external_event_id — строки без parent FK; schema:155–171 | Для rehearsal slot ключ external_event_id равен String(rehearsalId), удаление ручное. В обновлении busy delete+reinsert транзакционные (:72–75), но сама репетиция/roster обновляются вне этой транзакции (`rehearsalService.js:483–551`). Дубликаты/partial failures относятся D03/F02. |
| Calendar connection → user | user CASCADE; требуется calendar_id или device_calendar_id; schema:175–194 | Connection current-user ownership проверяется route. Индекс user_id есть; гарантии уникального device/installation namespace нет в прочитанной base schema. Race SELECT→INSERT и конкретные constraints миграций сопоставляет основной F. |
| Mapping → connection / internal event | connection CASCADE, internal_event_id полиморфный integer без parent FK; schema:198–209 | `calendarSync.js:247–261` сверяет только owner connection, не существование/доступность internal rehearsal. Само по себе это не IDOR содержимого: записываются метаданные текущего user. После удаления rehearsal mapping может быть нужна устройству для cleanup native event, поэтому добавлять FK CASCADE на rehearsal вслепую неправильно — нужен tombstone/reconciliation contract. Схлопывание connection scopes уже ES02. |
| Push token → user | user CASCADE; UNIQUE(user_id,device_token), schema:228–238 | Это НЕ уникальность владельца токена. Route пытается её имитировать delete-otherusers + upsert двумя запросами; кандидат FC01 ниже, добор G. |
| Reminder → rehearsal/user | FK обоих CASCADE; UNIQUE(rehearsal_id,user_id,reminder_type), schema:243–253 | Claims адресованы человеку, а не только rehearsal; удаление репетиции/user их убирает. Membership roster linkage отдельно не закодирован. Scheduler lifecycle/доставка будут полностью проверены G. |
| Notification / bug report → user | user CASCADE; schema:259–282 | related_type/related_id notification без parent FK намеренно сохраняют историю уведомления после удаления rehearsal/project. Наличие такой ссылки не объявляется orphan-багом без проверки UI navigation; относится G/H. |

## Индексы и реальные query patterns

1. **Notifications, поддерживающее доказательство F02.** `notificationStore.js:96–102` всегда фильтрует user_id и сортирует created_at DESC,id DESC; `:78–81,130` считает unread по user_id/read_at; mark/delete-all также user scoped (:167,:200). В init-native-schema.sql:286–300 этих индексов нет. Поиск нашёл их в `server/migrations/003-notifications-timestamptz.sql:16–20`: `(user_id,created_at DESC)` и partial `(user_id) WHERE read_at IS NULL`. Значит нельзя утверждать «в проекте индексов нет»: они есть в миграциях и возможной production БД. Проблема только схемы fresh init+baseline, уже F02; при таком создании таблица растёт на каждый recipient (:38–44), и каждый inbox/count пользователя вынужден отбирать записи из общей таблицы без подходящего user index. Без реальных объёмов/EXPLAIN время выполнения не оценивалось.
2. **Availability imported uniqueness, поддержка F02.** Base schema не содержит UNIQUE(user_id,external_event_id,source), migration005 создаёт её. `server/routes/native/availability.js:141–143` использует `ON CONFLICT(user_id,external_event_id,source)` и зависит от реально существующего уникального индекса. Не переносить этот конкретный failure на `slotService`: его create/ensure (:40–48,:110–118) обычный INSERT без ON CONFLICT, он при отсутствии UNIQUE не падает по отсутствующей conflict target, но теряет защиту от duplicate.
3. **Глобальный cleanup busy, условная оптимизация, НЕ отдельная finding.** `slotService.js:132` делает `DELETE ... WHERE source=$1 AND external_event_id=$2` без user_id. UNIQUE(user_id,external_event_id,source) не даёт подходящий leading prefix, остальные first-party availability indexes относятся user/timestamps; отдельный `(source,external_event_id)` поиском не найден ни в base, ни в миграциях. Это потенциальный scan глобального availability при каждом удалении/редактировании rehearsal, существенный только при большом общем объёме. Проверить EXPLAIN на production-like cardinality; рассмотреть partial index по external_event_id WHERE source='rehearsal'. Утверждения об уже наблюдаемой медлительности нет.
4. **Базовые joins.** У membership есть индексы user_id/project_id и unique(user,project); roster — rehearsal_id/user_id и unique(rehearsal,user); rehearsals — project/time. Не объявляем missing composite index только из-за отсутствия идентичного порядка колонок в SQL: реальное преимущество зависит от селективности/плана, которые запрещено запускать.

## N+1, циклы, отсутствие LIMIT

- `members.js:96–108,135–143` читает names/hasData/availability пакетно по всем целевым userId; SQL N+1 на каждого участника здесь не найден. Date expansion CPU/неограниченное окно уже B03.
- `rehearsalService.js:59–127` получает доступ, список репетиций и RSVP статистику пакетно, не отдельным SQL на каждую репетицию. Есть дополнительная member-count query/map (:120–132), результат которого дальше не используется для invited; это небольшая лишняя операция, не самостоятельный correctness/security finding.
- `rehearsalService.js:404–409` пишет RSVP по одному participant; затем `slotService.js:37–50` пишет по busy на каждого. Создание N участников делает минимум 2N последовательных writes; `notificationStore.js:38–63` аналогично последовательно записывает fanout. Это доказанный round-trip pattern, но без большого состава и измеренной latency не ставим отдельную performance критичность. При необходимости заменить на INSERT SELECT/batch в общей транзакции; транзакционная correctness уже D03.
- `availabilityAPI.getAll` серверный consumer `availability.js:38–41` возвращает всю историю без window/LIMIT; импорт (`src/shared/services/calendar/import.ts:188–190,233–250`) потом фильтрует только 365-дневное окно на клиенте и оставляет прошедшие rows. Значит стоимость sync растёт с историей пользователя. Реальное ухудшение требует большого накопленного календаря; предложить window query/pagination после измерения, не объявлять уже доказанный DoS.
- `rehearsalService.js:75–83` список нескольких проектов тоже без временного окна/LIMIT; admin stats создаёт IN-параметр на каждый history rehearsal (:110–116) и `includes` для каждого результата (:143–145). При очень длинной истории это повышает CPU/число bind parameters и response size. Никакой конкретный timeout не доказан. В UI/server roadmap разумно date-window/pagination, но это здесь conditional review note.
- Notification list имеет cap100 (:103). Поисковое покрытие `routes/admin.js` показывает LIMIT/OFFSET для users/bug reports (:89,:133); отсутствие LIMIT у COUNT само по себе нормально. Аудит значений negative offset/limit и админ-прав — G/I, не заявлен данным проходом.

## FC01 — подтверждено в G01, без отдельного count — схема не обеспечивает одного владельца push token при конкурентной регистрации

**Окончательная сверка:** G проверил client registration lifecycle и actual recipient delivery; находка подтверждена как G01 High в `notes-notifications-delivery.md`. Ранний pending-текст ниже — история проверки, его ограничение «не считать до G» уже разрешено. Считать один G01, не FC01+G01.

Статически подтверждены недостаточный UNIQUE и возможный SQL interleaving. Основной аудитор попросил до G оставить pending: G проверяет client registration lifecycle и фактический recipient delivery. Предварительная критичность **High при подтверждении достижимого account-switch overlap** (утечка notification content); не включать в final count до добора G.

Места: `server/routes/native/pushTokens.js:34–70`; `server/database/init-native-schema.sql:237`; `server/services/notifications/pushNotificationService.js:25–37`.

```js
// pushTokens.js:49–70
await db.run(
  'DELETE FROM native_push_tokens WHERE device_token = ? AND user_id != ?',
  [deviceToken, userId]
);
await db.run(
  `INSERT INTO native_push_tokens (user_id, device_token, ...)
   VALUES (?, ?, ...)
   ON CONFLICT (user_id, device_token) DO UPDATE SET ...`,
  [userId, deviceToken, ...]
);
// schema:237
UNIQUE (user_id, device_token)
```

Конкретная допустимая БД последовательность: один deviceToken T, два уже авторизованных overlapping запроса от A/B, строки ещё нет. A DELETE →0; B DELETE →0; A INSERT(A,T); B INSERT(B,T). Ни одна пара UNIQUE не совпадает, обе записи сохраняются. Аналогичный overlap может случиться вокруг смены пользователя и незавершённой регистрации, достижимость client lifecycle проверяет G. `getUserPushTokens` выбирает все строки WHERE user_id IN(...) и notifications_enabled=true, без последующей проверки актуального владельца T.

Почему потенциально серьёзно: комментарий route:34–48 обещает единственного владельца устройства именно для предотвращения чужих project/rehearsal/member names на lock screen. Разовая регистрация B после A в обычном последовательном сценарии действительно чистит A; дефект только concurrent/поздняя операция, существующий sequential тест этого не доказывает.

Минимум (0.5 дня): очистить существующие duplicate tokens и обеспечить UNIQUE(device_token); заменить delete+insert на атомарный upsert, передающий владение token одному user. Плюс: БД гарантирует невозможность двух владельцев; минус: это само по себе не отличает актуального нового владельца от запоздалой старой session, для последнего нужны session-generation проверки.

Правильно (1–2 дня): device registration с generation/session ownership, revoke/cancel старых запросов при смене аккаунта, одно атомарное обновление владельца с version check; интеграционный barrier test двух registrations и проверка фактических получателей. Плюс: защищает как от двойных строк, так и от позднего возврата старого владельца; минус: Auth/client/server контракт. Обычная transaction без UNIQUE и достаточной сериализации не закрывает race двух пустых SELECT/DELETE.

## Результат прохода

Новых самостоятельных confirmed findings, не покрытых A/B/D/E/F, не начислено. Сохранены доказательства существующих A04, B01/B02, D01/D02/D03, ES02 и F02/F04, таблица FK/constraints и условные query-performance проверки. FC01 передан на G. Покрытие SQL-поиска не выдаётся за полное чтение всех серверных файлов.

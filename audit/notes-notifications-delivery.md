# G — серверная доставка push и владение токеном

Статическое чтение, 2026-09-10, HEAD 8de99ab. Полностью прочитаны `server/services/notifications/pushNotificationService.js` (349 строк), `notificationStore.js` (206), `server/routes/native/pushTokens.js` (127), `server/i18n/pushNotifications.js` (296), `server/__tests__/routes/pushTokenOwnership.test.js` (155), `rehearsalNotifications.test.js` (372). Push ownership тест перечитан после обрезанного вывода. Глобальный поиск receipt/send/record по first-party server JS; обработчик receipts отсутствует. Код не запускался.

## G01 — High — конкурентная регистрация оставляет двух владельцев одного push-токена

Доказательство: `server/routes/native/pushTokens.js:49-52`: `DELETE FROM native_push_tokens WHERE device_token = ? AND user_id != ?`; отдельный запрос :61-69: `ON CONFLICT (user_id, device_token) DO UPDATE`. Схема `server/database/init-native-schema.sql:237` имеет `UNIQUE(user_id, device_token)`, не глобальную уникальность токена. `pushNotificationService.js:25-37` выбирает токены всех переданных userIds без проверки текущей сессии/владельца.

Сценарий: один телефон T, два ещё авторизованных запроса A и B (смена аккаунта/запоздалая регистрация). На PostgreSQL возможен порядок DELETE A → DELETE B → INSERT A → INSERT B. Даже если перед гонкой была строка A, первый DELETE её оставляет, второй удаляет; последующие INSERT создают обе строки. Обе операции возвращают 200. После этого приватные названия проектов, репетиций и имена из push A доставляются на телефон с аккаунтом B. Это гонка двух реальных регистраций одного токена, не утверждение об угадывании чужого токена. Последовательная перерегистрация уже исправлена и покрыта тестами, параллельная — нет. F/FC01 объединён сюда, не считать дважды.

Минимум: очистить дубликаты и добавить UNIQUE(device_token), заменить пару запросов атомарным UPSERT владельца (0.5–1 день; + обеспечивает одного владельца на уровне БД, − поздний запрос старой сессии всё ещё может стать последним). Правильно: привязка устройства к поколению сессии/регистрации, отклонение старых запросов и отзыв push при завершении сессии, плюс атомарная уникальность (1–3 дня; + закрывает stale ownership, − требует протокола клиента/сервера). Одна transaction без уникальности/блокировки не гарантирует отсутствие гонки. Проверить вручную через барьеры двух PostgreSQL соединений и смену A→B на устройстве; никакие запросы не запускались.

## G02 — Medium — ticket Expo принят за окончательный результат; receipts не обрабатываются

`pushNotificationService.js:89-103`: `const tickets = await expo.sendPushNotificationsAsync(chunk);` и `if (ticket.status === 'ok') { totalSent++; }`; ticket.id не сохраняется, removeInvalidToken вызывается только при немедленном ticket error. Поиск по server first-party JS не нашёл чтения receipts/планировщика их обработки.

Сценарий: Expo принял сообщение, затем APNs/FCM отклонил доставку из-за невалидного токена или credentials. В логах остаётся Sent, token не очищается по позднему DeviceNotRegistered, причина отсутствия push не видна. Inbox обычно остаётся доступен (записывается до отправки), поэтому это не утверждение потери всех данных уведомления. Согласно [официальной документации Expo](https://docs.expo.dev/push-notifications/sending-notifications/), ticket подтверждает приём в Expo, receipt — попытку передачи провайдеру; даже успешный receipt не доказывает показ пользователю. Источник проверен 2026-09-10.

Минимум: сохранять ticket ID с токеном, отдельным периодическим шагом читать receipts и удалять только подтверждённые невалидные токены (0.5–1.5 дня; + видны поздние ошибки, − состояния повторов ещё разрознены). Правильно: таблица доставок/outbox с accepted/provider-delivered/failed, ограниченными повторами временных ошибок и метриками (2–4 дня; + наблюдаемость и управляемые повторы, − миграция/фоновые задачи). Ручная проверка: управляемые mock-ответы ticket ok → receipt error; никакая отправка не выполнялась.

## Стыки и исключённые дубли

- GR01: `sendPushNotification:114-117` возвращает summary вместо rejection; `sendLocalizedNotification:172-184` его теряет. Reminder scheduler считает resolve успешным. Это подробно в notes-reminders.md, не ещё одна находка здесь.
- B01 подтверждён на стыке G: при ошибке удаления responses после уже удалённого membership `routes/native/rehearsals.js:159-162,219-222` берёт получателей только из responses; :175-181/:229-232 отправляет им новые сообщения. В send/record/getTokens нет active-membership guard. Значит бывший участник с осиротевшей response может получать обновления/отмену в inbox и push, хотя GET rehearsal защищён повторным membership guard. В B01 добавить это последствие; не отдельная G-находка. Для обычного успешного удаления данная проблема не заявляется.
- Уведомления сохраняются для пользователей с notifications_enabled=false намеренно: это настройка push, inbox продолжает работать. Само по себе не баг.
- Ошибка записи одной inbox-строки ловится и остальные продолжаются; потеря обеих доставок учитывается в GR01. Общий best-effort без outbox не размножать на каждую business-функцию.
- removeInvalidToken не await, но функция ловит свои ошибки: unhandled rejection здесь не подтверждён. Serverless freeze cleanup — ручной дополнительный сценарий, не отдельный confirmed.
- Логирование полного push token `pushNotificationService:127` отметить сквозному I; значения токенов в отчёт не выводить.

Тест pushTokenOwnership проверяет пять последовательных HTTP-сценариев на SQLite/mock adapter. Не проверяет interleaving двух владельцев, реальные Expo receipts, offline/session-switch клиента. RehearsalNotifications покрывает roster, исключение автора, diff изменений и очистку уже существующих claims при move; push service замокан целиком, гонка scheduler с переносом отсутствует. Locale strings просмотрены целиком; edge-case произвольной locale входит A03, не дублируется.

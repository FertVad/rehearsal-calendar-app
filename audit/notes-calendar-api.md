# Участок E — сервер синхронизации календаря

Статическое чтение 2026-09-08; HEAD 8de99ab, изменения чужой работы те же, что отмечены 7 сентября в progress. Код не запускался и не менялся.

## Покрытие и сценарии

Полностью прочитан `server/routes/native/calendarSync.js` (398): connections create/update/list/delete, mappings create/update/list/by-event/delete, update-sync-time. Полностью дочитаны imported endpoints `server/routes/native/availability.js:198-303`, повторно сверены bulk:70-167 и client API `src/shared/services/api.ts:327-404` (API файл теперь полностью прочитан с A/D). Полностью прочитаны tests `server/__tests__/routes/calendarMappingLookup.test.js` (62), `server/__tests__/integration/calendarSync.integration.test.js` (660), `src/shared/utils/__tests__/connectionCache.test.ts` (169), helper `src/shared/utils/formatLastSync.ts` (20).

Calendar routes хранят только метаданные календарей устройства, а сами события меняются через Expo Calendar на клиенте. Все handlers требуют requireAuth. Ownership чтения/удаления mapping проверяется JOIN к connection.user_id; POST mapping сверяет owner connection. Cross-user IDOR через подстановку чужого connectionId не найден. SQL значения параметризованы, динамический список imported IDs состоит из placeholders.

## Стыки, которые нельзя выдавать за независимые подтверждённые findings до client/F

1. `calendarSync.js:204-211`: GET by-event ищет `WHERE c.user_id = $1 AND m.event_type = $2 AND m.internal_event_id = $3`, без target calendar/connection/порядка. POST :257-261 разрешает отдельную mapping на каждую connection, поэтому одна репетиция на двух календарях даёт неоднозначный lookup. Client export/storage проверяет фактическое использование; связать с finding того прохода, не дублировать серверный и клиентский count.
2. `calendarSync.js:68-94` и :258-282 — SELECT→INSERT вместо атомарного UPSERT. При двух параллельных первых запросах оба видят отсутствие, второй INSERT сталкивается с unique либо создаёт дубль при отсутствии constraint. Проверить реальную схему F и достижимость concurrent exporter; минимальное решение UPSERT RETURNING (2–4 ч, простой DB fix), правильное единый keyed connection/mapping registry с device identity (1 день, больше migration/API работы).
3. DELETE connection :134-143 сначала удаляет mappings, затем connection без transaction: отказ второй операции оставляет connection без mappings. При CASCADE в F лишний первый DELETE стоит убрать. Может оставить экспортированные события без привязки, зависит от UI lifecycle E. Минимум один CASCADE delete (1 ч), правильно явно спланировать cleanup native events с журналом до удаления метаданных (0.5–1 день).
4. Imported batch PUT `availability.js:274-296` делает по одной UPDATE без transaction и `continue` для незаполненных полей; batch DELETE :238-252 отдельными блоками50. Неверный timestamp во второй записи PUT оставит первую сохранённой и даст500; пропущенные entries дают200. Нет общей гарантии batch atomicity, importer должен reconciliation после любой ошибки. Связать с конкретным client reporting/redo, если влияет на него; не присваивать High только за отсутствие transaction.
5. Imported update/delete фильтруют user+external_event_id+source IN(apple,google), не точный source/calendar/device. Bulk уникальность — user+external+source (:127-143). Проверка namespace и recurring occurrence identity — import проход. Сервер не делает собственный origin-id, доверяет client external_event_id.
6. POST connection :61 и mapping :241 проверяют только truthiness, enum/type/длины не проверены. POST mapping разрешает внутренний ID без сверки наличия/доступа к rehearsal; само по себе это меняет лишь metadata текущего пользователя и не выдаёт содержимое другого rehearsal, поэтому не объявлять доказанным IDOR. Enum SQL CHECK и client users проверяются F/E.

## Тесты против реализации

calendarMappingLookup действительно вызывает production router с mocked auth/db и проверяет только200 null/object. Не проверяет multiuser filtering actual SQL/две connections. calendarSync.integration делает свои SQL statements: "simulate UPSERT" — последовательный UPDATE, без production SELECT→INSERT/races/HTTP permission guards. Использует sync_direction `bidirectional/to_device/from_device`, тогда как current API принимает/клиент отправляет `both/export/import`. Совместимость реальной схемы уточнить F. Это ограничение доказательности tests, не результат запуска.

connectionCache test моделирует ручной `resetConnectionCache()`; он не проверяет его фактическое выполнение в момент account switch и завершение старого async request после reset. Последнее изучают auth/storage/hooks стыки E. formatLastSync прост и сам не запускает clock updates: устаревание label до rerender косметическое, отдельной finding не начислено.

На момент записи самостоятельных подтверждённых находок из E API нет; перечисленные server свойства — доказательства для сквозных client findings и F, а не утверждение полной runtime корректности.

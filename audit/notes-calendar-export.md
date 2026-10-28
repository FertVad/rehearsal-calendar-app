# Участок E: экспорт в календарь устройства

Статус: готов для перечисленного покрытия. 2026-09-08. Только чтение; исходники не менялись, приложение/тесты/API не запускались. Пути от `rehearsal-calendar-native/`.

## EX01 — Medium — Экспорт присваивает личное событие по совпадению текста и затем может удалить его

**Код:** `src/shared/services/calendar/export.ts:141-151`: если URL не содержит rehearsal id, совпадение определяется через title (включая произвольный rehearsal.title), время начала/конца с допуском 1 минуты и location. `195-201` затем вызывает `saveEventMapping(rehearsal.id, duplicateEventId, calendarId)`. Нет проверки notes/app marker или согласия присвоить это событие. После такого mapping обновление вызывает `updateEventAsync` (`281,390`), unsync — `deleteEventAsync` (`301,437`).

**Сценарий:** в выбранном writable календаре уже есть вручную созданная запись «Репетиция» 10:00–12:00 без места; администратор создаёт одноимённую репетицию с тем же временем. Legacy heuristic считает личную запись экспортом приложения. После изменения репетиции её перезапишут, а при удалении репетиции/отключении экспорта удалят личное событие. Особенно вероятно с короткими общими названиями и отсутствующим location, который нормализуется в пустую строку (`108,149`).

**Последствие:** потеря/перезапись календарных данных, которые приложение не создавало. Глобальное разрешение на календарь не подтверждает происхождение конкретной записи.

Оценка Medium: требуется совпадение title/start/end/location в выбранном календаре, затрагивается отдельное локальное событие; широкий охват или эксплуатация атакующим не доказаны.

**Минимум:** для автоматического adoption требовать собственный URL-marker, у legacy дополнительно устойчивый app marker в notes; при сомнении создавать отдельное событие (2–4 часа; устраняет чужое присвоение, возможны дубли старых экспортов). **Правильно:** явная миграция legacy mappings с review/подтверждением неоднозначных совпадений, стабильный app/account/event identity и проверка ownership перед update/delete (1–2 дня; надёжнее для нескольких устройств, больше интеграционной проверки).

## EX02 — Medium — После неудачного удаления mapping всё равно уничтожается, событие становится бесхозным

**Код:** `export.ts:536-555` собирает ошибки удаления отдельных events, но после этого безусловно выполняет `clearAllMappings()` (`565-566`), включая записи, которые удалить не удалось. Второй путь: move сначала `createCalendarEvent` сохраняет mapping нового event (`369`, создание `244`), затем удаляет старый; catch удаления только логирует (`371-375`) и функция возвращает успех.

**Сценарии:** (1) «Удалить все экспортированные» — часть календарей недоступна/permission отозван/платформенное удаление падает. failed счётчик растёт, но mappings этих events удалены. Повторная очистка их уже не найдёт. (2) Смена export calendar: новая копия создана, старое удаление упало; mapping уже указывает только на новую, старую больше нельзя удалить штатной очисткой.

**Последствие:** оставшиеся старые/дублированные события и напоминания; UI может сообщить успешный перенос, последующее управление событиями утрачено. EX01 усиливает риск: однажды присвоенное личное событие тоже становится целью cleanup.

**Минимум:** не clearAllMappings после partial failure, удалять mapping только успешного event; при move сохранять pending-old-event cleanup и отражать failure (3–6 часов; исправляет повторный retry, добавляет маленький журнал). **Правильно:** lifecycle mapping current/pending-delete с идемпотентными retry и operation result, который явно разделяет created/removed/failed (1–2 дня; надёжно при частичном успехе, сложнее хранение/миграция).

## EX03 — Medium — Ошибка update превращается в «успешный» экспорт старого события

**Код:** `export.ts:389-400` при любой ошибке update удаляет mapping и вызывает createCalendarEvent. create сначала делает поиск существующего event; если найден тот же rehearsal URL (`127-132`), просто сохраняет mapping и возвращает id (`195-201`), **не применяя обновлённые поля**. Batch считает fulfilled успешным (`487-488`).

**Сценарий:** событие существует, серверное время изменилось; Calendar.updateEventAsync временно отклоняется или календарь стал read-only при сохранённом общем разрешении. Recovery поиск видит старое событие с тем же URL и объявляет его результатом create. Исходная ошибка исчезает, event остаётся со старым временем, batch success++. На каждом новом sync цикл может повторяться.

**Последствие:** пользователь видит «синхронизировано», но получит старое время/место и неверное напоминание.

**Минимум:** recreate только при достоверной not-found ошибке; остальные ошибки пробрасывать без удаления mapping (2–4 часа; не маскирует failure, надо классифицировать platform errors). **Правильно:** отдельный результат read/update/create с классификацией ошибки и подтверждением конечного содержимого event; adopting duplicate должен тоже сверить/обновить payload (0.5–1 дня; корректно восстанавливается, больше platform сценариев).

## EX04 — Medium — Неуспешный read/search трактуется как отсутствие и запускает создание дублей

**Код:** `export.ts:60-69` сначала проверяет общее permission, но затем `getEventAsync` catch любого типа возвращает null. `findDuplicateEvent:160-162` также возвращает null при любом getEventsAsync failure. Caller удаляет mapping и пересоздаёт (`401-406`).

**Сценарий:** permission уже проверен как granted, затем временный сбой native calendar/изменение доступа между проверкой и lookup вызывает read error. Ветка считает event удалённым и уничтожает mapping. Если duplicate search тоже не смог прочитать events, но create доступен/уже восстановился, создаётся новый event поверх существующего. Старый остаётся без mapping. Даже без дубля ошибочный remove ухудшает восстановление.

**Последствие:** дубли в календаре, потеря привязки и повторные напоминания после краткого сбоя. **Минимум:** null только для известного not-found; permission/network/native ошибки пробрасывать, не делать create после failed search (2–4 часа; сохраняет mapping, может потребовать retry вручную). **Правильно:** tri-state found/absent/unknown, backoff и идемпотентная reconciliation по app marker (0.5–1 дня; безопасное восстановление, сложнее обработка состояния).

## Стыки и условные риски

- Mapping provenance: `syncRehearsalToCalendar:341-352` принимает eventId из server/device mapping и читает его, но не проверяет фактический `existing.calendarId` или `existing.url` на совпадение rehearsal/account. Проверяет лишь **metadata** `mapping.calendarId !== requested calendarId` (`367`). `unsyncRehearsal:437` и removeAll `538-540` вообще удаляют eventId без read verification. Root подтвердил API by-event lookup по userId/eventType/internalId без device calendar/connection; storage аудитор подтвердил `calendarMappings.ts:181-201` сворачивает записи разных connections по одному internal_event_id и server wins local. Полученный foreign-device eventId может вызвать recreate/delete/update не той привязки. При recreate поиск marker ограничен ±1 день **нового** времени (`117-123`), поэтому перенос репетиции на другую неделю не обнаружит старую cloud-копию. Count этой проблемы остаётся в общем server/storage разделе, здесь только подтверждён потребитель.
- Account switch: AuthContext из A очищает calendar mappings лишь при смене owner; E storage/mappings аудитор проверяет late responses и actual cache scope. Export сам не несёт account ID/cancellation generation в event mapping/URL (`eventUrlFor:93`, EventMapping type:11-15).
- Дополнительная сверка Root: server GET all mappings идёт `ORDER BY last_sync_at DESC` (`calendarSync.js:184`), а client `calendarMappings.ts:181-187` последовательно перезаписывает result[id], поэтому для нескольких connections выигрывает **старейший** mapping и затем перекрывает local (`201`). Эта поправка относится к общему EM multiple-calendar/device finding; EX01–EX04 её повторно не считают.
- `RehearsalWithProject` не содержит isAllDay (`src/shared/types/calendar.ts:46-55`), create/update eventDetails не задают allDay (`export:204-227,269-278`). Передача all-day rehearsal как timed event — стык D→E: backend read contract также теряет isAllDay (подтверждён D). Не дублируется без полной writer/type-chain finding.
- `management.ts:24-28` возвращает все calendars с allowsModifications, включая shared calendars. Это не самостоятельный баг: пользователь может выбрать writable общий календарь. Но это расширяет последствия EX01; права на запись не означают app ownership конкретного события.
- `syncAllRehearsals:502` обновляет lastExportTime даже когда все операции failed; sync settings/consumer должен трактовать timestamp как попытку, а не успешную синхронизацию. UI/auto interval проверяется другим E аудитором.

## Покрытие

Полностью прочитаны: `src/shared/services/calendar/export.ts` (574), `management.ts` (55), `permissions.ts` (35), `index.ts` (42), `src/shared/types/calendar.ts` (87), `src/shared/services/calendar/__tests__/exportFailures.test.ts` (135), `exportMatching.test.ts` (138). Никакие migrations/configs/generated assets/node_modules здесь не читались. Import/storage/mappings проверяют другие аудиторы E; их evidence выше явно помечено как межмодульная сверка, не собственный полный read.

## Что тесты покрывают и пропускают

- exportFailures:34-64 проверяет denied permission **до** чтения, поэтому ловит старый вариант ошибки, но не случай granted→getEventAsync error (EX04).
- exportFailures:93-135 проверяет move success и невозможность создать новую копию; нет теста «новая создана, старое удаление упало» (EX02).
- Ни один из двух тестовых файлов не вызывает removeAllExportedEvents; unconditional clearAllMappings при partial delete не покрыт.
- exportFailures ordinary run:80-89 всегда даёт успешный update; нет update rejection→duplicate adoption→ложный success (EX03).
- exportMatching:78-100 закрепляет adoption немаркированного события без notes/ownership evidence. Он не различает настоящий legacy app-export и личную календарную запись с совпавшими атрибутами (EX01).
- exportMatching:55-65 разрешает URL-adoption «whatever else differs», но не проверяет, что финальное событие после такого adoption обновилось до текущего rehearsal payload. Это blind spot EX03.
- Tests полностью мокают mappings, не проверяя device/connection scoping и частичный отказ хранилища; соответствующий стык проверяет storage аудитор.

Для ручной проверки после исправлений: личное немаркированное совпадающее событие + export/unsync; partial delete failure; move с отказом удалить old copy; update rejection при остающемся URL-маркированном событии; granted permission с native read/search error; два устройства одного cloud calendar после переноса репетиции на неделю. Конкретная достижимость transient native read/search failure зависит от платформы и должна проверяться через контролируемую fault injection. Runtime проверки в аудите запрещены пользователем и не выполнялись.

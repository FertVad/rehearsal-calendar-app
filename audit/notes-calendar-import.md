# Участок E — импорт календаря

Статический аудит 2026-09-08. Код, тесты и любые проверки выполнения не запускались; исходники не изменялись. Пути относительно `rehearsal-calendar-native/`.

## Покрытие

Полностью прочитаны `src/shared/services/calendar/import.ts` (531 строка) и `src/shared/services/calendar/__tests__/importScope.test.ts` (300 строк). Всего 2 файла, 831 строка. Непосредственные storage/mappings dependencies прочитаны полностью, отдельные заметки `notes-calendar-storage.md`. Permissions/export/хуки UI и сервер проверяются другими аудиторами участка E. Native реализация expo-calendar, зависимости и фактические ответы календаря не проверялись.

## Сценарий

Импорт запрашивает события выбранных календарей с начала сегодняшнего дня до now+365 дней, параллельно получает все availability пользователя и экспортные mappings. Экспортированные репетиции исключаются по URL-маркеру или eventId mapping. Обычное событие получает внешний ключ event.id, recurring — event.id + start timestamp. All-day преобразуется в floating UTC календарные даты, включая последний день диапазона. Diff сравнивает события с импортированными apple/google строками БД, пересекающими окно. Delete/update/add запускаются параллельно, новые строки порциями по 50. В БД отправляются временные границы, source/eventId, isAllDay и постоянный title; контент события не отправляется. AsyncStorage tracking сохраняется после bulkSet. Cleanup удаления всех импортов доверяет наличию локального tracking.

## EI01 — High — diff удаляет импорт другого устройства/источника пользователя

Места: `src/shared/services/calendar/import.ts:233–264,270,297–305,362,420–438`.

```ts
const isImported = slot.source === 'apple_calendar' || slot.source === 'google_calendar';
return hasExternalId && isImported && inRange;
const dbEventMap = new Map(dbSlots.map((slot: any) => [slot.externalEventId || slot.external_event_id, slot]));
const calendarEventMap = new Map(eventsToProcess.map(e => [occurrenceKey(e), e]));
if (!inCalendar && !isExported) toDelete.push(id);
availabilityAPI.batchDeleteImported(toDelete)
```

Сценарий: пользователь импортировал рабочий календарь с устройства A; затем входит тем же аккаунтом на B и импортирует другой календарь (или тот же аккаунт провайдера, но события имеют device-local IDs). availabilityAPI.getAll возвращает обе категории imported этого пользователя; dbEventMap не ограничен текущим source, устройством или connection. В списке событий B нет eventId из A, все их будущие/текущие строки попадают в toDelete. Каждый последующий sync A/B может заменять занятость другого устройства. Приватные календари, доступные только одному устройству, — обычный случай, не предположение о совпадении eventId.

Подтверждённый серверный стык от основного аудитора, адреса дополнительно сверены поиском: `server/routes/native/availability.js:242–247` удаляет по userId + externalEventId + source IN(apple_calendar,google_calendar), без device/calendar scope. Update имеет тот же широкий scope (:281–290); уникальность bulk — user/external/source. Импортный payload вообще не несёт серверного connection/installation scope (:438 удаляет calendarId).

Проявление: занятые часы пропадают из планирования, коллегам предлагается конфликтующая репетиция. Это логическая потеря расписания внутри одного пользователя, не IDOR чужого аккаунта. Дополнительный риск: plain eventId одинаков на разных устройствах/провайдерах; Map стирает distinction source, batchUpdate/delete может затронуть обе строки. Реальный конфликт ID требует device проверки и отдельно как подтверждённая находка не считается.

Минимум (0.5–1 день): delete ограничить ID из tracking текущего устройства и только календарями, которые успешно прочитаны; пустой/утерянный tracking не даёт права массово удалять всю серверную занятость. Учитывать source при сравнении. Плюс: быстро защищает от чужого scope; минус: после reinstall/потери tracking останутся stale строки, пока не восстановлена provenance.

Правильно (2–4 дня): server-managed connection/installation namespace в импортированной строке и API; diff/delete только по этому scope и окну, глобальный stable provider ID применять лишь где он реально гарантирован. Подумать, как единый cloud календарь на двух устройствах согласуется с разными device-local IDs. Плюс: явное владение строками и безопасное удаление; минус: миграция существующего импорта и контрактов клиента/API.

## EI02 — Medium — неудачное чтение календаря считается успешной синхронизацией

Места: `src/shared/services/calendar/import.ts:74–85,292–295,349–352,469–470`.

```ts
catch (error) { failedCalendarIds.push(calendarId); }
if (failedCalendarIds.length > 0) {
  logger.warn('... skipping the delete pass this run');
}
if (toDelete.length === 0 && toUpdate.length === 0 && toAdd.length === 0) {
  await updateLastImportTime();
  return result;
}
if (result.failed === 0) await updateLastImportTime();
```

Сценарий: permission общий дан, но Calendar.getEventsAsync не смог открыть выбранный рабочий календарь (отозван доступ к account, временная ошибка провайдера). Fetch подавляет ошибку и сообщает только failedCalendarIds. Delete безопасно пропущен, но ни result.failed, ни errors не отражают чтение. Если все календари не прочитаны, function возвращает `{success:0,failed:0,errors:[]}` и ставит lastImportTime «сейчас». Если один прочитан — его изменения применятся, а failed=0 и новый timestamp сохранятся.

Проявление: пользователь не видит, что новые/изменённые busy интервалы не импортированы; старые данные становятся свежими по timestamp. Orchestration подтвердил: старый десятиминутный interval удалён, задержку retry из-за timestamp не утверждаем. Сам ошибочный success/timestamp подтверждён.

Минимум (1–2 ч): добавить failedCalendarIds в result.errors и не обновлять timestamp успешного полного sync при любом fetch failure. Плюс: честный статус без изменения diff; минус: счётчик failed смешивает события и календари, если добавлять в него число календарей.

Правильно (0.5–1 день): типизированный per-calendar результат чтения/записи и отдельные lastAttempt/lastSuccess; retry только failed calendars, UI частичного успеха. Плюс: корректный статус и восстановление; минус: меняет результат сервиса и его потребителей.

## EI03 — Medium — удаление всех импортов не работает без локального tracking

Места: `src/shared/services/calendar/import.ts:498–504,511,520–523`; `src/shared/utils/calendarStorage.ts:275–282`.

```ts
const importedEvents = await getImportedEvents();
const eventIds = Object.keys(importedEvents);
if (total === 0) return result;
// only reached for nonempty tracking
const response = await availabilityAPI.deleteAllImported();
```

Сценарий: availability импортирована на сервер, приложение переустановлено / пользователь пользуется другим устройством / локальный tracking потерян или getItem/JSON.parse вернул ошибку (storage catch отдаёт {}). Организатор вызывает «удалить все импортированные». Функция возвращает успех с нулями, даже не обращаясь к серверу, хотя server rows есть. Tracking также не восстанавливается из dbSlots при no-op импорте: записи tracking создаются только для toAdd (:444–446).

Проявление: занятость продолжает действовать после ожидаемого отключения/очистки импорта. Раздел «БД — primary, survives reinstall» не согласуется с зависимостью destructive cleanup от локального cache.

Минимум (30–60 мин): всегда вызывать deleteAllImported; количество брать из ответа сервера; очищать tracking только после успешного ответа. Плюс: маленькая правка и идемпотентная очистка; минус: один HTTP даже при реально пустой БД.

Правильно (0.5–1 день): scoped cleanup в рамках EI01 и серверный authoritative count, tracking только cache; использовать отдельный результат для ошибки local cache после успешного DB удаления. Плюс: корректно после reinstall и multi-device; минус: нужен API/UI контракт.

## EI04 — Medium — перенос recurring события может сначала стереть старую занятость, а новое время не записать

Места: `src/shared/services/calendar/import.ts:142–145,270,297–321,355–362,428–460`.

```ts
if (!event.recurrenceRule) return event.id;
return `${event.id}:${startsAt}`;
operations.push(availabilityAPI.batchDeleteImported(toDelete)...);
operations.push(availabilityAPI.bulkSet(wire as any)...);
await Promise.all(operations);
```

Сценарий: импортирована регулярная встреча 10:00, она переносится на 11:00. Ключ occurrence включает start timestamp, поэтому diff воспринимает новый ключ как add, старый как delete (при переносе серии — много таких пар). Операции выполняются независимо/параллельно. Delete проходит, create chunk получает сетевую/серверную ошибку. На сервере больше нет старой и ещё нет новой занятости. Ошибка в result.failed сообщает о проблеме, но не откатывает уже выполненный delete. С обычным one-off event эта конкретная проблема смены ключа не возникает, он идёт через update.

Проявление: в интервале до следующего успешного sync участник выглядит свободным и для старого, и для нового времени; это хуже безопасного сохранения stale busy. Комментарий :289–291 называет «too busy rather than too free» желаемым поведением при неопределённости, но apply phase его не сохраняет.

Минимум (1–3 ч): сначала дождаться успешных add/update и только затем разрешить destructive delete; при любой записи, не подтверждённой сервером, сохранить старую занятость. Плюс: false-free заменяется временным overblocking; минус: без transaction может временно отображаться двойная занятость.

Правильно (1–2 дня плюс API): применить scoped diff атомарно на сервере с revision/idempotency, либо идентифицировать occurrence стабильным originalStartDate там, где API это поддерживает. Плюс: согласованный снимок; минус: изменение модели sync/контракта. Нужны отказ create после успешного delete и отказ одной из нескольких порций — здесь не запускались.

## Проверено и ограничения

- All-day multi-day: начало берётся как device-local дата; end минус1ms учитывает exclusive midnight, затем оба дня хранятся в floating UTC. Для обычных native local-midnight событий длительный отпуск сохраняет все даты. Не проверено на устройстве, как iOS/Android/provider возвращают allDay Date/string и timezone. Если Android отдаёт all-day UTC midnight, device-local getDate может сдвинуть дату; это условие требует проверки native контракта, отдельного подтверждённого бага здесь нет.
- Recurrence keys разделяют несколько occurrence при наличии recurrenceRule; отсутствуют тесты этого кода. Для detached/modified occurrences фактическое наличие recurrenceRule и стабильность id/originalStartDate требуют native проверки. Нет утверждения, что все recurrence сейчас ломаются.
- Пересечение DB окна проверяется по start/end, а не только startsAt; прошедшие/дальние события не удаляются. Маленькое расхождение inclusive end сравнения >= vs half-open native API возможно ровно на границе, но значимого воспроизводимого ущерба здесь не установлено.
- Event content не передаётся в bulk/update: title постоянный, notes/location/url/calendarId не включены. external_event_id остаётся частью технического wire, поэтому утверждение «вообще ничего идентифицирующего» в названии теста :200 шире реальности; не считаем это передачей содержимого события.
- Permission полностью отсутствует → throw до применения изменений. Один календарь отказал → delete пропущен для всего scope, что безопасно от массового стирания, но статус неверен (EI02).
- Create chunks 50, update/delete идут одним payload, все create chunks запускаются одновременно. Root проверяет размер body/rate limits; при больших реальных правках возможен отказ, но без проверенного лимита/профиля отдельную находку не начисляем.
- `onProgress` принят обеими exported функциями (:157,:488), нигде не вызван. Стык UI progress проверить у автора hooks; функциональную потерю импорта из этого не выводим.
- Импортные unit tests покрывают DB scope окна, no-op timed событий, payload privacy, URL exclusion экспортированных репетиций. Не покрыты failed calendar fetch, reinstall cleanup, multi-device diff, recurrence/all-day conversion и частичный failure apply. Ни один тест не запускался.

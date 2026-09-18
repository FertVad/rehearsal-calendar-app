# Участок E — календарные storage и mappings

Статический аудит 2026-09-08, без запуска кода/тестов и без правок исходников. Все пути относительно `rehearsal-calendar-native/`.

## Покрытие

Полностью прочитаны `src/shared/utils/calendarStorage.ts` (339 строк), `src/shared/utils/calendarMappings.ts` (245 строк), `src/shared/utils/__tests__/calendarStorageWrites.test.ts` (73 строки). Всего 3 файла, 657 строк. Импортный caller полностью прочитан в рамках `notes-calendar-import.md`. Адресно прочитаны стыки AuthContext reconcileDeviceState/login, API interceptor, export.ts:329–415; это не заявляется полным покрытием этих файлов, их полностью проверяли другие аудиторы. Native storage/platform реализация и runtime не проверялись.

## ES01 — High — незавершённый sync прошлого пользователя продолжает запись под новым аккаунтом

Места: `src/shared/utils/calendarStorage.ts:10–14,33–44,258–264`; `src/shared/services/calendar/import.ts:188–192,316–321,441–446`; `src/contexts/AuthContext.tsx:64–82,202–208`; `src/shared/services/api.ts:85–90`; `src/shared/hooks/useAutoCalendarSync.ts:236–240,255–283,318–333`.

Цитаты:

```ts
// calendarStorage.ts:10–14 — общие для любых аккаунтов ключи
EXPORT_MAPPINGS: 'calendar-export-mappings',
IMPORT_TRACKING: 'calendar-import-tracking',
SYNC_SETTINGS: 'calendar-sync-settings',

// import.ts:188–192 — native read и DB read начаты под A
const [{ events, failedCalendarIds }, dbResponse, exportedMappings] = await Promise.all([
  fetchCalendarEvents(calendarIds, startDate, endDate),
  availabilityAPI.getAll(),
  knownMappings ? Promise.resolve(knownMappings) : getAllMappings(),
]);
// import.ts:441 — после await авторизация не закреплена за A
availabilityAPI.bulkSet(wire as any)

// api.ts:88–90 — каждый новый HTTP использует токен на данный момент
const token = await AsyncStorage.getItem('accessToken');
if (token) config.headers.Authorization = `Bearer ${token}`;
```

Подтверждённый совместный timeline (Auth проверен основным аудитором, auto hook — автором `notes-calendar-orchestration`):

1. Пользователь A запускает auto/manual sync. Auto guard проверяет только наличие token в начале (:236–240), import запоминает выбранные A calendarIds и начинает native fetch + getAll. getAll успевает вернуть availability A, Calendar.getEventsAsync ещё ожидает provider.
2. A выходит; начинается вход B. AuthContext login сначала пишет accessToken/refreshToken B (:202–206), затем reconcileDeviceState (:208) удаляет общие calendar keys и сбрасывает connection cache (:64–82). Ни logout, ни reconcileDeviceState не отменяют и не ожидают старый календарный sync; cleanup auto effect лишь снимает listener (:318–333), global currentSync не принадлежит session/user.
3. Старый native fetch A завершается. Старый import строит diff по событиям/DB snapshot A; перед bulkSet/update/delete не проверяет captured user/session generation. Axios перехватывает новый token B. Даже если у B import выключен по умолчанию, A calendar events загружаются в занятость B. При совпадающих external IDs возможны update/delete импортированных B строк; для доказательства write/leak совпадение не требуется — достаточно нового события A в toAdd.
4. После successful write saveImportedEvent и timestamp снова наполняют неключёванные userId AsyncStorage keys данными A (:444–446), уже после очистки B. Отдельно queued updateStored writer мог прочитать A map до clear и записать его обратно после await; clear/removeItem не стоят в той же очереди.

Проявление: временные данные личного календаря A оказываются в аккаунте B и его project availability; неверная занятость B, потенциальное раскрытие расписания A коллегам B. Контент/title события import маскирует, поэтому утечка здесь именно временных интервалов и технических IDs, не названий встреч. Это собственная cross-account гонка клиента, а не обход серверной авторизации: сервер корректно выполняет запрос от token B.

Минимум (0.5–1 день): session generation/userId capture при старте sync, invalidate до смены tokens/cleanup; после каждого awaited native/API этапа и перед каждой side effect проверять generation, отбрасывать устаревшие операции. AbortController для API плюс остановка последующих native side effects. Плюс: предотвращает продолжение цепочки; минус: уже отправленные запросы/native mutations отменяемы не всегда, нужны чёткие точки завершения.

Правильно (2–3 дня): sync coordinator с явным owner/session lifetime, запрет account switch commit до отмены/settlement старых операций или отдельный immutable owner-bound API client; cache keys/queues по userId + device connection, очистка через coordinator. Плюс: изоляция данных и lifecycle; минус: несколько слоёв Auth/API/calendar, нужны гонки logout/login при задержках и pending local writes. Пользовательский logout не должен бесконечно ждать недоступный provider — задача отменяется логически, с bounded cleanup.

Не дублировать эту находку отдельными EO lifecycle пунктами. Обычные static clearing/reset при последующем входе уже присутствуют; проблема исключительно незавершённых операций.

## ES02 — Medium — mappings разных календарей/устройств схлопываются, причём старейший перезаписывает новый

Места: `src/shared/utils/calendarMappings.ts:173–201,116–144`; `server/routes/native/calendarSync.js:184`; `src/shared/services/calendar/export.ts:341–352,367–375,390–406`.

```ts
// calendarMappings.ts:181–187
for (const mapping of mappings) {
  result[mapping.internal_event_id] = {
    eventId: mapping.external_event_id,
    calendarId: mapping.device_calendar_id,
    lastSynced: mapping.last_sync_at,
  };
}
// :201
return { ...cached, ...result };
// server/routes/native/calendarSync.js:184
sql += ' ORDER BY m.last_sync_at DESC';
```

Сценарий: один пользователь экспортировал rehearsal R в нескольких connections (несколько устройств/календарей). Сервер допускает несколько mappings для internal_event_id в разных connection. GET all сортирует newest first, но клиент складывает все в объект `result[R]`, игнорируя connectionId/device, поэтому последний (самый старый) детерминированно побеждает. Затем server result вытесняет даже новый правильный local cached mapping. Single getEventMapping также запрашивает по rehearsal без current connection (метод/серверный стык подтверждён root).

Проявление: sync получает старый или device-local ID другого устройства. Если ID отсутствует локально, export считает событие удалённым и заново создаёт/ищет дубликат (:401–406). Его поиск ограничен ±1 днём новой даты (экспортный аудитор подтвердил :117–123); если репетиция перенесена дальше, прежняя cloud-копия остаётся, новая создаётся отдельно. Повторяющийся выбор oldest mapping делает это системным. Если ID случайно обозначает другое событие на текущем устройстве, export не проверяет url/calendar ownership перед update/delete (:390,:372) и может затронуть это событие — это дополнительный условный повышенный риск, конкретное совпадение ID требует проверки на устройстве, не отдельная подтверждённая High находка.

Минимум (1–3 ч): фильтровать mappings по текущему календарю/connection до свёртки, выбирать первый newest, предпочитать подтверждённый local mapping для текущего устройства; перед native update/delete сверять marker rehearsalId/calendarId. Плюс: локальное снижение риска; минус: календарный ID тоже device-local, без installation namespace неоднозначность сохраняется.

Правильно (1–2 дня): контракт getMapping/getAll/put/delete с current installation+connection, тип `Record<connectionId, Record<rehearsalId,mapping>>`, независимые exports по устройствам; локальное recovery по marker и временному окну с учётом прежней даты. Плюс: каждая mapping однозначна; минус: клиент/API контракт и миграция cache. Отдельные export эвристики/partial delete рассматриваются EX01/EX02 и не дублируются здесь.

## ES03 — доказательства к EO04, без отдельного count — settings writers обходят очередь

Места: `src/shared/utils/calendarStorage.ts:33–44,201–205,215–219,324–333`.

```ts
// saveSyncSettings.ts:205 (функция в calendarStorage.ts)
await AsyncStorage.setItem(KEYS.SYNC_SETTINGS, JSON.stringify(settings));
// updateLastExportTime:217–219
const settings = await getSyncSettings();
settings.lastExportTime = new Date().toISOString();
await saveSyncSettings(settings);
// updateLastImportTime:330–333
await updateStored(KEYS.SYNC_SETTINGS,
  (settings) => ({ ...settings, lastImportTime: new Date().toISOString() }),
  {} as CalendarSyncSettings);
```

Подтверждено на уровне реализации: изменение lastImportTime сериализуется только с другими updateStored; saveSyncSettings и updateLastExportTime обходят очередь, поэтому гарантия комментария :326–329 («оба timestamp одной синхронизации не теряются») неполна. Дополнительно async settings writer может сохранить полный устаревший объект и вернуть старый importEnabled/exportEnabled/selected calendar вместе с timestamp.

Сценарий: updateLastExportTime прочитал settings S; пользователь/параллельный writer сохранил S' (другой календарь, выключенный import, либо новый lastImportTime); export сохраняет S+timestamp и перезаписывает изменение. Для simultaneous import/export timestamp loss необходимо подтверждение orchestration: обычная full sync может выполнять их последовательно, поэтому не утверждаем, что каждая full sync уже теряет timestamp. Отдельные UI handlers / manual+auto concurrency уточняются у аудитора hooks.

Достижимость подтверждена EO04: между importNow и getBatch UI разрешает выключение/смену календаря, а старый sync callback сохраняет полный старый snapshot. Manual и auto также не используют общий lock. Это доказательства той же EO04, не самостоятельная finding и не отдельный count.

Минимум (1–2 ч): все read-modify-write settings операции проводить через единый updateStored, lastExportTime тоже patch, а UI передавать patch изменённых полей. Плюс: малое изменение и очевидная сериализация; минус: full stale snapshots нельзя просто поставить в очередь — они всё равно перезаписывают новые значения.

Правильно (0.5–1 день): единый user-scoped settings store/reducer и patch API, sync timestamps отдельными полями/ключами с независимым обновлением, тесты конкурентных переключений. Плюс: не смешиваются настройки и служебный статус; минус: рефактор нескольких callers.

## Дополнительные стыки и проверенные свойства

- `saveEventMapping` hybrid (:89–110) catch подавляет даже ошибку первичного `saveToAsyncStorage`, хотя fallback comment предполагает, что local запись уже успешна; при отказе обоих хранилищ функция всё равно resolve. Export caller после создания native события считает mapping сохранённой. Конкретное поведение дублирования/отчёта учтено у export-аудитора; не начисляем здесь duplicate finding без отдельной проверки UX.
- `removeEventMapping` (:150–168) и `clearAllMappings` (:224–245) очищают local, подавляют DB failure. На следующем успешном getAll server stale mapping может вернуться. Export partial-delete проблема отдельно EX02; общий storage API не подтверждает durable удаление и требует учитывать это при callers.
- `clearAllMappings` storage:136 и `clearAllImportedEvents`:306 обходят очереди; standalone гонка clear/save возможна. В cross-account сценарии это включено ES01, не считать отдельно.
- getImportedEvents/getAll local mapping подавляют read/parse failure в `{}`. EI03 описывает конкретное неверное действие remove-all. getAll hybrid при server failure и пустом local cache бросает явную ошибку (:217), это защищает импорт от ложного «ничего не экспортировано». Если cache непустой, возвращается потенциально неполный fallback, что требует осторожности с destructive diff.
- Per-key updateStored корректно сериализует saveImportedEvent/removeImportedEvent/saveEventMapping/removeEventMapping в одном JS runtime; ловит предыдущую ошибку только для продолжения очереди, caller собственную ошибку получает; queue entry удаляется только если не заменён новым run. Прочитанные tests проверяют save50 импортов, save10 экспортов и параллельный remove/save одного tracking key.
- Очередь не изолирует разные JS runtimes/процессы и не привязана к user. Native multi-process concurrency не исследовалась; не утверждаем её наличие. В текущем runtime выявленная межсессионная проблема уже ES01.
- Нет schema validation JSON настроек/mappings. Malformed persisted structure может ломать readers, но источник повреждения не установлен; отдельного security finding нет.

## Не проверено выполнением

Account switch во время ожидающего native read/между HTTP chunks и pending AsyncStorage writes; два устройства/две connections с одной репетицией и переносом >1 дня; настройка import/export во время timestamp save; storage I/O/JSON corruption; interrupted mapping DB write. Все эти сценарии предложены для ручной/интеграционной проверки, запуска не было.

# Участок C — доступность и ввод

Полностью: server/routes/native/availability.js, server/utils/timezone.js, server/constants/timezone.js, route test availabilityBulk.test.js. Дополнительно shared/utils/time.ts и useAvailabilitySave.ts полностью для контракта дат. Клиентские сценарии — notes-availability-client.md.

Прочитаны также server/__tests__/timezone.test.js, server/__tests__/integration/availability.integration.test.js, src/__tests__/availabilityValidation.test.ts и src/__tests__/integration/availabilityFlow.test.ts. SQL-only integration не тестирует HTTP replacement и timezone semantics production. Клиентский integration мокает ответы 400 для overlap, хотя сервер их сам не генерирует — не считать эти моки доказательством backend validation.

## C01 — High — all-day записи удаляются/заменяются по неверному дню в UTC−

Решающая цитата `server/routes/native/availability.js:113–117` (тот же предикат на :184–188):

```js
`DELETE FROM native_user_availability
 WHERE user_id = $1
 AND DATE(starts_at AT TIME ZONE $2) = $3
 AND source = $4`,
[userId, timezone, date, AVAILABILITY_SOURCES.MANUAL]
```

Клиент `src/features/availability/hooks/useAvailabilitySave.ts:51-65` хранит all-day как `dateT00:00:00.000Z`..23:59:59.999Z, т.е. календарная дата, не момент. Сервер `routes/native/availability.js:95-117` вычисляет affectedDates из строкового YYYY-MM-DD, но DELETE использует `DATE(starts_at AT TIME ZONE $2)`. DELETE дня :183-188 делает то же. В America/New_York all-day 2026-09-15T00Z находится 14 сентября локально. Повторное сохранение 15-го не удалит старую запись 15-го, зато может удалить all-day 16-го (локально 15-е). Уникальность imported event для NULL external_event_id это не исправляет. Сохранение одного дня удаляет соседний, в текущем дне накапливаются противоречивые free/busy. Минимум: CASE WHEN is_all_day THEN DATE(starts_at AT TIME ZONE 'UTC') ELSE DATE(starts_at AT TIME ZONE $2) END в обоих DELETE (2–4 ч). Плюс: локально исправляет удаление без миграции; минус: смешанный контракт date/instant остаётся, оба пути нужно поддерживать согласованно. Правильно: отдельный DATE/day key для floating all-day и явный ключ заменяемого дня; timed events с нормализованным timezone контрактом (1–2 дня). Плюс: календарный день хранится без неоднозначной конвертации; минус: миграция данных и согласование API/клиента. Проверить PostgreSQL, не только test adapter.

## C02 — Medium — неполная запись стирает день с ответом success

Решающие условия `server/routes/native/availability.js:98–100` и :121–123 (между ними выполняется DELETE :110–118):

```js
if (entry.startsAt && entry.type && entrySource === AVAILABILITY_SOURCES.MANUAL) {
  affectedDates.add(entry.startsAt.split('T')[0]);
}
```

```js
for (const entry of entries) {
  const { startsAt, endsAt, type, title, notes, isAllDay, source, external_event_id } = entry;
  if (!startsAt || !endsAt || !type) continue;
```

`availability.js:98-99` включает день в affectedDates при startsAt+type; после DELETE `:123` пропускает entry без endsAt. Payload с валидными startsAt/type, отсутствующим endsAt удаляет все manual rows дня, не вставляет ничего и отвечает success (:159). Похожая проблема — type/source/isAllDay не валидируются; null entry/нестроковый startsAt падают ещё до try (:96-100). Минимум: валидировать все entries целиком до DELETE и вернуть 400 на любую невалидную (2–4 ч). Плюс: прекращает потерю данных до первого write; минус: ручные guards в одном route могут разойтись с imported updates. Правильно: единая схема bulk/imported updates с лимитами, допустимыми source и результатом по каждой записи (1–2 дня). Плюс: единый проверяемый контракт входа и ошибок; минус: изменение нескольких callers/tests, частичные результаты не должны нарушать атомарный replace-day. Ошибку malformed body до try объединить с A02, не считать отдельным DoS.

## C03 — Medium — параллельные manual saves могут склеить взаимоисключающие состояния

Решающая последовательность начинается с обычной transaction и DELETE (`server/routes/native/availability.js:110–113`):

```js
await db.transaction(async (tx) => {
  for (const date of affectedDates) {
    await tx.run(
      `DELETE FROM native_user_availability
```

За ней следует INSERT с уникальностью внешнего ID, не дня (:141–143):

```js
`INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, notes, is_all_day, source, external_event_id)
 VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, $7, $8, $9)
 ON CONFLICT (user_id, external_event_id, source) DO NOTHING`,
```

`availability.js:110-155`: transaction выполняет DELETE затем INSERT без блокировки user/day. У двух PostgreSQL READ COMMITTED транзакций для ещё пустого дня оба DELETE заканчиваются на 0 строках, обе вставки manual с NULL external_event_id проходят; итог — оба набора, хотя контракт «replace the day». UNIQUE(user_id,external_event_id,source) не ограничивает NULL. Сценарий два устройства/повтор сети одновременно free vs busy. Минимум: lock user row в transaction до DELETE (2–4 ч). Плюс: сериализует замену даже пустого дня без отдельной day таблицы; минус: сериализует и независимые дни пользователя, последний save молча побеждает. Правильно: day record c revision + conditional update/409 и idempotency keys (1–2 дня). Плюс: конфликт двух редакторов явный, retries не повторяют write; минус: схема/revision и обработка conflict в клиенте. Требует concurrency ручной проверки на PostgreSQL; не запускалась.

## Стыки/наблюдения

## C04 — Medium — дедупликация по часам теряет источник и может скрыть занятость

Решающая цитата `src/features/availability/hooks/useAvailabilityData.ts:153–159`; rehearsal pass на :144–150 уже заполнил `seenTimeRanges`:

```ts
// Second pass: add manual/other slots only if time range not already covered by rehearsal
for (const slot of slots) {
  if (slot.source !== 'rehearsal') {
    const key = `${slot.startTime}-${slot.endTime}`;
    if (!seenTimeRanges.has(key)) {
      uniqueSlots.push(slot);
      seenTimeRanges.add(key);
```

`src/features/availability/hooks/useAvailabilityData.ts:137-167`: ключ `${slot.startTime}-${slot.endTime}` не включает source/type; rehearsal сохраняется первым, остальные одинаковые интервалы отбрасываются. Затем только оставшиеся own slots попадают в editable state (:191-221). Сценарий 1: manual all-day available и imported all-day busy имеют одинаковые 00:00–23:59, manual попадает первым (SQL сортирует лишь starts_at): imported отбрасывается, экран показывает free, тогда как members API отдаёт оба интервала и planner считает busy. Сценарий 2: manual busy 10–12 совпал с rehearsal, ещё есть manual 15–16; после reload+Save остаётся только manual 15–16, потому что 10–12 был исключён из snapshot. После отмены rehearsal теряется исходная ручная занятость. Минимум: не удалять независимые source/type записи из модели, группировать только визуально (2–4 ч). Плюс: сохраняет оригинальные записи при существующем API; минус: UI должен аккуратно показывать совпадения и приоритеты, иначе вырастет визуальное дублирование. Правильно: отдельные manual declarations и внешние constraints с сохранением идентичности; write только dirty manual данные (1–2 дня, совместно CC05). Плюс: отображение совпадений не влияет на сохранность редактируемой модели; минус: изменение client state/read-write contract и сценариев сохранения. Порядок ties в SQL не гарантирован, поэтому сценарий 1 зависит от порядка; сценарий 2 следует из явного rehearsal-first независимо от ties.

## Стыки/наблюдения (продолжение)

- A02 расширение: timezone DB lookup bulk :79 и parsing :95-100 до try. Ошибки здесь не перехватываются Express 4.
- A03 подтверждён downstream: неверная timezone вызывает Intl.DateTimeFormat RangeError в `server/utils/timezone.js:53-61` и ошибку SQL AT TIME ZONE; personal GET только читает timezone, но members planner конвертирует её.
- Source/type enums: server constants объявляют FREE='free', редактор посылает 'available'. Проверить CHECK и planner precedence в D/F; сами неиспользуемые constants не баг.
- imported batch update/delete scoped user, но источник apple/google объединён и externalEventId не включает календарь; связь и коллизии проверить E.
- Нет file upload/платежей в участке. SQL динамические части состоят из placeholders, пользовательские значения параметризованы.

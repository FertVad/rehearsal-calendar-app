# Участок D — сервер репетиций и RSVP

Прочитаны полностью routes/native/rehearsals.js; services/rehearsals/{rehearsalService,rsvpService,slotService}.js; shared/types/index.ts для контракта. Формы, calendar display и smart planner в отдельных заметках текущего D.

## D01 — High — администратор проекта пишет занятость произвольным пользователям

Решающая цитата `server/services/rehearsals/rehearsalService.js:404–409`:

```js
for (const participantId of participant_ids) {
  await db.run(
    'INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
    [newRehearsal.id, participantId, 'no']
  );
}
```

`rehearsalService.js:402-408` вставляет каждый participant_ids в native_rehearsal_responses, не сверяя с active members проекта. PUT :517-541 лишь Number/Integer фильтр, также без membership. `slotService.js:29-49` берёт все response rows и записывает busy availability этим user_id. Админ своего нового проекта передаёт ID постороннего существующего пользователя: у того появляется read-only 'rehearsal' busy slot; уведомления create/update тоже получают эти rows (`routes/native/rehearsals.js:107-117`). Это произвольная запись в чужой личный график и нежелательные push; чтение чужих проектов этим не предоставляется. Минимум: перед любыми изменениями проверить массив уникальных положительных IDs и полное включение в active project members, отказать 400/403 при лишних (3–6 ч). Правильно: transactional roster service с membership lock/constraint и тем же guard при каждом формировании получателей (1–2 дня). Ручная проверка двух несвязанных аккаунтов, без вызова production.

Минимум — плюс: закрывает прямой произвольный participant_ids до первого write; минус: отдельная проверка без lock оставляет гонку удаления membership между проверкой и записью, guard нужно повторить в create/update. Правильное решение — плюс: membership, roster и downstream recipients имеют общий проверяемый контракт, в том числе при конкуренции; минус: потребуются передача transaction в helpers, согласование remove-member и тесты конкурентных изменений. Усилия указаны выше, исправление source не выполнялось.

## D02 — High — не приглашённый участник сам получает доступ через RSVP

Route ограничивается membership проекта (`server/routes/native/rehearsals.js:260–266`):

```js
const membership = await checkUserMembership(rehearsal.project_id, userId);

if (!membership) {
  return res.status(403).json({ error: 'Access denied' });
}

const stats = await respondToRehearsal(rehearsalId, userId, response, notes, rehearsal.project_id);
```

Service создаёт отсутствующее приглашение (`server/services/rehearsals/rsvpService.js:19–23`):

```js
`INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
 VALUES ($1, $2, $3, $4)
 ON CONFLICT (rehearsal_id, user_id)
 DO UPDATE SET response = $3, notes = $4, updated_at = NOW()`,
[rehearsalId, userId, response, notes]
```

`routes/native/rehearsals.js:252-266` проверяет только membership проекта. `rsvpService.js:16-24` делает INSERT..ON CONFLICT, даже если invitation row отсутствует; затем ensureRehearsalSlot. В то же время `rehearsalService.js:294-299` допускает обычного участника к GET-by-id только при наличии этой самой response row. Зная/угадав rehearsalId в своём проекте, member вызывает respond yes/no и превращает скрытую репетицию в доступную, получает дальнейшие изменения. GET responses (`routes:312-321`) также выдаёт roster/notes любого rehearsal проекта без invitation guard. Минимум: regular member допускается к respond/responses только если уже приглашён; admin-only auto-enrol явно отделить (2–4 ч). Правильно: единая canViewRehearsal/canRespond и UPDATE существующего invitation вместо общего upsert; тест non-invited member (1 день). Чужое project membership не обходится, важна горизонтальная граница внутри проекта.

Минимум — плюс: закрывает обе доступные regular-member ветки с небольшим изменением; минус: дублированные policy guards могут снова разойтись, admin auto-enrol требует явного исключения. Правильное решение — плюс: наличие invitation перестаёт создаваться действием, которое использует его как условие доступа; минус: нужно согласовать self-enrol администратора и consumers responses с новым service контрактом. Усилия указаны выше.

## D03 — High — жизненный цикл репетиции фиксируется частями

Первый самостоятельный write при создании (`server/services/rehearsals/rehearsalService.js:384–387`) уже фиксирует rehearsal до приглашений и busy slots:

```js
const newRehearsal = await db.get(
  `INSERT INTO native_rehearsals (project_id, title, description, starts_at, ends_at, location, created_by, created_at, updated_at)
   VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, NOW(), NOW())
   RETURNING *`,
```

Последующие invitation INSERT — точная цитата D01:404–409. В DELETE та же последовательность независимых записей (:578–584):

```js
// Delete RSVP responses
logger.debug(`[deleteRehearsal] Step 2: Deleting RSVP responses...`);
await db.run('DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1', [rehearsalId]);

// Delete rehearsal
logger.debug(`[deleteRehearsal] Step 3: Deleting rehearsal record...`);
await db.run('DELETE FROM native_rehearsals WHERE id = $1', [rehearsalId]);
```

`rehearsalService.js:384-422` INSERT rehearsal → N invitation INSERT → N busy INSERT без общей transaction. Payload [validUser,validUser] создаёт rehearsal + первый response, второй падает по UNIQUE; ответ500, объект уже существует, busy slots ещё нет; повтор UI создаёт дубль. PUT :482-551 сначала сохраняет время, удаляет reminders/меняет roster, затем только slot rebuild имеет собственную transaction (`slotService:72-75`). Ошибка rebuild оставляет новое время rehearsal со старыми busy hours; ошибка malformed participant_ids.map происходит уже после UPDATE. DELETE :574-584 тоже три операции без transaction. Минимум: предварительная полная validation и db.transaction на весь create/update/delete с передачей tx в helpers (0.5–1 день). Правильно: транзакционный aggregate и idempotency key, version для concurrent edit, уведомления через outbox после commit (2–3 дня). Текущая локальная transaction updateSlots предотвращает частичную пересборку только её таблицы, не consistency с rehearsal/roster.

Минимум — плюс: rollback связывает rehearsal, roster, claims и busy slots при обычной SQL/validation ошибке; минус: требуется реально передать один tx во все helpers, а повтор запроса после потерянного success-response всё ещё может дублировать create. Правильное решение — плюс: согласует атомарность данных, повторные запросы, конкурирующее редактирование и post-commit уведомления; минус: idempotency/version/outbox требуют схемы, хранения состояния попыток и отдельного delivery worker/процесса. Усилия указаны выше.

## D04 — Medium — администратор не может открыть редактирование репетиции, в которую не приглашён

Решающая цитата `src/features/calendar/hooks/useAddRehearsalForm.ts:142–149`:

```ts
const rehearsalResponse = await rehearsalsAPI.getBatch([String(projectId)]);
const rehearsals = rehearsalResponse.data.rehearsals || [];
const rehearsal = rehearsals.find((r: any) => r.id === rehearsalId);

if (!rehearsal) {
  Alert.alert('Error', 'Rehearsal not found');
  navigation.goBack();
  return;
```

`src/features/calendar/hooks/useAddRehearsalForm.ts:142-149`: `await rehearsalsAPI.getBatch([String(projectId)])`, затем `rehearsals.find(...)`, иначе `Alert.alert('Error', 'Rehearsal not found'); navigation.goBack()`. Batch намеренно personal: `rehearsalService.js:79` делает `INNER JOIN native_rehearsal_responses ur ON r.id = ur.rehearsal_id AND ur.user_id = ?` для всех ролей. Project list (:196-205) и GET by ID (:289-299) допускают администратору все репетиции проекта. Сценарий: администратор создаёт репетицию только для актёров, затем в ProjectDetail нажимает редактировать — форма не находит объект. Изменить время/место через штатную форму нельзя. Минимум: в editor использовать существующий getById, сохранив permission guard (1–2 ч; плюс локально, минус остаются отдельные запросы roster). Правильно: endpoint получения целого edit draft с едиными правами и атомарным client loading state (0.5–1 день; плюс согласованный контракт, минус расширение API). Проверить manual admin-not-invited edit и обычного member.

## Исключённый кандидат all-day

`rehearsalService.js:347,453` не принимает isAllDay, сериализаторы не возвращают его, `slotService.js:40-41` всегда FALSE. Однако обычная форма вообще не содержит all-day toggle/payload. Поэтому прежняя гипотеза «пользователь включает all-day, флаг теряется» НЕ подтверждена и исключена из findings. Остаётся расхождение schema/типов, подлежащее сверке E/F, без выдуманного UI-сценария.

## Контракты/стыки

- B01 second membership check подтверждён `rehearsalService:289-299`: stale response без членства не открывает GET по id. Push recipients ещё G.
- BC04: getProjectRehearsals возвращает date/time/endTime (:228-243), поэтому скрытие всех карточек из-за undefined опровергнуто; date-only new Date display UTC− подтверждено.
- Batch API выдаёт только приглашённые rep даже admin (:79), project API admin все (:196-205). Различие само по себе корректно; неверный consumer editor подтверждён D04.
- Нет серверной проверки конфликта слотов перед созданием; планировщик рекомендационный, отсутствие DB exclusion само по себе не баг без обещанного запрета пересечений.
- RSVP yes/no означает seen/unseen по service, shared/types:1 называет accepted/declined, responseStats.invited comment описывает not-responded. Текущие consumers проверяются для неверных реальных действий, не только названий.
- Ошибка invalid response service :40 'yes or no' не совпадает с route :292 'yes or null', поэтому невалидное значение даёт500 вместо400; включить в общую finding validation без отдельной высокой важности.

## Прочитанные тесты и границы

Полностью прочитаны routes/rehearsalById.test.js (176), routes/rehearsalNotifications.test.js (372), integration/rehearsals.integration.test.js (489), rehearsalParticipants.integration.test.js (182), rsvp.integration.test.js (339), rsvpService.integration.test.js (171). Не запускались.

`rsvp.integration.test.js` заявляет импорт реального service в шапке, но тела делают собственный SQL, включая obsolete unlike=DELETE и invited=members-responses; production использует no с сохранением приглашения и invited=roster count. `rehearsals.integration.test.js` тоже проверяет отдельный SQL, а не create/update API. Новые rehearsalParticipants/rsvpService и HTTP rehearsalNotifications действительно импортируют production и покрывают исправленные roster slots/stats/reminder reset. Но mock transaction в rehearsalParticipants:30-32 просто `return fn(mockDb)`, вопреки комментарию не делает rollback. Атомарность и production PostgreSQL этими тестами не доказаны. Тест rsvpService:139-151 сам добавляет неприглашённого member; обоснование комментарием про admin не совпадает с seeded role member. Это согласуется с D02, не опровергает его.

DF02 server contract: :517 отсутствие participant_ids сохраняет roster, :528-529 [] удаляет. DF03: :482-495 сразу заменяет title/description/location на `value || null`. DF04: прямые ISO :352-355 не проверяются на end>start в JS; SQL CHECK и точный статус отказа проверить F.

Дополнительно полностью прочитан client `src/__tests__/integration/rehearsalFlow.test.ts` (399) и `src/shared/services/api.ts:190-429` (хвост, начало ранее A). rehearsalFlow подменяет axios: mocked partial PUT endsAt-only считается успешным (:118-135), хотя production service требует обе границы; mocked conflict409 (:262-288) не соответствует API, где конфликты лишь клиентское предупреждение. Это coverage/contract mismatch, не доказательство серверного запрета пересечений.

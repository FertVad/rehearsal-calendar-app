# Участок B — проекты, права, приглашения

Полностью прочитаны server/routes/native/{projects,invites,members}.js, utils/projectAuth.js, routing mounts native.js; route tests authorization/memberRemoval/projectsInviteCode/projectDeletionCleanup. Клиент см. notes-projects-client.md. Members availability алгоритм также перепроверяется на стыке C/D.

Дополнительно прочитаны целиком membersAvailabilityRange.test.js, membershipNotifications.test.js и integration/{projects,invites}.integration.test.js. Последние два проверяют SQL, написанный прямо в тесте, а не production handlers; напр. invite code length=32 в тесте против 8 в production. Это ограничение гарантий, не новая production-ошибка.

## B01 — Medium — удаление участника неатомарно, сбой оставляет связанные записи

`server/routes/native/members.js:468-496`: три отдельных DELETE (membership → responses → rehearsal availability), без transaction. Если второй DELETE падает, членство уже удалено; следующий повтор получает 404 на :440-447 и cleanup никогда не повторяется. Если третий DELETE падает — остаётся ложная занятость. Тест memberRemoval:198-213 специально проверяет, что stale response сам по себе НЕ даёт read-by-id без membership; не утверждать обход прав на основании устаревшего комментария. Минимум: все изменения в db.transaction (2–4 ч). Правильно: единая операция membership removal с блокировкой состава, идемпотентным cleanup и failure injection проверками (1–2 дня). Сценарий требует ошибки между SQL или конкурентной записи, а не обычного успешного запроса.

Первая отдельная запись, `server/routes/native/members.js:468–471`:

```js
    await db.run(
      'DELETE FROM native_project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
```

Следующая запись, `server/routes/native/members.js:482–487`:

```js
    await db.run(
      `DELETE FROM native_rehearsal_responses
       WHERE user_id = $1
       AND rehearsal_id IN (SELECT id FROM native_rehearsals WHERE project_id = $2)`,
      [userId, projectId]
    );
```

Минимум: **+** отказ любого шага откатывает удаление членства и связанных записей вместе; **−** не устраняет все гонки изменения roster без согласованной блокировки. Правильное решение: **+** согласует права, roster и занятость при ошибках и повторе; **−** нужен общий lifecycle-контракт и проверки конкурентных изменений/частичных отказов.

Дополнение к B01 из G, 2026-09-10: `routes/native/rehearsals.js:159-162,219-222` получает получателей updates/deletion из response roster без active membership; `pushNotificationService.js:25-37,52` и `notificationStore.js:38-65` повторно membership не проверяют. Если второй DELETE member removal упал, бывший участник продолжает получать новые названия/сведения в push и inbox. Чтение rehearsal by id по-прежнему закрыто. Подробная цепочка в notes-notifications-delivery.md; не считать отдельной G-проблемой.

## B02 — Medium — создание/удаление проекта частично фиксируются при ошибке

`server/routes/native/projects.js:70-81`: INSERT project, затем INSERT owner без транзакции; отказ/удаление аккаунта между ними оставляет проект без владельца, повтор создаёт другой. `:185-193`: сначала удаляет busy availability, потом проект; при отказе второго запроса репетиции остаются, занятость уже потеряна. Минимум: две операции обернуть transaction (2–4 ч, малое изменение). Правильно: транзакционные lifecycle services и failure/retry contract, уникальный idempotency key на create (1–2 дня). Уведомления оставить после commit.

Создание первого объекта, `server/routes/native/projects.js:70–73`:

```js
    const newProject = await db.get(
      'INSERT INTO native_projects (name, description, timezone, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      [name, description || null, projectTimezone]
    );
```

Отдельное создание владельца, `server/routes/native/projects.js:78–81`:

```js
    await db.run(
      'INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
      [projectId, accountId, 'owner', 'active']
    );
```

На удалении сначала фиксируется очистка занятости, `server/routes/native/projects.js:185–190`:

```js
    await db.run(
      `DELETE FROM native_user_availability
       WHERE source = 'rehearsal'
       AND external_event_id IN (SELECT CAST(id AS TEXT) FROM native_rehearsals WHERE project_id = $1)`,
      [projectId]
    );
```

Удаление самого проекта — отдельный db.run на :193. Минимум: **+** устраняет половинчатую фиксацию в каждом lifecycle; **−** потеря ответа после успешного commit всё ещё допускает повторное создание. Правильное решение: **+** согласует атомарность, повторы и отправку уведомлений после commit; **−** нужны idempotency storage и единые правила обработки уже выполненного запроса.

## B03 — High — неограниченный диапазон дат блокирует event loop до проверки членства

`server/routes/native/members.js:26-39`: `while (current <= last) { dates.push(...); current.setUTCDate(...) }`; ограничений диапазона нет и membership lookup только :44-51. Любой зарегистрированный пользователь может запросить диапазон 0001-01-01..9999-12-31 для любого projectId: миллионы строк синхронно создаются до отказа в доступе. Затем у настоящего участника стоимость растёт также по пользователям/дням. Общего rate limit на /projects нет. Минимум: строгие реальные YYYY-MM-DD, start<=end, cap 31/90 дней перед циклом (2–3 ч). Правильно: общий budget дат/пользователей/размера ответа + проверка членства до тяжёлой работы и rate limit (0.5–1 день). Уязвимость не проверялась запуском нагрузочного запроса.

Неограниченное синхронное разворачивание входного диапазона, `server/routes/native/members.js:33–39`:

```js
      const current = new Date(`${startDate}T00:00:00Z`);
      const last = new Date(`${endDate}T00:00:00Z`);

      while (current <= last) {
        dates.push(current.toISOString().split('T')[0]);
        current.setUTCDate(current.getUTCDate() + 1);
      }
```

Минимум: **+** ставит верхнюю границу CPU/memory одного запроса ещё до цикла; **−** фиксированный лимит требует разбивать разрешённые длинные выборки на части. Правильное решение: **+** ограничивает суммарную стоимость с учётом участников и частоты запросов, отказывает чужому пользователю до тяжёлой работы; **−** нужны согласованные caps, pagination/chunking клиента и общий limiter store для нескольких экземпляров.

## B04 — Medium — альтернативный join URL обходит rate limit приглашений

`server/routes/native.js:29–31` монтирует invitesRoutes и под `/projects`, и под `/invite`; его `POST /:code/join` (`invites.js:214`) доступен по `/api/native/projects/:code/join`. `server/server.js:145` ограничивает только `/api/native/invite`. Другие projects routers не имеют POST /:code/join и пропускают его дальше. Перебор кода с авторизованной сессией и массовое вступление по alias обходят заявленный 20/min. 8-символьное пространство большое: не утверждать, что случайный одиночный код легко подобрать. Минимум: limiter на router handler join/lookup независимо от mount (1–2 ч). Правильно: отдельные routers для project invites и redeem, IP+account лимиты с общим store (0.5–1 день). Memory-store/serverless аспект I.

Два mounts одного router, `server/routes/native.js:29–31`:

```js
router.use('/projects', invitesRoutes);
router.use('/rehearsals', rehearsalsRoutes);
router.use('/invite', invitesRoutes);
```

Ограничитель привязан только к одному prefix, `server/server.js:145–148`:

```js
app.use('/api/native/invite', rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
```

Сам join route не ограничивает mount, `server/routes/native/invites.js:213–214`:

```js
// POST /api/native/invite/:code/join - Join project using invite
router.post('/:code/join', requireAuth, async (req, res) => {
```

Минимум: **+** одинаково ограничивает все aliases уже существующего обработчика; **−** неоднозначная структура URL и ограничения в памяти процесса остаются. Правильное решение: **+** отделяет управление приглашениями от погашения кода и считает единый budget IP/account на всех экземплярах; **−** потребуются общее хранилище limiter и план совместимости старых aliases.

## Прочие наблюдения, не самостоятельные подтверждённые серьёзные баги

- Истёкший invite проверяется, коды криптографические, ordinary member не может менять роли, owner защищён. Explicit userIds пересекается с active members: прежний IDOR исправлен.
- POST invite не проверяет expiresInDays; строка конкатенируется с getDate (:68), большие/невалидные значения дают неожиданный срок/500. Включить в общую находку входной валидации, если не дублировать A03.
- POST invite check-live then UPDATE: параллельные генерации возвращают один уже недействующий код; требуется ручной concurrency check, затраты ~0.5 дня на conditional UPDATE/lock. Можно включить в план idempotency, не завышать severity.
- Reactivation сохраняет role; в текущем удалении membership физически удаляется, поэтому обход снятия admin через reactivation не подтверждён для доступного flow.

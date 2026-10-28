# G — inbox уведомлений и общий счётчик

Статическое чтение 2026-09-09/10; исходники и данные не изменялись, приложение/тесты не запускались. Базовый каталог file refs: `rehearsal-calendar-native/`.

## Покрытие

Полностью прочитаны `src/contexts/UnreadContext.tsx` (132), `src/features/notifications/screens/NotificationsScreen.tsx` (273), `src/i18n/translations/notifications.ts` (93; все четыре локали), `server/routes/native/notifications.js` (113), `server/services/notifications/notificationStore.js` (206), `src/contexts/__tests__/UnreadContext.test.tsx` (235), `server/__tests__/routes/notifications.test.js` (276), `App.tsx` (45, повторная проверка lifetime для G).

Для стыков прочитаны только `src/shared/services/api.ts:401-425`, `src/contexts/AuthContext.tsx:30-95,335-390` и результаты relevant поиска Auth; полное покрытие этих файлов находится в A/H, не заявляется здесь. Styles inbox не читались: визуальное поведение не проверялось. Отдельный NotificationsScreen test не найден по именам файлов и поиску ссылок на экран/handlers среди test-файлов src. Backend suite использует in-memory SQLite helper, а не реальный PostgreSQL; см. F notes о пределах такого helper.

## NI01 — Medium — в приложении недоступны уведомления старше первых 50

Категория: пагинация / потеря доступа к данным интерфейса.

`src/features/notifications/screens/NotificationsScreen.tsx:62-63`: `const res = await notificationsAPI.list(); setItems(res.data.notifications || []);`. API wrapper `src/shared/services/api.ts:408-409` задаёт default `limit = 50, offset = 0`; сервер `notificationStore.js:94-104` действительно применяет limit/offset. FlatList `NotificationsScreen.tsx:250-269` не имеет onEndReached или иной загрузки следующей страницы.

Сценарий: у пользователя 51+ уведомление. Старые записи ещё лежат в БД, но UI при каждом открытии и refresh загружает лишь свежие 50. Если эти 50 прочитаны, а более старые нет, общий unreadCount остаётся положительным, однако hasUnread вычисляется только по загруженным items (`:122`), и кнопка «Отметить все» скрыта (`:227-235`). Нельзя ни найти старое непрочитанное, ни пометить его прочитанным через обычный путь без удаления/очистки новых записей.

Минимум: подгрузка следующей страницы по offset/hasMore с дедупликацией и показ mark-all на основании общего unreadCount. Плюс — небольшое изменение существующего контракта; минус — offset может смещаться при новых поступлениях. Правильно: cursor pagination по `(created_at,id)` с явным hasMore, отдельные total/unreadCount, обновление/удаление без пропуска страниц. Плюс — устойчиво к новым уведомлениям; минус — нужен новый API контракт. Effort: 0.5–1 день / 1–2 дня.

## NI02 — Medium — ошибка «прочитано» скрывается, а UI объявляет уведомления прочитанными

Категория: обработка сетевых ошибок / согласованность состояния.

`src/contexts/UnreadContext.tsx:74-80` ловит ошибку notificationsAPI.markRead и только логирует её, возвращая fulfilled Promise<void>. Вызывающие `NotificationsScreen.tsx:75-78,89-92` всегда после await ставят локальное `read: true`.

Сценарий: список уже загружен, сеть пропала; пользователь нажал «Отметить все» либо открыл одно уведомление. POST не дошёл до сервера. Карточки теряют unread-индикатор, кнопка mark-all может исчезнуть, но count/badge остаётся прежним и БД всё ещё считает записи непрочитанными. После следующего открытия они вновь подсвечиваются. Нет видимой ошибки или очереди повторной записи; пользователь получил ложное подтверждение действия.

Минимум: markRead возвращает success:boolean либо бросает исключение; экран обновляет read только после success или откатывает optimistic state с понятной ошибкой. Плюс — соответствует уже существующему remove():boolean; минус — offline-read не сохраняется автоматически. Правильно: персистентная idempotent очередь mark-read по конкретным IDs, отдельные pending/error состояния и reconciliation со счётчиком. Плюс — надёжный offline flow; минус — сложнее синхронизация. Effort: 2–4 часа / 1–2 дня.

## NI03 — Medium — счётчик прошлого аккаунта остаётся после смены пользователя

Категория: изоляция локального состояния / неверные badge.

`src/contexts/UnreadContext.tsx:37-61` создаёт состояние/knownRef один раз, загружает общий storage key `'unread-count'` (`:9,55`) и не использует user/session identity. `App.tsx:33-38` держит UnreadProvider над AppContent/Navigation, поэтому logout/login не размонтирует provider. Auth при смене пользователя удаляет storage key (`src/contexts/AuthContext.tsx:64-75`), но не память UnreadProvider; logout (`:367-375`) также не сбрасывает unreadCount/knownRef или системный badge.

Сценарий: A имеет 8 непрочитанных, затем выходит, B входит на том же запущенном приложении. Даже после удаления `'unread-count'` на диске context всё ещё хранит 8; до успешного server refresh B видит чужой счётчик, при offline/count failure он сохраняется намеренно (`UnreadContext.tsx:67-70`). Уже запущенный ответ A может после очистки вызвать remember (`:45-51,65-66`) и заново записать A count в общий storage, установив и badge (`:111-116`). Это утечка счётчика активности/ошибочный badge, не чтение тела чужих уведомлений и не обход серверной авторизации.

Минимум: зависимость provider от user.id/session generation, сброс unreadCount/knownRef/known и badge при logout/account change, игнорирование поздних ответов предыдущей сессии. Плюс — закрывает текущий переход; минус — cleanup и чтение storage нужно согласовать. Правильно: scoped storage key и query-state по userId, атомарная смена владельца кеша, cancellation/generation всех запросов. Плюс — изоляция across restart/async; минус — миграция старого ключа и контекста. Effort: 3–5 часов / 1 день.

Стык A похож по причине на BC01/ES01, но здесь отдельный store счётчика; не раздувать до общего High cross-account доступа.

## NI04 — Medium — поздние ответы возвращают старый счётчик и уже удалённые карточки

Категория: гонки чтения и mutation.

`src/contexts/UnreadContext.tsx:63-77` и remove/removeAll `:83-98` все безусловно передают полученный unreadCount в remember, без sequence/version guard. `NotificationsScreen.tsx:59-69` load также безусловно заменяет items, в то время как deleteOne `:124-131` и clear-all `:153-163` меняют этот же список.

Сценарий счётчика: refresh прочитал N непрочитанных и ответ задержался; mark-all завершился позже на сервере, но раньше на клиенте, вернул 0. Приходит старый refresh → remember(N) возвращает badge и persist-ит его, хотя все уже read. Сценарий списка: pull-to-refresh получил snapshot до удаления, затем deleteOne успешно завершился и убрал строку; поздний load возвращает удалённую карточку в UI. Следующий tap/delete может получить 404, и пользователя вводит в заблуждение результат успешно выполненного действия. Исправление storage-read knownRef (`:57-58`) защищает только startup read, а не сеть.

Минимум: mutation generation, игнорирование query responses, начатых до успешной mutation; инвалидировать/перезапрашивать список и count после завершения. Плюс — небольшой guard в двух местах; минус — concurrent mutations нужно учитывать отдельно. Правильно: единый keyed query/cache с cancellation, optimistic mutations и merge по notification ID/version, серверная version для authoritative count если нужен строгий порядок. Плюс — общая согласованность; минус — шире data layer. Effort: 0.5–1 день / 1–2 дня.

## NI05 — Low — сбой первоначальной загрузки показывается как пустой inbox

Категория: обработка ошибок / неверная информация пользователю.

`NotificationsScreen.tsx:64-68` при load failure только пишет logger.warn и выключает loading; initial items=[] (`:55`). Затем FlatList рендерит empty state (`:262-267`). Готовый перевод ошибки `src/i18n/translations/notifications.ts:30` — «Не удалось загрузить уведомления» — не используется экраном.

Сценарий: открыть inbox при offline/HTTP500. Вместо объяснения проблемы показано «Пока тихо» и обещание будущих уведомлений, хотя сервер может содержать важные сообщения. Pull-to-refresh остаётся доступным, но причина пустоты скрыта.

Минимум: loadError state, отдельный error + retry при отсутствии кеша; при ошибке refresh оставить старый список с сообщением. Плюс — маленький UI fix; минус — offline inbox без кеша всё ещё недоступен. Правильно: scoped per-user persisted list и явные lastLoadedAt/stale/error состояния. Плюс — полезен офлайн; минус — кеш и очистка на account switch. Effort: 1–2 часа / 0.5–1 день.

## NI06 — Low — API markRead с пустым списком отмечает весь inbox

Категория: API контракт / обработка пользовательского ввода.

Документированный контракт `server/routes/native/notifications.js:52-55`: `{ids:number[]}` отмечает указанные, `{}` — весь inbox. Валидация `:61-65` принимает ids=[]. `server/services/notifications/notificationStore.js:188` проверяет `Array.isArray(ids) && ids.length > 0`, поэтому пустой массив попадает в ветку `:198-201` с UPDATE всех непрочитанных пользователя. Клиентский wrapper `src/shared/services/api.ts:415-416` тоже отправит явное `{ids:[]}`, поскольку массив truthy.

Сценарий достижимости: аутентифицированный API-клиент отправляет POST `/api/native/notifications/read` с `{ids:[]}`, например после фильтрации выбранных ID до пустого набора. Вместо no-op все уведомления становятся read, в том числе ещё не показанные. В текущем экране обычные вызовы передают undefined либо одиночный непустой массив, поэтому это контрактный edge case, не утверждение о ежедневном tap flow. Серверное WHERE user_id сохраняет изоляцию аккаунтов.

Минимум: различать отсутствие ids и наличие массива; [] возвращает current count без UPDATE или 400. Плюс — минимальный fix; минус — нужно задокументировать empty semantics. Правильно: отдельное явное all:true/endpoint для mark-all, строгая валидация положительных safe-integer IDs и contract tests. Плюс — исключает неоднозначность destructive scope; минус — версионирование API. Effort: 1–2 часа / 0.5 дня.

## Проверенные положительные гарантии и стыки

- Все 5 inbox endpoints применяют requireAuth. SQL list/count/read/delete ограничены user_id, single-delete чужого/отсутствующего id возвращает404 (`routes/notifications.js:84-89`). Прямой IDOR в этом scope не найден.
- IDs не интерполируются как исходный SQL: store переводит их в числа и генерирует placeholders (`notificationStore.js:151-162,188-196`). Это не SQL injection finding.
- Одноудаление UI откатывает строку из памяти при failure (`NotificationsScreen.tsx:133-144`), clear-all возвращает прежний массив (`:156-163`). Это полезное offline-поведение; concurrent snapshots покрыты NI04.
- Переход rehearsal использует relatedType/id, server recordNotifications создаёт их из data (`notificationStore.js:35-36`). Rehearsal-deleted исключён от открытия удалённой репетиции (`NotificationsScreen.tsx:99`); project_deleted/member_removed всё ещё может вести в уже недоступный project (`:104-109`). Существование целевого объекта/членства проверяется downstream B/D, такой переход не назван обходом прав.
- Комментарий «arriving here is acknowledgement» `NotificationsScreen.tsx:72-74` устарел: focus `:80-84` только load, markEverythingRead вызывается кнопкой `:230`; само по себе это не баг, поскольку explicit mark-all UI сохраняет контроль пользователя.
- `listNotifications` нормализует limit/offset только через Number и верхний предел (`notificationStore.js:103`), без nonnegative/integer validation. Некорректные внешние значения могут вызвать SQL error, а LIMIT -1 в SQLite означает отсутствие лимита. Обычный UI посылает корректные defaults. Это отмечено как input-validation ограничение без дополнительного finding ID; при усилении API возвращать400 и clamp к разрешённым целым значениям.
- recordNotifications вставляет по одному recipient и продолжает после ошибки; delivery/idempotency/fan-out consequences проверяет основной аудитор push, не дублируются здесь.

## Тесты и границы проверки

- Backend `server/__tests__/routes/notifications.test.js` полностью прочитан: реальные router/store на mock db helper, авторизация, чужие read/delete, mark-all, delete-all, сортировка, связь с объектом. Нет empty ids, пагинации >50, limit/offset edge cases, PostgreSQL-specific runs. Тесты не запускались, утверждения «прошли» нет.
- `UnreadContext.test.tsx` полностью прочитан: storage restore, count/badge success, refresh failure, markRead success, delete success/failure, empty answer. Все probes находятся в одном provider без Auth; нет A→B перехода, delayed overlapping API или markRead rejection, поэтому NI02–NI04 не покрыты.
- Test «reports whether the deletion actually happened» (`UnreadContext.test.tsx:203-213`) проверяет только неизменность displayed count, а не возвращаемый boolean. Сам экран с rollback из памяти этим тестом не проверяется.
- Новые screen tests не создавались. Проверять после разрешения запуска: 51+ items со старыми unread; failed markRead; initial list500; refresh ответ после read/delete; account switch с успешным login и failed count refresh; API POST ids=[].

Итог: 6 подтверждённых находок — 4 Medium NI01–NI04, 2 Low NI05–NI06. Выделенный production и оба соответствующих test-файла прочитаны полностью; UI styles и actual runtime/PostgreSQL не проверялись.

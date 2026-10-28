# E — orchestration, hooks и настройки синхронизации

Статический аудит 2026-09-08. Проект не запускался и не изменялся. Базовый каталог ссылок: `rehearsal-calendar-native/`. Первые findings сохранены до завершения остальных чтений, затем дополнены проверкой onboarding и тестов.

## Покрытие

Полностью прочитаны `src/shared/hooks/useAutoCalendarSync.ts` (384 строки), `src/features/calendar/hooks/useCalendarSync.ts` (408), `src/features/profile/screens/CalendarSyncSettingsScreen.tsx` (620), `src/features/onboarding/screens/CalendarSyncScreen.tsx` (467, включая встроенные стили), `src/shared/hooks/__tests__/useAutoCalendarSync.test.ts` (312), `src/features/calendar/hooks/__tests__/useCalendarSync.test.ts` (753). Тесты не запускались. В `src/i18n/translations/calendarSync.ts` прочитаны relevant ключи и значения через поиск: permissions, autoSync, syncSuccess/syncError, removeAll/confirm/success/partial, import/export, chooseCalendar для всех четырёх локалей. В `translations/onboarding.ts` прочитаны ключи privacy/pickCalendar/connectedBody/manualBody для всех четырёх локалей. Оба файла переводов проверены частично, а не целиком. Сервер API и низкоуровневые import/export/storage проверены другими аудиторами E; ниже явно атрибутированы их подтверждения стыков.

## EO01 — Medium — после ухода из последнего проекта экспортированные события не удаляются

Категория: reconciliation / устаревшие календарные данные.

`src/shared/hooks/useAutoCalendarSync.ts:65-70`: `const projectIds = ...; if (projectIds.length === 0) { ... return; }`. Вызов `reconcileDeletedRehearsals(...)` находится ниже в `:107-110`. Комментарий `:94-96` прямо обещает, что пользователь, вышедший из всех проектов, не должен сохранять экспортированные события.

Сценарий: экспортировать репетиции единственного проекта, затем удалить проект/потерять последнее membership. При следующем autosync GET projects успешно отдаёт []; ранний return не читает mappings и не удаляет ни одного старого события. В календаре продолжаются устаревшие записи и напоминания, хотя приложение больше не имеет этих репетиций.

Минимум: при достоверном успешном пустом projects response сверять mappings с пустым live set вместо return. Плюс — маленькая правка; минус — нужно явно различить ошибку/неполный ответ и успешную пустоту. Правильно: единый reconciliation snapshot с признаком completeness независимо от числа проектов, персистентная очередь удалений. Плюс — обрабатывает последний проект и retry; минус — шире контракт. Effort: 2–4 часа / 1 день.

## EO02 — Medium — ошибка импорта отменяет независимый автоэкспорт

Категория: обработка ошибок / расхождение с комментарием.

`src/shared/hooks/useAutoCalendarSync.ts:258-268` выполняет getAllMappings и import внутри внешнего try, до блока export `:275-279`; outer catch находится `:280-282`. Комментарий `:274`: `A failed import should not stop the export, and the other way round.`

Сценарий: оба направления включены; чтение/import календаря либо getAllMappings бросает исключение. Управление сразу попадает в outer catch, `exportRehearsalsIfDue` вообще не вызывается. Новые или изменённые репетиции не попадают в календарь, пока проблема импорта не исчезнет. Постоянная ошибка одного направления блокирует второе. Достижимость throw подтверждена import-аудитором: `src/shared/services/calendar/import.ts:188-192` Promise.all включает availabilityAPI.getAll без локального catch, HTTP500/timeout выходит через rethrow `:477-480`; чтение календаря может бросать при отсутствии permission `:66-69`. Дополнительно `src/shared/utils/calendarMappings.ts:217` бросает при server failure и пустом локальном кеше.

Минимум: отдельные try/catch для import и export; после import failure попытаться export с independently полученными mappings. Плюс — локальный fix; минус — возможно повторное чтение общего ресурса. Правильно: независимые результаты направлений в общем sync-run и явное degraded состояние. Плюс — понятны частичные успехи; минус — больше orchestration/UI. Effort: 2–3 часа / 0.5–1 день.

## EO03 — Medium — очередь ручных запусков не гарантирует один sync одновременно

Категория: concurrency.

`src/shared/hooks/useAutoCalendarSync.ts:200-213`: `if (currentSync) { if (!waitForTurn) return; await currentSync.catch(() => {}); } const run = work().finally(...); currentSync = run;`. `forceSync` использует waitForTurn=true (`:343,377`). После await не делается повторная проверка currentSync и очередь не строится цепочкой.

Сценарий: автоматический sync A ещё выполняется. Два manual forceSync B и C успевают ожидать один и тот же Promise A. После A оба продолжают с work(), так что два импорта/экспорта одновременно читают старые mappings и сохраняют изменения. Это нарушает заявленный комментариями общий lock и создаёт условия для дублей/потери mappings; конкретные последствия низкоуровневых записей сверяются с export/storage.

Минимум: повторно захватывать lock в while-loop после пробуждения либо строить настоящую цепочку queued promises. Плюс — малый fix; минус — нужна защита starvation/error release. Правильно: общий mutex/очередь всех ручных, автоматических, save/delete sync операций с ключом account+device. Плюс — защищает и другие callers; минус — затрагивает API сервисов. Effort: 2–4 часа / 1 день. Проверка без текущего запуска: deferred promise A, два force callers, maximum concurrent work должен быть 1.

## EO04 — Medium — ручная синхронизация может восстановить уже выключенную настройку

Категория: гонка настроек / пользовательский контроль.

`src/features/profile/screens/CalendarSyncSettingsScreen.tsx:351-362` сначала `await importNow()`, затем `await rehearsalsAPI.getBatch(projectIds)`, и лишь после ответа вызывает захваченный в старом render `syncAll` (`:389`). `useCalendarSync.ts:328` сбрасывает isImporting после import, тогда как isSyncing=true выставляется только при входе в syncAll (`:234`). В промежутке оба флага false и экран разрешает переключатель (`CalendarSyncSettingsScreen.tsx:462-467`) и выбор календаря. `useCalendarSync.ts:149-158` updateSettings сохраняет snapshot `const updated = { ...settings, ...newSettings }; await saveSyncSettings(updated);`, а syncAll вызывает именно захваченный updateSettings в `:251`.

Сценарий: нажать Synchronize; после импорта batch-запрос медленный. Выключить Auto Sync либо сменить целевой календарь в разблокированном UI. Старый handler после ответа запускает export с прежним settings.exportCalendarId и затем сохраняет старые флаги/settings вместе с lastExportTime. Настройка снова становится enabled=true/прежний calendarId; события записываются после явного отключения пользователя. Даже без действий пользователя export stamp может затереть lastImportTime, только что записанный предыдущей фазой, поскольку обе callback-функции взяты из одного старого render.

Минимум: флаг wholeRunBusy на весь handleSynchronize включая network gap; updateSettings должен атомарно обновлять только переданные поля на свежем storage snapshot и проверять generation настройки перед export. Плюс — устраняет доступный UI-сценарий; минус — другие callers остаются вне общей синхронизации. Правильно: общий settings store с serialized patch updates и cancellation/generation token для sync-run, пересмотр разрешения записи при отключении/смене account/calendar. Плюс — не теряет независимые изменения; минус — охватывает hooks/storage. Effort: 0.5–1 день / 1–2 дня.

## EO05 — Low — ручная синхронизация заменяет названия репетиций общим названием проекта

Категория: потеря отображаемых данных / контракт export.

`src/features/profile/screens/CalendarSyncSettingsScreen.tsx:368-375` строит allRehearsals только из id/projectId/projectName/startsAt/endsAt/location, отбрасывая r.title. Для сравнения автоматический путь в `src/shared/hooks/useAutoCalendarSync.ts:73-80` сохраняет title. Проверяющий export подтвердил `src/shared/services/calendar/export.ts:104-105`: `eventTitleFor = rehearsal.title?.trim() || ... Rehearsal: <projectName>`; при несовпадении имени существующий event обновляется через `:385-392` и `:269-275`.

Сценарий: репетиция «Акт II» уже правильно экспортирована. В настройках нажать «Синхронизировать». Новый DTO не содержит title; export сравнивает его с fallback и перезаписывает название события на «Rehearsal: <project>». После auto-sync имя может вернуться, поэтому результат зависит от выбранного способа синхронизации; пользователь теряет различимость репетиций в личном календаре.

Минимум: добавить `title: r.title` в manual mapping. Плюс — маленькая правка; минус — другие DTO могут снова разойтись. Правильно: общий типизированный mapper Rehearsal→RehearsalWithProject для всех путей и regression assertion payload. Плюс — единый контракт; минус — небольшое объединение callers. Effort: 30–60 минут / 2–3 часа.

## EO06 — Medium — неудачная синхронизация получает новую отметку успешного экспорта

Категория: обработка частичных ошибок / ложный статус результата.

`src/features/calendar/hooks/useCalendarSync.ts:238-251` получает BatchSyncResult, затем без проверки failed делает `setSyncStatus('success')` и `updateSettings({ lastExportTime: new Date().toISOString() })`. Экран `CalendarSyncSettingsScreen.tsx:393-398` всегда показывает заголовок `t.calendarSync.syncSuccess`, сообщает только success counts, а `:577-583` использует lastExportTime как зелёное «синхронизировано недавно».

Автоматический путь `useAutoCalendarSync.ts:120-135` пытается сохранять timestamp только при result.failed===0, но проверяющий export и основной аудитор подтвердили более раннюю безусловную запись внутри `src/shared/services/calendar/export.ts:502`: `updateLastExportTime` вызывается даже после накопления failed (`:485-493`). Поэтому guard hook уже не отменяет ложную отметку низкого слоя.

Сценарий: exportEnabled=true, у календаря отозвана возможность записи либо несколько/все операции export завершились failed. Batch возвращает `{success:0, failed:N}` без исключения. Ручной экран объявляет успешную синхронизацию, persistent status получает текущее время, а auto-путь также не сохраняет прежнюю отметку. Пользователь считает расписание в календаре актуальным и может пропустить изменения. Это не утверждение о 10-минутной задержке retry: старый interval в текущем коде удалён.

Минимум: централизовать запись lastExportTime только после полного успеха, убрать безусловный writer export.ts:502, отразить failed>0 как partial/error в hook и экране. Плюс — локально восстанавливает честный статус; минус — одного timestamp недостаточно для деталей. Правильно: separate lastAttemptAt/lastSuccessfulAt, per-operation summary с failed IDs и retry, единый владелец статуса на уровне orchestration. Плюс — понятно, что актуально и что повторить; минус — расширяет storage/UI. Effort: 0.5–1 день / 1–2 дня.

## Стыки и замечания без отдельных finding IDs

- Manual `useCalendarSync` методы прямо вызывают import/export/remove и не входят в module-global runExclusively; automatic/manual/remove могут пересекаться. Сверить сервисные guards/idempotency, прежде чем заявлять конкретную потерю данных.
- `useCalendarSync.ts:278-281` removeAll всегда setSyncedCount(0). Экран умеет показать partial removal (`CalendarSyncSettingsScreen.tsx:301-308`), но hook неверно обнуляет count. Более серьёзная первопричина подтверждена export-аудитором: export.ts:565-566 удаляет mappings неудачно удалённых событий; это уже EX02, отдельное EO для count не создаётся.
- Remove all доступен только внутри `syncEnabled && selectedProvider` (`CalendarSyncSettingsScreen.tsx:573,599-612`); выключив sync, пользователь теряет UI удаления уже экспортированных событий. При удалении с enabled=true auto экспорт может восстановить события при следующем запуске. Проверить ожидаемый результат действия/переводы.
- `useAutoCalendarSync.ts:236-240` проверяет только наличие accessToken в начале, далее user/session identity не фиксируется; forceSync не делает даже этой проверки. Основной аудитор подтвердил Auth login сохраняет B token до очистки состояния (`AuthContext.tsx:202-208`), а logout (`:344-381`) не отменяет старый run. Import/storage-аудитор фиксирует High ES01: старый A import после await выполняется уже с B token и возвращает старые данные в общий storage. Не дублировать как EO. Listener cleanup в `useAutoCalendarSync.ts:330-332` удаляет только подписку; текущий Promise продолжает работу.
- Onboarding ставит selectedCalendarId до завершения сохранения (`CalendarSyncScreen.tsx:130-141`); outcome `:289-297` основан на выборе, а не persisted success. После ошибки установки выбор не сбрасывается (`:144-148`). Потенциально вводит в заблуждение при storage failure; здесь оставлено замечанием, не самостоятельным finding, поскольку ошибки самого storage сверяются в ES.

## Что именно гарантируют и не гарантируют прочитанные тесты

- `useAutoCalendarSync.test.ts:32-35` всегда держит непустой project list `{id:'p1'}`. Test «last rehearsal gone» `:193-198` делает пустым только batch rehearsals; сценарий последнего удалённого проекта EO01 не моделируется.
- Auto guard test `:123-136` вызывает две auto-операции в один и тот же mocked Date.now. Второй вызов может быть отсечён throttle до lock, поэтому один import не доказывает mutex. Manual test `:214-228` проверяет два force callers и лишь итоговое число запросов, а не максимум одновременно работающих операций; EO03 требует третьего caller (один выполняется, двое ждут) и deferred promises.
- Auto service mocks `:24-27` по умолчанию всегда успешно resolve; нет проверки throw на import с последующим export, которой недостаёт для EO02. getItem mock `:50-52` всегда даёт токен; смена сессии ES01 не покрыта.
- `useCalendarSync.test.ts:341-345,388-392,416-420,515-519` mock результатов использует `succeeded`, тогда как production/экран используют `success`. Assertions `:372,435,539` повторяют эту устаревшую форму. Все batch/remove fixtures failed=0; частичные ошибки и lastSuccessfulAt не проверяются. Вызов прогресса подменённого сервиса проверяется как передача callback, не как реальная последовательность его срабатываний.
- Settings test `useCalendarSync.test.ts:133-153` выполняет одиночный update, storage полностью mock (`:11-12`), без overlapping writes и manual import→batch→export сценария EO04. Проверка `settings` defined до update не доказывает завершение асинхронного init, так как initial settings уже объект.
- Ошибки permission/throws на single sync/import/clear представлены и проверяют state/message. Это полезный happy/error coverage, но он не заменяет проверки batch partial results или интеграцию hook со screen/service/storage.

## Ручная проверка после разрешения запуска

Проверить zero-project reconciliation; три конкурирующих force callers с blocked первым; import throw при рабочем export; выключение/смену календаря во время batch; partial/all-failed export с persistent статусом; manual+auto roundtrip названия; auto-run на A→B смене аккаунта совместно с ES01. Сейчас ни один сценарий не запускался.

Итог: 6 подтверждённых находок: 5 Medium (EO01–EO04, EO06), 1 Low (EO05). Полное чтение выделенного production и двух suites завершено; переводы прочитаны частично по relevant ключам. Ошибка cross-session относится к ES01, потеря mappings при partial delete — к EX02 и здесь не дублируется.

Root final E сверка: EO04 включает storage ES03 как ту же проблему полного stale snapshot (не отдельный count). EO06 распространяется и на ручной import: `useCalendarSync.ts:323-335` после ImportResult с failed>0 всё равно вызывает updateSettings(lastImportTime), а settings screen:398 не показывает failed. Низкий import service при write failures сам не stamp (:469), но этот hook обходит защиту; EI02 отдельно описывает read failure, который даже не попадает в result.failed. Объединить EO06 в финале как «частичный/полный отказ записи получает отметку успешной синхронизации» для обоих направлений, без ещё одного ID.

# План проверок исправлений: физические устройства, календари и доставка

Дата: 2026-09-16. **Это сегодняшние рекомендации будущему агенту по проверенному статическому коду, не выполненные проверки.** Исходный статический аудит относится к HEAD `0f655e2`; исправленная сборка должна иметь свой точный commit/build ID. На момент подготовки этого файла приложение, tests, сборки, API, календари, push и OS Settings не запускались и не изменялись. Все карточки DEV-01…DEV-19 имеют текущий статус **NOT_RUN**. Основной план — `audit/REMEDIATION_PLAN.md`, реестр фактического статуса — `audit/REMEDIATION_STATUS.md`; этот файл не отмечает ни одно исправление выполненным.

Документ дополняет [AUDIT_REPORT.md](/Users/vadimfertik/Desktop/reh_app/audit/AUDIT_REPORT.md). Точное соответствие findings и карточек находится в разделе 6; этот набор не заменяет автоматические проверки всех 102 находок. Здесь проверяется целевое поведение после исправлений, а не объявляется, что текущая реализация его уже поддерживает.

## 1. Минимальный стенд и участие человека

**Минимум для базовой проверки — один реальный iPhone и два тестовых app-аккаунта.** На нём доступны account switch, native calendar, permissions, picker, offline/retry и базовый push display. Агент может параллельно проверить source-scoped diff/mapping/concurrency автоматически.

**Полный gate межустройственной синхронизации — две независимые native-установки; при iOS distribution желательно два реальных iPhone.** Вторым может быть уже имеющееся устройство другого тестера: покупка не требуется. Два аккаунта или два перезапуска одной установки не заменяют второй installation namespace/native event store. Если второй установки нет, её части DEV-03/DEV-04/DEV-18 остаются NOT_RUN; passing server-diff tests не превращают их в «2 устройства проверены». Второй симулятор может дополнить проверку изоляции instances, но не закрывает отсутствующие real-provider/OS/push evidence.

| Обозначение | Назначение |
|---|---|
| D1 | Основной iPhone, точные модель/iOS/build записаны; допускается очищаемая тестовая установка. На нём account switch A→B, permissions, блокировка и перезапуск. |
| D2 | Вторая независимая native-установка, желательно второй реальный iPhone/устройство тестера; отдельный installation ID, по возможности другая поддерживаемая iOS-версия. По очереди входит тем же A для multi-device и A/B для privacy/notification сценариев. Если недоступна, её проверки NOT_RUN. |
| A | Staging app-account, владелец P_shared с участником B и отдельного P_A, недоступного B. |
| B | Staging app-account с отличимыми locale/weekStart/seen/unread; владеет P_B, не состоит в P_A. |
| CAL_A1/CAL_A2 | Два записываемых синтетических календаря устройства D1: импортный и альтернативная цель экспорта. Не использовать календарь по умолчанию с личными событиями. |
| CAL_D2 | Отдельный синтетический календарь D2; дополнительно один общий облачный календарь, доступный обеим установкам, чтобы сравнить разные native IDs одной cloud-сущности. |
| CAL_RO | Тестовый календарь с реально доступным только чтением; роль меняет владелец отдельного тестового календарного аккаунта. Если такой provider/role недоступен, real-OS часть помечается BLOCKED, а adapter-contract проверяется автоматически. |

Синтетические проекты/события именуются `QA-<runId>-<caseId>-<entity>`. Fixtures: одна репетиция только для A, одна для A+B, one-day all-day, multi-day all-day, timed overnight, событие на соседний день, два события с одинаковыми title/time/place (одно создано вручную), несколько read/unread уведомлений с различимыми ID. Сохранить снимок владельцев, количества и полей до опыта. Не считать уникальные имена достаточной защитой от удаления: runner и cleanup обязаны ограничиваться явным allowlist IDs этих календарей/проектов.

**Изоляция:** staging backend/database/auth/push project и staging build не должны писать в production. Проверить endpoint и project/environment IDs до первых действий. Server push allowlist ограничен двумя тестовыми установками; внешний scheduler остаётся выключенным, для карточек reminders используется только разрешённый одноразовый staging runner/тестовые часы. В аудируемом HEAD автоматическое workflow-расписание выключено; не включать production schedule ради проверки.

**Человек нужен в следующих точках, затем агент может продолжать автоматизируемые шаги:**

- Предоставить D1 и, для полного gate, доступную D2/второго тестера; разрешить установку указанной staging-сборки, разблокировать устройство, выполнить OS permission dialogs/Settings. Первый отказ permission воспроизводить на чистом тестовом состоянии, не сбрасывая личный телефон целиком.
- Войти в тестовые Apple/Google calendar accounts и пройти MFA самостоятельно; агенту не передаются пароли/коды. Создать/подтвердить allowlist тестовых календарей и изменить sharing role для CAL_RO.
- Нажать внешний invite link в реальном браузере/мессенджере, подтвердить universal-link/system-prompt поведение, сделать физическую блокировку и принудительное завершение приложения в соответствующих карточках.
- Наблюдать notification center/баннер/звук и приложить экранную запись с временем. Серверный receipt не заменяет это наблюдение.
- Если нельзя управляемо задержать запрос/native continuation, получить нужную роль календаря или воспроизвести OS-состояние, зафиксировать **BLOCKED с причиной**, а не PASS. Помощь человека запрашивается для конкретного недоступного действия, а не повторно перед каждым уже согласованным шагом.

**Android:** если Android входит в распространяемый продукт, привлечь **один** физический Android/тестера к критическим OS-карточкам DEV-07, DEV-10–DEV-13, DEV-15–DEV-16; D1/D2 продолжают использоваться для остальных матриц. Проверить фактически поддерживаемые API level/target SDK, runtime notification permission на версии, где она есть, channelId/каналы и system Back/dismiss picker. Если Android не распространяется, явно записать `Android = out of release scope`, а не «проверен». Не обещать весь парк OS-версий: перечислить реально проверенные и оставшийся риск. Отсутствие устройства — NOT_RUN нужных OS-веток, не требование купить телефон.

## 2. Manifest и доказательства, обязательные для каждого run

В будущий каталог артефактов run сохранить manifest:

- `runId`, UTC start/end, tester, app git SHA, backend git SHA, schema/migration revision, bundle ID, app version/build number, артефакт сборки или EAS build ID; Expo project/environment/channel/update ID, если они участвуют. Один номер версии без SHA/build ID недостаточен.
- D1/D2 модель, точная OS-версия, installation alias, разрешения Calendar/Notifications, выбранные calendar aliases и actual capabilities; timezone устройства и профиля, weekStart/locale, network mode. Не публиковать Apple ID, токены, Authorization, calendar содержимое вне fixture.
- A/B aliases, project/rehearsal aliases, connection/operation/request IDs, session generation и настройки sync. Для корреляции токена использовать безопасный внутренний fingerprint/alias, не сам токен. Скриншоты обрезать до тестовых данных.
- `faultPoint`, `releaseOrder`, ответ операции/status/revision, снимки БД и native calendars до/после, UI-state timeline и запись экрана. Часы устройств синхронизированы; искусственное время тестового scheduler хранить отдельно от wall clock.

После будущего исполнения каждая карточка получает `PASS / FAIL / BLOCKED / NOT_RUN`, фактический результат и ссылки на evidence. Сейчас все NOT_RUN. PASS допустим только при выполнении всех её инвариантов. Отсутствие crash или зелёный HTTP сами по себе не критерий.

## 3. Что автоматизируется, а что требует реальной OS

**Детерминированная часть:** тесты настоящих coordinator/context/service/route contracts, staging PostgreSQL для locks/constraints, управляемые promises/барьеры, fake clock, подменённые boundary-адаптеры Calendar/Expo/transport/storage. Подменять внешнюю границу, не заменять тестируемый business helper произвольным success/throw: например notify, реально возвращающий `{failed:N}`, нельзя проверять только через `mockRejectedValue`.

Нужные барьеры — рекомендация к будущему test harness, сейчас их наличие не подтверждено: после capture user/session, после native read, до API write, после commit до HTTP response, до native write completion, после push claim до send, после list snapshot до возврата. Они работают лишь в тестовой сборке/изолированном harness, не открывают управляемые извне backdoors production. Для двух перестановок одна операция сначала завершается, затем другая; случайные sleeps не заменяют барьер.

**OS/manual часть:** реальные native IDs/cloud propagation, permission dialogs и внешнее изменение прав, background/terminated behavior, timezone Settings, spinner Cancel, браузерные intents и фактический push display. Barrier-test воспроизводит гонку; ручной smoke подтверждает связь с SDK/OS. Ни один из них не подменяет другой.

### Успех операции: обязательное разделение уровней

| Состояние | Допустимый вывод | Недопустимый вывод |
|---|---|---|
| Изменён локальный draft | Пользователь отредактировал данные | Сервер или native календарь уже изменён |
| Durable local queue после offline Save | «На устройстве, ожидает отправки»; данные переживают restart | «Сохранено на сервере» |
| HTTP 202 + operationId, если такой контракт будет введён | Сервер принял работу; UI pending, доступна reconciliation по operationId | Работа завершена, можно очищать произвольный новый draft |
| HTTP 200/201 по синхронному контракту или async terminal succeeded + revision | Подтверждён конкретный server commit | Native событие/push автоматически доставлены |
| Calendar write completion | SDK подтвердил эту native-операцию | Cloud уже обновился на D2; все операции batch успешны |
| Expo ticket accepted | Expo принял попытку, сохранён ticket ID | Устройство получило или показало уведомление |
| Provider receipt success | Установлен результат передачи провайдеру согласно его контракту | Пользователь видел баннер/прочитал уведомление |
| OS display/tap, видимый человеку | Конкретный notification показан/открыт на этом устройстве | Все остальные recipients также получили его |

**202 — целевой тест будущего async-контракта, не утверждение о текущем API.** Если исправление оставляет синхронный API, ветка 202 помечается N/A с обоснованием и проходят offline/commit-lost-response ветки. Локальная offline-очередь не должна имитировать server 202. UI может быть оптимистическим, но pending/failed и откат/повтор должны быть различимы.

## 4. Карточки выполнения

### DEV-01 — A→B во время native import/export и позднего auth-ответа · P0

**Связь:** ES01, AC03, BC01, NI03, HN03. **Режим:** обязательный barrier-test; затем D1 ручной smoke, D2 наблюдает сервер как A. **Предусловия:** D1=A, импорт/экспорт CAL_A1 включён; уникальный private event A; B sync выключен, его clean snapshot сохранён. Доступны session-owner/operation correlation IDs.

**Шаги:** (1) Приостановить sync A после native read, но до API write; отдельно повторить для pending export/native completion и позднего timezone/profile/read response A. (2) Выйти A, войти B, убедиться, что новый user/session опубликован. (3) Завершить старую операцию A. (4) Открыть availability/projects/inbox/seen B, перезапустить D1. (5) Для уже начатой native-записи проверить записанное design-решение отмены или owner-scoped reconciliation, не пытаться «отменить» SDK обещанием.

**PASS:** ни одного API write данных A с credentials B; никакого возврата A user/cache/seen/badge в B; locale/weekStart B применяются к UI согласно сохранённым настройкам B. Old operation не меняет настройки B и не создаёт mappings B. Если native side effect успел состояться, он учитывается/исправляется в пространстве A согласно выбранной политике; cleanup не удаляет личное событие и не присваивает его B. Новые операции B работают после завершения old run.

**Evidence/человек:** trace capturedOwner/currentOwner/sessionGeneration и решение discard/compensate, diff B DB/cache, native event/mapping counts, запись logout/login. Человек нужен только для OS calendar setup и наблюдения; агент управляет барьерами. Непойманная реальная гонка без барьера — не PASS.

### DEV-02 — Два владельца одного push token, перестановка register/unregister · P0

**Связь:** G01, GC03. **Режим:** PostgreSQL concurrency + D1/D2. **Предусловия:** D1 token T, A/B known aliases; D2=A может вызвать тестовое обновление P_A. Зафиксировано правило актуального владельца устройства/session.

**Шаги:** (1) Запустить два registration A/B с контролируемым overlap; проверить обе очередности завершения, включая поздний register A после B и поздний unregister A после успешного B. (2) D1 остаётся B. (3) D2=A создаёт только A-directed уведомление P_A; затем B-directed уведомление P_shared. (4) Повторить при local token ещё не сохранённом на момент logout и при временном отказе unregister.

**PASS:** у T ровно один актуальный owner, stale session не может перехватить его и stale unregister не удаляет регистрацию B; новая dispatch-операция A, начатая после подтверждённой передачи владения, не выбирает T. B получает свои уведомления. Попытка, уже начатая/принятая provider до switch, разбирается отдельно по времени начала/accept/ownership: физическое отсутствие её позднего OS display не обещается. Этот ограниченный остаточный риск, TTL/content policy и граница отзыва явно документируются; клиентский tap/privacy проверяет DEV-13. Базовая проверка owner transfer возможна на D1 с staging-trigger вместо D2; это не заменяет отдельный multi-device gate.

**Evidence/человек:** DB snapshot владельца T по fingerprint, request ordering, recipient resolution/send IDs, запись lock screen. Человек подтверждает фактический показ, агент проверяет уникальность/поколения. Нельзя ограничиться двумя последовательными registration calls.

### DEV-03 — Один app-account на двух устройствах: изоляция импортов · P0

**Связь:** EI01, ES02. **Режим:** automated diff/connection contracts + реальная OS. **Предусловия:** D1=A импортирует CAL_A1 с E1; D2=A импортирует CAL_D2 с E2; непересекающиеся event IDs/часы и сохранённые installation/connection scopes.

**Шаги:** (1) Синхронизировать D1, затем D2. (2) По очереди изменить/удалить E1 и выполнить sync D1; D2 не синхронизировать. (3) Изменить E2 и sync D2. (4) Сделать CAL_A1 пустым и повторить D1. (5) Повторить для общего cloud calendar обеих установок с различными device-local IDs по согласованной политике дедупликации.

**PASS:** scope D1 не удаляет E2/D2; удаления ограничены авторитетным полным snapshot конкретного источника. Один общий cloud event учитывается согласно явно записанной identity policy, без случайного слияния несвязанных событий по совпавшему native ID. Нельзя просто ожидать ровно одну строку, пока cross-installation cloud identity не определена.

**Evidence/человек:** before/after source/connection/installation/externalId aliases и intervals; read-back обоих native календарей. Человек подготавливает cloud accounts и подтверждает доступность/propagation; отсутствие ещё не дошедшей cloud-правки отмечается pending, а не удалением.

### DEV-04 — Экспорт одной репетиции на D1/D2, смена цели и старые mappings · P0

**Связь:** ES02, EO04, EX02. **Режим:** automated mapper ordering + OS. **Предусловия:** D1/D2=A, у каждого своя export connection; R экспортирована обоими. D1 дополнительно имеет CAL_A2.

**Шаги:** (1) Вернуть mappings в обратном порядке newest/oldest и с одинаковым internal R, но разными installations/connections. (2) Перенести R больше чем на сутки, переименовать. (3) Синхронизировать D1, затем D2. (4) Переключить D1 на CAL_A2 во время pending sync и отпустить старый ответ. (5) Повторить закрытие/открытие приложения.

**PASS:** каждый writer изменяет только подтверждённый event своей цели; поздний snapshot не возвращает старый calendarId/enabled. Перенос не оставляет забытый старый app-owned event; выполняется записанная политика смены цели (move/copy), остальные device mappings сохраняются. Счёт событий сверяется с этой политикой, а не слепым «одна запись на всю БД».

**Evidence/человек:** mapping tuples, native calendar/event IDs в виде aliases, title/time до/после и persisted settings; человек проверяет два Calendar UI. Автоматический тест обязателен на oldest-overwrite и stale settings, manual provider order сам по себе недетерминирован.

### DEV-05 — Совпадающее личное событие, read failure и partial cleanup · P0

**Связь:** EX01–EX04, EI02–EI04, EO06. **Режим:** adapter fault injection + synthetic Calendar UI. **Предусловия:** личное синтетическое E_personal без app marker имеет ровно title/time/place репетиции R; E_app создан приложением; обе записи только в allowlisted calendar.

**Шаги:** (1) Удалить/испортить mapping R и запустить export. (2) Отдельно заставить native lookup завершиться error вместо «not found». (3) Отказать update E_app, затем повторить sync. (4) При remove-all/move разрешить удаление одного app event, отказать другому. (5) Для import old→new сначала отказать add/update, проверить, что old busy не удалён раньше подтверждения. (6) Убрать fault и retry.

**PASS:** E_personal остаётся неизменным и не усыновляется по эвристике; lookup-error не считается достоверным отсутствием; failed update не получает success из-за существования старого совпадения. Неудачно удалённый app event сохраняет actionable mapping/tombstone и попадает в повтор; UI показывает partial/failed с количеством, не ложные 0/«всё успешно». Old busy сохраняется до безопасного replacement. После retry нет необъяснённых дублей.

**Evidence/человек:** checksum синтетического E_personal, per-operation outcomes, mapping/retry ledger, before/after calendar screenshots. Native ошибки отдельных операций воспроизводить boundary harness; реальный отказ permissions отдельно DEV-07.

### DEV-06 — Пустой список после удаления последнего проекта и отключённый sync · P1

**Связь:** EO01–EO02, EX02. **Режим:** automated empty-state flow + D1. **Предусловия:** отдельный тестовый A-run с единственным P_A и app-owned экспортом R; один E_personal рядом.

**Шаги:** (1) Удалить P_A через разрешённый staging UI. (2) Получить успешный авторитетный пустой server snapshot. (3) Выполнить reconciliation. (4) Повторить отдельно с отключением sync перед ручным remove exported events. (5) Смоделировать API read error вместо достоверного empty.

**PASS:** достоверный пустой набор запускает запланированный cleanup app-owned events/alarms; ошибка чтения не становится командой удалить всё. После явного remove/disable события не воссоздаются фоновым stale run; доступен понятный путь удаления экспорта при отключённом sync. Личные события сохранны.

**Evidence/человек:** server-empty versus read-error trace, app-owned IDs до/после, sync settings и native alarms. Человек смотрит Calendar; тест не должен удалять настоящий проект/календарь.

### DEV-07 — Calendar permission denied/revoked и read-only destination · P0

**Связь:** HP05, EO06, EX02–EX04. **Режим:** OS manual + автоматическая проверка typed outcomes. **Предусловия:** свежая тестовая установка для first denial; затем granted setup; CAL_RO подготовлен. Записаны варианты Calendar permission, реально предлагаемые этой OS/сборкой, без предположения, что один Boolean описывает все capabilities.

**Шаги:** (1) На onboarding отказать permission, перейти дальше. (2) Разрешить через Settings и вернуться без переустановки. (3) Запустить sync и отозвать доступ извне до завершения. (4) Выбрать существующий calendar, затем сделать его read-only либо удалить его в тестовом календарном аккаунте. (5) Вернуть допустимые права/цель и retry.

**PASS:** интерфейс различает denied, capability ограничена, transient error и saved setup; зелёный connected/synced не остаётся после отказа persistence/native write. Revocation не очищает mappings/source rows как будто календарь пуст; old settings не маскируют новую недоступную цель. Writable capability проверена до destructive action, а ошибка во время write обработана. Восстановление возможно без logout и без бесконечного повторного OS prompt.

**Evidence/человек:** экран permission Settings до/после, фактические permissions/capabilities, error outcome, native/server diff. OS clicks/sharing role выполняет человек; API mock не заменяет эту карточку.

### DEV-08 — Date-only/all-day в UTC−/UTC+, соседний день и multi-day · P0

**Связь:** C01, CC01, DD02 и date-only объединения. **Режим:** deterministic calendar-date tests + D1/D2 OS. **Предусловия:** D1 UTC− zone, D2 UTC+ zone из поддерживаемого IANA списка; записать actual offsets на датах fixtures. D — будущая календарная дата, D−1/D+1 уже содержат различимые sentinel slots. All-day D и multi-day [D,D+3) заданы как календарные даты, не как универсальная длительность в секундах.

**Шаги:** (1) Создать и дважды пересохранить all-day D на D1. (2) Прочитать с D2, изменить только D, удалить только D. Для базового single-device варианта последовательно сменить timezone D1 и повторно прочитать данные; это доказывает timezone behavior, не cross-device sync. (3) Импортировать multi-day all-day и проверить каждый покрытый день и исключительную конечную дату провайдера. (4) Пройти calendar, ProjectDetail, availability header и DateRangePicker; выбрать/подтвердить одну дату. (5) Повторить рядом с переходом DST из DEV-09.

**PASS:** одна и та же календарная дата подписана одинаково независимо от UTC offset; D−1/D+1 не изменились; повторное сохранение идемпотентно. Multi-day занятость покрывает ровно согласованные calendar days, без лишнего последнего дня. Date-only label, выбранная дата и persisted day key совпадают. Не требовать 24h в секундах от каждого локального all-day во время DST.

**Evidence/человек:** выбранные D/зоны/offsets, DB day/isAllDay и native start/end semantics, screenshots всех затронутых headers. Человек переключает timezone тестового устройства; системные часы ради fixture не переводятся произвольно.

### DEV-09 — Profile/device timezone mismatch, overnight и DST gap/fold · P0

**Связь:** DF01, DF04, CC06, HP04, DD02, условный planner timezone стык. **Режим:** независимый time oracle + selected OS examples. **Предусловия:** D1 device zone отличается от выбранной manual profile zone; R начинается 23:00 и заканчивается 01:00 следующей даты в zone R. `T_gap` и `T_fold` заранее вычислены из **зафиксированной версии tzdata/независимого oracle**, ожидаемые offsets/instants приложены к fixture; не брать ожидаемый ответ из того же тестируемого formatter.

**Шаги:** (1) Открыть R, изменить только title, сохранить. (2) Проверить обе даты в calendar и busy availability. (3) Сохранить manual profile zone и перезапустить/войти повторно. (4) Попытаться выбрать несуществующее время T_gap и двусмысленное T_fold; если продукт поддерживает fold-selection, явно выбрать offset/occurrence. (5) Войти в планировщик при разных device/profile «сегодня», проверить past filtering.

**PASS:** title-only edit не сдвигает startsAt/endsAt; overnight сохраняет правильный end date и виден на обоих днях. Manual timezone не перезаписывается auto-mode без выбора пользователя. Для gap — явный отказ либо явно согласованная и показанная нормализация; для fold — явное разрешение неоднозначности или отказ, но не скрытый выбор. После успешного сохранения instant соответствует oracle; отрицательная/нулевая длительность не отправляется как success. Непринятая продуктовая политика gap/fold означает BLOCKED на policy, не произвольный PASS.

**Evidence/человек:** исходные/итоговые ISO, zone/mode/offset, oracle fixture, picker labels, planner now. Автоматически покрыть обе стороны DST; человеку достаточно по одному gap/fold UI и overnight примеру в нужной зоне.

### DEV-10 — Push permission «Позже», отказ, внешний Settings change и retry · P0

**Связь:** GC01–GC03. **Режим:** coordinator tests + чистое OS permission state D1. **Предусловия:** staged A с onboarding=false; известные global preference, OS permission и registration state.

**Шаги:** (1) Нажать Later/Skip и завершить onboarding. (2) В Profile включить уведомления, отказать OS. (3) Разрешить в Settings, вернуться foreground. (4) При enabled+granted отказать первой регистрации network/5xx; восстановить связь и сделать background→foreground без нового login. (5) Выключить global preference и повторить foreground.

**PASS:** Later не порождает немедленный скрытый prompt после mount; denied не отображается как registered success. Возврат из Settings и transient failure приводят к ограниченному no-prompt retry с single-flight/backoff; нет бесконечного запроса permissions. Preference=false, OS denied и временно unregistered различимы; inbox может существовать независимо от push и не считается ошибкой только потому, что push выключен.

**Evidence/человек:** видео количества OS prompts, manifest трёх состояний, регистрации/повторы и server token state. Человек нужен для prompt/Settings; scheduler/transport faults автоматизируются.

### DEV-11 — От ticket к receipt, invalid token и частичные ошибки · P0

**Связь:** G02, GR01, EO-style success discipline. **Режим:** deterministic provider adapter + отдельная реальная staging отправка на D1. **Предусловия:** per-recipient attempt ID, ticket ID, receipt polling/result storage реализованы или явно отсутствуют; отсутствие реализации — FAIL соответствующего gate, не ручное предположение.

**Шаги:** (1) В harness пройти send network failure, ticket error, ticket accepted→receipt error и ticket accepted→receipt success. (2) Один recipient успешен, другой временно failed; retry только failed. (3) DeviceNotRegistered удаляет/деактивирует именно подтверждённый token, временный provider error — не все tokens пользователя. (4) Одной реальной отправкой проверить end-to-end correlation до receipt; observation OS — DEV-12.

**PASS:** все уровни имеют отдельные состояния; accepted не превращается в delivered/displayed. Failed receipt становится видимым и actionable; повтор не множит inbox и не пересылает без причины успешным recipients. Временный сбой не навсегда гасит регистрацию. Live receipt невозможно гарантированно заставить вернуть нужную ошибку — error cases закрывает adapter harness, не бесконечная отправка на телефон.

**Evidence/человек:** redacted attempt→ticket→receipt timeline, retry counts, token alias diff; человек наблюдает одну live доставку, не предоставляет токен в переписку.

### DEV-12 — Push foreground/background/locked/terminated и tap · P1

**Связь:** G02, GC lifecycle, notification navigation. **Режим:** физический D1; D2=A или staging harness инициирует synthetic event. **Предусловия:** разрешения granted, Focus/Scheduled Summary/preview/sound и connectivity записаны; calendar alarms для этой карточки выключены, чтобы не путать два источника.

**Шаги:** последовательно отправить различимые сообщения в foreground, background, на locked screen и после явного force-quit. Для каждого проверить receipt отдельно, наличие в Notification Center/баннер и tap. Повторить cold-start/live tap одной notification, затем user refresh, убедиться в отсутствии двойного details sheet. Открыть notification по id без предварительно загруженной репетиции; отдельно target удалён/недоступен.

**PASS:** для реально наблюдённой доставки one tap открывает один корректный доступный объект, без двух sheets/залипшего overlay; missing target даёт понятное состояние. Отсутствие banner при политике OS не переписывается как server failure, а receipt success не доказывает показ. Force-quit/background результаты фиксируются как OS observations; приложение восстанавливает данные/inbox при следующем foreground без зависимости от исполнения background JS. Не задавать гарантированную real-provider latency как unit SLA.

**Evidence/человек:** notification alias/type, receipt, screen recording с состоянием приложения и ОС; человек подтверждает фактический display/tap. Если banner не появился, записать observation window и OS settings; вердикт доставки может быть INCONCLUSIVE/BLOCKED, а не выдуманный success.

### DEV-13 — Уведомление старой сессии после A→B и два источника напоминаний · P0

**Связь:** G01, HN03, NI03; native response dedup пока проверочный стык. **Режим:** intent handler harness + OS. **Предусловия:** A notification уже принята provider до switch и содержит synthetic private target P_A; B не имеет доступа. Для второго подпункта app-owned calendar event имеет alarm, remote push помечен другим ID/source.

**Шаги:** (1) Задержать dispatch/tap notification A, переключить D1 на B. (2) Доставить live либо получить last response при launch. (3) Нажать старую карточку/уведомление. (4) Повторить тот же intent ID. (5) Отдельно наблюдать calendar alarm и remote reminder одной R.

**PASS:** app не восстанавливает данные/seen/badge A и не отмечает запись B ошибочно; server read всё ещё запрещает P_A. Старый intent отвергается/откладывается согласно recipient/session policy, повтор ID не открывает второй экран. Уже принятый внешней системой A push может появиться после switch: это измеряется и требует product privacy решения для содержимого, а не обещания невозможной ретроактивной отмены. Calendar alarm и remote push учтены как разные sources; если продукт обещает одно напоминание, реализована явная политика подавления/настройки, а не случайная дедупликация по title.

**Evidence/человек:** время send/accept/switch/display/tap, recipient aliases и access denial, badges, source IDs двух сигналов. Человек нужен для lock-screen privacy наблюдения; персональных данных fixtures нет.

### DEV-14 — Reminder failure/claim lease, move race и отключённое расписание · P0

**Связь:** GR01–GR05. **Режим:** deterministic fake-clock/real PostgreSQL barriers; один разрешённый staging smoke. **Предусловия:** отдельный тестовый runner без production scheduler; due R с A/B; revision/lease/attempt protocol описан. Текущее состояние scheduler disabled явно записано.

**Шаги:** (1) Отказать после claim A до claim B, затем остановить worker после claim до send. (2) После lease expiry запустить повтор. (3) Два concurrent runners для одной revision. (4) Перенести R между due-read и claim/send; отпустить старый worker. (5) Вернуть helper fulfilled failed summary вместо throw; отдельно DB query failure. (6) На новой revision выполнить разрешённый smoke.

**PASS:** failed/expired attempts восстанавливаются адресно, чужие успешные claims не стираются; старый worker не подавляет напоминание новой revision. No-due отличается от query-broken в HTTP/health, partial success видим. Inbox idempotent; внешняя доставка at-least-once не выдаётся за exactly-once. Wording соответствует фактическому startsAt/recipient timezone, а catch-up «через 10 минут» не называется «через час». Включение реального расписания — отдельное operational решение после gate, не шаг этой карточки.

**Evidence/человек:** barrier order, fake now/wall now, revision/claim/attempt states, per-recipient results, run HTTP/body. Физическое устройство нужно только для smoke, не для воспроизведения каждого worker crash.

### DEV-15 — Invite до входа/во время onboarding, холодный старт и повтор · P1

**Связь:** HN01, H02. **Режим:** deterministic intent queue + D1 браузер. **Предусловия:** новый B без onboarding, active allowlisted invite P_shared; отдельный истёкший/revoked invite. Обработчик имеет stable intent ID/queue acknowledgement.

**Шаги:** (1) Открыть HTTPS invite до login, войти B, пройти onboarding медленно (>прежнего 500 ms timer). (2) Повторить получение ссылки уже в onboarding и с cold launch. (3) Открыть тот же intent дважды и один другой код после первого. (4) Проверить browser fallback после отказа automatic open; отдельно expired/revoked.

**PASS:** код не consumed до готового допустимого navigator; после onboarding открывается именно нужный JoinProject, join совершается только явным действием. Повтор intent не дублирует навигацию/членство, новая ссылка не теряется в старом initializer. Expired/revoked показывает понятный отказ; fallback кнопка работает реальным tap при действующем CSP. Недоступный из-за build association universal link — отдельный FAIL integration, не ошибка backend invite.

**Evidence/человек:** queue received/deferred/consumed timeline, route/screens, staging link/build association IDs, запись Safari/выбранного мессенджера. Человек делает tap/OS selection; агент проверяет route readiness автоматически.

### DEV-16 — iOS picker Cancel/Done, зависимое end time и date range · P1

**Связь:** HC02, CC01, DF04. **Режим:** component event tests + physical iOS spinner. **Предусловия:** draft R с известными date/start/end; original hash сохранён; dirty status наблюдаем.

**Шаги:** (1) Поменять start позже старого end, чтобы сработало зависимое изменение end; нажать Cancel. (2) Повторить date/end picker и закрытие через доступные dismiss/overlay жесты. (3) Открыть заново — видны originals. (4) Изменить и Done — ровно одно commit draft. (5) DateRangePicker отменить/подтвердить в UTC− zone и проверить label versus selected value. При Android-in-scope повторить set/dismiss и system Back.

**PASS:** Cancel/dismiss не меняет ни основное, ни зависимое поле и не создаёт server/native write; Done применяет согласованный draft, validation использует его целиком. Никакого cancelled-time в последующем Save. Label и persisted calendar date совпадают. Runtime spinner проверяется человеком, mock event alone не доказывает native semantics.

**Evidence/человек:** before/draft/after values, callback/commit count, отсутствие network mutation, экранная запись Cancel/Done. Человек нужен для native gestures.

### DEV-17 — Offline Save и потерянный ответ после commit · P0

**Связь:** AC01–AC02, CC02–CC05, NI02/NI04; future async contract. **Режим:** controlled transport/storage faults + D1 airplane/offline smoke. **Предусловия:** R/availability draft revision v1; server snapshot v1; per-operation status/reconciliation policy явно выбрана. HTTP 202 и durable offline queue **не обязательны**: достаточно честного saving/succeeded/failed/uncertain результата конкретной операции. Если offline save не поддержан, ожидается сохранённый на текущем экране draft+видимый отказ без обещания отправки; persistence через restart проверяется только если оно обещано продуктом. Этот план не навязывает новую очередь.

**Шаги:** (1) Выключить сеть до Save, сделать Save и restart. (2) Вернуть связь; перед ответом создать локальную правку v2. (3) Отдельно выполнить server commit, потерять только HTTP response, повторить с тем же idempotency key. (4) Только если выбран контракт HTTP 202, вернуть 202/opId, затем terminal failed и отдельно succeeded/revision; закрыть/reopen приложение между ними. Иначе эта ветка N/A, проверяется обычный per-operation status. (5) Задержать GET старой v1 после confirmed v2. (6) Повторить mark-read offline и transient refresh500 versus настоящий revoked401.

**PASS:** при заявленной offline persistence draft/очередь переживает restart с правильным owner; без неё UI заранее сообщает, что запись не выполнена, не очищает draft в текущем экране и не обещает фоновой доставки. Transient auth/network сбой не стирает рабочую сессию, настоящий revoke приводит в согласованное signed-out состояние. ACK v1 не очищает dirty v2. Если есть 202, он остаётся pending до terminal outcome; terminal failed видим и повторяем. Lost-response retry не создаёт дубль/повторное destructive действие; uncertain outcome сначала reconciled или безопасно повторяется, а не объявляется success по таймеру. Old GET не откатывает confirmed revision. Read/unread/badge согласованы с pending/confirmed, offline read не выдаётся за server commit.

**Evidence/человек:** operation/idempotency IDs, exact commit/response timeline, queued/saving/pending/saved/error UI screenshots, server revisions/counts. Человек включает реальную offline сеть один раз; точную lost-ACK/202 перестановку выполняет harness. Не заявлять существование 202 endpoint, если выбрана синхронная реализация.

### DEV-18 — Два устройства редактируют дни, refresh не теряет draft · P0

**Связь:** CC02–CC05, C03. **Режим:** integration revisions/locks + D1/D2=A. **Предусловия:** оба загрузили X/Y=v1, нет личных данных; указан контракт conflict409/merge для одной даты.

**Шаги:** (1) D2 меняет только Y→v2. (2) D1 со старым snapshot меняет только X и сохраняет, включая offline-cache вариант. (3) Одновременно изменить один X с обоих устройств через barrier. (4) На D1 оставить несохранённый draft, выполнить focus/reload/network fallback. (5) Изменить новое поле во время Save, после него выполнить выборочное удаление past-date при других dirty dates.

**PASS:** save X не отправляет stale Y и не затирает v2; same-day conflict разрешён явно либо отклонён с сохранением draft, две взаимоисключающие строки не объединяются молча. Refresh сохраняет dirty edits или требует явного решения; pending-save ACK отмечает сохранённой только отправленную revision; удаление одной даты не очищает unrelated dirty state. Server constraints/locks проверяются на реальном staging PostgreSQL, SQLite mock недостаточен.

**Evidence/человек:** per-date revisions/payload scope/affected rows, before/after DB, видео обоих draft. Человек выполняет UI последовательность; concurrency ordering детерминированный.

### DEV-19 — RSVP/inbox с поздними ответами и восстановлением после ошибки · P1

**Связь:** DD01, HN02–HN03, NI01–NI06, DF06. **Режим:** screen+real context tests и D1/D2. **Предусловия:** R общая A/B; >50 synthetic notifications с unread на следующей странице; загружен snapshot.

**Шаги:** (1) Снять seen на D2 и успешно refresh D1; затем toggle D1 с network failure. (2) Открыть R из notification id-only. (3) Задержать list/count, выполнить read/delete, отпустить старый ответ. (4) Переключить project filter при двух переставленных запросах. (5) Доскроллить inbox до старой unread, mark-all, затем error/retry initial list. (6) В contract-тесте передать ids=[] отдельно от all:true, согласно новому API.

**PASS:** server no снимает старое yes; карточка/Details/stats используют согласованное состояние и rollback. Поздний GET не возвращает удалённую запись/старый badge/другой project under new filter. Все страницы доступны, mark-all соответствует общему scope и не прячется из-за первой страницы. Empty IDs не означают случайный mark-all. Ошибка initial load отличается от настоящего пустого inbox и имеет retry.

**Evidence/человек:** request-order trace, roster stats и unread counts до/после, screenrecordings двух entrypoints. Контекст в тесте настоящий, не mock, заранее принимающий любое состояние за правильное.

## 5. Порядок, остановка и критерий готовности

1. Агент сначала готовит deterministic tests/fixtures и manifest предлагаемой staging-сборки, сообщает человеку конкретные недостающие действия. Сначала DEV-01–DEV-05, DEV-07–DEV-11, DEV-14, DEV-17–DEV-18: опасные data/session invariants должны закрыться до широкого OS smoke.
2. Затем на доступном реальном iPhone выполнить базовый прогон; при наличии D2 закрыть отдельный multi-device gate. Разные clock/response permutations покрывает harness; повторять их вручную десятки раз не нужно. Для хрупкой найденной гонки сохранить прежний failing trace и подтверждённый passing trace с тем же release order. Без D2 server tests выполняются самостоятельно, cross-device OS результаты остаются NOT_RUN.
3. Любая запись A в B, изменение sentinel personal event, удаление чужого source scope или ложное confirmed/synced после отказа — **FAIL блокирующего gate**. Остановить дальнейшие destructive runs, сохранить evidence и исправить причину; не продолжать, пытаясь «очистить» симптомы.
4. Runtime OS limitations и внешняя доставка не маскируются зелёными unit tests: BLOCKED/INCONCLUSIVE объясняют непроверенное поведение. PASS требует привязки к build/backend/schema, поэтому пересборка после изменения auth/calendar/native-config инвалидирует соответствующие предыдущие результаты; локальная редакция текста не требует полного повторения матрицы.
5. После проверки человек/агент удаляет только allowlisted synthetic data по заранее сохранённым IDs, отзывает staging registrations и возвращает OS Settings тестовых устройств. Проверить сохранность sentinel событий, отсутствие оставшихся QA alarms, отключённый staging scheduler. Cleanup outcome входит в run evidence.

Отчёт будущего исполнения: таблица caseId → build/OS → result → evidence → remaining limitation. Никаких общих «push работает»/«offline работает» без указания проверенного уровня. Этот файл сам по себе не является разрешением запускать проверки или доказательством исправления findings.

## 6. Mapping для основного плана и реестра

Статус **всех строк сейчас NOT_RUN**. Несколько карточек могут проверять одну находку; это не несколько исправлений. Группа findings не означает, что одна OS-демонстрация закрывает каждый серверный контракт: deterministic/server evidence остаётся обязательной частью соответствующей карточки.

| Finding IDs / проверочный стык | DEV-ID | Текущий статус |
|---|---|---|
| AC03, BC01, ES01, NI03, HN03, HC01 | DEV-01 | NOT_RUN |
| G01 (включает FC01), GC03 | DEV-02 | NOT_RUN |
| EI01, ES02 — import scopes | DEV-03 | NOT_RUN |
| ES02, EO04 (включает ES03), EX02 — export scopes/смена цели | DEV-04 | NOT_RUN |
| EX01–EX04, EI02–EI04, EO06 | DEV-05 | NOT_RUN |
| EO01–EO02, EX02 — empty/cleanup | DEV-06 | NOT_RUN |
| HP05, EO06, EX02–EX04 — permission/capability | DEV-07 | NOT_RUN |
| C01, CC01 (включает date-only DP03/BC04), DD02 — calendar-day | DEV-08 | NOT_RUN |
| DF01, DF04, CC06, HP04, DD02; условный timezone стык planner | DEV-09 | NOT_RUN |
| GC01–GC03 | DEV-10 | NOT_RUN |
| G02, GR01 — ticket/receipt/per-recipient outcomes | DEV-11 | NOT_RUN |
| G02, GC lifecycle; OS delivery/tap/dedup — проверочные стыки | DEV-12 | NOT_RUN |
| G01, HN03, NI03; старый in-flight intent/calendar alarm — проверочные стыки | DEV-13 | NOT_RUN |
| GR01–GR05 | DEV-14 | NOT_RUN |
| HN01, H02 | DEV-15 | NOT_RUN |
| HC02, CC01, DF04 | DEV-16 | NOT_RUN |
| AC01–AC02, CC02–CC05, NI02, NI04; optional async ACK contract | DEV-17 | NOT_RUN |
| CC02–CC05, C03 | DEV-18 | NOT_RUN |
| DD01, HN02–HN03, NI01–NI06, DF06 | DEV-19 | NOT_RUN |

Без второй независимой native-установки реестр отдельно отмечает `DEV-03 native = NOT_RUN`, `DEV-04 multi-device native = NOT_RUN`, `DEV-18 two-device UI = NOT_RUN`, даже если их автоматические подчасти позже станут PASS. Одноустройственные timezone/registration/notification примеры обозначаются именно как базовый прогон.

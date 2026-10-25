# Реестр системного исправления Rehearsly

> **С 24.09.2026 исправления ведёт Claude на ветке `claude/systematic-repair`**
> (от `aa00ffd`); незаконченный R2 агента сохранён там первым коммитом без
> изменений (`dd886ea`). Codex — независимый ревьюер: ревьюит в отдельном
> `git worktree`, замечания пишет в `audit/REVIEW_<пакет>.md`, код и реестр не
> правит. Ветка `codex/systematic-repair` остаётся на `aa00ffd`.

Операционный контекст: [известный отказ Neon и границы доступа](PRODUCTION_ACCESS.md), сообщённые Вадимом 18 сентября 2026. Production smoke остаётся NOT_RUN. Вадим отдельно разрешил push `codex/systematic-repair` и первый удалённый `Application checks`; deployment и доступ к production требуют отдельного решения. Локальные статусы ниже не утверждают работоспособность production.

Дата подготовки: 16 сентября 2026; начало реализации: 17 сентября 2026. Ветка `codex/systematic-repair`, база `0f655e2`. [R0 COMPLETE](REMEDIATION_R0.md); H01, [A02](REMEDIATION_A02.md), [B03](REMEDIATION_B03.md), [B04](REMEDIATION_B04.md), [H04](REMEDIATION_H04.md), [ID01](REMEDIATION_ID01.md) и [IS01](REMEDIATION_IS01.md) VERIFIED локально, H02 — [READY_FOR_CHECK](REMEDIATION_H02.md) на `df6fd01` до физической DEV-15; IA01 — [READY_FOR_CHECK](REMEDIATION_IA01.md) на `0dc7666` до OPS-IA01; [IS02](REMEDIATION_IS02.md) — READY_FOR_CHECK на `61ced139` до OPS-IS02; F03/F05 — [VERIFIED локально](REMEDIATION_R2_FOUNDATION.md) на `573608c`; F01/F02/FT01/FT02 — [VERIFIED локально](REMEDIATION_R2.md) на `eb24c62`, FM02 — VERIFIED с read-only проверкой данных production 24.09, FM01 — READY_FOR_CHECK до OPS-FM01-DATE (ревью R2-01); остальные 84 пункта остаются TODO. Первоначальное воспроизведение A02/B02/D01/F01 в R0 не было исправлением; A02 закрыт отдельным этапом на `7e1eefa`, B03 — на `e0a0ede`, B04 — на `fd5f1eb`. B03 требует additive migration007 до будущего серверного deployment и отдельного выпуска клиентских изменений. B04 требует additive migration008 до серверного deployment. Это учёт локальной реализации, не повторная оценка текущего production.

Удалённый [Application checks на8e206b2 — PASS](REMEDIATION_R2_FOUNDATION_CI.md): оба jobs, включая browser cleanup и R2 foundation. Production по сообщению Вадима19сентября доступен; агент к нему не обращался.

[План R0–R9](/Users/vadimfertik/Desktop/reh_app/audit/REMEDIATION_PLAN.md) · [Аудит](/Users/vadimfertik/Desktop/reh_app/audit/AUDIT_REPORT.md) · [Серверные проверки](/Users/vadimfertik/Desktop/reh_app/audit/notes-remediation-server.md) · [Устройства](/Users/vadimfertik/Desktop/reh_app/audit/notes-remediation-device-tests.md).

Основной пакет у пункта один; общие зависимости и повторные regression проверки остаются обязательными. Число закрытых строк не заменяет соблюдение общего правила. Исходная критичность сохранена:15High/69Medium/18Low;5условных отмечены отдельно.

## Статусы и порядок учёта

- TODO — не начато. DESIGN — сформулированы контракт и критерии. IN_PROGRESS — реализация. READY_FOR_CHECK — код готов, необходимые проверки ещё не завершены. VERIFIED — выполнены все применимые критерии и приложены доказательства. BLOCKED — указана конкретная внешняя причина/нужное действие. DEFERRED — явно отложено с ответственным решением и риском, не исправлено.
- Для тестов отдельно PASS / FAIL / NOT_RUN / BLOCKED; N/A допустим с конкретным обоснованием неприменимости платформы/контракта. Отсутствие устройства — NOT_RUN/BLOCKED, не N/A.
- VERIFIED требует regression на исходный дефект, правильного конечного состояния и релевантных failure/retry/race/upgrade проверок. При обязательной device проверке её отсутствие запрещает VERIFIED; код может оставаться READY_FOR_CHECK.
- Evidence для VERIFIED должен называть полный проверенный commit исходников, команды, фактические exit codes и хеши проверенных файлов. Код сначала фиксируется; отчёт и результаты проверки этого commit добавляются отдельным коммитом документации. После изменения проверяемого кода релевантные проверки повторяются. Старые манифесты остаются историческими снимками; их хеши нельзя просто переписать под новое состояние без проверки.
- Для conditional finding проверка условия deployment и проверка fail-closed поведения фиксируются раздельно. «В текущем env ключ есть» не исправляет отсутствие обязательного guard.
- Закрытие одного ID не закрывает автоматически соседний. Новый общий механизм связывается со всеми affected IDs, затем каждый критерий проверяется отдельно.

## Пакеты

R0 — baseline/harness, решения и первичная инвентаризация кандидатов на мёртвый код, дубли и неиспользуемые зависимости; не имеет отдельного finding ID. Очистка заменённых реализаций выполняется внутри соответствующего пакета, общий повторный проход — в R9. Порядок и условия перехода описаны в основном плане. Следующие числа — распределение ответственности, не число отдельных PR.

| Пакет | Пунктов | Состояние |
|---|---:|---|
| R0 | — | COMPLETE — baseline, real PG/HTTP harness, исходные дефекты, первичная инвентаризация |
| R1 | 10 | READY_FOR_CHECK — 7 VERIFIED, H02/IA01/IS02 READY_FOR_CHECK (DEV-15/OPS-IA01/OPS-IS02); release gates открыты |
| R2 | 8 | READY_FOR_CHECK — 7 VERIFIED; FM01 ждёт даты конвертации production (OPS-FM01-DATE, ревью R2-01); OPS-R2-ADOPT до деплоя 007/008 |
| R3 | 6 | IN_PROGRESS — [контракт](REMEDIATION_R3.md) `e5d9edc`; A03/A04/HP02 — в коде, PG-сценарии `dd73b96`; маршруты A01 `d5564ee`, `3859ece` (почтой — после OPS-EMAIL); правило Google/Apple `d964417`, `56d11e9`, `43cbdac`; сброс пароля `ec292ee`; смена email `50ba23d`; клиент регистрации `77bddd1`..`286787a`; экраны сброса и смены адреса `23f59cb`, замечания ревью `a7e42d8` (T-130) — A01, A03, A04, HP01, HP02 READY_FOR_CHECK до ревью и DEV-20; AC05 не сделан |
| R4 | 8 | IN_PROGRESS — [отчёт](REMEDIATION_R4.md): D01, D02, DF02, D04 VERIFIED (правка №1); правка №10 (B01, B02, D03) READY_FOR_CHECK до ревью, выкладка сервера — после миграции 012; правка №11 (G01) READY_FOR_CHECK до ревью и DEV-02, выкладка — после миграций 012 и 013; [разбор](TRIAGE_R4_R9.md) |
| R5 | 15 | IN_PROGRESS — [отчёт](REMEDIATION_R5.md): правка №8 (DP01) READY_FOR_CHECK до DEV-19; правка №12 (`e9711e4`, e2e `8730a61`; ревью — `66123fb`, e2e 15–20 `70bcde6`, `87a47fa`; ревью 2 — `52934c9`, e2e 21 `3b20f40`; ревью 3 — `9e70ab6`; ревью 4 — e2e 22 `e677aaf`) — AC01–AC03, BC01, BC02, DF05, DF06, ES01, NI03, HN02, HN03, HC01 и NI04 (R8) READY_FOR_CHECK до ревью и DEV-01/17/19/21; правка №13 (AC04) READY_FOR_CHECK до ревью; остальные TODO |
| R6 | 14 | IN_PROGRESS — [отчёт](REMEDIATION_R6.md): правка №2 принята ревью (C02 VERIFIED; CC02–CC05, C03 до DEV-17/DEV-18); правка №3 принята ревью (DP04 VERIFIED; C01, CC01 до DEV-08); правка №16 (`bf9a24a`, e2e 29 `4b693d8`) — C04 READY_FOR_CHECK до ревью; [разбор](TRIAGE_R4_R9.md) |
| R7 | 16 | IN_PROGRESS — [отчёт](REMEDIATION_R7.md): правка №4 принята ревью `ad09154` (EI01, EI03, EI04, ES02 — READY_FOR_CHECK до DEV-03/04/05); [разбор](TRIAGE_R4_R9.md) |
| R8 | 14 | IN_PROGRESS — [отчёт](REMEDIATION_R8.md): правка №5 (GR01, GR02, GR03, GR05, G02) READY_FOR_CHECK до DEV-11/DEV-14; принята ревью `b948056` (R8-01, R8-02 закрыты в `7f85bab`); правка №6 (GR04) принята ревью `7665ae4` (READY_FOR_CHECK до DEV-14); выкладка — после миграции 011; [разбор](TRIAGE_R4_R9.md) |
| R9 | 11 | IN_PROGRESS — [отчёт](REMEDIATION_R9.md): правка №7 принята ревью `a684f6b` (R9-01, R9-02 закрыты в `9a0ce85`); DP02 VERIFIED, HC02 READY_FOR_CHECK до DEV-16; R9-03 (навигация) исправлено в `df60673`, `2d79fa2`, ждёт проверки; правка №9 — `4dd49c5`: HN01 READY_FOR_CHECK до ревью и DEV-15, HP03 READY_FOR_CHECK до ревью; [разбор](TRIAGE_R4_R9.md); DF03 VERIFIED (правка №1, [R4](REMEDIATION_R4.md)); IC01 DEFERRED до выпуска Android |

## Ждут владельца

Сводный список на 25.09. Работа продолжается без них; колонка «Блокирует» — что
без карточки нельзя закрыть или выпустить. Выполнены: OPS-R2-DATA (24.09),
OPS-R3-DATA (25.09).

| Карточка | Пакет | Что сделать | Блокирует |
|---|---|---|---|
| OPS-DEMO-PASSWORD | вне аудита | Сменить пароль демо-аккаунта ревью Apple и обновить его в App Store Connect ([карточка](REMEDIATION_R2.md)) | безопасность аккаунта ревью: старый пароль в публичной истории |
| OPS-EMAIL | R3 | Resend, DNS домена, ключ в Vercel ([карточка](REMEDIATION_R3.md)) | реальную отправку писем и деплой сервера R3: без почты регистрация отвечает 503. Разработка идёт без неё |
| OPS-R2-ADOPT | R2 | С разрешения — `npm run migrate -- --dry` против production ([карточка](REMEDIATION_R2.md)) | деплой сервера, которому нужны 007/008/010 |
| OPS-FM01-DATE | R2 | Дата первого production-деплоя кода со `starts_at` (история Vercel); 25.09 неизвестна | FM01 → VERIFIED |
| DEV-17, DEV-18 | R6 | Устройства: офлайн-сохранение занятости и два устройства на одном аккаунте ([карточки](notes-remediation-device-tests.md)). Одновременная правка одного дня — последнее сохранение, по решению (known-issues) | CC02–CC05, C03 → VERIFIED |
| DEV-20 | R3 | Устройство и настоящая почта (после OPS-EMAIL): сброс пароля со входа и с занятого адреса, смена адреса с паролем и без ([карточка](notes-remediation-device-tests.md)) | A01, HP01 → VERIFIED |
| DEV-15 | R1, R9 | Физическое устройство: кнопка открытия приглашения ([H02](REMEDIATION_H02.md)); приглашение до входа и во время онбординга открывается после него ([правка №9](REMEDIATION_R9.md)) | H02, HN01 → VERIFIED |
| OPS-IA01 | R1 | `APPLE_CLIENT_ID` в Vercel ([карточка](PRODUCTION_ACCESS.md#ops-ia01--проверка-apple_client_id-человеком)) | IA01 → VERIFIED, выпуск |
| OPS-IS02 | R1 | Deployment-условия общих лимитов ([карточка](PRODUCTION_ACCESS.md)) | IS02 → VERIFIED, выпуск |
| OPS-R3-APPLE | R3 | 25.09 выполнено: единственный аккаунт с Apple — владельца, R3-10 закрыт. Повторить исправленный запрос после выкладки R3 ([карточка](REMEDIATION_R3.md)) | повтор после выкладки: новые связи Apple до неё ещё возможны |
| OPS-DEMO-RESEED | вне аудита | По желанию: перезалить демо исправленным сидом | — |

## Все находки

В графе evidence после реализации указывать ссылку на карточку исполнения: commit/ветка, проверки и фактический результат. Для не начатых строк оставлено «—». Цитаты и доказательства исходных дефектов находятся в аудите.

| ID | Важность | Условный | Пакет | Статус | Краткая суть | Evidence |
|---|---|---|---|---|---|---|
| A01 | High | Нет | R3 | READY_FOR_CHECK | предварительный захват аккаунта через email/OAuth | [Регистрация ждёт кода, pending без сессии — d5564ee; версия сессии под блокировкой — 3859ece; правило Google/Apple и все пути выдачи сессии — d964417, отзыв под блокировкой и первый пароль — 56d11e9, сессии и устройства при любом доказательстве, без взаимоблокировки удаления — 43cbdac; сброс пароля — ec292ee; смена email — 50ba23d и исправление R3-19 (route-тесты, PG R3_AUTH, мутации); клиент регистрации — 77bddd1..286787a; экраны сброса и смены адреса — 23f59cb (T-130, «красное до» client-recovery-before.txt), замечания ревью — a7e42d8 (выход отменяет ответы в пути, таймаут по письмам; client-recovery-review-before.txt); ждёт ревью, DEV-20 после OPS-EMAIL; R3-10 закрыт для данных 25.09 (карточку OPS-R3-APPLE — повторить после выкладки)](REMEDIATION_R3.md) |
| A02 | High | Нет | R1 | VERIFIED | необработанные async-исключения в auth middleware/admin login | [Исполнение и проверки — 7e1eefa](REMEDIATION_A02.md) |
| A03 | Medium | Нет | R3 | READY_FOR_CHECK | backend не применяет правила пароля и профильные типы | [Код и route-тест (красный до: 16/22) — 9a702ba; PG-сценарий (зоны, NUL, пароль, HP02) — dd73b96; клиент: правило пароля в одном месте, как на сервере (символы, 72 байта) — 23f59cb (T-130); ошибки без кода на языке приложения, NAME_INVALID в профиле — a7e42d8; ждёт ревью](REMEDIATION_R3.md) |
| A04 | Medium | Нет | R3 | READY_FOR_CHECK | способы входа расходятся с реальными credentials | [Код и route-тест (красный до: 5/5) — 6320743; гонка двух отвязок на PG — dd73b96; клиент: пароль при смене адреса спрашивается по реальному способу входа — 23f59cb (T-130); ждёт ревью](REMEDIATION_R3.md) |
| AC01 | Medium | Нет | R5 | READY_FOR_CHECK | Кратковременный сбой refresh уничтожает сессию | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; ждёт ревью и DEV-17](REMEDIATION_R5.md) |
| AC02 | Medium | Нет | R5 | READY_FOR_CHECK | Окончательная потеря авторизации не переводит открытое приложение на вход | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; e2e 15 — 70bcde6, «красное до» — evidence/R5/e2e-15-17-before.txt; ждёт ревью и DEV-17](REMEDIATION_R5.md) |
| AC03 | Medium | Нет | R5 | READY_FOR_CHECK | Поздний ответ профиля восстанавливает user после выхода или подменяет user нового входа | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; ждёт ревью и DEV-01](REMEDIATION_R5.md) |
| AC04 | Medium | Нет | R5 | READY_FOR_CHECK | OAuth токен и возможный Authorization передаются в незащищённый log sink | [правка причины №13 — `f847b3e`, ревью — `94d09de`: один журнал с редактированием (токены, query, код приглашения в пути), ошибки — `LoggedError`, прямой `console` запрещён тестом и ESLint; «красное до» logger-ac04-before.txt, logger-ac04-invite-before.txt; устройство не нужно, ждёт ревью](REMEDIATION_R5.md) |
| AC05 | Medium | Нет | R3 | TODO | Долгоживущие bearer credentials сохраняются в обычном AsyncStorage | — |
| B01 | Medium | Нет | R4 | READY_FOR_CHECK | удаление участника неатомарно, сбой оставляет связанные записи | [правка причины №10 — f92c3da, c689277 (порядок блокировок); ждёт ревью](REMEDIATION_R4.md) |
| B02 | Medium | Нет | R4 | READY_FOR_CHECK | создание/удаление проекта частично фиксируются при ошибке | [правка причины №10 — f92c3da, 9ed5d83, 7cde64f, c689277, e2e 5e4d680, удаление аккаунта 1507eab; миграция 012; ждёт ревью](REMEDIATION_R4.md) |
| B03 | High | Нет | R1 | VERIFIED | неограниченный диапазон дат блокирует event loop до проверки членства | [Исполнение, миграция и проверки — e0a0ede](REMEDIATION_B03.md) |
| B04 | Medium | Нет | R1 | VERIFIED | альтернативный join URL обходит rate limit приглашений | [Исполнение, миграция и проверки — fd5f1eb](REMEDIATION_B04.md) |
| BC01 | Medium | Нет | R5 | READY_FOR_CHECK | проекты и выбранный проект переживают смену аккаунта | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; ждёт ревью и DEV-01](REMEDIATION_R5.md) |
| BC02 | Medium | Нет | R5 | READY_FOR_CHECK | после удаления или изменения прав выбранный проект остаётся старым объектом | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; e2e 19 — 70bcde6, «красное до» — evidence/R5/e2e-18-20-before.txt; ждёт ревью и DEV-21](REMEDIATION_R5.md) |
| BC03 | Low | Нет | R9 | TODO | прошедшие репетиции теряют название | [правка причины №22 — разбор](TRIAGE_R4_R9.md) |
| C01 | High | Нет | R6 | READY_FOR_CHECK | all-day записи удаляются/заменяются по неверному дню в UTC− | [правка причины №3 — 173d227; ждёт DEV-08](REMEDIATION_R6.md) |
| C02 | Medium | Нет | R6 | VERIFIED | неполная запись стирает день с ответом success | [правка причины №2 — 89d0467, 7393358; ревью eb2dbf6 принято; PG 15/15](REMEDIATION_R6.md) |
| C03 | Medium | Нет | R6 | READY_FOR_CHECK | параллельные manual saves могут склеить взаимоисключающие состояния | [правка причины №2 — 89d0467; ревью eb2dbf6 принято; ждёт DEV-17/DEV-18 на устройствах](REMEDIATION_R6.md) |
| C04 | Medium | Нет | R6 | READY_FOR_CHECK | дедупликация по часам теряет источник и может скрыть занятость | [правка причины №16 — `bf9a24a`: строка та же только по источнику, типу и часам, разные записи с одинаковыми часами показываются обе; e2e 29 — `4b693d8`; «красное до» c04-unit-before.txt, e2e-calendar-event-at-the-same-hours-before.txt; устройство не нужно, ждёт ревью](REMEDIATION_R6.md) |
| CC01 | Medium | Нет | R6 | READY_FOR_CHECK | UTC «сегодня» запрещает редактировать текущий местный день | [правка причины №3 — 173d227; ждёт DEV-08](REMEDIATION_R6.md) |
| CC02 | Medium | Нет | R6 | READY_FOR_CHECK | Автозагрузка безусловно стирает несохранённые правки | [правка причины №2 — 89d0467; ревью eb2dbf6 принято; ждёт DEV-17/DEV-18 на устройствах](REMEDIATION_R6.md) |
| CC03 | Medium | Нет | R6 | READY_FOR_CHECK | Изменения во время Save помечаются сохранёнными, хотя не попали в запрос | [правка причины №2 — 89d0467; ревью eb2dbf6 принято; ждёт DEV-17/DEV-18 на устройствах](REMEDIATION_R6.md) |
| CC04 | Medium | Нет | R6 | READY_FOR_CHECK | «Удалить прошлые даты» может удалить выбранные будущие дни | [правка причины №2 — 89d0467; ревью eb2dbf6 принято; ждёт DEV-17/DEV-18 на устройствах](REMEDIATION_R6.md) |
| CC05 | High | Нет | R6 | READY_FOR_CHECK | Save отправляет весь старый snapshot и перезаписывает нетронутые дни | [правка причины №2 — 89d0467; ревью eb2dbf6 принято; ждёт DEV-17/DEV-18 на устройствах](REMEDIATION_R6.md) |
| CC06 | Medium | Нет | R6 | READY_FOR_CHECK | Ветка сохранения через полночь недостижима из Save | [правка причины №15 — f2f34d5: одно правило конца на следующий день, ночной слот целиком в день начала; «красное до» cause15-client-before.txt, e2e 25 (был 24); ревью 1 — 56a91a4: своя строка не скрывается дедупликацией, «красное до» own-slot-dedup-before.txt; ревью 2 — a289956, 3b3b2e8, cce4411: своя строка не скрывает импорт, утро сохраняется к востоку от UTC, e2e 27, «красное до» imported-under-own-before.txt, morning-slot-day-before.txt, e2e-morning-slot-before.txt; ревью 3 — 4ed98f1: e2e 28, поездка из календаря на дне, отмеченном «свободен», «красное до» e2e-trip-under-free-day-before.txt; ждёт повторного ревью и DEV-09](REMEDIATION_R6.md) |
| D01 | High | Нет | R4 | VERIFIED | администратор проекта пишет занятость произвольным пользователям | [правка причины №1 — d9a25fd, ревью f0d90b8 принято](REMEDIATION_R4.md) |
| D02 | High | Нет | R4 | VERIFIED | не приглашённый участник сам получает доступ через RSVP | [правка причины №1 — d9a25fd, ревью f0d90b8 принято](REMEDIATION_R4.md) |
| D03 | High | Нет | R4 | READY_FOR_CHECK | жизненный цикл репетиции фиксируется частями | [правка причины №10 — f92c3da, 9ed5d83, 7cde64f, c689277; миграция 012; ждёт ревью](REMEDIATION_R4.md) |
| D04 | Medium | Нет | R4 | VERIFIED | администратор не может открыть редактирование репетиции, в которую не приглашён | [правка причины №1 — d9a25fd, ревью f0d90b8 принято](REMEDIATION_R4.md) |
| DF01 | Medium | Да | R6 | TODO | редактирование сдвигает время при разных timezone профиля и устройства | [правка причины №14 — разбор](TRIAGE_R4_R9.md) |
| DF02 | Medium | Нет | R4 | VERIFIED | невозможно удалить всех участников при редактировании | [правка причины №1 — d9a25fd, ревью f0d90b8 принято](REMEDIATION_R4.md) |
| DF03 | Medium | Нет | R9 | VERIFIED | после ошибки загрузки edit доступны сохранение и перезапись неполных данных | [правка причины №1 — d9a25fd, ревью f0d90b8 принято](REMEDIATION_R4.md) |
| DF04 | Medium | Нет | R6 | READY_FOR_CHECK | ночная репетиция проходит проверку, но конец сериализуется на день начала | [правка причины №15 — f2f34d5: форма и старый формат сервера — конец на следующий день, иначе 400 TIME_RANGE_INVALID; конфликты на двух днях; «красное до» cause15-client-before.txt, cause15-server-before.txt; ревью 1 — 56a91a4: e2e 26 (был 25) через форму, PG R6_AVAILABILITY, «красное до» e2e-past-midnight-form-before.txt, pg-rehearsal-interval-before.txt; ждёт повторного ревью и DEV-09](REMEDIATION_R6.md) |
| DF05 | Medium | Нет | R5 | READY_FOR_CHECK | поздние ответы и незавершённая загрузка дают неверный состав/проверку конфликтов | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; e2e 20 — 70bcde6, «красное до» — evidence/R5/e2e-18-20-before.txt; ждёт ревью и DEV-21](REMEDIATION_R5.md) |
| DF06 | Medium | Нет | R5 | READY_FOR_CHECK | поздний ответ старого фильтра заменяет репетиции выбранного проекта | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; e2e 17 — 70bcde6, «красное до» — evidence/R5/e2e-15-17-before.txt; ждёт ревью и DEV-19](REMEDIATION_R5.md) |
| DD01 | Medium | Нет | R9 | TODO | Details ведёт вторую копию RSVP и расходится с SeenContext | [правка причины №22 — разбор](TRIAGE_R4_R9.md) |
| DD02 | Medium | Нет | R6 | READY_FOR_CHECK | Репетиция через полночь отсутствует в календаре второго дня | [правка причины №15 — f2f34d5: rehearsalInZone — первый и последний день, лента, список дня, карточка и детали с датой конца; «красное до» e2e 24, был 23 (e2e-past-midnight-before.txt); ревью 1 — 56a91a4; ждёт повторного ревью и DEV-09](REMEDIATION_R6.md) |
| DD03 | Low | Нет | R9 | TODO | Кнопка «Сегодня» не выбирает сегодняшний день | [правка причины №22 — разбор](TRIAGE_R4_R9.md) |
| DP01 | Medium | Нет | R5 | READY_FOR_CHECK | смена проекта закрепляет старые ID участников за новым проектом | [правка причины №8 — `9d7bb83`, `23e4342`, e2e `f95061c`; ждёт DEV-19](REMEDIATION_R5.md) |
| DP02 | Medium | Нет | R9 | VERIFIED | выбранный в planner состав не переносится в создание репетиции | [правка причины №7 — 58a7706, 9a0ce85; ревью a684f6b принято](REMEDIATION_R9.md) |
| DP04 | Low | Нет | R6 | VERIFIED | предложение на сегодня не устаревает вместе с часами | [правка причины №3 — 173d227, 7375a13; ревью bbf4b6e принято](REMEDIATION_R6.md) |
| EI01 | High | Нет | R7 | READY_FOR_CHECK | diff удаляет импорт другого устройства/источника пользователя | [правка причины №4 — 16c6723, a3e6bc8; ревью ad09154 принято; ждёт DEV-03](REMEDIATION_R7.md) |
| EI02 | Medium | Нет | R7 | TODO | неудачное чтение календаря считается успешной синхронизацией | [правка причины №17 — разбор](TRIAGE_R4_R9.md); импорт уже называет непрочитанные календари и не ставит отметку сам (16c6723), но хук экрана ставит её безусловно — [R7](REMEDIATION_R7.md) |
| EI03 | Medium | Нет | R7 | READY_FOR_CHECK | удаление всех импортов не работает без локального tracking | [правка причины №4 — 16c6723, a3e6bc8; ревью ad09154 принято; ждёт DEV-05](REMEDIATION_R7.md) |
| EI04 | Medium | Нет | R7 | READY_FOR_CHECK | перенос recurring события может сначала стереть старую занятость, а новое время не записать | [правка причины №4 — 16c6723, a3e6bc8; ревью ad09154 принято; PG R7_IMPORT; ждёт DEV-05](REMEDIATION_R7.md) |
| EX01 | Medium | Нет | R7 | TODO | Экспорт присваивает личное событие по совпадению текста и затем может удалить его | [правка причины №19 — разбор](TRIAGE_R4_R9.md) |
| EX02 | Medium | Нет | R7 | TODO | После неудачного удаления mapping всё равно уничтожается, событие становится бесхозным | [правка причины №17 — разбор](TRIAGE_R4_R9.md) |
| EX03 | Medium | Нет | R7 | TODO | Ошибка update превращается в «успешный» экспорт старого события | [правка причины №17 — разбор](TRIAGE_R4_R9.md) |
| EX04 | Medium | Нет | R7 | TODO | Неуспешный read/search трактуется как отсутствие и запускает создание дублей | [правка причины №17 — разбор](TRIAGE_R4_R9.md) |
| ES01 | High | Нет | R5 | READY_FOR_CHECK | незавершённый sync прошлого пользователя продолжает запись под новым аккаунтом | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; ревью — 66123fb (поколение сессии по всей цепочке), «красное до» — evidence/R5/cause12-review-before.log; ждёт ревью и DEV-01](REMEDIATION_R5.md) |
| ES02 | Medium | Нет | R7 | READY_FOR_CHECK | mappings разных календарей/устройств схлопываются, причём старейший перезаписывает новый | [правка причины №4 — 16c6723, a3e6bc8; ревью ad09154 принято; ждёт DEV-03/DEV-04](REMEDIATION_R7.md) |
| EO01 | Medium | Нет | R7 | TODO | после ухода из последнего проекта экспортированные события не удаляются | [правка причины №18 — разбор](TRIAGE_R4_R9.md) |
| EO02 | Medium | Нет | R7 | TODO | ошибка импорта отменяет независимый автоэкспорт | [правка причины №17 — разбор](TRIAGE_R4_R9.md) |
| EO03 | Medium | Нет | R7 | TODO | очередь ручных запусков не гарантирует один sync одновременно | [правка причины №18 — разбор](TRIAGE_R4_R9.md) |
| EO04 | Medium | Нет | R7 | TODO | ручная синхронизация может восстановить уже выключенную настройку | [правка причины №18 — разбор](TRIAGE_R4_R9.md) |
| EO05 | Low | Нет | R7 | TODO | ручная синхронизация заменяет названия репетиций общим названием проекта | [правка причины №18 — разбор](TRIAGE_R4_R9.md) |
| EO06 | Medium | Нет | R7 | TODO | неудачная синхронизация получает новую отметку успешного экспорта | [правка причины №17 — разбор](TRIAGE_R4_R9.md) |
| F01 | High | Нет | R2 | VERIFIED | инструкция развёртывания новой БД использует несовместимую смесь SQL-диалектов | [Каноничный PG bootstrap через `--fresh`, мутация — eb24c62](REMEDIATION_R2.md) |
| F02 | High | Нет | R2 | VERIFIED | baseline пропускает обязательный unique index доступности | [Ключ в fresh, baseline отклонён, явный repair; HTTP и мутации — eb24c62](REMEDIATION_R2.md) |
| F03 | Medium | Нет | R2 | VERIFIED | заявленный SQLite режим не запускается штатной командой и не поддерживает SQL приложения | [Явный PostgreSQL runtime и startup — 573608c](REMEDIATION_R2_FOUNDATION.md) |
| F05 | Low | Нет | R2 | VERIFIED | adapter теряет число изменённых строк | [Реальные row counts и HTTP — 573608c](REMEDIATION_R2_FOUNDATION.md) |
| FT01 | Low | Нет | R2 | VERIFIED | режим --dry делает записи в БД; с --baseline вообще меняет историю миграций | [Dry в READ ONLY, --baseline отклонён — eb24c62](REMEDIATION_R2.md) |
| FT02 | Medium | Нет | R2 | VERIFIED | SQL миграции и её запись в журнал не атомарны | [Одна транзакция на вызов, отказ журнала откатывает шаг — eb24c62](REMEDIATION_R2.md) |
| FM01 | Medium | Да | R2 | READY_FOR_CHECK | Историческая конверсия UTC зависит от session timezone | [Legacy-раскладка отклоняется всеми режимами — eb24c62; дата конвертации production не установлена (ревью R2-01, OPS-FM01-DATE)](REMEDIATION_R2.md) |
| FM02 | Low | Да | R2 | VERIFIED | Повторный OAuth backfill создаёт дубли email-provider | [SQLite-пути нет, 001 не исполним — eb24c62; дублей в production нет (OPS-R2-DATA 24.09)](REMEDIATION_R2.md) |
| G01 | High | Нет | R4 | READY_FOR_CHECK | конкурентная регистрация оставляет двух владельцев одного push-токена | [правка причины №11 — 6f47364: токен уникален в схеме, регистрация — один upsert по нему; 5cbe4dd: миграция 013 — шаг мигратора (группа 013), применяется до выкладки сервера; PG R4_PUSH_TOKEN (красное до — fix11-push-token-pg-red-before.txt), мутации; ждёт ревью и DEV-02](REMEDIATION_R4.md) |
| G02 | Medium | Нет | R8 | READY_FOR_CHECK | ticket Expo принят за окончательный результат; receipts не обрабатываются | [правка причины №5 — 03042b9, 7f85bab; ревью b948056 принято; миграция 011; ждёт DEV-11](REMEDIATION_R8.md) |
| GC01 | Medium | Нет | R8 | TODO | «Позже» в onboarding не откладывает системный запрос уведомлений | [правка причины №20 — разбор](TRIAGE_R4_R9.md) |
| GC02 | Medium | Нет | R8 | TODO | Profile сообщает успешное включение push при отказе OS или backend | [правка причины №20 — разбор](TRIAGE_R4_R9.md) |
| GC03 | Medium | Нет | R8 | TODO | Временная ошибка регистрации при запуске не повторяется после восстановления связи | [правка причины №20 — разбор](TRIAGE_R4_R9.md) |
| NI01 | Medium | Нет | R8 | TODO | в приложении недоступны уведомления старше первых 50 | [правка причины №21 — разбор](TRIAGE_R4_R9.md) |
| NI02 | Medium | Нет | R8 | TODO | ошибка «прочитано» скрывается, а UI объявляет уведомления прочитанными | [правка причины №21 — разбор](TRIAGE_R4_R9.md) |
| NI03 | Medium | Нет | R5 | READY_FOR_CHECK | счётчик прошлого аккаунта остаётся после смены пользователя | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; e2e 16 — 70bcde6/87a47fa, «красное до» — evidence/R5/e2e-15-17-before.txt; ревью 3 — 9e70ab6 (запись прошлого аккаунта в пути не держит счётчик следующего на 0), «красное до» — evidence/R5/T-112-r3-red-before.log; e2e 22 — e677aaf, «красное до» — evidence/R5/e2e-22-before.txt; ждёт ревью и DEV-01](REMEDIATION_R5.md) |
| NI04 | Medium | Нет | R8 | READY_FOR_CHECK | поздние ответы возвращают старый счётчик и уже удалённые карточки | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; ревью — 66123fb («Прочитать всё» берёт очередь), e2e 18 — 70bcde6, «красное до» — evidence/R5/cause12-review-before.log, evidence/R5/e2e-18-20-before.txt; ревью 2 — 52934c9 (одно правило useRequestOrder: чтение во время изменения не ложится), e2e 21 — 3b20f40, «красное до» — evidence/R5/cause12-r2-before.log, evidence/R5/e2e-21-before.txt; ревью 3 — 9e70ab6 (порядок запросов у каждой сессии свой), «красное до» — evidence/R5/T-112-r3-red-before.log; ждёт ревью и DEV-17](REMEDIATION_R5.md) |
| NI05 | Low | Нет | R8 | TODO | сбой первоначальной загрузки показывается как пустой inbox | [правка причины №21 — разбор](TRIAGE_R4_R9.md) |
| NI06 | Low | Нет | R8 | TODO | API markRead с пустым списком отмечает весь inbox | [правка причины №21 — разбор](TRIAGE_R4_R9.md) |
| GR01 | Medium | Нет | R8 | READY_FOR_CHECK | ошибка отправки push не освобождает reminder claim | [правка причины №5 — 03042b9, 7f85bab; ревью b948056 принято; ждёт DEV-11/DEV-14](REMEDIATION_R8.md) |
| GR02 | Medium | Нет | R8 | READY_FOR_CHECK | ошибка или остановка между claims и notify навсегда исключает ещё не уведомлённых пользователей | [правка причины №5 — 03042b9, 7f85bab; ревью b948056 принято; PG R8_REMINDERS; ждёт DEV-14](REMEDIATION_R8.md) |
| GR03 | Medium | Нет | R8 | READY_FOR_CHECK | cron и workflow показывают успех при отказе БД/напоминаний | [правка причины №5 — 03042b9, 7f85bab; ревью b948056 принято; ждёт DEV-14](REMEDIATION_R8.md) |
| GR04 | Low | Нет | R8 | READY_FOR_CHECK | текст «завтра»/«через1час» противоречит расширенным окнам напоминания | [правка причины №6 — dc82278, 5e55917; ревью 7665ae4 принято; ждёт DEV-14](REMEDIATION_R8.md) |
| GR05 | Medium | Нет | R8 | READY_FOR_CHECK | старый scheduler snapshot ставит claim уже после переноса репетиции и блокирует новое напоминание | [правка причины №5 — 03042b9, 7f85bab; ревью b948056 принято; PG R8_REMINDERS; ждёт DEV-14](REMEDIATION_R8.md) |
| H01 | High | Нет | R1 | VERIFIED | сохранённая XSS из обращения/профиля выполняется в admin origin | [Исправление](REMEDIATION_H01.md); [обязательные проверки и точный commit](REMEDIATION_H01_FOLLOWUP.md) |
| H02 | Medium | Нет | R1 | READY_FOR_CHECK | резервная кнопка открытия приглашения блокируется CSP | [Локальные проверки — df6fd01; DEV-15 NOT_RUN](REMEDIATION_H02.md) |
| H03 | Low | Нет | R9 | TODO | метрика неактивности принимает давний login за отсутствие использования | [правка причины №22 — разбор](TRIAGE_R4_R9.md) |
| H04 | Low | Нет | R1 | VERIFIED | admin скрывает ошибки загрузки/смены статуса | [Исполнение и проверки — 7ab1e41](REMEDIATION_H04.md) |
| HP01 | Medium | Нет | R3 | READY_FOR_CHECK | изменение email подтверждается, но сервер его игнорирует | [Сервер отказывает вместо молчаливого сброса — 9a702ba; подтверждённая смена кодами на оба адреса — 50ba23d, 075e5d6 (route-тест, PG R3_AUTH, мутации); экран смены адреса, адрес в профиле только для чтения — 23f59cb (T-130); выход во время смены и таймаут двух писем — a7e42d8; ждёт ревью, DEV-20 после OPS-EMAIL](REMEDIATION_R3.md) |
| HP02 | Low | Нет | R3 | READY_FOR_CHECK | существующую фамилию нельзя очистить | [Сервер очищает по `''`/`null` — 9a702ba; клиент шлёт `''` — 23f59cb (T-130, красный до: `lastName: undefined`); ждёт ревью](REMEDIATION_R3.md) |
| HP03 | Low | Нет | R9 | READY_FOR_CHECK | ошибка «пропустить онбординг» остаётся необработанным Promise | [правка причины №9 — 4dd49c5; регресс-тест, «красное до» — evidence/R9/onboarding-before.txt; ждёт ревью](REMEDIATION_R9.md) |
| HP04 | Medium | Нет | R5 | TODO | ручная настройка timezone сбрасывается при следующем запуске/входе | [правка причины №14 — разбор](TRIAGE_R4_R9.md) |
| HP05 | Low | Нет | R7 | TODO | онбординг показывает подключённый календарь после отказа сохранения | [правка причины №18 — разбор](TRIAGE_R4_R9.md) |
| HN01 | Medium | Нет | R9 | READY_FOR_CHECK | Приглашение теряется при первом входе через onboarding | [правка причины №9 — 4dd49c5, формат кода по ревью — 647860a; «красное до» — evidence/R9/onboarding-before.txt, evidence/R9/invite-code-before.txt; ждёт ревью и DEV-15](REMEDIATION_R9.md) |
| HN02 | Medium | Нет | R5 | READY_FOR_CHECK | Успешная загрузка всех проектов не снимает устаревшую отметку «просмотрено» | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; ревью — 66123fb (порядок чтений и отметок в SeenContext), «красное до» — evidence/R5/cause12-review-before.log; ревью 2 — 52934c9 (одно правило useRequestOrder: чтение во время изменения не ложится), e2e 21 — 3b20f40, «красное до» — evidence/R5/cause12-r2-before.log, evidence/R5/e2e-21-before.txt; ждёт ревью и DEV-19](REMEDIATION_R5.md) |
| HN03 | Medium | Нет | R5 | READY_FOR_CHECK | SeenContext сохраняет ответы предыдущего аккаунта | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; ждёт ревью и DEV-01](REMEDIATION_R5.md) |
| HC01 | Low | Нет | R5 | READY_FOR_CHECK | язык аккаунта записывается в cache, но не обновляет уже работающий I18nContext | [правка причины №12 — e9711e4, e2e 14 — 8730a61; «красное до» — evidence/R5/cause12-before.log, evidence/R5/e2e-14-before.txt; e2e 16 — 70bcde6/87a47fa, «красное до» — evidence/R5/e2e-16-hc01-before.txt; ждёт ревью и DEV-01](REMEDIATION_R5.md) |
| HC02 | Medium | Нет | R9 | READY_FOR_CHECK | iOS PickerModal сохраняет изменения при нажатии «Отмена» | [правка причины №7 — 58a7706; ревью a684f6b принято; ждёт DEV-16](REMEDIATION_R9.md) |
| IC01 | Medium | Нет | R9 | DEFERRED | Android App Links не имеют действительной association подписи | [до выпуска Android — разбор](TRIAGE_R4_R9.md) |
| ID01 | Low | Нет | R1 | VERIFIED | документированные переменные срока JWT не влияют на выдачу | [Исполнение и проверки — e6b06b6](REMEDIATION_ID01.md) |
| IDOC01 | Low | Нет | R9 | TODO | документ API содержит устаревшие и противоречащие контракту инструкции | [вместе с каждой правкой — разбор](TRIAGE_R4_R9.md) |
| IS01 | Medium | Нет | R1 | VERIFIED | secret scanner использует неверный диалект regex и пропускает секреты | [Fail-closed scanner и обязательные CLI проверки — 4044e3d](REMEDIATION_IS01.md) |
| IS02 | Medium | Да | R1 | READY_FOR_CHECK | rate limits не общие для нескольких процессов | [Общие бюджеты и проверки — 61ced139; OPS-IS02 NOT_RUN](REMEDIATION_IS02.md); [CI cleanup follow-up — 573608c](REMEDIATION_IS02_CI_FOLLOWUP.md) |
| IA01 | High | Да | R1 | READY_FOR_CHECK | Apple ID token принимается без проверки приложения-получателя, если APPLE_CLIENT_ID отсутствует/пуст | [Локальный guard и проверки — 0dc7666](REMEDIATION_IA01.md); OPS-IA01 NOT_RUN |

## Карточка исполнения пакета — шаблон

Копировать при начале конкретного пакета; не заполнять вымышленными результатами.

- Пакет / ответственный агент / ветка / базовый commit:
- IDs и проверяемые правила:
- Новое API/schema/state поведение и причины выбора:
- Изменённые writers/readers и совместимость:
- Заменённые/удалённые реализации и доказательство перевода всех потребителей; сохранённые совместимые пути:
- Regression до исправления: команда или ручные шаги, исходный результат:
- Итоговый commit/PR:
- Автоматические проверки: test ID, команда, окружение, expected/actual, PASS/FAIL, evidence:
- Device cards: DEV-ID, build/API/schema, устройство/OS, исполнитель, expected/actual, статус, evidence:
- Миграция существующих данных / recovery / проверка старого клиента:
- Остаточные риски, NOT_RUN/BLOCKED/DEFERRED и кто/что требуется:
- Решение независимой проверки diff:
- Какие IDs действительно VERIFIED и почему:
- Следующий пакет и его оставшиеся зависимости:

## Финальная приёмка

Проверить итоговую матрицу прав, операции с отказом/повтором/конкуренцией, смену аккаунта, два устройства, даты/DST, native permissions, доставку и обновление старой установки. Подтверждение только happy path не достаточно. Сводка выпуска перечисляет оставшиеся ограничения и не заменяет отдельную авторизацию production действий.

## Учёт кандидатов на очистку

Первичная инвентаризация R0 завершена: [охват, Knip и ручные решения](notes-r0-cleanup-inventory.md). Полная финальная проверка зависимостей/дублей остаётся R9. Реестр кандидатов не добавляет подтверждённых находок к исходным 102.

Для каждого кандидата записать: файл/символ/пакет; тип (мёртвый код, export, dependency, дублирование); инструмент/способ поиска и охват; проверенные entry points, config/native/dynamic usage; связь с существующим finding; целевой пакет; решение и причина; commit и выполненные проверки. Начальный статус CANDIDATE. Итог — REMOVED с evidence, RETAINED с причиной либо NEEDS_CHECK. Для дублирования указать общее правило и различия поведения до решения об объединении. Для зависимости — runtime/build/test/native роль и результаты применимых сборок после удаления.

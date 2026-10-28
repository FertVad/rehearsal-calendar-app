# Аудит Rehearsly

Дата завершения: 16 сентября 2026. Репозиторий: `/Users/vadimfertik/Desktop/reh_app`. Финальная база: HEAD `0f655e2`; аудит начат на `8de99ab`. Изменения, появившиеся во время аудита, проверены отдельно. Исходники, настройки, данные и история Git аудитом не изменялись.

**Метод:** статическое чтение и поиск, анализ схем, контрактов и lock metadata. Приложение, тесты, сборки, скрипты, миграции и API не запускались; пакеты не устанавливались. «Подтверждено» означает подтверждённую цепочку в исходниках, а не воспроизведённый инцидент в production. Условия гонок, отказов и особого развёртывания указаны в карточках. Это завершённый аудит в согласованных границах; непроверенные области перечислены в разделе 6.

## 1. Резюме и пять главных рисков

Rehearsly связывает проекты, состав участников, доступность, репетиции и календарь устройства. Базовые проверки членства, параметризованные SQL-запросы и отзыв сессий через token_version присутствуют. Основные дефекты возникают там, где один сценарий проходит через несколько моделей: credentials и OAuth, приглашение и RSVP, репетиция и занятость, аккаунт и асинхронная синхронизация, push-токен и его владелец. Отдельно административный HTML допускает выполнение сохранённого пользовательского содержимого.

Пять наиболее существенных рисков:

1. **Компрометация административной сессии через сохранённую XSS — H01.** Обычный пользователь может передать HTML в обращении/профиле; при просмотре администратором он достигает исполняемого контекста. Последствие — доступ в пределах административного API к пользователям и обращениям.
2. **Предварительный захват password/OAuth-аккаунта — A01.** Регистрация чужого email до его владельца позволяет сохранить пароль и ранее выданные сессии после последующего OAuth-входа владельца адреса.
3. **Нарушение границ приглашения на репетицию — D01, D02.** Администратор проекта может записать занятость постороннему пользователю; неприглашённый участник проекта может сам создать запись RSVP, которая затем предоставляет доступ.
4. **Потеря или перенос календарных данных — C01, CC05, EI01, ES01.** Замена дня неверно обрабатывает all-day в UTC−, сохранение отправляет устаревшие нетронутые дни, импорт одного устройства удаляет импорт другого, а незавершённая синхронизация аккаунта A способна продолжить запись с токеном B.
5. **Один push-токен может остаться у двух аккаунтов — G01.** Конкурентная регистрация допускается схемой и обработчиком; уведомления могут поступать по общему адресу доставки от обоих пользователей.

Дополнительно высокую важность имеют неограниченный диапазон дат до проверки членства (B03), необработанные ошибки Express 4 (A02), неатомарная запись репетиций (D03) и сломанный путь создания новой БД (F01/F02). Последние два пункта относятся к provisioning: состояние существующей production-схемы не проверялось.

На финальном HEAD GitHub `schedule` закомментирован, оставлен ручной запуск. Отключение внешнего cron описано в документации, но независимо не проверено. Поэтому ошибки GR01–GR05 относятся к вызову обработчика вручную/напрямую или после возобновления расписания. Само намеренное отключение не записано как новый дефект. Добавленные почтовые helpers ещё не подключены к auth endpoints и не устраняют A01.

Итог: 102 отдельных пункта — Critical0, High15, Medium69, Low18; 97 подтверждены по коду, 5условных. Финальная редакция — AUDIT_REPORT.md.

## 2. Реестр находок

Critical — подтверждённый риск чрезвычайного масштаба; High — существенный доступ к чужим данным, потеря данных или отказ основной функции; Medium — нарушение конкретного сценария/целостности, часто при сбое или конкуренции; Low — ограниченный контрактный, эксплуатационный или интерфейсный дефект. Оценки относятся к описанному сценарию, а не к абстрактному CVSS зависимости.

Условные пункты включены в общую таблицу с отдельной отметкой и не выдаются за установленную конфигурацию production. Дубли не учитываются. Трудоёмкость в карточках — ориентир для одного разработчика, включая адресные проверки после исправления; это не выполненная работа и не аддитивная смета.


## 4. Расхождения кода и заявленного поведения

| Заявление / ожидание | Фактическая реализация | Связь |
|---|---|---|
| Email-регистрация идентифицирует владельца адреса; helpers подразумевают подготовку подтверждения | Сессия выдаётся до подтверждения; OAuth автоматически привязывается по email; mail helpers пока не вызываются endpoints | A01, A04 |
| Настройка сроков JWT через env | Выдача использует фиксированные 30/90 дней | ID01 |
| Сохранение доступности меняет выбранные правки | Клиент отправляет все будущие дни snapshot, сервер заменяет manual записи затронутого дня | C01–C04, CC02–CC05 |
| Сериализатор поддерживает интервалы через полночь | Availability validator отклоняет их заранее; форма репетиции может отправить конец на дне начала | CC06, DF04 |
| Администратор может редактировать все репетиции своего проекта | Форма загружает personal batch, содержащий только приглашения этого администратора | D04 |
| Состав, выбранный в планировщике, сохраняется при создании | Форма заново выбирает всех участников | DP02 |
| Успешный sync означает актуальные события | Ошибки чтения/обновления/частичный failure могут скрываться за success timestamp | EI02, EX03–EX04, EO06 |
| «Позже» откладывает уведомления; выключатель показывает результат регистрации | Главный экран снова запрашивает permission; UI включает настройку при null/failure | GC01–GC03 |
| Прочитанные/удалённые уведомления отражают сервер | Catch и поздние responses допускают ложный read state и возврат удалённых карточек | NI02–NI05 |
| Retry напоминаний освобождает неудачную отправку | Сервис возвращает failed, wrapper теряет результат; scheduler сохраняет claim | GR01–GR03 |
| Release notes заявляют экранирование XSS | Public script context защищён, но admin innerHTML остаётся уязвимым | H01 |
| Изменение email, очистка фамилии и Cancel picker выполняют видимое действие | Email сервером игнорируется, пустая фамилия опускается, iOS picker пишет изменения до Cancel | HP01–HP02, HC02 |
| API examples описывают актуальный контракт | Расходятся bulk replacement, RSVP null/no, auth user wrapper, timezone участников, enum free/available, длина кода и удаление owner-проектов | IDOC01 |
| Fresh bootstrap + baseline эквивалентны последовательным миграциям | Смешаны SQL-диалекты и отсутствует обязательный unique index | F01–F02 |
| Dry run ничего не изменяет | Может создать ledger/SQLite-файл; вместе с baseline записывает историю | FT01 |

Тестовые названия и комментарии также не всегда отражают проверяемый код. Часть integration-тестов выполняет собственный SQL вместо production routes/services; некоторые клиентские тесты заранее возвращают mock 400/409 для правил, которых сервер не реализует. Тестовый adapter возвращает `changes` и трансформирует SQL, production adapter ведёт себя иначе. Mock transaction в отдельных тестах не выполняет rollback. Тест reminder failure использует rejected Promise, тогда как настоящий helper обычно возвращает failed. Эти ограничения уменьшают доказательную силу тестов для F03/F05/D03/GR01; факт прохождения тестов в этом аудите не заявляется.

Исторические записи о «650 тестах/47 suites» и доступности внешних сервисов рассматриваются как сведения документации. Ни их актуальность, ни биллинг, ни текущий deployment запуском не проверялись. Удаление всех проектов, которыми владеет удаляемый аккаунт, явно предупреждается действующим Profile UI; это не скрытое разрушительное действие, хотя public/API-тексты местами устарели.

## 5. Стыки модулей

| Цепочка | Подтверждённый результат | Направление исправления |
|---|---|---|
| Auth → providers → DB | Новые password credentials не создают provider row; разовый backfill не поддерживает инвариант | Единая модель credentials и транзакционный unlink (A04) |
| Auth → API → caches → navigation | Очистка storage не инвалидирует старые ответы и память providers | Поколение сессии, отмена/игнорирование ответов, user-scoped state (AC02/03, BC01, ES01, NI03, HN03) |
| Member removal → rehearsal responses → push/inbox | Ошибка второго DELETE оставляет бывшему участнику новые уведомления; GET by ID всё ещё защищён членством | Одна транзакция cleanup; проверка актуального roster перед доставкой (B01) |
| Project/RSVP authorization → roster → busy slots | Пользовательские IDs проходят в занятость без полного membership guard; RSVP создаёт само основание доступа | Единые политики canView/canRespond и валидация roster (D01/D02) |
| Rehearsal → roster → availability → reminders | Частично сохранённый lifecycle расходится с расписанием и claims | Aggregate transaction, version и outbox после commit (D03, GR05) |
| Availability editor → bulk DELETE → timezone | Floating all-day дата интерпретируется как instant; полный draft используется как replacement | Day key, dirty dates и revision (C01/C03/C04, CC05) |
| Profile timezone → picker → ISO serialization | Разные зоны чтения/записи сдвигают время; ручная зона позднее сбрасывается Auth | Явный режим automatic/manual и единый timezone draft (DF01, HP04) |
| Planner → AddRehearsal | Старый roster и потеря выбранного subset меняют приглашённых | Query keys и передача состава в draft (DP01/DP02, DF05) |
| Native import → server diff | Общий user/source scope удаляет записи другого устройства | Connection/device ownership и атомарный diff (EI01/EI04) |
| Server mappings → local export | Маппинги схлопываются по rehearsalId, выбирается старейшая запись; экспорт доверяет device-local ID | Полная идентичность account/connection/event и проверка происхождения (ES02, EX01–EX04) |
| Sync hooks → settings storage → success UI | Очереди обходятся писателями settings, старый snapshot восстанавливает настройку, failure получает timestamp | Один coordinator, revision и типизированный результат (EO03/EO04/EO06) |
| Push registration → schema → recipients | Уникальна пара user/token, а не token; конкурентная регистрация оставляет двух владельцев | Global unique token + atomic transfer ownership (G01) |
| Push helper → scheduler → workflow | Failed return теряется, stale claims не освобождаются; HTTP200 выглядит успехом | Явный delivery result, lease/revision и проверка результата (G02, GR01–GR05) |
| Bug reports/profile → admin HTML/CSP | Параметризованный SQL сохраняет строку безопасно для SQL, затем она становится исполняемым HTML | textContent/escaping и строгий CSP (H01) |
| Schema → baseline → runtime adapter → tests | Bootstrap, миграции и test fixture дают разные гарантии | Canonical schema, проверки postconditions и adapter contracts (F01–F05, FT01/FT02) |

Полный журнал с решениями и исключёнными гипотезами: [cross-links.md](/Users/vadimfertik/Desktop/reh_app/audit/cross-links.md). Отдельные проявления одной причины объединены: DP03 и date-only часть BC04 → CC01; ES03 → EO04; FC01 → G01. Опровергнутое отсутствие legacy date/time в project API, неактивный Telegram flow AC06 и недоказанная текущая достижимость SQLite overlap F04 не входят в подтверждённый счёт.

## 6. Покрытие и ограничения

Полностью прочитан файл означает чтение его содержимого, а не наличие имени в поиске. Полный аудит согласованной очереди A–I не означает полного покрытия внешних зависимостей, платформы и каждого теста. [Карта](/Users/vadimfertik/Desktop/reh_app/audit/map.md), [инвентаризация](/Users/vadimfertik/Desktop/reh_app/audit/inventory.md) и индивидуальные notes содержат подробные перечни.

| Область | Охват |
|---|---|
| Auth, credentials, JWT/admin middleware, OAuth, client auth/API | Полное чтение перечисленных production файлов A; новая mail delta и env linkage проверены в I |
| Server routes/services проектов, участников, availability, репетиций, RSVP | Полное чтение production реализаций B–D; сопоставлены guards и SQL consumers |
| Availability UI/hooks/utils/constants; project UI; rehearsal forms/calendar/planner | Полное чтение функциональных реализаций по notes B–D; выделенные styles исключены |
| Calendar import/export/management/permissions, mappings/storage, sync hooks/settings | Полное чтение реализаций E; SDK providers и реальные календари не проверялись |
| DB adapter, bootstrap, migration runner и seed | Полное статическое чтение; все 23 SQL миграции (887 строк) прочитаны, ни одна не применялась |
| Push registration/delivery, inbox, scheduler/cron и notification texts | Полное чтение production реализаций G; delivery receipts, APNs/FCM и реальные jobs не проверялись |
| Navigation, providers, onboarding/profile, common components/utilities | Полное чтение перечисленных H реализаций; дополнительные constants проверены в финальном доборе |
| Public/admin HTML/JS, bug reports и server security headers | Полное чтение функциональной логики H/I; визуальная вёрстка, изображения, CSS-дизайн не оценивались |
| i18n | Основные locale helpers и notification/public тексты прочитаны; 8 feature translation modules проверены структурно/по relevant keys, полного лингвистического аудита всех строк нет |
| Тесты | Чтение конкретных файлов по notes, без запуска. Охват частичный: например availability component tests и displayedMode не прочитаны; нельзя считать весь test tree проверенным |
| Configs, manifests, CI, env examples, документация | Полное чтение перечисленных I текстовых конфигов и docs, включая API-документ 1780 строк и новый services.md 240 строк; локальные секретные значения маскировались |
| Два lock-файла | Полный разбор metadata: 1622 и 544 package records, включая root; все прямые production versions извлечены. Выборочная проверка advisories и применимости, без установки и исполнения |
| Native iOS/Android | Только текстовые настройки/метаданные; локальные generated native деревья ignored в Git, их расхождения не объявлены фактом EAS production release |
| Сквозной поиск | По first-party тексту, включая hidden и отдельный no-ignore проход: секреты, опасные calls, логирование, SQL interpolation. Это поиск, не полное чтение каждого локального файла |

**Явно не проверялись:** node_modules, vendor/Pods, dist/build, .expo, сгенерированные и минифицированные бандлы, snapshots, бинарные SQLite/DB, ассеты, изображения и screenshots; содержимое Git objects и всей исторической версии каждого файла; platform binaries; remote deployment secrets; фактические production schema/data/migration ledger; App Store/Play signing credentials и установленные приложения. Миграции не исключались по возрасту, поскольку их было достаточно мало для полного чтения.

Не подтверждены опубликованный действующий секрет, production SQL injection, command injection, path traversal, небезопасный request upload или отдельный CSRF в bearer-only проверенных paths. Это ограниченное статическое заключение, а не гарантия отсутствия всех таких дефектов. Живые секреты не копировались в заметки/отчёт. Известный development fallback не объявлен production bypass без доказательства соответствующего развёртывания.

### Зависимости

Зафиксированы, среди прочего: Express 4.21.2, jsonwebtoken 9.0.2, apple-signin-auth 1.7.9, better-sqlite3 12.4.1, pg 8.16.3; клиент Axios 1.13.2, Expo 54.0.37, RN 0.81.5, React 19.1.0. Это версии lock, а не проверенный установленный/deployed набор.

Подтверждённых новых runtime CVE findings после проверки условий эксплуатации не начислено. При этом обновления нужны: старые qs, install-chain tar, minimatch и lodash совпадают с affected ranges выбранных advisories; для qs важно наличие специальных parser options/лимитов, для tar — контролируемый install archive, для minimatch — входной glob pattern, для lodash — конкретные template/path APIs. Эти пути эксплуатации в приложении не доказаны. Native Axios caller также нельзя автоматически приравнять к уязвимому Node HTTP/proxy adapter.

Например, locked jws 3.2.2 попадает в affected range, но advisory прямо исключает вызываемый через jsonwebtoken `jws.verify()`: уязвимый путь требует другого API и условий выбора ключа. [Advisory jws](https://github.com/auth0/node-jws/security/advisories/GHSA-869p-cjfg-cm3x). Для qs default parameterLimit ограничивает рассматриваемую нагрузку; общий High DoS только по номеру версии не заявлен. [Advisory qs](https://github.com/advisories/GHSA-6rw7-vpxm-498p).

Все прямые версии, выбранные транзитивные цепочки, первичные advisory links, patches и условия: [notes-dependencies.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-dependencies.md). Источники проверены 11–15 сентября 2026; полный CVE-каталог для всех 2164 нерутовых records не исследован. Планировать обновления через совместимые parent dependencies, затем разрешённые regression checks, без слепых major overrides.

### Изменения во время аудита

Исходная база 8de99ab → 25475e8: семь файлов — CLAUDE, integration setup, два auth/account-deletion теста, mailTokens/mailer и новый mailTokens test. Проверены полные новые utilities и соответствующие diff; изменения test fixture не исправляют production constraints. 25475e8 → 0f655e2: workflow reminders, docs README и новый services.md. Проверенные A–H production реализации не изменились. Финальные ссылки относятся к этому состоянию; прежние номера строк документации в рабочих notes могут относиться к исходной базе.

## 7. Что требует запуска или ручной проверки

Ниже — план проверки, ничего из него в рамках аудита не выполнялось. Использовать изолированные аккаунты, календари и временную БД, чтобы результат можно было восстановить.

| Проверка | Ожидаемый критерий |
|---|---|
| Auth: регистрация чужого email → verified OAuth, повторный вход старым паролем/refresh | Владение email подтверждается, конфликт credentials разрешается явно, старые сессии отозваны |
| OAuth: корректный и чужой audience; пустой APPLE_CLIENT_ID | Токен другого приложения отклоняется; отсутствие обязательной настройки вызывает fail-fast |
| XSS: безопасный контрольный HTML marker в bug report/profile при просмотре админом | Строка показана как текст, обработчик не выполняется; admin actions сохраняют работоспособность при CSP |
| Авторизация: чужой participant ID, member без приглашения, удалённый member | Нет записи чужой занятости/новых уведомлений и самовыдачи доступа |
| Отказ БД/неверный JSON в async middleware; большой date range | Контролируемый 4xx/5xx, запрос заканчивается, процесс остаётся работоспособным, диапазон ограничен до цикла |
| PostgreSQL failure injection между lifecycle SQL и два конкурентных day saves | Полный rollback либо один согласованный revision; никакой смеси free/busy и orphan roster |
| Fresh DB → bootstrap → baseline, миграция с ошибкой до ledger, dry modes | Canonical schema совпадает; bulk работает; история и DDL атомарны; dry не пишет |
| UTC−/UTC+, DST, all-day соседние дни, overnight, разные profile/device timezone | Load→save без изменений сохраняет те же дни/instants, удаление не трогает соседний день |
| Dirty draft: focus/pull, save во время новых edits, mixed past/future delete, два устройства | Несохранённые изменения не теряются; stale revision не заменяет другой день |
| Planner/project filters при перестановке ответов; admin-not-invited edit | Только актуальный project/roster, корректный состав и доступ к edit |
| Calendar: два устройства/источника, одноимённое личное событие, recurring move, частичный native failure | Чужой импорт/личное событие сохранены; mapping остаётся для retry; failure не получает success |
| Logout A → login B при задержанном native sync/API/profile response | Данные/мутаторы A не применяются к B; providers и badges сбрасываются |
| Push: два account registrations одного token, denied permission, offline launch, tickets/receipts | Один владелец token, честный статус регистрации, retry по политике, различаются accepted/receipt |
| Reminders: failed return, crash после claim, перенос после scheduler snapshot, HTTP200 при DB failure | Lease освобождается/повторяется, revision исключает stale reminder, job показывает ошибку |
| Inbox: >50 событий, offline mark-read/delete, ответы в обратном порядке | Старые unread доступны, ошибка видна, старый ответ не откатывает успешную мутацию |
| Навигация из invite в onboarding, iOS Cancel, язык/timezone при входе | Invite не теряется, Cancel отменяет draft, настройки отражают выбранный аккаунт |
| Реальный deployment: proxy chain, общий limiter store, Android domain association | Ограничения действуют между instances; корректны trust proxy и подписанная Android association |
| Обновлённые зависимости и сборки на целевых платформах | Сохраняются auth, календарь, notification registration и native install compatibility |

Дополнительные гипотезы без самостоятельного confirmed ID: SQLite transaction с внешним ожиданием внутри callback (F04); несогласованность tentative в planner/form; устаревший clock при смене суток/часового пояса устройства; device-specific back stack; нативная locale fallback для es/de. Достижимость и влияние требуют адресной проверки. Неактивные Telegram helpers и будущий reset flow оценивать заново при подключении. Наличие поля isAllDay в типах/схеме не доказывает существование пользовательского all-day переключателя репетиции.

## 8. Приоритетный план исправлений

| Очередь | Работа и причина | Ориентир |
|---|---|---|
| 1 | H01: прекратить передачу пользовательских строк в исполняемый admin HTML; A01: закрыть unverified auto-link и согласовать отзыв credentials/sessions. Это прямые пути компрометации | 1–2 дня на локальную защиту и проверку H01; auth flow 3–5 дней |
| 2 | D01/D02: единые roster/access guards; G01: уникальный владелец token и атомарная передача; A02/B03: контролируемые errors и budget диапазона. Небольшие изменения закрывают высокий ущерб | Около 2–4 дней общим пакетом, с concurrency/authorization проверками |
| 3 | ES01/EI01/C01/CC05: привязать sync к сессии/connection, исправить floating day, отправлять dirty dates с revision. Снижает потерю и перенос личных данных | 4–7 дней с проверкой двух устройств, timezone и native failures |
| 4 | B01/B02/D03/C03: транзакционные lifecycle и idempotency; F01/F02/FT02: единый provisioning/ledger. Сначала составить план миграции для существующих данных | 3–6 дней; provisioning проверять на временной БД |
| 5 | A04/AC01–AC05/BC01/NI03/HN03: единый session lifecycle и credential registry, scoped caches и защищённое хранение. Общая основа устраняет несколько проявлений сразу | 3–5 дней, пересекается с очередями 1–3 |
| 6 | EX/EO/EI recovery и mappings: не удалять ownership при ошибке, правдиво показывать частичный результат, единственная очередь settings/sync | 3–5 дней, native regression существенен |
| 7 | GR01–GR05/G02: result contract, receipts, leases и revision. Проверить до любого возобновления автоматического расписания | 2–4 дня; решение о scheduler остаётся отдельным эксплуатационным выбором |
| 8 | D/H/NI UI-контракты, profile/onboarding, date labels и picker; ID01/IDOC01/IS01/IC01; shared limiter при multi-instance deployment | Выполнять небольшими PR по карточкам, обычно 1–6 часов на локальный fix |
| Параллельно | Плановые dependency parent updates, настоящие adapter/HTTP integration checks вместо повторения SQL в тестах, фиксация актуальных контрактов | Ориентир 1–3 дня на согласованный dependency batch, далее по результатам |

Оценки пересекаются: один session coordinator или lifecycle transaction закрывает несколько ID. Их нельзя складывать как независимые задачи. Минимальные правки целесообразно выпускать отдельными проверяемыми изменениями; более широкие решения вводить вокруг существующих services и контрактов, без переписывания приложения с нуля.

Критерий завершения исправлений: воспроизведённый исходный сценарий больше не нарушает права/данные, проверен отказ и конкурентный путь, тест использует production handler/adapter там, где это существенно, документация описывает действительный контракт. Сам этот аудит никаких исправлений не применял.

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

Дополнительно высокую важность имеют неограниченный диапазон дат до проверки членства (B03), необработанные ошибки Express 4 (A02), неатомарная запись репетиций (D03) и сломанный путь создания новой БД (F01/F02). F01/F02 относятся к provisioning: состояние существующей production-схемы не проверялось.

На финальном HEAD GitHub `schedule` закомментирован, оставлен ручной запуск. Отключение внешнего cron описано в документации, но независимо не проверено. Поэтому ошибки GR01–GR05 относятся к вызову обработчика вручную/напрямую или после возобновления расписания. Само намеренное отключение не записано как новый дефект. Добавленные почтовые helpers ещё не подключены к auth endpoints и не устраняют A01.

**Всего 102 отдельных пунктов:** Critical — 0, High — 15, Medium — 69, Low — 18. Из них 97 подтверждены для описанных путей кода и 5 явно условных: DF01, FM01, FM02, IS02, IA01. Условные пункты включены в число соответствующей критичности, но не в число установленных production-инцидентов.

## 2. Реестр находок

Critical — подтверждённый риск чрезвычайного масштаба; High — существенный доступ к чужим данным, потеря данных или отказ основной функции; Medium — нарушение конкретного сценария/целостности, часто при сбое или конкуренции; Low — ограниченный контрактный, эксплуатационный или интерфейсный дефект. Оценки относятся к описанному сценарию, а не к абстрактному CVSS зависимости.

Условные пункты включены в общую таблицу с отдельной отметкой и не выдаются за установленную конфигурацию production. Дубли не учитываются. Трудоёмкость в карточках — ориентир для одного разработчика, включая адресные проверки после исправления; это не выполненная работа и не аддитивная смета.


| ID | Категория | Критичность | Статус | Файл:строка | Суть |
|---|---|---|---|---|---|
| [A01](#a01) | Аутентификация / безопасность | High | По коду | [rehearsal-calendar-native/server/routes/auth.js:20](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:20) | предварительный захват аккаунта через email/OAuth |
| [A02](#a02) | Аутентификация / безопасность | High | По коду | [rehearsal-calendar-native/server/middleware/jwtMiddleware.js:58](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/middleware/jwtMiddleware.js:58) | необработанные async-исключения в auth middleware/admin login |
| [A03](#a03) | Аутентификация / безопасность | Medium | По коду | [rehearsal-calendar-native/server/routes/auth.js:20](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:20) | backend не применяет правила пароля и профильные типы |
| [A04](#a04) | Аутентификация / безопасность | Medium | По коду | [rehearsal-calendar-native/server/routes/auth.js:34](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:34) | способы входа расходятся с реальными credentials |
| [AC01](#ac01) | Сессия / клиент | Medium | По коду | [rehearsal-calendar-native/src/shared/services/api.ts:136](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:136) | Кратковременный сбой refresh уничтожает сессию |
| [AC02](#ac02) | Сессия / клиент | Medium | По коду | [rehearsal-calendar-native/src/shared/services/api.ts:136](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:136) | Окончательная потеря авторизации не переводит открытое приложение на вход |
| [AC03](#ac03) | Сессия / клиент | Medium | По коду | [rehearsal-calendar-native/src/contexts/AuthContext.tsx:180](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:180) | Поздний ответ профиля восстанавливает user после выхода или подменяет user нового входа |
| [AC04](#ac04) | Сессия / клиент | Medium | По коду | [rehearsal-calendar-native/src/contexts/AuthContext.tsx:302](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:302) | OAuth токен и возможный Authorization передаются в незащищённый log sink |
| [AC05](#ac05) | Сессия / клиент | Medium | По коду | [rehearsal-calendar-native/src/contexts/AuthContext.tsx:202](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:202) | Долгоживущие bearer credentials сохраняются в обычном AsyncStorage |
| [B01](#b01) | Проекты / права | Medium | По коду | [rehearsal-calendar-native/server/routes/native/members.js:468](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/members.js:468) | удаление участника неатомарно, сбой оставляет связанные записи |
| [B02](#b02) | Проекты / права | Medium | По коду | [rehearsal-calendar-native/server/routes/native/projects.js:70](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/projects.js:70) | создание/удаление проекта частично фиксируются при ошибке |
| [B03](#b03) | Проекты / права | High | По коду | [rehearsal-calendar-native/server/routes/native/members.js:26](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/members.js:26) | неограниченный диапазон дат блокирует event loop до проверки членства |
| [B04](#b04) | Проекты / права | Medium | По коду | [rehearsal-calendar-native/server/routes/native.js:29](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native.js:29) | альтернативный join URL обходит rate limit приглашений |
| [BC01](#bc01) | Проекты / клиент | Medium | По коду | [rehearsal-calendar-native/src/contexts/ProjectContext.tsx:26](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/ProjectContext.tsx:26) | проекты и выбранный проект переживают смену аккаунта |
| [BC02](#bc02) | Проекты / клиент | Medium | По коду | [rehearsal-calendar-native/src/contexts/ProjectContext.tsx:34](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/ProjectContext.tsx:34) | после удаления или изменения прав выбранный проект остаётся старым объектом |
| [BC03](#bc03) | Проекты / клиент | Low | По коду | [rehearsal-calendar-native/src/features/projects/screens/ProjectDetailScreen.tsx:465](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/projects/screens/ProjectDetailScreen.tsx:465) | прошедшие репетиции теряют название |
| [C01](#c01) | Доступность / данные | High | По коду | [rehearsal-calendar-native/server/routes/native/availability.js:113](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:113) | all-day записи удаляются/заменяются по неверному дню в UTC− |
| [C02](#c02) | Доступность / данные | Medium | По коду | [rehearsal-calendar-native/server/routes/native/availability.js:98](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:98) | неполная запись стирает день с ответом success |
| [C03](#c03) | Доступность / данные | Medium | По коду | [rehearsal-calendar-native/server/routes/native/availability.js:110](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:110) | параллельные manual saves могут склеить взаимоисключающие состояния |
| [C04](#c04) | Доступность / данные | Medium | По коду | [rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts:153](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts:153) | дедупликация по часам теряет источник и может скрыть занятость |
| [CC01](#cc01) | Доступность / клиент | Medium | По коду | [rehearsal-calendar-native/src/features/availability/screens/AvailabilityScreen.tsx:83](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/screens/AvailabilityScreen.tsx:83) | UTC «сегодня» запрещает редактировать текущий местный день |
| [CC02](#cc02) | Доступность / клиент | Medium | По коду | [rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts:246](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts:246) | Автозагрузка безусловно стирает несохранённые правки |
| [CC03](#cc03) | Доступность / клиент | Medium | По коду | [rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:197](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:197) | Изменения во время Save помечаются сохранёнными, хотя не попали в запрос |
| [CC04](#cc04) | Доступность / клиент | Medium | По коду | [rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityEditor.ts:220](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityEditor.ts:220) | «Удалить прошлые даты» может удалить выбранные будущие дни |
| [CC05](#cc05) | Доступность / клиент | High | По коду | [rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:47](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:47) | Save отправляет весь старый snapshot и перезаписывает нетронутые дни |
| [CC06](#cc06) | Доступность / клиент | Medium | По коду | [rehearsal-calendar-native/src/features/availability/utils/validationUtils.ts:17](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/utils/validationUtils.ts:17) | Ветка сохранения через полночь недостижима из Save |
| [D01](#d01) | Репетиции / права и данные | High | По коду | [rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:404](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:404) | администратор проекта пишет занятость произвольным пользователям |
| [D02](#d02) | Репетиции / права и данные | High | По коду | [rehearsal-calendar-native/server/routes/native/rehearsals.js:260](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/rehearsals.js:260) | не приглашённый участник сам получает доступ через RSVP |
| [D03](#d03) | Репетиции / права и данные | High | По коду | [rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:384](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:384) | жизненный цикл репетиции фиксируется частями |
| [D04](#d04) | Репетиции / права и данные | Medium | По коду | [rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:142](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:142) | администратор не может открыть редактирование репетиции, в которую не приглашён |
| [DF01](#df01) | Формы / даты и гонки | Medium | Условный | [rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:153](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:153) | редактирование сдвигает время при разных timezone профиля и устройства |
| [DF02](#df02) | Формы / даты и гонки | Medium | По коду | [rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalSubmit.ts:70](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalSubmit.ts:70) | невозможно удалить всех участников при редактировании |
| [DF03](#df03) | Формы / даты и гонки | Medium | По коду | [rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:137](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:137) | после ошибки загрузки edit доступны сохранение и перезапись неполных данных |
| [DF04](#df04) | Формы / даты и гонки | Medium | По коду | [rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:67](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:67) | ночная репетиция проходит проверку, но конец сериализуется на день начала |
| [DF05](#df05) | Формы / даты и гонки | Medium | По коду | [rehearsal-calendar-native/src/features/calendar/hooks/useRehearsalAvailability.ts:53](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useRehearsalAvailability.ts:53) | поздние ответы и незавершённая загрузка дают неверный состав/проверку конфликтов |
| [DF06](#df06) | Формы / даты и гонки | Medium | По коду | [rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx:112](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx:112) | поздний ответ старого фильтра заменяет репетиции выбранного проекта |
| [DD01](#dd01) | Календарь / отображение | Medium | По коду | [rehearsal-calendar-native/src/features/calendar/screens/RehearsalDetailsScreen.tsx:104](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/RehearsalDetailsScreen.tsx:104) | Details ведёт вторую копию RSVP и расходится с SeenContext |
| [DD02](#dd02) | Календарь / отображение | Medium | По коду | [rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx:183](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx:183) | Репетиция через полночь отсутствует в календаре второго дня |
| [DD03](#dd03) | Календарь / отображение | Low | По коду | [rehearsal-calendar-native/src/features/calendar/components/WeeklyCalendar.tsx:133](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/components/WeeklyCalendar.tsx:133) | Кнопка «Сегодня» не выбирает сегодняшний день |
| [DP01](#dp01) | Планировщик | Medium | По коду | [rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:144](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:144) | смена проекта закрепляет старые ID участников за новым проектом |
| [DP02](#dp02) | Планировщик | Medium | По коду | [rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:394](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:394) | выбранный в planner состав не переносится в создание репетиции |
| [DP04](#dp04) | Планировщик | Low | По коду | [rehearsal-calendar-native/src/features/smart-planner/hooks/useSmartPlanner.ts:153](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/hooks/useSmartPlanner.ts:153) | предложение на сегодня не устаревает вместе с часами |
| [EI01](#ei01) | Импорт календаря | High | По коду | [rehearsal-calendar-native/src/shared/services/calendar/import.ts:233](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:233) | diff удаляет импорт другого устройства/источника пользователя |
| [EI02](#ei02) | Импорт календаря | Medium | По коду | [rehearsal-calendar-native/src/shared/services/calendar/import.ts:74](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:74) | неудачное чтение календаря считается успешной синхронизацией |
| [EI03](#ei03) | Импорт календаря | Medium | По коду | [rehearsal-calendar-native/src/shared/services/calendar/import.ts:498](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:498) | удаление всех импортов не работает без локального tracking |
| [EI04](#ei04) | Импорт календаря | Medium | По коду | [rehearsal-calendar-native/src/shared/services/calendar/import.ts:142](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:142) | перенос recurring события может сначала стереть старую занятость, а новое время не записать |
| [EX01](#ex01) | Экспорт календаря | Medium | По коду | [rehearsal-calendar-native/src/shared/services/calendar/export.ts:141](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:141) | Экспорт присваивает личное событие по совпадению текста и затем может удалить его |
| [EX02](#ex02) | Экспорт календаря | Medium | По коду | [rehearsal-calendar-native/src/shared/services/calendar/export.ts:536](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:536) | После неудачного удаления mapping всё равно уничтожается, событие становится бесхозным |
| [EX03](#ex03) | Экспорт календаря | Medium | По коду | [rehearsal-calendar-native/src/shared/services/calendar/export.ts:389](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:389) | Ошибка update превращается в «успешный» экспорт старого события |
| [EX04](#ex04) | Экспорт календаря | Medium | По коду | [rehearsal-calendar-native/src/shared/services/calendar/export.ts:60](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:60) | Неуспешный read/search трактуется как отсутствие и запускает создание дублей |
| [ES01](#es01) | Синхронизация / изоляция | High | По коду | [rehearsal-calendar-native/src/shared/services/api.ts:85](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:85) | незавершённый sync прошлого пользователя продолжает запись под новым аккаунтом |
| [ES02](#es02) | Синхронизация / изоляция | Medium | По коду | [rehearsal-calendar-native/src/shared/utils/calendarMappings.ts:173](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/calendarMappings.ts:173) | mappings разных календарей/устройств схлопываются, причём старейший перезаписывает новый |
| [EO01](#eo01) | Синхронизация / управление | Medium | По коду | [rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:65](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:65) | после ухода из последнего проекта экспортированные события не удаляются |
| [EO02](#eo02) | Синхронизация / управление | Medium | По коду | [rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:258](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:258) | ошибка импорта отменяет независимый автоэкспорт |
| [EO03](#eo03) | Синхронизация / управление | Medium | По коду | [rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:200](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:200) | очередь ручных запусков не гарантирует один sync одновременно |
| [EO04](#eo04) | Синхронизация / управление | Medium | По коду | [rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:351](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:351) | ручная синхронизация может восстановить уже выключенную настройку |
| [EO05](#eo05) | Синхронизация / управление | Low | По коду | [rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:368](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:368) | ручная синхронизация заменяет названия репетиций общим названием проекта |
| [EO06](#eo06) | Синхронизация / управление | Medium | По коду | [rehearsal-calendar-native/src/features/calendar/hooks/useCalendarSync.ts:238](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useCalendarSync.ts:238) | неудачная синхронизация получает новую отметку успешного экспорта |
| [F01](#f01) | БД / схема и adapter | High | По коду | [rehearsal-calendar-native/server/database/init-native-schema.sql:39](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/init-native-schema.sql:39) | инструкция развёртывания новой БД использует несовместимую смесь SQL-диалектов |
| [F02](#f02) | БД / схема и adapter | High | По коду | [rehearsal-calendar-native/server/routes/native/availability.js:141](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:141) | baseline пропускает обязательный unique index доступности |
| [F03](#f03) | БД / схема и adapter | Medium | По коду | [rehearsal-calendar-native/server/database/db.js:114](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/db.js:114) | заявленный SQLite режим не запускается штатной командой и не поддерживает SQL приложения |
| [F05](#f05) | БД / схема и adapter | Low | По коду | [rehearsal-calendar-native/server/database/db.js:50](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/db.js:50) | adapter теряет число изменённых строк |
| [FT01](#ft01) | БД / tooling | Low | По коду | [rehearsal-calendar-native/server/scripts/migrate.js:115](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/scripts/migrate.js:115) | режим --dry делает записи в БД; с --baseline вообще меняет историю миграций |
| [FT02](#ft02) | БД / tooling | Medium | По коду | [rehearsal-calendar-native/server/scripts/migrate.js:155](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/scripts/migrate.js:155) | SQL миграции и её запись в журнал не атомарны |
| [FM01](#fm01) | БД / legacy migrations | Medium | Условный | [rehearsal-calendar-native/server/migrations/migrate-rehearsals-to-timestamptz.sql:15](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/migrations/migrate-rehearsals-to-timestamptz.sql:15) | Историческая конверсия UTC зависит от session timezone |
| [FM02](#fm02) | БД / legacy migrations | Low | Условный | [rehearsal-calendar-native/server/migrations/001-add-oauth-providers.sql:23](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/migrations/001-add-oauth-providers.sql:23) | Повторный OAuth backfill создаёт дубли email-provider |
| [G01](#g01) | Push / доставка и права | High | По коду | [rehearsal-calendar-native/server/routes/native/pushTokens.js:49](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/pushTokens.js:49) | конкурентная регистрация оставляет двух владельцев одного push-токена |
| [G02](#g02) | Push / доставка и права | Medium | По коду | [rehearsal-calendar-native/server/services/notifications/pushNotificationService.js:89](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/pushNotificationService.js:89) | ticket Expo принят за окончательный результат; receipts не обрабатываются |
| [GC01](#gc01) | Push / клиент | Medium | По коду | [rehearsal-calendar-native/src/features/onboarding/screens/NotificationsScreen.tsx:55](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/onboarding/screens/NotificationsScreen.tsx:55) | «Позже» в onboarding не откладывает системный запрос уведомлений |
| [GC02](#gc02) | Push / клиент | Medium | По коду | [rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:53](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:53) | Profile сообщает успешное включение push при отказе OS или backend |
| [GC03](#gc03) | Push / клиент | Medium | По коду | [rehearsal-calendar-native/src/contexts/AuthContext.tsx:154](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:154) | Временная ошибка регистрации при запуске не повторяется после восстановления связи |
| [NI01](#ni01) | Уведомления / inbox | Medium | По коду | [rehearsal-calendar-native/src/features/notifications/screens/NotificationsScreen.tsx:62](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/notifications/screens/NotificationsScreen.tsx:62) | в приложении недоступны уведомления старше первых 50 |
| [NI02](#ni02) | Уведомления / inbox | Medium | По коду | [rehearsal-calendar-native/src/contexts/UnreadContext.tsx:74](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/UnreadContext.tsx:74) | ошибка «прочитано» скрывается, а UI объявляет уведомления прочитанными |
| [NI03](#ni03) | Уведомления / inbox | Medium | По коду | [rehearsal-calendar-native/src/contexts/UnreadContext.tsx:37](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/UnreadContext.tsx:37) | счётчик прошлого аккаунта остаётся после смены пользователя |
| [NI04](#ni04) | Уведомления / inbox | Medium | По коду | [rehearsal-calendar-native/src/contexts/UnreadContext.tsx:63](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/UnreadContext.tsx:63) | поздние ответы возвращают старый счётчик и уже удалённые карточки |
| [NI05](#ni05) | Уведомления / inbox | Low | По коду | [rehearsal-calendar-native/src/features/notifications/screens/NotificationsScreen.tsx:62](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/notifications/screens/NotificationsScreen.tsx:62) | сбой первоначальной загрузки показывается как пустой inbox |
| [NI06](#ni06) | Уведомления / inbox | Low | По коду | [rehearsal-calendar-native/server/routes/native/notifications.js:52](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/notifications.js:52) | API markRead с пустым списком отмечает весь inbox |
| [GR01](#gr01) | Напоминания / scheduler | Medium | По коду | [rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:141](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:141) | ошибка отправки push не освобождает reminder claim |
| [GR02](#gr02) | Напоминания / scheduler | Medium | По коду | [rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:139](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:139) | ошибка или остановка между claims и notify навсегда исключает ещё не уведомлённых пользователей |
| [GR03](#gr03) | Напоминания / scheduler | Medium | По коду | [rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:102](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:102) | cron и workflow показывают успех при отказе БД/напоминаний |
| [GR04](#gr04) | Напоминания / scheduler | Low | По коду | [rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:24](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:24) | текст «завтра»/«через1час» противоречит расширенным окнам напоминания |
| [GR05](#gr05) | Напоминания / scheduler | Medium | По коду | [rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:77](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:77) | старый scheduler snapshot ставит claim уже после переноса репетиции и блокирует новое напоминание |
| [H01](#h01) | Public / admin | High | По коду | [rehearsal-calendar-native/server/routes/admin/dashboardPage.js:430](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/admin/dashboardPage.js:430) | сохранённая XSS из обращения/профиля выполняется в admin origin |
| [H02](#h02) | Public / admin | Medium | По коду | [rehearsal-calendar-native/server/server.js:317](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:317) | резервная кнопка открытия приглашения блокируется CSP |
| [H03](#h03) | Public / admin | Low | По коду | [rehearsal-calendar-native/server/routes/admin.js:35](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/admin.js:35) | метрика неактивности принимает давний login за отсутствие использования |
| [H04](#h04) | Public / admin | Low | По коду | [rehearsal-calendar-native/server/routes/admin/dashboardPage.js:261](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/admin/dashboardPage.js:261) | admin скрывает ошибки загрузки/смены статуса |
| [HP01](#hp01) | Профиль / onboarding | Medium | По коду | [rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:66](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:66) | изменение email подтверждается, но сервер его игнорирует |
| [HP02](#hp02) | Профиль / onboarding | Low | По коду | [rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:68](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:68) | существующую фамилию нельзя очистить |
| [HP03](#hp03) | Профиль / onboarding | Low | По коду | [rehearsal-calendar-native/src/features/onboarding/hooks/useOnboarding.ts:18](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/onboarding/hooks/useOnboarding.ts:18) | ошибка «пропустить онбординг» остаётся необработанным Promise |
| [HP04](#hp04) | Профиль / onboarding | Medium | По коду | [rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:92](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:92) | ручная настройка timezone сбрасывается при следующем запуске/входе |
| [HP05](#hp05) | Профиль / onboarding | Low | По коду | [rehearsal-calendar-native/src/features/onboarding/screens/CalendarSyncScreen.tsx:130](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/onboarding/screens/CalendarSyncScreen.tsx:130) | онбординг показывает подключённый календарь после отказа сохранения |
| [HN01](#hn01) | Навигация / state | Medium | По коду | [rehearsal-calendar-native/src/navigation/index.tsx:347](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/navigation/index.tsx:347) | Приглашение теряется при первом входе через onboarding |
| [HN02](#hn02) | Навигация / state | Medium | По коду | [rehearsal-calendar-native/src/features/calendar/hooks/useRehearsals.ts:82](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useRehearsals.ts:82) | Успешная загрузка всех проектов не снимает устаревшую отметку «просмотрено» |
| [HN03](#hn03) | Навигация / state | Medium | По коду | [rehearsal-calendar-native/App.tsx:33](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/App.tsx:33) | SeenContext сохраняет ответы предыдущего аккаунта |
| [HC01](#hc01) | Общие компоненты | Low | По коду | [rehearsal-calendar-native/src/contexts/I18nContext.tsx:23](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/I18nContext.tsx:23) | язык аккаунта записывается в cache, но не обновляет уже работающий I18nContext |
| [HC02](#hc02) | Общие компоненты | Medium | По коду | [rehearsal-calendar-native/src/shared/components/PickerModal.tsx:35](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/components/PickerModal.tsx:35) | iOS PickerModal сохраняет изменения при нажатии «Отмена» |
| [IC01](#ic01) | Конфигурация | Medium | По коду | [rehearsal-calendar-native/server/server.js:242](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:242) | Android App Links не имеют действительной association подписи |
| [ID01](#id01) | Конфигурация / контракты | Low | По коду | [rehearsal-calendar-native/server/middleware/jwtMiddleware.js:25](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/middleware/jwtMiddleware.js:25) | документированные переменные срока JWT не влияют на выдачу |
| [IDOC01](#idoc01) | Документация | Low | По коду | [rehearsal-calendar-native/docs/api-documentation.md:987](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/docs/api-documentation.md:987) | документ API содержит устаревшие и противоречащие контракту инструкции |
| [IS01](#is01) | Сквозная безопасность | Medium | По коду | [rehearsal-calendar-native/scripts/check-secrets.sh:51](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/scripts/check-secrets.sh:51) | secret scanner использует неверный диалект regex и пропускает секреты |
| [IS02](#is02) | Сквозная безопасность | Medium | Условный | [rehearsal-calendar-native/server/server.js:136](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:136) | rate limits не общие для нескольких процессов |
| [IA01](#ia01) | OAuth / конфигурация | High | Условный | [rehearsal-calendar-native/server/utils/oauthVerification.js:101](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/utils/oauthVerification.js:101) | Apple ID token принимается без проверки приложения-получателя, если APPLE_CLIENT_ID отсутствует/пуст |

## 3. Подробные карточки

Цитаты приведены из исходников финальной базы. Короткая выдержка показывает ключевой участок; вся цепочка и дополнительные места описаны рядом. Блоки кода с многоточием — явно сокращённые выдержки, не предлагаемые патчи.

<a id="a01"></a>

### A01 — High — предварительный захват аккаунта через email/OAuth

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/auth.js:20](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:20):

```js
    if (!email || !password || !firstName) {
      return res.status(400).json({ error: 'Email, password and first name are required' });
    }

    // Check if user already exists
    const existing = await db.get('SELECT id FROM native_users WHERE email = $1', [email]);
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
```

Доказательства: [server/routes/auth.js:20-37](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:20) проверяет только truthiness, сразу записывает email/password и выдаёт JWT (43); подтверждения владения email нет. [server/utils/accountLinking.js:74-90](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/utils/accountLinking.js:74): `SELECT id FROM native_users WHERE email = $1` → INSERT provider в найденный аккаунт. Старый password_hash и token_version не меняются.

Ключевое условие auto-link, [server/utils/accountLinking.js:74–80](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/utils/accountLinking.js:74):

```js
  if (email && emailVerified) {
    const existingUser = await db.get(
      'SELECT id FROM native_users WHERE email = $1',
      [email]
    );

    if (existingUser) {
```

Сессия выдаётся сразу после INSERT, [server/routes/auth.js:42–43](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:42):

```js
    // New users start with token_version = 1 (DB default)
    const { accessToken, refreshToken } = generateTokens(userId, 1);
```

Сценарий: злоумышленник первым регистрирует чужой email со своим паролем; владелец адреса позже входит Google/Apple с verified email; оба оказываются одним пользователем. Атакующий продолжает входить своим паролем и имеет ранее выданную сессию. Доступ к проектам и личной доступности жертвы после её начала работы. Не требует подделки OAuth.

Минимум: запретить авто-link в неподтверждённый password-аккаунт и не выдавать ему рабочую сессию до подтверждения (1–2 дня, понадобится flow подтверждения). Правильно: подтверждение email + linking из уже аутентифицированной сессии с повторной проверкой способов входа, отзыв старых сессий при разрешении коллизии (3–5 дней). Нельзя просто снять password_hash без отзыва уже выданных токенов.

Минимум: **+** закрывает именно предварительный захват неподтверждённого адреса; **−** добавляет обязательную доставку подтверждения и требует понятного восстановления для уже существующих коллизий. Правильное решение: **+** связывает методы входа только с доказанным владельцем и отзывает прежний доступ; **−** затрагивает регистрацию, linking, delivery, миграцию старых accounts и UX повторной проверки.

Рабочие доказательства и покрытие: [notes-auth.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-auth.md).

<a id="a02"></a>

### A02 — High — необработанные async-исключения в auth middleware/admin login

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/middleware/jwtMiddleware.js:58](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/middleware/jwtMiddleware.js:58):

```js
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

```

[server/middleware/jwtMiddleware.js:58-75](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/middleware/jwtMiddleware.js:58): async handler делает `await db.get` без try/catch/next(err). [server/middleware/adminAuth.js:9-22](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/middleware/adminAuth.js:9): `await bcrypt.compare(password, passwordHash)` без проверки типа и catch. Express 4 ([server/package.json:23](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/package.json:23)) не оборачивает отвергнутые promise автоматически. При сбое БД любой защищённый запрос; при ADMIN_PASSWORD_HASH запрос `{}`/нестроковый password к публичному admin login → rejected promise; ответ зависает либо процесс завершается (зависит от Node/runtime политики unhandled rejection). По коду нет глобального адаптера promises. Минимум: try/catch(next) + validate password (1–3 ч). Правильно: общий async wrapper всех middleware/handlers и error-boundary, тест отказа БД и неверного JSON (0.5–1 день). Запуск не производился.

Отвергаемая операция middleware, [server/middleware/jwtMiddleware.js:72–75](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/middleware/jwtMiddleware.js:72):

```js
  const user = await db.get(
    'SELECT token_version FROM native_users WHERE id = $1',
    [decoded.userId]
  );
```

Вход admin передаёт непроверенный request value в bcrypt, [server/middleware/adminAuth.js:17–22](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/middleware/adminAuth.js:17):

```js
  const { password } = req.body;

  // Prefer bcrypt hash; fall back to plaintext for backwards compatibility
  const isValid = passwordHash
    ? await bcrypt.compare(password, passwordHash)
    : password === passwordPlain;
```

Минимум: **+** небольшой локальный фикс с гарантированным HTTP-ответом; **−** ручные catch легко пропустить в других async handlers. Правильное решение: **+** единое поведение Express 4 при rejected Promise и общие проверки отказов; **−** требуется подключить wrapper ко всем соответствующим mounts и согласовать error responses.

Необходимость передавать async rejection в next(err) в Express 4 подтверждена [официальной документацией](https://expressjs.com/en/4x/guide/error-handling/). Такой же пробел до try обнаружен у bulk availability при DB lookup/parsing; это объединённое проявление, без нового ID.

Рабочие доказательства и покрытие: [notes-auth.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-auth.md).

<a id="a03"></a>

### A03 — Medium — backend не применяет правила пароля и профильные типы

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/auth.js:20](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:20):

```js
    if (!email || !password || !firstName) {
      return res.status(400).json({ error: 'Email, password and first name are required' });
    }

    // Check if user already exists
    const existing = await db.get('SELECT id FROM native_users WHERE email = $1', [email]);
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
```

[server/routes/auth.js:20-31](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:20), `:301-321`, `:337-349`: регистрация принимает любой непустой пароль, PUT допускает пустую строку в bcrypt, нет ограничения bcrypt 72 bytes, firstName/timezone/locale/booleans без валидации. Обход UI прямым API создаёт слабый пароль; профиль принимает несуществующую timezone, что ломает downstream date conversion (подтверждено: неверная зона вызывает RangeError в timezone helper и ошибку SQL AT TIME ZONE). Минимум: типы, длины, allowlist locale и валидная IANA timezone, единая политика пароля для register/update (0.5–1 день). Правильно: единая входная схема и согласованные 400 + контрактные тесты (1–2 дня). Не выдавать все невалидные типы за эскалацию прав.

Регистрация проверяет только наличие, [server/routes/auth.js:20–22](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:20):

```js
    if (!email || !password || !firstName) {
      return res.status(400).json({ error: 'Email, password and first name are required' });
    }
```

Правило PUT password, [server/routes/auth.js:318–322](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:318):

```js
  password: {
    dbColumn: 'password_hash',
    validate: null,
    transform: async (value) => await bcrypt.hash(value, 10)
  }
```

Минимум: **+** блокирует конкретные некорректные значения до SQL/bcrypt и приводит сервер к требованиям UI; **−** остаётся ручное дублирование правил между register/update/другими входами. Правильное решение: **+** один проверяемый контракт типов и одинаковые 400 вместо downstream 500; **−** изменение правил может потребовать обработки уже сохранённых невалидных профилей и обновления клиентов.

Рабочие доказательства и покрытие: [notes-auth.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-auth.md).

<a id="a04"></a>

### A04 — Medium — способы входа расходятся с реальными credentials

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/auth.js:34](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:34):

```js
    const result = await db.run(
      `INSERT INTO native_users (email, password_hash, first_name, last_name, timezone, last_login_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [email, passwordHash, firstName, lastName || null, timezone || null]
    );

    const userId = result.lastInsertId;

```

[server/routes/auth.js:34-43](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:34) создаёт password-аккаунт без native_auth_providers; PUT password `:318-321,369-372` тоже не синхронизирует provider. [utils/accountLinking.js:190-196](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/utils/accountLinking.js:190) считает только строки providers. Новая email-регистрация → список providers пуст; после Google → одна строка, unlink Google запрещён несмотря на рабочий пароль. Отдельно check-then-delete `:190-203` без блокировки: два конкурентных unlink для двух OAuth providers могут пройти last-method guard. В F проверено: поддерживающих triggers нет, email-provider backfill выполняется только разово. Минимум: учитывать password_hash и транзакционно создавать email provider, блокировать user row на unlink (0.5–1 день). Правильно: единый credential registry и инвариант последнего способа входа (1–2 дня). Авто-link по email также может вернуть только что удалённый OAuth при следующем входе; уточнить ожидаемый смысл unlink.

Guard опирается только на registry, [server/utils/accountLinking.js:190–197](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/utils/accountLinking.js:190):

```js
  const providers = await db.all(
    'SELECT provider_type FROM native_auth_providers WHERE user_id = $1',
    [userId]
  );

  if (providers.length <= 1) {
    throw new Error('Cannot unlink the last authentication method');
  }
```

Последующий отдельный DELETE, [server/utils/accountLinking.js:200–203](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/utils/accountLinking.js:200):

```js
  const result = await db.run(
    'DELETE FROM native_auth_providers WHERE user_id = $1 AND provider_type = $2',
    [userId, providerType]
  );
```

F подтвердил: backfill одноразовый, triggers нет; I delta не меняет production credential registry (см. notes-final-delta.md). Минимум: **+** восстанавливает соответствие password/registry и сериализует unlink; **−** отдельно потребуется нормализовать уже существующие аккаунты без email provider. Правильное решение: **+** инвариант последнего действующего способа входа проверяется во всех операциях; **−** затрагивает register, password updates, OAuth linking/unlinking и восстановление исторических данных.

Рабочие доказательства и покрытие: [notes-auth.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-auth.md).

<a id="ac01"></a>

### AC01 — Medium — Кратковременный сбой refresh уничтожает сессию

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/services/api.ts:136](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:136):

```ts
      } catch (refreshError) {
        // Refresh failed - logout user
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
        return Promise.reject(refreshError);
```

**Доказательство:** [src/shared/services/api.ts:136-139](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:136):

```ts
} catch (refreshError) {
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
  return Promise.reject(refreshError);
}
```

**Что не так:** catch не различает неверный refresh token и отсутствие сети/5xx. Это противоречит явному обещанию [AuthContext.tsx:110-111](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:110) не удалять токены при сетевых ошибках. При холодном старте `getMe` получает 401 из-за истечения access, затем refresh падает по сети: interceptor удаляет оба токена, а [AuthContext.tsx:117-125](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:117) поднимает cachedUser. Интерфейс считает пользователя вошедшим, но запросы больше нечем аутентифицировать. Следующий запуск возвращает на login, поскольку [AuthContext.tsx:87-91](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:87) не находит access token.

**Последствие:** случайный разрыв связи принудительно разлогинивает пользователя; в текущем сеансе UI может показывать профиль и действия, которые постоянно отклоняются сервером.

**Минимальная правка:** удалять токены только при подтверждённой auth-ошибке refresh, на network/5xx оставлять их и пробрасывать временную ошибку. Плюс: небольшая локальная правка; минус: отдельно остаётся уведомление AuthContext об окончательно истёкшей сессии.

**Правильное решение:** единый менеджер состояния сессии: valid/offline/expired, обработка invalidation в AuthContext, ограниченный retry transient errors, отдельный transport refresh с timeout. Плюс: согласованы UI, offline и API; минус: больше изменений и сценариев проверки.

**Трудоёмкость:** минимум 2–4 часа; полноценное решение 1–2 дня. Ручная проверка: просрочить access, оставить валидный refresh, оборвать связь ровно на refresh, затем восстановить сеть.

Рабочие доказательства и покрытие: [notes-auth-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-auth-client.md).

<a id="ac02"></a>

### AC02 — Medium — Окончательная потеря авторизации не переводит открытое приложение на вход

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/services/api.ts:136](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:136):

```ts
      } catch (refreshError) {
        // Refresh failed - logout user
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
        return Promise.reject(refreshError);
```

**Доказательство:** [api.ts:136-139](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:136) удаляет только storage; [AuthContext.tsx:134-137](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:134) вызывает `loadUser` только при mount, а [AuthContext.tsx:435](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:435) вычисляет `isAuthenticated: !!user`. Между interceptor и AuthContext отсутствует сигнал invalidation. Очистка user при 401/403 есть только внутри стартового loadUser ([AuthContext.tsx:112-116](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:112)).

**Сценарий:** пользователь уже вошёл; другой сеанс делает logout/меняет пароль и сервер отзывает токены. Следующее действие получает 401, refresh тоже отклонён. Storage очищен, React state user остаётся прежним. Все дальнейшие API действия получают 401, но AuthNavigator не активируется до явного logout/перезапуска.

**Последствие:** приложение застревает в неработающем авторизованном интерфейсе; профиль и кеши остаются отображёнными после отзыва сессии. Это не обход серверной авторизации.

**Минимальная правка:** callback/event auth-expired от interceptor, в обработчике AuthProvider очистить user и связанные данные. Плюс: быстро исправляет зависшее состояние; минус: требует аккуратной отписки/защиты от событий старой сессии.

**Правильное решение:** единый session store с идентификатором поколения; изменения токенов и user проводить атомарным переходом. Плюс: устраняет рассогласование; минус: затрагивает navigation/context/API.

**Трудоёмкость:** минимум 3–6 часов; правильное решение совместно с AC01/AC03 1–2 дня. Ручная проверка: отозвать сессию с другого устройства, затем выполнить защищённый запрос в открытом приложении.

Рабочие доказательства и покрытие: [notes-auth-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-auth-client.md).

<a id="ac03"></a>

### AC03 — Medium — Поздний ответ профиля восстанавливает user после выхода или подменяет user нового входа

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/contexts/AuthContext.tsx:180](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:180):

```tsx
    authAPI.updateMe({ timezone: deviceTimezone })
      .then(response => {
        const updatedUser = response.data.user;
        setUser(updatedUser);
        AsyncStorage.setItem('cachedUser', JSON.stringify(updatedUser));
        syncUserPreferences(updatedUser);
```

**Доказательство:** фоновый timezone update в [src/contexts/AuthContext.tsx:180-185](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:180):

```ts
authAPI.updateMe({ timezone: deviceTimezone })
  .then(response => {
    const updatedUser = response.data.user;
    setUser(updatedUser);
    AsyncStorage.setItem('cachedUser', JSON.stringify(updatedUser));
    syncUserPreferences(updatedUser);
  })
```

Нет cleanup/cancellation и проверки, относится ли ответ к текущему пользователю. Аналогично `updateUser` (`383-392`) безусловно применяет асинхронный ответ. Выход в `375` делает `setUser(null)`, но не инвалидирует уже выполняющиеся операции.

**Сценарий:** timezone PUT для A обработан сервером, но ответ задержан. Пользователь выходит (и может войти как B). Поздний ответ A вызывает setUser(A), переписывает cachedUser/preferences; после выхода интерфейс снова считается authenticated, после смены аккаунта UI и токены относятся к разным людям.

**Последствие:** возврат авторизованного UI после выхода, показ профиля предыдущего аккаунта/его настроек, действия при смене аккаунта от имени другого текущего токена. Серверные отозванные токены этим не восстанавливаются.

**Минимальная правка:** перед применением результата проверять session generation и user id; инвалидировать поколение сразу при logout/deleteAccount/начале нового входа. Плюс: локальное исправление без смены архитектуры; минус: guard требуется во всех писателях session state.

**Правильное решение:** централизовать вход/выход, отменять старые запросы и применять cache/token/user writes только в актуальном поколении сессии. Плюс: закрывает весь класс гонок; минус: больше интеграционной проверки.

**Трудоёмкость:** минимум 3–6 часов, полный session lifecycle 1–2 дня. Ручная проверка: искусственно задержать успешный timezone/profile ответ до завершения logout и повторного login.

Рабочие доказательства и покрытие: [notes-auth-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-auth-client.md).

<a id="ac04"></a>

### AC04 — Medium — OAuth токен и возможный Authorization передаются в незащищённый log sink

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/contexts/AuthContext.tsx:302](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:302):

```tsx
      console.error('[Auth] Google login error:', err);
```

**Доказательство:** [src/contexts/AuthContext.tsx:302](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:302):

```ts
console.error('[Auth] Google login error:', err);
```

Запрос формируется в [src/shared/services/api.ts:179-180](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:179): `api.post('/auth/google', { idToken })`. AxiosError сохраняет конфигурацию запроса, включая body; request interceptor [api.ts:88-90](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:88) также может добавить существующий Bearer. В catch передаётся полный объект ошибки без редактирования полей. Здесь нет `__DEV__`/NODE_ENV guard. [src/shared/utils/logger.ts:40-41](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/logger.ts:40) также не фильтрует error в production, но этот вызов вообще идёт прямо в console.

**Сценарий:** Google login отклонён сервером либо потеряна сеть. Среда, которая сериализует полный объект console.error (диагностика/сбор логов/отладчик), получает ID token в request config; при уже имеющейся сессии может получить access token в headers.

**Последствие:** credential material оказывается в диагностике с более широким доступом/сроком хранения. Наличие внешнего сборщика логов и точная сериализация release-runtime здесь не подтверждались; факт передачи неотредактированного объекта в sink подтверждён.

**Минимальная правка:** логировать только код/status/обезличенное сообщение, не err/config/headers/body. Плюс: 1 точечная правка; минус: другие sinks требуют отдельной проверки.

**Правильное решение:** общий redaction логгер для Error и HTTP объектов с denylist credential fields и allowlist диагностических полей; исключить прямые console для HTTP errors. Плюс: защита на уровне приложения; минус: дополнительная инфраструктура и проверка диагностической полезности.

**Трудоёмкость:** минимум до 1 часа; системно 0.5–1 дня. Сквозной поиск логирования — стык с финальным security sweep.

Дополнение сквозного поиска: [src/shared/services/notifications.ts:66](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/notifications.ts:66) и [src/shared/hooks/useNotifications.ts:36](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useNotifications.ts:36) логируют token/payload напрямую; Axios errors в notifications.ts:92,159 передаются целиком. Рекомендация redact распространяется и на эти sinks. Server logger.info с push-token выключен в production; доступ внешнего сборщика логов к этим сообщениям не подтверждён.

Рабочие доказательства и покрытие: [notes-auth-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-auth-client.md).

<a id="ac05"></a>

### AC05 — Medium — Долгоживущие bearer credentials сохраняются в обычном AsyncStorage

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/contexts/AuthContext.tsx:202](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:202):

```tsx
      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['refreshToken', refreshToken],
        ['cachedUser', JSON.stringify(user)],
```

**Доказательство:** [src/contexts/AuthContext.tsx:202-205](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:202) (также 232-235, 261-264, 288-291, 322-325):

```ts
await AsyncStorage.multiSet([
  ['accessToken', accessToken],
  ['refreshToken', refreshToken],
  ['cachedUser', JSON.stringify(user)],
]);
```

[src/shared/services/api.ts:117-129](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:117) читает/обновляет refresh в том же хранилище. В проверенном потоке нет использования защищённого системного credential store/шифрования. AsyncStorage — общее хранилище данных приложения, не Keychain/Keystore.

**Сценарий:** чтение локальных данных/резервной копии приложения или диагностического дампа, имеющего доступ к AsyncStorage, раскрывает bearer credentials; refresh позволяет продлить доступ. Обычное стороннее приложение без соответствующего доступа не получает их автоматически. Конкретные настройки platform backup и hardware protection не проверены здесь.

**Последствие:** кража локальных данных может перерасти в захват удалённой сессии. Access действует 30 дней, refresh 90 дней; см. [server/middleware/jwtMiddleware.js:25–26](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/middleware/jwtMiddleware.js:25) и проверку token_version.

**Минимальная правка:** перенести refresh token в SecureStore/Keychain/Keystore с миграцией и удалением старого ключа; access держать в памяти либо там же. Плюс: существенно снижает риск выгрузки общего storage; минус: требуется обработать миграцию/недоступность защищённого хранилища.

**Правильное решение:** системный credential store + короткоживущий access и управляемые refresh sessions на сервере. Плюс: ограничивает ущерб/позволяет отзывать конкретные устройства; минус: затрагивает серверный token lifecycle.

**Трудоёмкость:** минимум 0.5–1 дня; вместе с серверной ротацией 2–4 дня. Проверка на физическом устройстве и в platform backups требуется отдельно.

Рабочие доказательства и покрытие: [notes-auth-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-auth-client.md).

<a id="b01"></a>

### B01 — Medium — удаление участника неатомарно, сбой оставляет связанные записи

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/native/members.js:468](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/members.js:468):

```js
    await db.run(
      'DELETE FROM native_project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    // And take them off the project's rehearsals.
    //
    // Membership is not what grants access to a rehearsal — a row in
```

[server/routes/native/members.js:468-496](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/members.js:468): три отдельных DELETE (membership → responses → rehearsal availability), без transaction. Если второй DELETE падает, членство уже удалено; следующий повтор получает 404 на :440-447 и cleanup никогда не повторяется. Если третий DELETE падает — остаётся ложная занятость. Тест memberRemoval:198-213 специально проверяет, что stale response сам по себе НЕ даёт read-by-id без membership; не утверждать обход прав на основании устаревшего комментария. Минимум: все изменения в db.transaction (2–4 ч). Правильно: единая операция membership removal с блокировкой состава, идемпотентным cleanup и failure injection проверками (1–2 дня). Сценарий требует ошибки между SQL или конкурентной записи, а не обычного успешного запроса.

Первая отдельная запись, [server/routes/native/members.js:468–471](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/members.js:468):

```js
    await db.run(
      'DELETE FROM native_project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
```

Следующая запись, [server/routes/native/members.js:482–487](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/members.js:482):

```js
    await db.run(
      `DELETE FROM native_rehearsal_responses
       WHERE user_id = $1
       AND rehearsal_id IN (SELECT id FROM native_rehearsals WHERE project_id = $2)`,
      [userId, projectId]
    );
```

Минимум: **+** отказ любого шага откатывает удаление членства и связанных записей вместе; **−** не устраняет все гонки изменения roster без согласованной блокировки. Правильное решение: **+** согласует права, roster и занятость при ошибках и повторе; **−** нужен общий lifecycle-контракт и проверки конкурентных изменений/частичных отказов.

Дополнение к B01 из G, 2026-09-10: [routes/native/rehearsals.js:159-162](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/rehearsals.js:159),219-222 получает получателей updates/deletion из response roster без active membership; [pushNotificationService.js:25-37](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/pushNotificationService.js:25),52 и [notificationStore.js:38-65](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/notificationStore.js:38) повторно membership не проверяют. Если второй DELETE member removal упал, бывший участник продолжает получать новые названия/сведения в push и inbox. Чтение rehearsal by id по-прежнему закрыто. Подробная цепочка в notes-notifications-delivery.md; не считать отдельной G-проблемой.

Рабочие доказательства и покрытие: [notes-projects.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-projects.md).

<a id="b02"></a>

### B02 — Medium — создание/удаление проекта частично фиксируются при ошибке

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/native/projects.js:70](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/projects.js:70):

```js
    const newProject = await db.get(
      'INSERT INTO native_projects (name, description, timezone, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      [name, description || null, projectTimezone]
    );

    const projectId = newProject.id;

    // Add creator as owner member
```

[server/routes/native/projects.js:70-81](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/projects.js:70): INSERT project, затем INSERT owner без транзакции; отказ/удаление аккаунта между ними оставляет проект без владельца, повтор создаёт другой. `:185-193`: сначала удаляет busy availability, потом проект; при отказе второго запроса репетиции остаются, занятость уже потеряна. Минимум: две операции обернуть transaction (2–4 ч, малое изменение). Правильно: транзакционные lifecycle services и failure/retry contract, уникальный idempotency key на create (1–2 дня). Уведомления оставить после commit.

Создание первого объекта, [server/routes/native/projects.js:70–73](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/projects.js:70):

```js
    const newProject = await db.get(
      'INSERT INTO native_projects (name, description, timezone, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      [name, description || null, projectTimezone]
    );
```

Отдельное создание владельца, [server/routes/native/projects.js:78–81](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/projects.js:78):

```js
    await db.run(
      'INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
      [projectId, accountId, 'owner', 'active']
    );
```

На удалении сначала фиксируется очистка занятости, [server/routes/native/projects.js:185–190](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/projects.js:185):

```js
    await db.run(
      `DELETE FROM native_user_availability
       WHERE source = 'rehearsal'
       AND external_event_id IN (SELECT CAST(id AS TEXT) FROM native_rehearsals WHERE project_id = $1)`,
      [projectId]
    );
```

Удаление самого проекта — отдельный db.run на :193. Минимум: **+** устраняет половинчатую фиксацию в каждом lifecycle; **−** потеря ответа после успешного commit всё ещё допускает повторное создание. Правильное решение: **+** согласует атомарность, повторы и отправку уведомлений после commit; **−** нужны idempotency storage и единые правила обработки уже выполненного запроса.

Рабочие доказательства и покрытие: [notes-projects.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-projects.md).

<a id="b03"></a>

### B03 — High — неограниченный диапазон дат блокирует event loop до проверки членства

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/native/members.js:26](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/members.js:26):

```js
    } else if (startDate && endDate) {
      // Date range mode (for Smart Planner).
      //
      // Walked with the UTC accessors throughout. Anchoring on UTC midnight and
      // then stepping with setDate(), which moves the local components, agrees
      // with itself only until a clock change — harmless on Vercel, which runs
      // UTC, but wrong on a developer machine that observes one.
      const current = new Date(`${startDate}T00:00:00Z`);
```

[server/routes/native/members.js:26-39](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/members.js:26): `while (current <= last) { dates.push(...); current.setUTCDate(...) }`; ограничений диапазона нет и membership lookup только :44-51. Любой зарегистрированный пользователь может запросить диапазон 0001-01-01..9999-12-31 для любого projectId: миллионы строк синхронно создаются до отказа в доступе. Затем у настоящего участника стоимость растёт также по пользователям/дням. Общего rate limit на /projects нет. Минимум: строгие реальные YYYY-MM-DD, start<=end, cap 31/90 дней перед циклом (2–3 ч). Правильно: общий budget дат/пользователей/размера ответа + проверка членства до тяжёлой работы и rate limit (0.5–1 день). Уязвимость не проверялась запуском нагрузочного запроса.

Неограниченное синхронное разворачивание входного диапазона, [server/routes/native/members.js:33–39](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/members.js:33):

```js
      const current = new Date(`${startDate}T00:00:00Z`);
      const last = new Date(`${endDate}T00:00:00Z`);

      while (current <= last) {
        dates.push(current.toISOString().split('T')[0]);
        current.setUTCDate(current.getUTCDate() + 1);
      }
```

Минимум: **+** ставит верхнюю границу CPU/memory одного запроса ещё до цикла; **−** фиксированный лимит требует разбивать разрешённые длинные выборки на части. Правильное решение: **+** ограничивает суммарную стоимость с учётом участников и частоты запросов, отказывает чужому пользователю до тяжёлой работы; **−** нужны согласованные caps, pagination/chunking клиента и общий limiter store для нескольких экземпляров.

Рабочие доказательства и покрытие: [notes-projects.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-projects.md).

<a id="b04"></a>

### B04 — Medium — альтернативный join URL обходит rate limit приглашений

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/native.js:29](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native.js:29):

```js
router.use('/projects', invitesRoutes);
router.use('/rehearsals', rehearsalsRoutes);
router.use('/invite', invitesRoutes);
```

[server/routes/native.js:29–31](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native.js:29) монтирует invitesRoutes и под `/projects`, и под `/invite`; его `POST /:code/join` ([invites.js:214](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/invites.js:214)) доступен по `/api/native/projects/:code/join`. [server/server.js:145](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:145) ограничивает только `/api/native/invite`. Другие projects routers не имеют POST /:code/join и пропускают его дальше. Перебор кода с авторизованной сессией и массовое вступление по alias обходят заявленный 20/min. 8-символьное пространство большое: не утверждать, что случайный одиночный код легко подобрать. Минимум: limiter на router handler join/lookup независимо от mount (1–2 ч). Правильно: отдельные routers для project invites и redeem, IP+account лимиты с общим store (0.5–1 день). Memory-store/serverless аспект I.

Два mounts одного router, [server/routes/native.js:29–31](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native.js:29):

```js
router.use('/projects', invitesRoutes);
router.use('/rehearsals', rehearsalsRoutes);
router.use('/invite', invitesRoutes);
```

Ограничитель привязан только к одному prefix, [server/server.js:145–148](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:145):

```js
app.use('/api/native/invite', rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
```

Сам join route не ограничивает mount, [server/routes/native/invites.js:213–214](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/invites.js:213):

```js
// POST /api/native/invite/:code/join - Join project using invite
router.post('/:code/join', requireAuth, async (req, res) => {
```

Минимум: **+** одинаково ограничивает все aliases уже существующего обработчика; **−** неоднозначная структура URL и ограничения в памяти процесса остаются. Правильное решение: **+** отделяет управление приглашениями от погашения кода и считает единый budget IP/account на всех экземплярах; **−** потребуются общее хранилище limiter и план совместимости старых aliases.

Рабочие доказательства и покрытие: [notes-projects.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-projects.md).

<a id="bc01"></a>

### BC01 — Medium — проекты и выбранный проект переживают смену аккаунта

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/contexts/ProjectContext.tsx:26](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/ProjectContext.tsx:26):

```tsx
  const fetchProjects = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await projectsAPI.getUserProjects();
```

Категория: изоляция состояния / конфиденциальность локальных данных.

Код [src/contexts/ProjectContext.tsx:26-40](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/ProjectContext.tsx:26),66-70: `if (!user) return;`, `setProjects(projectsList);`, `if (!selectedProject && projectsList.length > 0) { setSelectedProject(projectsList[0]); }`; effect выполняет загрузку только при `user`, не очищая старое состояние при logout. [App.tsx:33-40](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/App.tsx:33) держит ProjectProvider выше Navigation, поэтому смена auth-экрана его не размонтирует. Запрос также не связан с идентификатором текущей сессии и не отменяется при её смене.

Сценарий: A выбирает свой проект → выходит → на том же устройстве входит B. `selectedProject` остаётся объектом A даже после успешной загрузки списка B. Открытие формы создания репетиции без projectId берёт этот объект: [src/features/calendar/hooks/useAddRehearsalForm.ts:75-76](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:75) — `selectedProject?.is_admin ? selectedProject : null`; effect `:112-128` не проверяет наличие выбранного id в новом списке. Дополнительно поздний ответ запроса A может перезаписать уже загруженный список B, показывая названия, описания и inviteCode A в карточках ([ProjectsScreen.tsx:103](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/projects/screens/ProjectsScreen.tsx:103),116-117,144-153). Это не подтверждает обход серверной авторизации, но нарушает разделение клиентских данных.

Минимум: очищать projects, selectedProject и error при смене user.id; игнорировать результаты запроса, если сменился id/номер сессии. Плюс — небольшая правка; минус — отдельный ручной lifecycle. Правильно: кеш и запросы с ключом user.id, отмена/инвалидация на logout, выбор проекта только из актуального списка. Плюс — устраняет весь класс переходов; минус — шире затрагивает context и consumers. Трудоёмкость: минимум 3–5 часов; правильно 1–2 дня с проверками login/logout и гонок.

Рабочие доказательства и покрытие: [notes-projects-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-projects-client.md).

<a id="bc02"></a>

### BC02 — Medium — после удаления или изменения прав выбранный проект остаётся старым объектом

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/contexts/ProjectContext.tsx:34](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/ProjectContext.tsx:34):

```tsx
      const projectsList = response.data.projects || [];
      setProjects(projectsList);

      // Auto-select first project if none selected
      if (!selectedProject && projectsList.length > 0) {
        setSelectedProject(projectsList[0]);
      }
```

Категория: целостность клиентского состояния / бизнес-логика.

Код [src/contexts/ProjectContext.tsx:34-40](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/ProjectContext.tsx:34) заменяет `projects`, но обновляет selection только когда он уже null. [src/features/projects/screens/ProjectDetailScreen.tsx:303-309](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/projects/screens/ProjectDetailScreen.tsx:303): `await projectsAPI.deleteProject(projectId); await refreshProjects(); navigation.replace('ProjectsMain');`.

Сценарий: выбрать администрируемый P, удалить его, затем открыть создание репетиции при наличии другого проекта Q. Список уже не содержит P, однако context и форма продолжают использовать P ([useAddRehearsalForm.ts:75-76](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:75),112-128). Аналогично после отзыва admin новая запись списка имеет is_admin=false, а selectedProject хранит старое true. Пользователь видит удалённый проект или недоступные действия и получает отказ API; автоматического перехода на действующий проект не происходит.

Минимум: после каждого fetch функционально сопоставлять selection.id со свежим projectsList, заменять объект актуальным, иначе выбирать первый доступный/null. Плюс — небольшое централизованное исправление; минус — потребители с собственными копиями selection тоже нуждаются в синхронизации. Правильно: хранить selectedProjectId и вычислять объект по текущему списку, сбрасывать выбор и кеш форм при удалении/утрате доступа. Плюс — предотвращает устаревшие поля; минус — изменение контракта context. Трудоёмкость: минимум 2–4 часа; правильно 1 день.

Рабочие доказательства и покрытие: [notes-projects-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-projects-client.md).

<a id="bc03"></a>

### BC03 — Low — прошедшие репетиции теряют название

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/projects/screens/ProjectDetailScreen.tsx:465](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/projects/screens/ProjectDetailScreen.tsx:465):

```tsx
                    {/* `scene` predates the title field and is never written
                        to; keep reading it so any legacy row still renders. */}
                    <Text style={styles.rehearsalTitle} numberOfLines={1}>
                      {rehearsal.title || rehearsal.scene || t.calendar.rehearsal}
```

Категория: UI / расхождение с заявленной логикой.

Код [src/features/projects/screens/ProjectDetailScreen.tsx:465-468](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/projects/screens/ProjectDetailScreen.tsx:465) прямо поясняет, что `scene` устарел, и для будущих записей использует `{rehearsal.title || rehearsal.scene || t.calendar.rehearsal}`. Для прошлых `:525-526` осталось `{rehearsal.scene || t.calendar.rehearsal}`.

Сценарий: запись имеет title «Акт II», scene пустое, date раньше сегодня. В списке прошлых её название становится общим «Репетиция», тогда как до смены даты выводилось настоящее название. Пользователю трудно найти нужную репетицию.

Минимум: тот же fallback с title в строке 526. Плюс — минимальная правка; минус — дублированное выражение остаётся. Правильно: единый renderer/функция получения названия для обеих секций. Плюс — исключает расхождения; минус — чуть более широкая правка. Трудоёмкость: 15–30 минут / 1–2 часа соответственно.

Рабочие доказательства и покрытие: [notes-projects-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-projects-client.md).

<a id="c01"></a>

### C01 — High — all-day записи удаляются/заменяются по неверному дню в UTC−

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/native/availability.js:113](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:113):

```js
          `DELETE FROM native_user_availability
           WHERE user_id = $1
           AND DATE(starts_at AT TIME ZONE $2) = $3
           AND source = $4`,
          [userId, timezone, date, AVAILABILITY_SOURCES.MANUAL]
```

Решающая цитата [server/routes/native/availability.js:113–117](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:113) (тот же предикат на :184–188):

```js
`DELETE FROM native_user_availability
 WHERE user_id = $1
 AND DATE(starts_at AT TIME ZONE $2) = $3
 AND source = $4`,
[userId, timezone, date, AVAILABILITY_SOURCES.MANUAL]
```

Клиент [src/features/availability/hooks/useAvailabilitySave.ts:51-65](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:51) хранит all-day как `dateT00:00:00.000Z`..23:59:59.999Z, т.е. календарная дата, не момент. Сервер [routes/native/availability.js:95-117](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:95) вычисляет affectedDates из строкового YYYY-MM-DD, но DELETE использует `DATE(starts_at AT TIME ZONE $2)`. DELETE дня :183-188 делает то же. В America/New_York all-day 2026-09-15T00Z находится 14 сентября локально. Повторное сохранение 15-го не удалит старую запись 15-го, зато может удалить all-day 16-го (локально 15-е). Уникальность imported event для NULL external_event_id это не исправляет. Сохранение одного дня удаляет соседний, в текущем дне накапливаются противоречивые free/busy. Минимум: CASE WHEN is_all_day THEN DATE(starts_at AT TIME ZONE 'UTC') ELSE DATE(starts_at AT TIME ZONE $2) END в обоих DELETE (2–4 ч). Плюс: локально исправляет удаление без миграции; минус: смешанный контракт date/instant остаётся, оба пути нужно поддерживать согласованно. Правильно: отдельный DATE/day key для floating all-day и явный ключ заменяемого дня; timed events с нормализованным timezone контрактом (1–2 дня). Плюс: календарный день хранится без неоднозначной конвертации; минус: миграция данных и согласование API/клиента. Проверить PostgreSQL, не только test adapter.

Рабочие доказательства и покрытие: [notes-availability.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-availability.md).

<a id="c02"></a>

### C02 — Medium — неполная запись стирает день с ответом success

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/native/availability.js:98](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:98):

```js
    if (entry.startsAt && entry.type && entrySource === AVAILABILITY_SOURCES.MANUAL) {
      affectedDates.add(entry.startsAt.split('T')[0]);
    }
```

Решающие условия [server/routes/native/availability.js:98–100](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:98) и :121–123 (между ними выполняется DELETE :110–118):

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

[availability.js:98-99](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:98) включает день в affectedDates при startsAt+type; после DELETE `:123` пропускает entry без endsAt. Payload с валидными startsAt/type, отсутствующим endsAt удаляет все manual rows дня, не вставляет ничего и отвечает success (:159). Похожая проблема — type/source/isAllDay не валидируются; null entry/нестроковый startsAt падают ещё до try (:96-100). Минимум: валидировать все entries целиком до DELETE и вернуть 400 на любую невалидную (2–4 ч). Плюс: прекращает потерю данных до первого write; минус: ручные guards в одном route могут разойтись с imported updates. Правильно: единая схема bulk/imported updates с лимитами, допустимыми source и результатом по каждой записи (1–2 дня). Плюс: единый проверяемый контракт входа и ошибок; минус: изменение нескольких callers/tests, частичные результаты не должны нарушать атомарный replace-day. Ошибку malformed body до try объединить с A02, не считать отдельным DoS.

Рабочие доказательства и покрытие: [notes-availability.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-availability.md).

<a id="c03"></a>

### C03 — Medium — параллельные manual saves могут склеить взаимоисключающие состояния

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/native/availability.js:110](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:110):

```js
    await db.transaction(async (tx) => {
      for (const date of affectedDates) {
        await tx.run(
          `DELETE FROM native_user_availability
```

Решающая последовательность начинается с обычной transaction и DELETE ([server/routes/native/availability.js:110–113](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:110)):

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

[availability.js:110-155](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:110): transaction выполняет DELETE затем INSERT без блокировки user/day. У двух PostgreSQL READ COMMITTED транзакций для ещё пустого дня оба DELETE заканчиваются на 0 строках, обе вставки manual с NULL external_event_id проходят; итог — оба набора, хотя контракт «replace the day». UNIQUE(user_id,external_event_id,source) не ограничивает NULL. Сценарий два устройства/повтор сети одновременно free vs busy. Минимум: lock user row в transaction до DELETE (2–4 ч). Плюс: сериализует замену даже пустого дня без отдельной day таблицы; минус: сериализует и независимые дни пользователя, последний save молча побеждает. Правильно: day record c revision + conditional update/409 и idempotency keys (1–2 дня). Плюс: конфликт двух редакторов явный, retries не повторяют write; минус: схема/revision и обработка conflict в клиенте. Требует concurrency ручной проверки на PostgreSQL; не запускалась.

Рабочие доказательства и покрытие: [notes-availability.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-availability.md).

<a id="c04"></a>

### C04 — Medium — дедупликация по часам теряет источник и может скрыть занятость

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts:153](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts:153):

```ts
        // Second pass: add manual/other slots only if time range not already covered by rehearsal
        for (const slot of slots) {
          if (slot.source !== 'rehearsal') {
            const key = `${slot.startTime}-${slot.endTime}`;
            if (!seenTimeRanges.has(key)) {
              uniqueSlots.push(slot);
              seenTimeRanges.add(key);
```

Решающая цитата [src/features/availability/hooks/useAvailabilityData.ts:153–159](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts:153); rehearsal pass на :144–150 уже заполнил `seenTimeRanges`:

```ts
// Second pass: add manual/other slots only if time range not already covered by rehearsal
for (const slot of slots) {
  if (slot.source !== 'rehearsal') {
    const key = `${slot.startTime}-${slot.endTime}`;
    if (!seenTimeRanges.has(key)) {
      uniqueSlots.push(slot);
      seenTimeRanges.add(key);
```

[src/features/availability/hooks/useAvailabilityData.ts:137-167](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts:137): ключ `${slot.startTime}-${slot.endTime}` не включает source/type; rehearsal сохраняется первым, остальные одинаковые интервалы отбрасываются. Затем только оставшиеся own slots попадают в editable state (:191-221). Сценарий 1: manual all-day available и imported all-day busy имеют одинаковые 00:00–23:59, manual попадает первым (SQL сортирует лишь starts_at): imported отбрасывается, экран показывает free, тогда как members API отдаёт оба интервала и planner считает busy. Сценарий 2: manual busy 10–12 совпал с rehearsal, ещё есть manual 15–16; после reload+Save остаётся только manual 15–16, потому что 10–12 был исключён из snapshot. После отмены rehearsal теряется исходная ручная занятость. Минимум: не удалять независимые source/type записи из модели, группировать только визуально (2–4 ч). Плюс: сохраняет оригинальные записи при существующем API; минус: UI должен аккуратно показывать совпадения и приоритеты, иначе вырастет визуальное дублирование. Правильно: отдельные manual declarations и внешние constraints с сохранением идентичности; write только dirty manual данные (1–2 дня, совместно CC05). Плюс: отображение совпадений не влияет на сохранность редактируемой модели; минус: изменение client state/read-write contract и сценариев сохранения. Порядок ties в SQL не гарантирован, поэтому сценарий 1 зависит от порядка; сценарий 2 следует из явного rehearsal-first независимо от ties.

Рабочие доказательства и покрытие: [notes-availability.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-availability.md).

<a id="cc01"></a>

### CC01 — Medium — UTC «сегодня» запрещает редактировать текущий местный день

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/availability/screens/AvailabilityScreen.tsx:83](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/screens/AvailabilityScreen.tsx:83):

```tsx
  const today = new Date().toISOString().split('T')[0];
```

Код: [src/features/availability/screens/AvailabilityScreen.tsx:83](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/screens/AvailabilityScreen.tsx:83): `const today = new Date().toISOString().split('T')[0]`. При этом месяцы строятся через местный `new Date()` ([utils/calendarUtils.ts:14-17](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/utils/calendarUtils.ts:14)), timed entries — с device offset ([hooks/useAvailabilitySave.ts:15-28](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:15)). Сравнение с today запрещает редактор (`Screen:264,274,301`), а prepareEntries исключает такие даты (`Save:47-48`).

Сценарий: Нью-Йорк 10 сентября 21:00 (UTC уже 11-е): 10 сентября показано прошлым и не сохраняется. В положительных смещениях после местной полуночи можно редактировать уже прошедший день до UTC полуночи. Последствие: неправильная доступность/невозможность изменить сегодняшний вечер.

Минимум: local YYYY-MM-DD вместо UTC today (до 1 часа; быстро, но остаётся вопрос profile timezone). Правильно: единый clock/date boundary в выбранной timezone, refresh при переходе суток (2–4 часа; единая семантика, больше проверки). Проверить вручную UTC− и UTC+ возле полуночи.

Дополнительное проявление неправильной UTC-конверсии календарной даты: [components/editor/EditorHeader.tsx:26](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/components/editor/EditorHeader.tsx:26) делает `new Date(selectedDate).toLocaleDateString(...)`. Для selectedDate = '2026-09-10' это UTC midnight, поэтому пользователь Нью-Йорка видит заголовок «9 сентября», хотя редактор меняет 10-е. Использовать имеющийся [shared/utils/time.ts:5-13](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/time.ts:5) parseDateString или форматирование date-only без преобразования в instant. В [CalendarMonth.tsx:78-94](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/components/calendar/CalendarMonth.tsx:78) прошлые и будущие клетки остаются selectable, что также подтверждает достижимость CC04.

Объединённые проявления той же date-only ошибки: [ProjectDetailScreen.tsx:62–67](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/projects/screens/ProjectDetailScreen.tsx:62), [SmartPlannerScreen.tsx:33–49](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:33) и [src/shared/components/DateRangePicker.tsx:141–145](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/components/DateRangePicker.tsx:141) используют new Date для YYYY-MM-DD. Это смена отображаемой календарной даты в UTC−; DateRangePicker сохраняет исходное правильное значение, поэтому ему не приписывается неправильная запись в БД.

Рабочие доказательства и покрытие: [notes-availability-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-availability-client.md).

<a id="cc02"></a>

### CC02 — Medium — Автозагрузка безусловно стирает несохранённые правки

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts:246](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts:246):

```ts
      setAvailability(localData);
```

Код: [hooks/useAvailabilityData.ts:246](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityData.ts:246): `setAvailability(localData)`; [screens/AvailabilityScreen.tsx:92-95](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/screens/AvailabilityScreen.tsx:92) запускает reload при focus независимо от hasChanges. Pull-to-refresh (`Screen:105-110`) тоже делает reload. В error fallback `Data:257-258` предыдущий cached snapshot так же безусловно заменяет state.

Сценарий: изменить занятость, переключить tab и вернуться/потянуть refresh до Save — ответ сервера затирает локальное изменение без подтверждения. hasChanges не сбрасывается при reload, поэтому интерфейс может ещё предлагать сохранить уже потерянные правки. Последствие: незаметная потеря введённых данных.

Минимум: не заменять dirty state при background/focus reload; ручной refresh с предупреждением (2–4 часа; быстро, надо явно показать stale state). Правильно: server baseline отдельно от dirty dates/draft и merge с конфликтами (1–2 дня; сохраняет правки и свежесть, сложнее).

Рабочие доказательства и покрытие: [notes-availability-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-availability-client.md).

<a id="cc03"></a>

### CC03 — Medium — Изменения во время Save помечаются сохранёнными, хотя не попали в запрос

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:197](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:197):

```ts
      const entries = prepareEntriesForAPI(availability, today);
      await availabilityAPI.bulkSet(entries);

      setHasChanges(false);
```

Код: [hooks/useAvailabilitySave.ts:197-200](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:197): entries берутся из переданного snapshot, после HTTP всегда `setHasChanges(false)`. На экране блокируется только Save (`Screen:473-475`); mode controls (`310,331,352`), время и add/remove остаются активны.

Сценарий: нажать Save на медленной сети, затем изменить время/другую дату. Новое изменение не входит в отправленный snapshot, но завершение старого запроса убирает dirty flag и кнопку сохранения. UI показывает новое время как будто сохранённое; после reload оно исчезнет.

Минимум: блокировать редактор до ответа (1–2 часа; просто, ухудшает отзывчивость). Правильно: revision/snapshot acknowledged state, очищать только изменения отправленной ревизии (0.5–1 дня; разрешает параллельную работу, нужен lifecycle тест).

Рабочие доказательства и покрытие: [notes-availability-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-availability-client.md).

<a id="cc04"></a>

### CC04 — Medium — «Удалить прошлые даты» может удалить выбранные будущие дни

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityEditor.ts:220](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityEditor.ts:220):

```ts
  const deletePastDates = async (onComplete: (error?: unknown) => void) => {
    const dates = [...selectedDates];
    if (dates.length === 0) return;

    try {
      await Promise.all(dates.map((date) => availabilityAPI.delete(date)));
```

Код: [hooks/useAvailabilityEditor.ts:39](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilityEditor.ts:39) selectedDate = selectedDates[0]; UI показывает past-delete только по первому элементу (`Screen:274`), а handler копирует и удаляет весь selectedDates (`Editor:220-225`): `Promise.all(dates.map((date) => availabilityAPI.delete(date)))`. Multi-select не ограничен однородностью дат (`Editor:70-72`).

Сценарий: выбрать прошлый день первым, затем будущий; на экране остаётся действие удаления прошлого, запросы DELETE уходят для обоих. После успешного удаления `Editor:237` ещё и безусловно сбрасывает hasChanges, включая несохранённые изменения других будущих дней.

Последствие: удаление актуальной будущей доступности и потеря признака несохранённых правок. При частичной ошибке Promise.all некоторые даты уже удалены, но локально не обновлена ни одна (`225-228`), что дополнительно даёт stale UI; серверные batch-транзакции здесь отсутствуют.

Минимум: фильтровать past dates внутри handler и не очищать общий dirty flag (2–4 часа; локально устраняет опасный путь). Правильно: разделить past/future selection и отслеживать dirty dates; атомарный batch delete либо per-date reconciliation (0.5–1 дня; честный частичный результат, затрагивает API).

Рабочие доказательства и покрытие: [notes-availability-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-availability-client.md).

<a id="cc05"></a>

### CC05 — High — Save отправляет весь старый snapshot и перезаписывает нетронутые дни

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:47](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:47):

```ts
    for (const [date, state] of Object.entries(availability)) {
```

Код: [hooks/useAvailabilitySave.ts:47](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:47) проходит `Object.entries(availability)`, исключает только прошлое (`48`), а затем `197-198` отправляет все entries. Изменённые даты отдельно не учитываются. Offline fallback берёт общий cache (`Data:257-258`), UI `Screen:161-165` показывает баннер, но не запрещает редактирование/Save. Сервер заменяет manual записи затронутых дней: [server/routes/native/availability.js:95–117](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:95).

Сценарий: A загружает дни X/Y. B меняет Y на другом устройстве. A меняет только X и Save — stale Y тоже приходит в bulk и заменяет свежую правку B. Более вероятно после offline fallback: сеть возвращается, пользователь сохраняет единственный изменённый день, вместе с ним уходит весь старый кеш.

Последствие: незаметная потеря актуальных отметок и ошибочная занятость в планировщике. Это отдельный сценарий от серверной C03 (два concurrent insert в пустой день): здесь последовательные сохранения старого snapshot.

Минимум: хранить dirtyDates и отправлять только их; после offline load требовать обновление перед replace (3–6 часов; уменьшает ущерб, одновременная правка одного дня остаётся). Правильно: version/ETag на день и conditional replace с разрешением конфликтов (1–2 дня; закрывает lost updates, затрагивает сервер).

Рабочие доказательства и покрытие: [notes-availability-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-availability-client.md).

<a id="cc06"></a>

### CC06 — Medium — Ветка сохранения через полночь недостижима из Save

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/availability/utils/validationUtils.ts:17](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/utils/validationUtils.ts:17):

```ts
  if (startMinutes >= endMinutes) {
    return {
      isValid: false,
      error: 'endBeforeStart'
    };
```

Код: [hooks/useAvailabilitySave.ts:70-88](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/hooks/useAvailabilitySave.ts:70) обещает midnight crossing: `const endsNextDay = endMinutes <= startMinutes`, затем переносит endDate на следующий день. Но `saveAvailability:186-191` сначала вызывает validateAvailability; тот вызывает validateSlot (`124`) из [utils/validationUtils.ts:17-21](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/availability/utils/validationUtils.ts:17), где `startMinutes >= endMinutes` всегда запрещён. Любой слот, для которого нужна overnight-ветка, отбрасывается до сериализации.

Сценарий: пользователь ставит занятость 23:00–01:00 через time picker (Screen:515-520 не ограничивает end относительно start) и нажимает Save. Получает ошибку endBeforeStart вместо сохранения двухчасовой ночной занятости; UI и сериализатор расходятся. Это не ошибка самих Date calculations: ветка вообще не вызывается из пользовательского save flow.

Минимум: явно ограничить UX одним календарным днём и дать разбиение на два дня/понятный текст, убрать обещание overnight (2–4 часа; минимальный риск, менее удобно). Правильно: единое представление start/end с датами, разрешить overnight с корректной проверкой длительности и пересечений на обоих днях (0.5–1 дня; выполняет заявленное поведение, требует согласования границ bulk delete). Не достаточно просто убрать validateSlot: slotsOverlap тоже рассчитан на часы одного дня.

Рабочие доказательства и покрытие: [notes-availability-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-availability-client.md).

<a id="d01"></a>

### D01 — High — администратор проекта пишет занятость произвольным пользователям

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:404](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:404):

```js
    for (const participantId of participant_ids) {
      await db.run(
        'INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
        [newRehearsal.id, participantId, 'no']
      );
    }
```

Решающая цитата [server/services/rehearsals/rehearsalService.js:404–409](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:404):

```js
for (const participantId of participant_ids) {
  await db.run(
    'INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
    [newRehearsal.id, participantId, 'no']
  );
}
```

[rehearsalService.js:402-408](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:402) вставляет каждый participant_ids в native_rehearsal_responses, не сверяя с active members проекта. PUT :517-541 лишь Number/Integer фильтр, также без membership. [slotService.js:29-49](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/slotService.js:29) берёт все response rows и записывает busy availability этим user_id. Админ своего нового проекта передаёт ID постороннего существующего пользователя: у того появляется read-only 'rehearsal' busy slot; уведомления create/update тоже получают эти rows ([routes/native/rehearsals.js:107-117](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/rehearsals.js:107)). Это произвольная запись в чужой личный график и нежелательные push; чтение чужих проектов этим не предоставляется. Минимум: перед любыми изменениями проверить массив уникальных положительных IDs и полное включение в active project members, отказать 400/403 при лишних (3–6 ч). Правильно: transactional roster service с membership lock/constraint и тем же guard при каждом формировании получателей (1–2 дня). Ручная проверка двух несвязанных аккаунтов, без вызова production.

Минимум — плюс: закрывает прямой произвольный participant_ids до первого write; минус: отдельная проверка без lock оставляет гонку удаления membership между проверкой и записью, guard нужно повторить в create/update. Правильное решение — плюс: membership, roster и downstream recipients имеют общий проверяемый контракт, в том числе при конкуренции; минус: потребуются передача transaction в helpers, согласование remove-member и тесты конкурентных изменений. Усилия указаны выше, исправление source не выполнялось.

Рабочие доказательства и покрытие: [notes-rehearsals-server.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-server.md).

<a id="d02"></a>

### D02 — High — не приглашённый участник сам получает доступ через RSVP

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/native/rehearsals.js:260](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/rehearsals.js:260):

```js
    const membership = await checkUserMembership(rehearsal.project_id, userId);

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await respondToRehearsal(rehearsalId, userId, response, notes, rehearsal.project_id);
```

Route ограничивается membership проекта ([server/routes/native/rehearsals.js:260–266](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/rehearsals.js:260)):

```js
const membership = await checkUserMembership(rehearsal.project_id, userId);

if (!membership) {
  return res.status(403).json({ error: 'Access denied' });
}

const stats = await respondToRehearsal(rehearsalId, userId, response, notes, rehearsal.project_id);
```

Service создаёт отсутствующее приглашение ([server/services/rehearsals/rsvpService.js:19–23](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rsvpService.js:19)):

```js
`INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
 VALUES ($1, $2, $3, $4)
 ON CONFLICT (rehearsal_id, user_id)
 DO UPDATE SET response = $3, notes = $4, updated_at = NOW()`,
[rehearsalId, userId, response, notes]
```

[routes/native/rehearsals.js:252-266](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/rehearsals.js:252) проверяет только membership проекта. [rsvpService.js:16-24](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rsvpService.js:16) делает INSERT..ON CONFLICT, даже если invitation row отсутствует; затем ensureRehearsalSlot. В то же время [rehearsalService.js:294-299](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:294) допускает обычного участника к GET-by-id только при наличии этой самой response row. Зная/угадав rehearsalId в своём проекте, member вызывает respond yes/no и превращает скрытую репетицию в доступную, получает дальнейшие изменения. GET responses (`routes:312-321`) также выдаёт roster/notes любого rehearsal проекта без invitation guard. Минимум: regular member допускается к respond/responses только если уже приглашён; admin-only auto-enrol явно отделить (2–4 ч). Правильно: единая canViewRehearsal/canRespond и UPDATE существующего invitation вместо общего upsert; тест non-invited member (1 день). Чужое project membership не обходится, важна горизонтальная граница внутри проекта.

Минимум — плюс: закрывает обе доступные regular-member ветки с небольшим изменением; минус: дублированные policy guards могут снова разойтись, admin auto-enrol требует явного исключения. Правильное решение — плюс: наличие invitation перестаёт создаваться действием, которое использует его как условие доступа; минус: нужно согласовать self-enrol администратора и consumers responses с новым service контрактом. Усилия указаны выше.

Рабочие доказательства и покрытие: [notes-rehearsals-server.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-server.md).

<a id="d03"></a>

### D03 — High — жизненный цикл репетиции фиксируется частями

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:384](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:384):

```js
  const newRehearsal = await db.get(
    `INSERT INTO native_rehearsals (project_id, title, description, starts_at, ends_at, location, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, NOW(), NOW())
     RETURNING *`,
```

Первый самостоятельный write при создании ([server/services/rehearsals/rehearsalService.js:384–387](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:384)) уже фиксирует rehearsal до приглашений и busy slots:

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

[rehearsalService.js:384-422](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:384) INSERT rehearsal → N invitation INSERT → N busy INSERT без общей transaction. Payload [validUser,validUser] создаёт rehearsal + первый response, второй падает по UNIQUE; ответ500, объект уже существует, busy slots ещё нет; повтор UI создаёт дубль. PUT :482-551 сначала сохраняет время, удаляет reminders/меняет roster, затем только slot rebuild имеет собственную transaction (`slotService:72-75`). Ошибка rebuild оставляет новое время rehearsal со старыми busy hours; ошибка malformed participant_ids.map происходит уже после UPDATE. DELETE :574-584 тоже три операции без transaction. Минимум: предварительная полная validation и db.transaction на весь create/update/delete с передачей tx в helpers (0.5–1 день). Правильно: транзакционный aggregate и idempotency key, version для concurrent edit, уведомления через outbox после commit (2–3 дня). Текущая локальная transaction updateSlots предотвращает частичную пересборку только её таблицы, не consistency с rehearsal/roster.

Минимум — плюс: rollback связывает rehearsal, roster, claims и busy slots при обычной SQL/validation ошибке; минус: требуется реально передать один tx во все helpers, а повтор запроса после потерянного success-response всё ещё может дублировать create. Правильное решение — плюс: согласует атомарность данных, повторные запросы, конкурирующее редактирование и post-commit уведомления; минус: idempotency/version/outbox требуют схемы, хранения состояния попыток и отдельного delivery worker/процесса. Усилия указаны выше.

Рабочие доказательства и покрытие: [notes-rehearsals-server.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-server.md).

<a id="d04"></a>

### D04 — Medium — администратор не может открыть редактирование репетиции, в которую не приглашён

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:142](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:142):

```ts
        const rehearsalResponse = await rehearsalsAPI.getBatch([String(projectId)]);
        const rehearsals = rehearsalResponse.data.rehearsals || [];
        const rehearsal = rehearsals.find((r: any) => r.id === rehearsalId);

        if (!rehearsal) {
          Alert.alert('Error', 'Rehearsal not found');
          navigation.goBack();
          return;
```

Решающая цитата [src/features/calendar/hooks/useAddRehearsalForm.ts:142–149](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:142):

```ts
const rehearsalResponse = await rehearsalsAPI.getBatch([String(projectId)]);
const rehearsals = rehearsalResponse.data.rehearsals || [];
const rehearsal = rehearsals.find((r: any) => r.id === rehearsalId);

if (!rehearsal) {
  Alert.alert('Error', 'Rehearsal not found');
  navigation.goBack();
  return;
```

[src/features/calendar/hooks/useAddRehearsalForm.ts:142-149](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:142): `await rehearsalsAPI.getBatch([String(projectId)])`, затем `rehearsals.find(...)`, иначе `Alert.alert('Error', 'Rehearsal not found'); navigation.goBack()`. Batch намеренно personal: [rehearsalService.js:79](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:79) делает `INNER JOIN native_rehearsal_responses ur ON r.id = ur.rehearsal_id AND ur.user_id = ?` для всех ролей. Project list (:196-205) и GET by ID (:289-299) допускают администратору все репетиции проекта. Сценарий: администратор создаёт репетицию только для актёров, затем в ProjectDetail нажимает редактировать — форма не находит объект. Изменить время/место через штатную форму нельзя. Минимум: в editor использовать существующий getById, сохранив permission guard (1–2 ч; плюс локально, минус остаются отдельные запросы roster). Правильно: endpoint получения целого edit draft с едиными правами и атомарным client loading state (0.5–1 день; плюс согласованный контракт, минус расширение API). Проверить manual admin-not-invited edit и обычного member.

Рабочие доказательства и покрытие: [notes-rehearsals-server.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-server.md).

<a id="df01"></a>

### DF01 — Medium — редактирование сдвигает время при разных timezone профиля и устройства

**Статус:** условный; требуемые условия ниже.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:153](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:153):

```ts
        const startsAt = new Date(rehearsal.startsAt);
        const endsAt = new Date(rehearsal.endsAt);

        setDate(startsAt);
        setStartTime(startsAt);
        setEndTime(endsAt);
```

Категория: даты / целостность данных. Условие: timezone профиля отличается от timezone устройства; автоматический Auth sync обычно их выравнивает. Это не ошибка каждого редактирования.

Цитата [src/features/calendar/hooks/useAddRehearsalForm.ts:153-158](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:153): `const startsAt = new Date(rehearsal.startsAt); ... setDate(startsAt); setStartTime(startsAt); setEndTime(endsAt);`. Экран показывает время через `formatDateToTimeString(form.startTime)` ([AddRehearsalScreen.tsx:220](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/AddRehearsalScreen.tsx:220),232), а этот helper читает device-local `date.getHours()` ([src/shared/utils/time.ts:54-57](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/time.ts:54)). Обратная запись в [useAddRehearsalSubmit.ts:51-65](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalSubmit.ts:51) использует `userTimezone = user?.timezone || 'UTC'` и `dateTimeToISOInTimezone(dateString, startTimeString, userTimezone)`.

Сценарий: timezone устройства UTC, профиля Europe/Moscow. Сервер хранит начало `2026-01-20T15:00:00Z` (18:00 Москвы). Форма редактирования показывает 15:00; пользователь меняет только название. Save интерпретирует 15:00 как Moscow и отправляет `12:00Z`. Репетиция незаметно сдвигается на 3 часа. Для перехода суток может измениться и календарная дата. [time.ts:177-191](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/time.ts:177) подтверждает, что параметр timezone применяется к указанным локальным часам.

Минимальная правка: при заполнении edit преобразовать timestamps в дату и часы user.timezone теми же `isoToDateStringInTimezone/isoToTimeStringInTimezone`, которые применяет [useRehearsals.ts:29-34](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useRehearsals.ts:29). Плюс — небольшой единообразный fix; минус — Date в роли «часов» продолжает быть неоднозначным. Правильное решение: хранить draft как YYYY-MM-DD и HH:mm с явным timezone, создавать Date только для picker, timestamps формировать в одной точке. Плюс — устраняет расхождение чтения и записи; минус — затрагивает handlers и picker adapter. Трудоёмкость: минимум 3–5 часов; правильно 1–2 дня.

Ручная проверка после разрешения запуска: загрузить и сохранить без изменения времени при нескольких парах device/profile timezone; исходные startsAt/endsAt должны сохраняться.

Условие уточнено в H: [ProfileScreen.tsx:92–97](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:92) позволяет вручную выбрать зону, отличную от device timezone, пока очередное восстановление Auth не вернуло device zone ([AuthContext.tsx:166–191](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:166); HP04). Разные зоны достижимы этим UI; конкретные platform/DST варианты запуска не проверены.

Рабочие доказательства и покрытие: [notes-rehearsals-forms.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-forms.md).

<a id="df02"></a>

### DF02 — Medium — невозможно удалить всех участников при редактировании

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalSubmit.ts:70](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalSubmit.ts:70):

```ts
        participant_ids: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
```

Категория: контракт API / целостность состава участников.

Цитата [src/features/calendar/hooks/useAddRehearsalSubmit.ts:70](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalSubmit.ts:70): `participant_ids: selectedMemberIds.length > 0 ? selectedMemberIds : undefined`. Этот объект отправляется и при PUT (`:76-81`). Проверяющий сервер подтвердил контракт: PUT с отсутствующим participant_ids сохраняет прежний roster, а переданный `[]` очищает его. Сервер сохраняет roster при отсутствии поля и очищает его при []: [server/services/rehearsals/rehearsalService.js:517–541](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:517).

Сценарий: открыть репетицию с приглашёнными, снять все флажки и сохранить. JSON не содержит participant_ids, сервер оставляет приглашённых. Экран сообщает успех, однако люди продолжают считаться участниками и видеть репетицию.

Минимум: для edit всегда отправлять selectedMemberIds, включая пустой массив. Плюс — локальный fix; минус — различное поведение create/update остаётся неявным. Правильно: формализовать DTO и семантику «поле отсутствует»/«пустой список», передавать явный массив roster и проверять сохранённый результат. Плюс — предотвращает неоднозначность контрактов; минус — синхронизация client/server tests. Трудоёмкость: минимум 1–2 часа; правильно 0.5–1 день.

Не путать с create: сервер сообщил, что POST без participant_ids не создаёт RSVP, а не приглашает всех. Поэтому этот конкретный finding относится к edit.

Рабочие доказательства и покрытие: [notes-rehearsals-forms.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-forms.md).

<a id="df03"></a>

### DF03 — Medium — после ошибки загрузки edit доступны сохранение и перезапись неполных данных

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:137](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:137):

```ts
      setLoadingRehearsal(true);
      setIsEditMode(true);
```

Категория: обработка ошибок / целостность данных.

Цитата [src/features/calendar/hooks/useAddRehearsalForm.ts:137-138](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:137): `setLoadingRehearsal(true); setIsEditMode(true);`; catch/finally `:178-182`: `Alert.alert('Error', 'Failed to load rehearsal data'); ... setLoadingRehearsal(false);`. Нет состояния loadError, закрытия формы либо блокировки submit. В [AddRehearsalScreen.tsx:261](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/AddRehearsalScreen.tsx:261) disabled равен только `loading || form.loadingRehearsal`.

Сценарий 1: getBatch временно не отвечает. Форма остаётся в editMode с текущими датой/часами и пустыми полями по умолчанию. Пользователь после предупреждения нажимает «Обновить», PUT уходит с исходным rehearsalId, новыми default timestamp и пустыми полями. Серверная реализация подтверждает, что отсутствующие title/location в PUT превращаются в null, поэтому исходные значения теряются. Сценарий 2: основная запись загрузилась, а getResponses/getMembers падает: поля заполнены частично, состав участников ещё не восстановлен, но сохранение разблокировано.

Минимум: отдельный loadError/loadedSuccessfully и запрет submit до успешного завершения всех запросов, retry либо закрытие формы при ошибке. Плюс — локальный безопасный барьер; минус — больше состояний UI. Правильно: атомарно собирать draft из результата полного запроса, публиковать его в форму только при success; явная state machine loading/ready/error и отдельный retry. Плюс — исключает сохранение частичного draft; минус — рефактор загрузки. Трудоёмкость: минимум 2–4 часа; правильно 1 день.

Тест edit ([useAddRehearsalForm.test.ts:127-217](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/__tests__/useAddRehearsalForm.test.ts:127)) проверяет success и пустой список, но не сетевой failure с дальнейшим нажатием Save. После полного добора остальных тел этой suite такой проверки также не найдено.

Рабочие доказательства и покрытие: [notes-rehearsals-forms.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-forms.md).

<a id="df04"></a>

### DF04 — Medium — ночная репетиция проходит проверку, но конец сериализуется на день начала

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:67](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:67):

```ts
  const [endTime, setEndTime] = useState(() => {
    const start = setMinutesToZero(new Date());
    const end = new Date(start);
    end.setHours(end.getHours() + 2);
    return end;
```

Категория: границы дат / валидация.

Цитата [src/features/calendar/hooks/useAddRehearsalForm.ts:67-71](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:67): `const end = new Date(start); end.setHours(end.getHours() + 2);`, та же логика при смене начала `:213-220`. Проверка [useAddRehearsalSubmit.ts:172](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalSubmit.ts:172) сравнивает полные Date: `if (endTime <= startTime)`. Но `:64-65` формирует обе границы с одним `dateString`: `startsAt: dateTimeToISOInTimezone(dateString, startTimeString, userTimezone), endsAt: dateTimeToISOInTimezone(dateString, endTimeString, userTimezone)`.

Сценарий: открыть форму в 23:00 или сдвинуть начало на 23:00, автоматический конец — 01:00 следующего дня. Проверка проходит, поскольку Date конца действительно больше начала. Сериализация отбрасывает дату endTime и отправляет конец 01:00 дня начала, то есть до начала. Возможное проявление — отказ серверной валидации, несмотря на корректно выглядящую форму; если сервер пропускает отрицательную длительность, повреждённый интервал. Само неверное payload подтверждено статически; PostgreSQL CHECK ends_at > starts_at отклоняет такой payload, а route возвращает 500; [server/database/init-native-schema.sql:137](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/init-native-schema.sql:137), [server/routes/native/rehearsals.js:190–193](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/rehearsals.js:190).

То же представление не умеет сохранить корректный multi-day/24h интервал при edit: форма имеет лишь одну дату. Отдельного UI all-day здесь нет, поэтому не утверждается поломка существующего all-day toggle.

F подтвердил CHECK ends_at>starts_at в [init-native-schema.sql:137](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/init-native-schema.sql:137) и [migrate-rehearsals-to-timestamptz.sql:37-39](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/migrations/migrate-rehearsals-to-timestamptz.sql:37). Rehearsal routes:125-128,190-193 не классифицируют constraint failure как400 и возвращают500. При действующей проверенной схеме это отказ записи, а не сохранение отрицательного интервала.

Минимум: валидировать уже сформированные timestamps и явно запрещать переход суток с понятной ошибкой либо переносить endDate на следующий день при поддержке ночных репетиций. Плюс — предотвращает неверный запрос; минус — запрет ограничит сценарий. Правильно: отдельные start/end date-time с общей timezone и явной поддержкой overnight; conflict-check тоже должен учитывать день. Плюс — корректны длинные интервалы; минус — более широкая форма. Трудоёмкость: минимум 2–4 часа; правильно 1–2 дня.

Рабочие доказательства и покрытие: [notes-rehearsals-forms.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-forms.md).

<a id="df05"></a>

### DF05 — Medium — поздние ответы и незавершённая загрузка дают неверный состав/проверку конфликтов

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/hooks/useRehearsalAvailability.ts:53](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useRehearsalAvailability.ts:53):

```ts
        const response = await projectsAPI.getMembersAvailability(
          project.id,
          dateStr,
          selectedMemberIds,
          excludeRehearsalId
        );
```

Категория: гонки запросов / бизнес-логика.

Цитаты [src/features/calendar/hooks/useRehearsalAvailability.ts:53-58](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useRehearsalAvailability.ts:53),77: await getMembersAvailability для captured project/date/ids, затем безусловный `setMemberAvailability(availabilityMap)`; effect `:92-93` не отменяет запрос и не проверяет актуальность. Аналогично [useRehearsalMembers.ts:25-26](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useRehearsalMembers.ts:25) — `await projectsAPI.getMembers(project.id); setMembers(response.data.members || [])`, без cleanup/guard, а catch `:27-29` сохраняет предыдущий список. Начало новых загрузок не очищает старые результаты. [AddRehearsalScreen.tsx:261](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/AddRehearsalScreen.tsx:261) не учитывает loadingAvailability/loadingMembers при разрешении save.

Сценарий доступности: для даты A участник свободен, запрос A задержался. Пользователь переключается на B, запрос B возвращает busy, затем приходит ответ A и перезаписывает карту. Форма уже показывает B, но проверка конфликтов использует данные A и может сохранить репетицию без предупреждения. Даже без out-of-order достаточно нажать Save после смены даты до завершения запроса: старые timeRanges продолжают использоваться. При сетевой ошибке карта сбрасывается в `{}` ([useRehearsalAvailability.ts:85-86](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useRehearsalAvailability.ts:85)), а [src/shared/utils/conflictDetection.ts:49-51](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/conflictDetection.ts:49) пропускает участника без данных как не имеющего конфликтов.

Сценарий состава: быстро сменить P на Q; более поздний ответ P перезаписывает members под Q, и auto-select из [AddRehearsalScreen.tsx:80-88](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/AddRehearsalScreen.tsx:80) может выбрать id из P для Q. Это усиливает серверную проблему отсутствия проверки membership participant_ids, отмеченную при сверке исходников D01; само нарушение прав не приписывается клиентскому hook.

Минимум: номер поколения запроса/cleanup guard, очистка результатов при смене ключа, блокировать submit до актуальных members/availability либо показывать явное «проверка не завершена». Плюс — небольшой набор правок; минус — lifecycle вручную в двух hooks. Правильно: query-key = projectId/date/sorted memberIds/excludeRehearsalId, отмена/игнорирование старых ответов, явные состояния unknown/error/loaded; проверка conflict только для matching key. Плюс — единая корректная модель; минус — шире затрагивает data hooks. Трудоёмкость: минимум 0.5–1 день; правильно 1–2 дня.

Рабочие доказательства и покрытие: [notes-rehearsals-forms.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-forms.md).

<a id="df06"></a>

### DF06 — Medium — поздний ответ старого фильтра заменяет репетиции выбранного проекта

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx:112](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx:112):

```tsx
  // Refetch when filter changes (force refresh to bypass cache)
  React.useEffect(() => {
    fetchRehearsals(true);
  }, [filterProjectId, fetchRehearsals]);
```

Категория: гонка запросов / несоответствие фильтра данным. Стык подтверждён проверяющим display: [src/features/calendar/screens/CalendarScreen.tsx:112-115](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx:112) вызывает принудительный fetch при изменении фильтра, поэтому подозрение на пропуск нового запроса из-за 15-секундного TTL исключено. Однако [src/features/calendar/hooks/useRehearsals.ts:157-158](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useRehearsals.ts:157) без проверки актуальности выполняет `setRehearsals(fetchedRehearsals); prime(responses, stats);`. Дополнительный display-фильтр [CalendarScreen.tsx:185](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx:185) проверяет только date и не отбрасывает данные прежнего проекта. Экран и hook проверены совместно в D.

Сценарий: запрос «Все проекты» ещё идёт; пользователь выбирает P. Новый принудительный запрос P заканчивается первым и показывает правильные записи. Затем завершается старый запрос и заменяет массив данными всех проектов. На экране остаётся выбранный P, но отображаются чужие для этого фильтра записи; данные RSVP также prime-ятся из старого ответа. Серверное разграничение доступа это не обходит, но пользователь может принять решение по расписанию другого проекта.

Минимум: идентификатор поколения/ключ запроса и игнорирование ответа, не соответствующего текущему фильтру/projects/userTimezone; UI дополнительно фильтрует по projectId. Плюс — локальное устранение гонки; минус — управление запросами вручную. Правильно: query-cache по полному ключу с отменой/инвалидацией устаревших запросов. Плюс — единая модель кеша и загрузки; минус — более широкое изменение data hooks. Трудоёмкость: 3–5 часов / 1 день.

Рабочие доказательства и покрытие: [notes-rehearsals-forms.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-forms.md).

<a id="dd01"></a>

### DD01 — Medium — Details ведёт вторую копию RSVP и расходится с SeenContext

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/screens/RehearsalDetailsScreen.tsx:104](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/RehearsalDetailsScreen.tsx:104):

```tsx
        if (res.data.allParticipants) {
          const participantsList = res.data.allParticipants.map((p: any) => ({
            userId: p.userId,
            firstName: p.firstName,
            lastName: p.lastName,
            hasSeen: p.response === 'yes',
            hasResponded: p.response === 'yes', // 'no' means invited but not responded (same UI as not responded)
          }));
```

**Код:** [src/features/calendar/screens/RehearsalDetailsScreen.tsx:104-117](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/RehearsalDetailsScreen.tsx:104) кладёт getResponses только в local participants/stats, не вызывает `SeenContext.prime`. Затем `143-149`:

```ts
setParticipants(prev => prev.map(p =>
  p.userId === participant.userId
    ? { ...p, hasSeen: !wasSeen, hasResponded: true }
    : p
));
await toggleSeen(rehearsal!.id);
```

В [src/contexts/SeenContext.tsx:62-68](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/SeenContext.tsx:62) toggle вычисляется из **другой** копии: `const current = responses[rehearsalId] ?? null`. При ошибке context откатывает только свой responses и проглатывает исключение (`78-84`). Details после await читает `statsFor` из closure прежнего render (`Details:152-153`), не подписывает local stats на обновлённые context stats.

**Сценарии:** (1) Открыть details по id из notification, когда rehearsal ещё не primed календарным списком. GET responses возвращает собственный yes, пользователь пытается снять отметку. Details рисует false, context видит null и отправляет yes — сервер оставляет yes. (2) Находясь в details переключить статус без сети: global card state откатится, local строка останется оптимистически изменённой после alert. (3) После успешного переключения badge details может сохранить прежний счётчик, поскольку statsFor захватил старое context значение.

**Последствие:** отметка «просмотрено»/число подтвердивших отличаются между деталями, карточкой и сервером; действие пользователя может фактически не выполниться.

**Минимум:** prime собственный response/stats из getResponses; возвращать success/result из toggleSeen и откатывать local participants при failure, использовать возвращённые stats (3–6 часов; локально устраняет симптомы, остаются две копии state). **Правильно:** participants identities отдельным state, собственный response и агрегаты derive из одного SeenContext; явный `setResponse(id,value)` вместо toggle по непроверенному кешу (0.5–1 дня; единый источник и предсказуемый id-only flow, надо проверить карточку/details/notification).

Рабочие доказательства и покрытие: [notes-rehearsals-display.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-display.md).

<a id="dd02"></a>

### DD02 — Medium — Репетиция через полночь отсутствует в календаре второго дня

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx:183](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx:183):

```tsx
  const selectedDateRehearsals = useMemo(() => {
    return rehearsals
      .filter(r => r.date === selectedDate)
```

**Код:** [src/features/calendar/screens/CalendarScreen.tsx:183-185](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx:183):

```ts
return rehearsals.filter(r => r.date === selectedDate)
```

[src/features/calendar/components/WeeklyCalendar.tsx:58-60](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/components/WeeklyCalendar.tsx:58) считает событие только по `r.date`; ни selected list, ни count не используют startsAt/endsAt. [RehearsalDetailsScreen.tsx:232-234](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/RehearsalDetailsScreen.tsx:232),272-273 и [RehearsalCard.tsx:78-79](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/components/RehearsalCard.tsx:78) показывают единственную дату плюс start/end HH:mm, без end date.

**Сценарий:** серверная запись 10 сентября 23:00 — 11 сентября 01:00 появляется только под 10 сентября; выбор 11 сентября показывает «нет репетиций» и нулевой badge, хотя репетиция идёт до 01:00. Более длинный интервал скрывает все дни после первого. Даже в карточке «23:00 — 01:00» не сообщает, к какой дате относится конец. Сверка схемы и service подтверждает: server legacy date = дата начала; create/update допускают startsAt/endsAt разных календарных дней (JS ограничения на same-day нет). Это достижимый серверный интервал, а не выдуманный неподдерживаемый формат.

**Последствие:** пользователь пропускает продолжающуюся репетицию/неверно считает день свободным. **Минимум:** включать событие в каждую пересекаемую календарную дату и показывать end date, когда она отличается (3–6 часов; исправляет отображение, необходима единая timezone). **Правильно:** отображать интервал startsAt/endsAt через общую timezone-aware модель, отдельно all-day date ranges, использовать её в strip/list/details (1–2 дня; единая семантика и DST/all-day, больше тестовых сценариев).

Рабочие доказательства и покрытие: [notes-rehearsals-display.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-display.md).

<a id="dd03"></a>

### DD03 — Low — Кнопка «Сегодня» не выбирает сегодняшний день

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/components/WeeklyCalendar.tsx:133](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/components/WeeklyCalendar.tsx:133):

```tsx
  const handleGoToToday = useCallback(() => {
    hapticMedium();
    flatListRef.current?.scrollToIndex({
      index: CENTER_INDEX,
      animated: true,
    });
    setCurrentWeekIndex(CENTER_INDEX);
  }, []);
```

**Код:** [src/features/calendar/components/WeeklyCalendar.tsx:133-140](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/components/WeeklyCalendar.tsx:133) handleGoToToday вызывает только `scrollToIndex({index:CENTER_INDEX})` и setCurrentWeekIndex; onDaySelect(today) отсутствует. Выбранная дата хранится в CalendarScreen:27 и меняется через onDaySelect только нажатиями клеток (`WeeklyCalendar:157-159`).

**Сценарий:** выбрать старую дату, пролистать недели и нажать «Сегодня». Видимая неделя вернётся к текущей, но список ниже и selectedDate останутся для старого дня вне экрана.

**Последствие:** кнопка создаёт впечатление перехода к сегодняшним репетициям, но показывает иной день. **Минимум:** onDaySelect(formatDateToString(new Date())) в handler (до 1 часа; просто). **Правильно:** единая операция select-and-scroll для внешнего выбора даты/перехода к today, с актуализацией clock при смене суток (2–4 часа; покрывает разные входы, немного шире change).

Рабочие доказательства и покрытие: [notes-rehearsals-display.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-rehearsals-display.md).

<a id="dp01"></a>

### DP01 — Medium — смена проекта закрепляет старые ID участников за новым проектом

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:144](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:144):

```tsx
  useEffect(() => {
    if (hasInitializedMembers.current === projectId) return;

    if (simpleMembers.length === 0) {
      setSelectedMemberIds([]);
      return;
    }

```

Места: [src/features/smart-planner/screens/SmartPlannerScreen.tsx:144–154](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:144), [src/features/smart-planner/hooks/useSmartPlanner.ts:48–52](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/hooks/useSmartPlanner.ts:48), [src/features/smart-planner/utils/slotGenerator.ts:112–115](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/utils/slotGenerator.ts:112).

Цитаты:

```tsx
// useSmartPlanner.ts:48–52
useEffect(() => {
  setProject(null);
  setMembers([]);
  setMemberAvailability([]);
}, [projectId]);

// SmartPlannerScreen.tsx:144–154
useEffect(() => {
  if (hasInitializedMembers.current === projectId) return;
  if (simpleMembers.length === 0) {
    setSelectedMemberIds([]);
    return;
  }
  setSelectedMemberIds(simpleMembers.map(m => m.id));
  hasInitializedMembers.current = projectId;
}, [simpleMembers, projectId]);
```

Сценарий: проект A уже загружен. Выбрать B через `navigation.setParams` (:158), без размонтирования экрана. Рендер B ещё содержит simpleMembers=A. В его effects hook только планирует очищение state, но эффект экрана работает с snapshot того же рендера, видит A и записывает `hasInitializedMembers.current=B` вместе с ID из A. На следующем рендере с пустым составом, затем с участниками B, ранний return запрещает переинициализацию. Это детерминированная последовательность state/effect, а не предположение о скорости HTTP.

Проявление: счётчик/галочки относятся к старому составу. При непересекающихся составах `relevantMembers=[]`; генератор возвращает perfect с `totalMembers=0`, а SlotItem:48 скрывает кнопку создания (0<0=false). При частичном пересечении рекомендации учитывают только общих участников и могут назвать окно свободным, игнорируя занятых людей B. Риск сохраняется и после успешного ответа сети.

Расхождение с заявленным: комментарий SmartPlannerScreen:136–143 обещает переинициализацию «once per project» и очистку ID в ожидании нового состава; фактический effect фиксирует новый projectId с предыдущими данными.

Минимум (1–2 ч): очищать выбор/маркер синхронно при переключении проекта и разрешать инициализацию лишь после загрузки состава, достоверно принадлежащего текущему projectId. Один `setSelectedMemberIds([])` в handleSelectProject недостаточен, если текущий effect снова читает старый состав. Плюс: локальное изменение; минус: нужно учитывать также вход/смену route извне.

Правильно (0.5–1 день): хранить данные и selection с ключом projectId; возвращать hook данные только для текущего ключа либо перемонтировать subtree с `key=projectId`; пересекать выбранные ID с актуальным составом. Добавить интеграционные проверки A→B, частичного/нулевого пересечения, удаления участника, медленных ответов. Плюс: единая гарантия принадлежности; минус: небольшое изменение модели состояния.

Рабочие доказательства и покрытие: [notes-smart-planner.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-smart-planner.md).

<a id="dp02"></a>

### DP02 — Medium — выбранный в planner состав не переносится в создание репетиции

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:394](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:394):

```tsx
                onCreateRehearsal={(slot) => {
                  // Navigate directly to AddRehearsal (now at AppStack level)
                  // @ts-ignore - Navigate to parent app navigator
                  navigation.navigate('AddRehearsal', {
                    projectId,
                    prefilledDate: slot.date,
                    prefilledTime: slot.startTime,
                    prefilledEndTime: slot.endTime,
```

Место: [src/features/smart-planner/screens/SmartPlannerScreen.tsx:394–402](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:394). Стык подтверждён при сверке исходников: форма AddRehearsal инициализирует выбор всеми участниками ([src/features/calendar/screens/AddRehearsalScreen.tsx:80–88](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/AddRehearsalScreen.tsx:80); строка :86 — `form.setSelectedMemberIds(members.map(m => m.userId))`, дополнительно сверена адресным поиском в этом проходе).

Цитата:

```tsx
navigation.navigate('AddRehearsal', {
  projectId,
  prefilledDate: slot.date,
  prefilledTime: slot.startTime,
  prefilledEndTime: slot.endTime,
});
```

Сценарий: организатор выбирает только двух актёров из десяти; окно perfect рассчитано только для них ([useSmartPlanner.ts:158–173](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/hooks/useSmartPlanner.ts:158) и [slotGenerator.ts:112–115](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/utils/slotGenerator.ts:112)). Нажатие «+» открывает форму с десятью участниками. Информация о целевом составе не передана вообще. В том числе скрытые занятые участники добавляются в новый состав.

Проявление: пользователь повторно отбирает участников или создаёт репетицию с лишними приглашёнными; проверка конфликтов в форме может предупредить, но не восстанавливает выбранный состав и не отменяет дефект передачи намерения.

Минимум (1–3 ч): добавить `prefilledMemberIds` в параметры маршрута и передавать эффективный состав (при [] — текущий полный состав); форме использовать его после загрузки участников. Плюс: малый объём; минус: надо корректно отличать отсутствующий prefill от пустого выбора.

Правильно (0.5–1 день): передавать typed planner draft с датой/временем/составом и сверять состав с актуальными правами/участниками при инициализации формы. Добавить end-to-end сценарий «2 из 10 → создать». Плюс: сохраняется целостное намерение; минус: затрагивает контракт навигации и два feature.

Рабочие доказательства и покрытие: [notes-smart-planner.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-smart-planner.md).

<a id="dp04"></a>

### DP04 — Low — предложение на сегодня не устаревает вместе с часами

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/smart-planner/hooks/useSmartPlanner.ts:153](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/hooks/useSmartPlanner.ts:153):

```ts
  const allSlots: TimeSlot[] = useMemo(() => {
    if (!startDate || !endDate || simpleMembers.length === 0) {
      return [];
    }

    // If no members selected, use all members
    const memberIds = selectedMemberIds.length > 0
      ? selectedMemberIds
```

Места: [src/features/smart-planner/hooks/useSmartPlanner.ts:153–180](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/hooks/useSmartPlanner.ts:153), [src/features/smart-planner/utils/slotGenerator.ts:215–223](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/utils/slotGenerator.ts:215), [src/features/smart-planner/screens/SmartPlannerScreen.tsx:122–132](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx:122),394–402.

Цитата:

```tsx
// useSmartPlanner.ts:168–180
const slots = generateTimeSlots(startDate, endDate, simpleMembers, mergedAvailability, memberIds);
return slots;
}, [startDate, endDate, simpleMembers, mergedAvailability, selectedMemberIds]);

// slotGenerator.ts:215,222–223
now: Date = new Date()
const today = formatDateToString(now);
const timeNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
```

Сценарий: открыть экран в 10:05, получить свободное окно 10:30–23:00, оставить экран открытым до 12:00 без изменения фильтров/данных. useMemo не имеет зависимости от часов/тикера, а refresh вызывается лишь при повторном фокусе. Карточка всё ещё предлагает начало 10:30; onCreateRehearsal переносит его без проверки актуального времени. Аналогично при пересечении полуночи остаются предыдущие границы диапазона, рассчитанные useMemo экрана (:81–102).

Проявление: функция, обещающая исключать прошлое время (комментарии slotGenerator:102–105,219–221), снова передаёт форму в прошлое после обычного ожидания. Дефект не требует сбоя сервера. Сохранение такого прошлого слота зависит от проверок получателя (это проверить в H), но неверная рекомендация и prefill подтверждены непосредственно.

Минимум (1–2 ч): перед навигацией сравнивать начало с текущим временем и пересчитать/предложить актуальный интервал; освежать при возвращении приложения в foreground. Плюс: устраняет неверное действие; минус: до тапа остаётся старая карточка.

Правильно (0.5 дня): clock dependency на границе получаса/дня, пересчёт диапазона и слотов, foreground listener с cleanup, повторная проверка при нажатии. Плюс: список и действие всегда согласованы со временем; минус: дополнительные lifecycle состояния. Нужны fake-clock сценарии ожидания, background/foreground, полуночи — здесь не запускались.

Рабочие доказательства и покрытие: [notes-smart-planner.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-smart-planner.md).

<a id="ei01"></a>

### EI01 — High — diff удаляет импорт другого устройства/источника пользователя

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/services/calendar/import.ts:233](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:233):

```ts
    const dbSlots = (dbResponse.data.availability || dbResponse.data || []).filter((slot: any) => {
      const extId = slot.externalEventId || slot.external_event_id;
      const hasExternalId = !!extId;
      const isImported = slot.source === 'apple_calendar' || slot.source === 'google_calendar';
      // Overlap, not "starts inside" — the same question the device is asked.
      //
      // iOS returns every event that overlaps the window, so a holiday running
      // 1–15 September still arrives on the 4th. Matching the stored row by its
```

Места: [src/shared/services/calendar/import.ts:233–264](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:233),270,297–305,362,420–438.

```ts
const isImported = slot.source === 'apple_calendar' || slot.source === 'google_calendar';
return hasExternalId && isImported && inRange;
const dbEventMap = new Map(dbSlots.map((slot: any) => [slot.externalEventId || slot.external_event_id, slot]));
const calendarEventMap = new Map(eventsToProcess.map(e => [occurrenceKey(e), e]));
if (!inCalendar && !isExported) toDelete.push(id);
availabilityAPI.batchDeleteImported(toDelete)
```

Сценарий: пользователь импортировал рабочий календарь с устройства A; затем входит тем же аккаунтом на B и импортирует другой календарь (или тот же аккаунт провайдера, но события имеют device-local IDs). availabilityAPI.getAll возвращает обе категории imported этого пользователя; dbEventMap не ограничен текущим source, устройством или connection. В списке событий B нет eventId из A, все их будущие/текущие строки попадают в toDelete. Каждый последующий sync A/B может заменять занятость другого устройства. Приватные календари, доступные только одному устройству, — обычный случай, не предположение о совпадении eventId.

Подтверждённый серверный стык: [server/routes/native/availability.js:242–247](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:242) удаляет по userId + externalEventId + source IN(apple_calendar,google_calendar), без device/calendar scope. Update имеет тот же широкий scope (:281–290); уникальность bulk — user/external/source. Импортный payload вообще не несёт серверного connection/installation scope (:438 удаляет calendarId).

Проявление: занятые часы пропадают из планирования, коллегам предлагается конфликтующая репетиция. Это логическая потеря расписания внутри одного пользователя, не IDOR чужого аккаунта. Дополнительный риск: plain eventId одинаков на разных устройствах/провайдерах; Map стирает distinction source, batchUpdate/delete может затронуть обе строки. Реальный конфликт ID требует device проверки и отдельно как подтверждённая находка не считается.

Минимум (0.5–1 день): delete ограничить ID из tracking текущего устройства и только календарями, которые успешно прочитаны; пустой/утерянный tracking не даёт права массово удалять всю серверную занятость. Учитывать source при сравнении. Плюс: быстро защищает от чужого scope; минус: после reinstall/потери tracking останутся stale строки, пока не восстановлена provenance.

Правильно (2–4 дня): server-managed connection/installation namespace в импортированной строке и API; diff/delete только по этому scope и окну, глобальный stable provider ID применять лишь где он реально гарантирован. Подумать, как единый cloud календарь на двух устройствах согласуется с разными device-local IDs. Плюс: явное владение строками и безопасное удаление; минус: миграция существующего импорта и контрактов клиента/API.

Рабочие доказательства и покрытие: [notes-calendar-import.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-import.md).

<a id="ei02"></a>

### EI02 — Medium — неудачное чтение календаря считается успешной синхронизацией

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/services/calendar/import.ts:74](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:74):

```ts
  for (const calendarId of calendarIds) {
    try {
      const calendarEvents = await Calendar.getEventsAsync([calendarId], startDate, endDate);
      events = events.concat(calendarEvents);
      logger.debug(`[CalendarSync] Fetched ${calendarEvents.length} events from calendar ${calendarId}`);
    } catch (error) {
      logger.error(`[CalendarSync] Failed to fetch events from calendar ${calendarId}:`, error);
      failedCalendarIds.push(calendarId);
```

Места: [src/shared/services/calendar/import.ts:74–85](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:74),292–295,349–352,469–470.

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

Рабочие доказательства и покрытие: [notes-calendar-import.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-import.md).

<a id="ei03"></a>

### EI03 — Medium — удаление всех импортов не работает без локального tracking

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/services/calendar/import.ts:498](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:498):

```ts
    const importedEvents = await getImportedEvents();
    const eventIds = Object.keys(importedEvents);
    const total = eventIds.length;

    if (total === 0) {
      logger.info('[CalendarSync] No imported events to remove');
      return result;
```

Места: [src/shared/services/calendar/import.ts:498–504](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:498),511,520–523; [src/shared/utils/calendarStorage.ts:275–282](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/calendarStorage.ts:275).

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

Рабочие доказательства и покрытие: [notes-calendar-import.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-import.md).

<a id="ei04"></a>

### EI04 — Medium — перенос recurring события может сначала стереть старую занятость, а новое время не записать

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/services/calendar/import.ts:142](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:142):

```ts
function occurrenceKey(event: Calendar.Event): string {
  if (!event.recurrenceRule) return event.id;
  const { startsAt } = convertEventToTimestamps(event);
  return `${event.id}:${startsAt}`;
```

Места: [src/shared/services/calendar/import.ts:142–145](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:142),270,297–321,355–362,428–460.

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

Рабочие доказательства и покрытие: [notes-calendar-import.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-import.md).

<a id="ex01"></a>

### EX01 — Medium — Экспорт присваивает личное событие по совпадению текста и затем может удалить его

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/services/calendar/export.ts:141](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:141):

```ts
    const duplicateEvent = events.find(event => {
      if (rehearsalIdFromUrl((event as { url?: string }).url)) return false;

      const titleMatch =
        event.title === eventTitleFor(rehearsal) ||
        event.title === `Rehearsal: ${rehearsal.projectName}`;
      const startMatch = Math.abs(new Date(event.startDate).getTime() - startDate.getTime()) < 60000; // Within 1 minute
      const endMatch = Math.abs(new Date(event.endDate).getTime() - endDate.getTime()) < 60000;
```

**Код:** [src/shared/services/calendar/export.ts:141-151](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:141): если URL не содержит rehearsal id, совпадение определяется через title (включая произвольный rehearsal.title), время начала/конца с допуском 1 минуты и location. `195-201` затем вызывает `saveEventMapping(rehearsal.id, duplicateEventId, calendarId)`. Нет проверки notes/app marker или согласия присвоить это событие. После такого mapping обновление вызывает `updateEventAsync` (`281,390`), unsync — `deleteEventAsync` (`301,437`).

**Сценарий:** в выбранном writable календаре уже есть вручную созданная запись «Репетиция» 10:00–12:00 без места; администратор создаёт одноимённую репетицию с тем же временем. Legacy heuristic считает личную запись экспортом приложения. После изменения репетиции её перезапишут, а при удалении репетиции/отключении экспорта удалят личное событие. Особенно вероятно с короткими общими названиями и отсутствующим location, который нормализуется в пустую строку (`108,149`).

**Последствие:** потеря/перезапись календарных данных, которые приложение не создавало. Глобальное разрешение на календарь не подтверждает происхождение конкретной записи.

Оценка Medium: требуется совпадение title/start/end/location в выбранном календаре, затрагивается отдельное локальное событие; широкий охват или эксплуатация атакующим не доказаны.

**Минимум:** для автоматического adoption требовать собственный URL-marker, у legacy дополнительно устойчивый app marker в notes; при сомнении создавать отдельное событие (2–4 часа; устраняет чужое присвоение, возможны дубли старых экспортов). **Правильно:** явная миграция legacy mappings с review/подтверждением неоднозначных совпадений, стабильный app/account/event identity и проверка ownership перед update/delete (1–2 дня; надёжнее для нескольких устройств, больше интеграционной проверки).

Рабочие доказательства и покрытие: [notes-calendar-export.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-export.md).

<a id="ex02"></a>

### EX02 — Medium — После неудачного удаления mapping всё равно уничтожается, событие становится бесхозным

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/services/calendar/export.ts:536](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:536):

```ts
      const results = await Promise.allSettled(
        batchIds.map(async rehearsalId => {
          const eventId = mappings[rehearsalId].eventId;
          // Try to delete event from calendar
          await deleteCalendarEvent(eventId);
          // Remove mapping from DB + AsyncStorage
          await removeEventMapping(rehearsalId);
        })
```

**Код:** [export.ts:536-555](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:536) собирает ошибки удаления отдельных events, но после этого безусловно выполняет `clearAllMappings()` (`565-566`), включая записи, которые удалить не удалось. Второй путь: move сначала `createCalendarEvent` сохраняет mapping нового event (`369`, создание `244`), затем удаляет старый; catch удаления только логирует (`371-375`) и функция возвращает успех.

**Сценарии:** (1) «Удалить все экспортированные» — часть календарей недоступна/permission отозван/платформенное удаление падает. failed счётчик растёт, но mappings этих events удалены. Повторная очистка их уже не найдёт. (2) Смена export calendar: новая копия создана, старое удаление упало; mapping уже указывает только на новую, старую больше нельзя удалить штатной очисткой.

**Последствие:** оставшиеся старые/дублированные события и напоминания; UI может сообщить успешный перенос, последующее управление событиями утрачено. EX01 усиливает риск: однажды присвоенное личное событие тоже становится целью cleanup.

**Минимум:** не clearAllMappings после partial failure, удалять mapping только успешного event; при move сохранять pending-old-event cleanup и отражать failure (3–6 часов; исправляет повторный retry, добавляет маленький журнал). **Правильно:** lifecycle mapping current/pending-delete с идемпотентными retry и operation result, который явно разделяет created/removed/failed (1–2 дня; надёжно при частичном успехе, сложнее хранение/миграция).

Рабочие доказательства и покрытие: [notes-calendar-export.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-export.md).

<a id="ex03"></a>

### EX03 — Medium — Ошибка update превращается в «успешный» экспорт старого события

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/services/calendar/export.ts:389](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:389):

```ts
        try {
          await updateCalendarEvent(mapping.eventId, rehearsal);
          // Update lastSynced timestamp
          await saveEventMapping(rehearsal.id, mapping.eventId, mapping.calendarId);
          logger.debug('[CalendarSync] ✅ Event updated successfully');
        } catch (error) {
          // Update failed, event might be deleted - recreate
          logger.warn(`[CalendarSync] Update failed for event ${mapping.eventId}, recreating...`);
```

**Код:** [export.ts:389-400](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:389) при любой ошибке update удаляет mapping и вызывает createCalendarEvent. create сначала делает поиск существующего event; если найден тот же rehearsal URL (`127-132`), просто сохраняет mapping и возвращает id (`195-201`), **не применяя обновлённые поля**. Batch считает fulfilled успешным (`487-488`).

**Сценарий:** событие существует, серверное время изменилось; Calendar.updateEventAsync временно отклоняется или календарь стал read-only при сохранённом общем разрешении. Recovery поиск видит старое событие с тем же URL и объявляет его результатом create. Исходная ошибка исчезает, event остаётся со старым временем, batch success++. На каждом новом sync цикл может повторяться.

**Последствие:** пользователь видит «синхронизировано», но получит старое время/место и неверное напоминание.

**Минимум:** recreate только при достоверной not-found ошибке; остальные ошибки пробрасывать без удаления mapping (2–4 часа; не маскирует failure, надо классифицировать platform errors). **Правильно:** отдельный результат read/update/create с классификацией ошибки и подтверждением конечного содержимого event; adopting duplicate должен тоже сверить/обновить payload (0.5–1 дня; корректно восстанавливается, больше platform сценариев).

Рабочие доказательства и покрытие: [notes-calendar-export.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-export.md).

<a id="ex04"></a>

### EX04 — Medium — Неуспешный read/search трактуется как отсутствие и запускает создание дублей

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/services/calendar/export.ts:60](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:60):

```ts
  const hasPermission = await checkCalendarPermissions();
  if (!hasPermission) {
    throw new Error('Calendar permission not granted');
  }

  try {
    const event = await Calendar.getEventAsync(eventId);
    return event ?? null;
```

**Код:** [export.ts:60-69](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:60) сначала проверяет общее permission, но затем `getEventAsync` catch любого типа возвращает null. `findDuplicateEvent:160-162` также возвращает null при любом getEventsAsync failure. Caller удаляет mapping и пересоздаёт (`401-406`).

**Сценарий:** permission уже проверен как granted, затем временный сбой native calendar/изменение доступа между проверкой и lookup вызывает read error. Ветка считает event удалённым и уничтожает mapping. Если duplicate search тоже не смог прочитать events, но create доступен/уже восстановился, создаётся новый event поверх существующего. Старый остаётся без mapping. Даже без дубля ошибочный remove ухудшает восстановление.

**Последствие:** дубли в календаре, потеря привязки и повторные напоминания после краткого сбоя. **Минимум:** null только для известного not-found; permission/network/native ошибки пробрасывать, не делать create после failed search (2–4 часа; сохраняет mapping, может потребовать retry вручную). **Правильно:** tri-state found/absent/unknown, backoff и идемпотентная reconciliation по app marker (0.5–1 дня; безопасное восстановление, сложнее обработка состояния).

Рабочие доказательства и покрытие: [notes-calendar-export.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-export.md).

<a id="es01"></a>

### ES01 — High — незавершённый sync прошлого пользователя продолжает запись под новым аккаунтом

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/services/api.ts:85](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:85):

```ts
// Request interceptor - add access token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
```

Места: [src/shared/utils/calendarStorage.ts:10–14](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/calendarStorage.ts:10),33–44,258–264; [src/shared/services/calendar/import.ts:188–192](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:188),316–321,441–446; [src/contexts/AuthContext.tsx:64–82](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:64),202–208; [src/shared/services/api.ts:85–90](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:85); [src/shared/hooks/useAutoCalendarSync.ts:236–240](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:236),255–283,318–333.

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

Подтверждённый совместный timeline (Auth проверен при сверке исходников, auto hook — автором `notes-calendar-orchestration`):

1. Пользователь A запускает auto/manual sync. Auto guard проверяет только наличие token в начале (:236–240), import запоминает выбранные A calendarIds и начинает native fetch + getAll. getAll успевает вернуть availability A, Calendar.getEventsAsync ещё ожидает provider.
2. A выходит; начинается вход B. AuthContext login сначала пишет accessToken/refreshToken B (:202–206), затем reconcileDeviceState (:208) удаляет общие calendar keys и сбрасывает connection cache (:64–82). Ни logout, ни reconcileDeviceState не отменяют и не ожидают старый календарный sync; cleanup auto effect лишь снимает listener (:318–333), global currentSync не принадлежит session/user.
3. Старый native fetch A завершается. Старый import строит diff по событиям/DB snapshot A; перед bulkSet/update/delete не проверяет captured user/session generation. Axios перехватывает новый token B. Даже если у B import выключен по умолчанию, A calendar events загружаются в занятость B. При совпадающих external IDs возможны update/delete импортированных B строк; для доказательства write/leak совпадение не требуется — достаточно нового события A в toAdd.
4. После successful write saveImportedEvent и timestamp снова наполняют неключёванные userId AsyncStorage keys данными A (:444–446), уже после очистки B. Отдельно queued updateStored writer мог прочитать A map до clear и записать его обратно после await; clear/removeItem не стоят в той же очереди.

Проявление: временные данные личного календаря A оказываются в аккаунте B и его project availability; неверная занятость B, потенциальное раскрытие расписания A коллегам B. Контент/title события import маскирует, поэтому утечка здесь именно временных интервалов и технических IDs, не названий встреч. Это собственная cross-account гонка клиента, а не обход серверной авторизации: сервер корректно выполняет запрос от token B.

Минимум (0.5–1 день): session generation/userId capture при старте sync, invalidate до смены tokens/cleanup; после каждого awaited native/API этапа и перед каждой side effect проверять generation, отбрасывать устаревшие операции. AbortController для API плюс остановка последующих native side effects. Плюс: предотвращает продолжение цепочки; минус: уже отправленные запросы/native mutations отменяемы не всегда, нужны чёткие точки завершения.

Правильно (2–3 дня): sync coordinator с явным owner/session lifetime, запрет account switch commit до отмены/settlement старых операций или отдельный immutable owner-bound API client; cache keys/queues по userId + device connection, очистка через coordinator. Плюс: изоляция данных и lifecycle; минус: несколько слоёв Auth/API/calendar, нужны гонки logout/login при задержках и pending local writes. Пользовательский logout не должен бесконечно ждать недоступный provider — задача отменяется логически, с bounded cleanup.

Обычные static clearing/reset при последующем входе уже присутствуют; проблема исключительно незавершённых операций.

Рабочие доказательства и покрытие: [notes-calendar-storage.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-storage.md).

<a id="es02"></a>

### ES02 — Medium — mappings разных календарей/устройств схлопываются, причём старейший перезаписывает новый

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/utils/calendarMappings.ts:173](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/calendarMappings.ts:173):

```ts
export async function getAllMappings(): Promise<Record<string, { eventId: string; calendarId: string; lastSynced: string }>> {
  try {
    // Try database first
    const response = await calendarSyncAPI.getMappings('rehearsal');
    const mappings = response.data.mappings || [];

    // Convert to expected format
    const result: Record<string, { eventId: string; calendarId: string; lastSynced: string }> = {};
```

Места: [src/shared/utils/calendarMappings.ts:173–201](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/calendarMappings.ts:173),116–144; [server/routes/native/calendarSync.js:184](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/calendarSync.js:184); [src/shared/services/calendar/export.ts:341–352](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:341),367–375,390–406.

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

Сценарий: один пользователь экспортировал rehearsal R в нескольких connections (несколько устройств/календарей). Сервер допускает несколько mappings для internal_event_id в разных connection. GET all сортирует newest first, но клиент складывает все в объект `result[R]`, игнорируя connectionId/device, поэтому последний (самый старый) детерминированно побеждает. Затем server result вытесняет даже новый правильный local cached mapping. Single getEventMapping также запрашивает по rehearsal без current connection (метод/серверный стык подтверждён при сверке).

Проявление: sync получает старый или device-local ID другого устройства. Если ID отсутствует локально, export считает событие удалённым и заново создаёт/ищет дубликат (:401–406). Его поиск ограничен ±1 днём новой даты (подтверждено в export :117–123); если репетиция перенесена дальше, прежняя cloud-копия остаётся, новая создаётся отдельно. Повторяющийся выбор oldest mapping делает это системным. Если ID случайно обозначает другое событие на текущем устройстве, export не проверяет url/calendar ownership перед update/delete (:390,:372) и может затронуть это событие — это дополнительный условный повышенный риск, конкретное совпадение ID требует проверки на устройстве, не отдельная подтверждённая High находка.

Минимум (1–3 ч): фильтровать mappings по текущему календарю/connection до свёртки, выбирать первый newest, предпочитать подтверждённый local mapping для текущего устройства; перед native update/delete сверять marker rehearsalId/calendarId. Плюс: локальное снижение риска; минус: календарный ID тоже device-local, без installation namespace неоднозначность сохраняется.

Правильно (1–2 дня): контракт getMapping/getAll/put/delete с current installation+connection, тип `Record<connectionId, Record<rehearsalId,mapping>>`, независимые exports по устройствам; локальное recovery по marker и временному окну с учётом прежней даты. Плюс: каждая mapping однозначна; минус: клиент/API контракт и миграция cache. Отдельные export эвристики/partial delete рассматриваются EX01/EX02 и не дублируются здесь.

Рабочие доказательства и покрытие: [notes-calendar-storage.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-storage.md).

<a id="eo01"></a>

### EO01 — Medium — после ухода из последнего проекта экспортированные события не удаляются

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:65](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:65):

```ts
  const projectsRes = await projectsAPI.getUserProjects();
  const projectIds = (projectsRes.data?.projects || []).map((p: any) => p.id);
  if (projectIds.length === 0) {
    logger.debug('[AutoSync] No projects - nothing to export');
    return;
  }
```

Категория: reconciliation / устаревшие календарные данные.

[src/shared/hooks/useAutoCalendarSync.ts:65-70](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:65): `const projectIds = ...; if (projectIds.length === 0) { ... return; }`. Вызов `reconcileDeletedRehearsals(...)` находится ниже в `:107-110`. Комментарий `:94-96` прямо обещает, что пользователь, вышедший из всех проектов, не должен сохранять экспортированные события.

Сценарий: экспортировать репетиции единственного проекта, затем удалить проект/потерять последнее membership. При следующем autosync GET projects успешно отдаёт []; ранний return не читает mappings и не удаляет ни одного старого события. В календаре продолжаются устаревшие записи и напоминания, хотя приложение больше не имеет этих репетиций.

Минимум: при достоверном успешном пустом projects response сверять mappings с пустым live set вместо return. Плюс — маленькая правка; минус — нужно явно различить ошибку/неполный ответ и успешную пустоту. Правильно: единый reconciliation snapshot с признаком completeness независимо от числа проектов, персистентная очередь удалений. Плюс — обрабатывает последний проект и retry; минус — шире контракт. Effort: 2–4 часа / 1 день.

Рабочие доказательства и покрытие: [notes-calendar-orchestration.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-orchestration.md).

<a id="eo02"></a>

### EO02 — Medium — ошибка импорта отменяет независимый автоэкспорт

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:258](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:258):

```ts
      const importSettings = await shouldImportNow();
      if (importSettings) {
        logger.debug('[AutoSync] Auto-importing calendar events');
        // Fetched once for both halves — the import needs it to leave our own
        // exported rehearsals alone, the export to match event to rehearsal.
        sharedMappings = await getAllMappings();
        const result = await importCalendarEventsToAvailability(
          importSettings.importCalendarIds,
```

Категория: обработка ошибок / расхождение с комментарием.

[src/shared/hooks/useAutoCalendarSync.ts:258-268](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:258) выполняет getAllMappings и import внутри внешнего try, до блока export `:275-279`; outer catch находится `:280-282`. Комментарий `:274`: `A failed import should not stop the export, and the other way round.`

Сценарий: оба направления включены; чтение/import календаря либо getAllMappings бросает исключение. Управление сразу попадает в outer catch, `exportRehearsalsIfDue` вообще не вызывается. Новые или изменённые репетиции не попадают в календарь, пока проблема импорта не исчезнет. Постоянная ошибка одного направления блокирует второе. Достижимость throw подтверждена в import: [src/shared/services/calendar/import.ts:188-192](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/import.ts:188) Promise.all включает availabilityAPI.getAll без локального catch, HTTP500/timeout выходит через rethrow `:477-480`; чтение календаря может бросать при отсутствии permission `:66-69`. Дополнительно [src/shared/utils/calendarMappings.ts:217](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/calendarMappings.ts:217) бросает при server failure и пустом локальном кеше.

Минимум: отдельные try/catch для import и export; после import failure попытаться export с independently полученными mappings. Плюс — локальный fix; минус — возможно повторное чтение общего ресурса. Правильно: независимые результаты направлений в общем sync-run и явное degraded состояние. Плюс — понятны частичные успехи; минус — больше orchestration/UI. Effort: 2–3 часа / 0.5–1 день.

Рабочие доказательства и покрытие: [notes-calendar-orchestration.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-orchestration.md).

<a id="eo03"></a>

### EO03 — Medium — очередь ручных запусков не гарантирует один sync одновременно

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:200](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:200):

```ts
async function runExclusively(
  work: () => Promise<void>,
  { waitForTurn }: { waitForTurn: boolean }
): Promise<void> {
  if (currentSync) {
    if (!waitForTurn) return;
    await currentSync.catch(() => {});
  }
```

Категория: concurrency.

[src/shared/hooks/useAutoCalendarSync.ts:200-213](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:200): `if (currentSync) { if (!waitForTurn) return; await currentSync.catch(() => {}); } const run = work().finally(...); currentSync = run;`. `forceSync` использует waitForTurn=true (`:343,377`). После await не делается повторная проверка currentSync и очередь не строится цепочкой.

Сценарий: автоматический sync A ещё выполняется. Два manual forceSync B и C успевают ожидать один и тот же Promise A. После A оба продолжают с work(), так что два импорта/экспорта одновременно читают старые mappings и сохраняют изменения. Это нарушает заявленный комментариями общий lock и создаёт условия для дублей/потери mappings; конкретные последствия низкоуровневых записей сверяются с export/storage.

Минимум: повторно захватывать lock в while-loop после пробуждения либо строить настоящую цепочку queued promises. Плюс — малый fix; минус — нужна защита starvation/error release. Правильно: общий mutex/очередь всех ручных, автоматических, save/delete sync операций с ключом account+device. Плюс — защищает и другие callers; минус — затрагивает API сервисов. Effort: 2–4 часа / 1 день. Проверка без текущего запуска: deferred promise A, два force callers, maximum concurrent work должен быть 1.

Рабочие доказательства и покрытие: [notes-calendar-orchestration.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-orchestration.md).

<a id="eo04"></a>

### EO04 — Medium — ручная синхронизация может восстановить уже выключенную настройку

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:351](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:351):

```tsx
      // Import calendar events
      logger.debug('[Sync] 📥 Starting import from calendar...');
      const importResult = await importNow();
      logger.debug('[Sync] ✅ Import completed:', importResult);

      // Export rehearsals to calendar
      logger.debug('[Sync] 📤 Starting export to calendar...');
      logger.debug('[Sync] 📊 Projects available:', projects.length);
```

Категория: гонка настроек / пользовательский контроль.

[src/features/profile/screens/CalendarSyncSettingsScreen.tsx:351-362](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:351) сначала `await importNow()`, затем `await rehearsalsAPI.getBatch(projectIds)`, и лишь после ответа вызывает захваченный в старом render `syncAll` (`:389`). [useCalendarSync.ts:328](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useCalendarSync.ts:328) сбрасывает isImporting после import, тогда как isSyncing=true выставляется только при входе в syncAll (`:234`). В промежутке оба флага false и экран разрешает переключатель ([CalendarSyncSettingsScreen.tsx:462-467](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:462)) и выбор календаря. [useCalendarSync.ts:149-158](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useCalendarSync.ts:149) updateSettings сохраняет snapshot `const updated = { ...settings, ...newSettings }; await saveSyncSettings(updated);`, а syncAll вызывает именно захваченный updateSettings в `:251`.

Сценарий: нажать Synchronize; после импорта batch-запрос медленный. Выключить Auto Sync либо сменить целевой календарь в разблокированном UI. Старый handler после ответа запускает export с прежним settings.exportCalendarId и затем сохраняет старые флаги/settings вместе с lastExportTime. Настройка снова становится enabled=true/прежний calendarId; события записываются после явного отключения пользователя. Даже без действий пользователя export stamp может затереть lastImportTime, только что записанный предыдущей фазой, поскольку обе callback-функции взяты из одного старого render.

Минимум: флаг wholeRunBusy на весь handleSynchronize включая network gap; updateSettings должен атомарно обновлять только переданные поля на свежем storage snapshot и проверять generation настройки перед export. Плюс — устраняет доступный UI-сценарий; минус — другие callers остаются вне общей синхронизации. Правильно: общий settings store с serialized patch updates и cancellation/generation token для sync-run, пересмотр разрешения записи при отключении/смене account/calendar. Плюс — не теряет независимые изменения; минус — охватывает hooks/storage. Effort: 0.5–1 день / 1–2 дня.

Рабочие доказательства и покрытие: [notes-calendar-orchestration.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-orchestration.md).

<a id="eo05"></a>

### EO05 — Low — ручная синхронизация заменяет названия репетиций общим названием проекта

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:368](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:368):

```tsx
      const allRehearsals: RehearsalWithProject[] = (response.data.rehearsals || []).map((r: any) => ({
        id: r.id,
        projectId: r.projectId,
        projectName: r.projectName,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        location: r.location,
      }));
```

Категория: потеря отображаемых данных / контракт export.

[src/features/profile/screens/CalendarSyncSettingsScreen.tsx:368-375](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:368) строит allRehearsals только из id/projectId/projectName/startsAt/endsAt/location, отбрасывая r.title. Для сравнения автоматический путь в [src/shared/hooks/useAutoCalendarSync.ts:73-80](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:73) сохраняет title. Проверяющий export подтвердил [src/shared/services/calendar/export.ts:104-105](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:104): `eventTitleFor = rehearsal.title?.trim() || ... Rehearsal: <projectName>`; при несовпадении имени существующий event обновляется через `:385-392` и `:269-275`.

Сценарий: репетиция «Акт II» уже правильно экспортирована. В настройках нажать «Синхронизировать». Новый DTO не содержит title; export сравнивает его с fallback и перезаписывает название события на «Rehearsal: <project>». После auto-sync имя может вернуться, поэтому результат зависит от выбранного способа синхронизации; пользователь теряет различимость репетиций в личном календаре.

Минимум: добавить `title: r.title` в manual mapping. Плюс — маленькая правка; минус — другие DTO могут снова разойтись. Правильно: общий типизированный mapper Rehearsal→RehearsalWithProject для всех путей и regression assertion payload. Плюс — единый контракт; минус — небольшое объединение callers. Effort: 30–60 минут / 2–3 часа.

Рабочие доказательства и покрытие: [notes-calendar-orchestration.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-orchestration.md).

<a id="eo06"></a>

### EO06 — Medium — неудачная синхронизация получает новую отметку успешного экспорта

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/hooks/useCalendarSync.ts:238](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useCalendarSync.ts:238):

```ts
      const result = await syncAllRehearsals(
        rehearsals,
        settings.exportCalendarId,
        onProgress
      );

      setSyncStatus('success');

```

Категория: обработка частичных ошибок / ложный статус результата.

[src/features/calendar/hooks/useCalendarSync.ts:238-251](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useCalendarSync.ts:238) получает BatchSyncResult, затем без проверки failed делает `setSyncStatus('success')` и `updateSettings({ lastExportTime: new Date().toISOString() })`. Экран [CalendarSyncSettingsScreen.tsx:393-398](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx:393) всегда показывает заголовок `t.calendarSync.syncSuccess`, сообщает только success counts, а `:577-583` использует lastExportTime как зелёное «синхронизировано недавно».

Автоматический путь [useAutoCalendarSync.ts:120-135](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useAutoCalendarSync.ts:120) пытается сохранять timestamp только при result.failed===0, но в export подтверждена более раннюю безусловную запись внутри [src/shared/services/calendar/export.ts:502](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:502): `updateLastExportTime` вызывается даже после накопления failed (`:485-493`). Поэтому guard hook уже не отменяет ложную отметку низкого слоя.

Сценарий: exportEnabled=true, у календаря отозвана возможность записи либо несколько/все операции export завершились failed. Batch возвращает `{success:0, failed:N}` без исключения. Ручной экран объявляет успешную синхронизацию, persistent status получает текущее время, а auto-путь также не сохраняет прежнюю отметку. Пользователь считает расписание в календаре актуальным и может пропустить изменения. Это не утверждение о 10-минутной задержке retry: старый interval в текущем коде удалён.

Минимум: централизовать запись lastExportTime только после полного успеха, убрать безусловный writer [export.ts:502](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/calendar/export.ts:502), отразить failed>0 как partial/error в hook и экране. Плюс — локально восстанавливает честный статус; минус — одного timestamp недостаточно для деталей. Правильно: separate lastAttemptAt/lastSuccessfulAt, per-operation summary с failed IDs и retry, единый владелец статуса на уровне orchestration. Плюс — понятно, что актуально и что повторить; минус — расширяет storage/UI. Effort: 0.5–1 день / 1–2 дня.

Рабочие доказательства и покрытие: [notes-calendar-orchestration.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-calendar-orchestration.md).

<a id="f01"></a>

### F01 — High — инструкция развёртывания новой БД использует несовместимую смесь SQL-диалектов

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/database/init-native-schema.sql:39](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/init-native-schema.sql:39):

```sql
  id INTEGER PRIMARY KEY AUTOINCREMENT,
```

[database/init-native-schema.sql:39](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/init-native-schema.sql:39) и ещё восемь PK: `id INTEGER PRIMARY KEY AUTOINCREMENT`; временные поля :122-123 — `DATETIME`. При этом :229 используются `SERIAL`, :234 `TIMESTAMPTZ`, :265 `JSONB`, :270 `DEFAULT NOW()`. [CLAUDE.md:719-720](/Users/vadimfertik/Desktop/reh_app/CLAUDE.md:719) предписывает `psql ... -f database/init-native-schema.sql`, затем baseline. В `db.js` вообще нет загрузки/преобразования схемы; runtime PostgreSQL transform :38-40 касается только знаков параметров.

Сценарий: создать новый PostgreSQL environment по документации. PostgreSQL не принимает SQLite AUTOINCREMENT и тип DATETIME, основные таблицы не создаются. psql без ON_ERROR_STOP может продолжить оставшиеся statements, что дополнительно создаёт неполное состояние. Последующий baseline отметит миграции выполненными без проверки таблиц. Сервер может установить SELECT1 соединение, но login/projects/availability будут500 из-за отсутствующих объектов. Утверждение header «verified against production» означает сравнение описания, а не доказанную исполнимость файла.

Минимум: отдельный валидный PostgreSQL bootstrap с identity/serial, timestamptz и boolean defaults, documented stop-on-error/transaction (0.5–1 день; быстро даёт рабочий new environment, нужно вручную сверить с live schema). Правильно: воспроизводимая версия bootstrap для каждой реально поддерживаемой БД, автоматическая проверка clean install → schema parity перед baseline (1–2 дня; повторяемость и обнаружение drift, потребует isolated DB проверки после разрешения запусков).

Рабочие доказательства и покрытие: [notes-database.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-database.md).

<a id="f02"></a>

### F02 — High — baseline пропускает обязательный unique index доступности

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/native/availability.js:141](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:141):

```js
          `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, notes, is_all_day, source, external_event_id)
           VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (user_id, external_event_id, source) DO NOTHING`,
          [
            userId,
            startsAt,
            endsAt,
```

[init-native-schema.sql:155-172](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/init-native-schema.sql:155) определяет availability без UNIQUE(user_id,external_event_id,source); весь index section :285-300 его также не содержит. Индекс добавляет только [migrations/005-unique-imported-event.sql:25-26](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/migrations/005-unique-imported-event.sql:25). Однако [scripts/migrate.js:115-124](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/scripts/migrate.js:115) при baseline лишь записывает **все** pending filenames. [routes/native/availability.js:143](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:143): `ON CONFLICT (user_id, external_event_id, source) DO NOTHING` обязателен для каждой bulk записи, даже manual с NULL external id.

Сценарий: после устранения диалекта F01 оператор создаёт новую БД из base и выполняет baseline по инструкции. Все bulk save/import запросы отклоняются: указанному conflict target не соответствует unique constraint. Наличие/отсутствие фактического дубля на это не влияет. PostgreSQL требует подходящий unique index при inference, иначе выдаёт ошибку ([официальная документация INSERT](https://www.postgresql.org/docs/current/sql-insert.html)). Production, где005 уже применена, этой конкретной ошибкой не затронут; текущий live catalog не проверялся.

Другие проявления того же schema parity gap: базовая схема не включает003 индексы notification user+created/unread; migrated production их получает, fresh baseline — нет. Поэтому при большом inbox возможны сканы общей таблицы. Не выдавать это за отсутствие индексов во всех средах. Календарные connection/mapping unique scope из тестовой схемы также не виден в базе (проверка ниже/consumers), но runtime SELECT→INSERT не требует ONCONFLICT там. **SlotService book/ensure не использует ONCONFLICT:** отсутствие005 не вызывает у него аналогичную ошибку, лишь лишает constraint защиты от дублей.

Минимум: добавить все обязательные постмиграционные объекты в bootstrap; перед baseline проверять обязательный unique availability index и остальные postconditions (2–4 ч; быстро разблокирует bulk, ручной список может снова устареть). Правильно: генерировать/проверять canonical schema от миграций, baseline только до определённой версии с проверкой checksum/postconditions (1–2 дня; предотвращает drift, нужно наладить provisioning workflow).

Рабочие доказательства и покрытие: [notes-database.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-database.md).

<a id="f03"></a>

### F03 — Medium — заявленный SQLite режим не запускается штатной командой и не поддерживает SQL приложения

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/database/db.js:114](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/db.js:114):

```js
    const dbPath = path.join(process.cwd(), 'server', 'database', 'data.sqlite');
```

[db.js:114](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/db.js:114): `path.join(process.cwd(), 'server', 'database', 'data.sqlite')`; [server/package.json:8-9](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/package.json:8) start/dev запускают server.js из каталога server. В результате путь становится server/server/database/data.sqlite, каталога в inventory нет; фактический файл расположен server/database/data.sqlite. Даже при запуске из корня native-проекта [db.js:119](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/db.js:119),123,126 отдаёт SQL напрямую sqlite.prepare без transform, тогда как реальный create rehearsal ([rehearsalService.js:385-386](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:385)) содержит `$4::timestamptz` и `NOW()`, availability bulk:115 содержит `AT TIME ZONE`. Это PostgreSQL синтаксис, SQLite его не исполняет. Тестовый harness трансформирует его, runtime adapter — нет.

Сценарий: разработчик использует заявленный SQLite fallback без DATABASE_URL (CLAUDE:136/782). `npm start` из server сначала падает на открытии неверного пути; после локального исправления пути ключевые API всё равно отказывают на SQL. Дополнительно [db.js:31-34](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/db.js:31) при неуспешном подключении **заданного** PostgreSQL автоматически выбирает этот SQLite путь. Таким образом fallback не обеспечивает сохранение доступности и может направить частично совместимые запросы в другую локальную БД. Реальная запись в fallback/состояние файла не проверялись и не утверждаются.

Минимум: путь относительно import.meta.url; при заданном DATABASE_URL завершать startup с ошибкой, явно документировать PostgreSQL-only пока SQL не портирован (2–4 ч; убирает скрытый другой storage и ложное обещание, SQLite dev временно ограничен). Правильно: явный DB engine config, отдельные SQL реализации/параметры и schema для каждого поддерживаемого engine; HTTP integration через настоящий adapter в обеих средах (2–4 дня; реальная переносимость, больше поддержки).

Рабочие доказательства и покрытие: [notes-database.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-database.md).

<a id="f05"></a>

### F05 — Low — adapter теряет число изменённых строк

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/database/db.js:50](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/db.js:50):

```js
        return { lastInsertId: res.rows[0]?.id };
```

[db.js:50](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/db.js:50),84: `return { lastInsertId: res.rows[0]?.id };`, SQLite :120 возвращает только lastInsertRowid. [routes/native/availability.js:214](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:214),249,293 читают `result.changes || 0`, поэтому deletedCount/updatedCount всегда0 после реально выполненных действий. [utils/accountLinking.js:205](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/utils/accountLinking.js:205) проверяет `result.changes === 0`; undefined никогда не0, и отсутствующий provider не даёт обещанную ошибку. Это не доказанный обход авторизации: guard количества методов остаётся, а unlink в A имеет отдельные проблемы.

Сценарий: удалить N импортированных строк через API; удаление выполнено, ответ заявляет0. Или при двух существующих auth methods unlink третьего отсутствующего provider сообщает успех. Тестовый setup возвращает changes, скрывая отличие production adapter.

Минимум: возвращать changes из pg rowCount / sqlite info.changes и дать общий DTO run result (1–2 ч; малое изменение, надо сверить callers). Правильно: отдельные typed results insert/execute с явным rowCount и contract tests реальных engines (0.5 дня; устраняет неоднозначность, небольшой API рефактор).

Рабочие доказательства и покрытие: [notes-database.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-database.md).

<a id="ft01"></a>

### FT01 — Low — режим --dry делает записи в БД; с --baseline вообще меняет историю миграций

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/scripts/migrate.js:115](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/scripts/migrate.js:115):

```js
  if (baseline) {
    if (done.size > 0) {
      console.log(`Already baselined — ${done.size} migrations on record. Nothing to do.`);
      await engine.close();
      return;
    }
    for (const file of pending) await engine.record(file);
    console.log(`Baselined ${pending.length} migrations as already applied. None were run.`);
```

Категория: служебный режим / расхождение с обещанием.

Цитата [server/scripts/migrate.js:7](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/scripts/migrate.js:7): `npm run migrate -- --dry   list what would be applied, change nothing`. Фактически `:109-112` сначала connect и engine.applied. PostgreSQL applied `:71-76` делает `CREATE TABLE IF NOT EXISTS native_migrations`; SQLite connect `:89` открывает/создаёт `database/data.sqlite`, а applied `:94-99` также делает CREATE TABLE. Проверка dryRun появляется только `:149-153`.

Сценарий: оператор запускает --dry на ещё не инициализированной БД, ожидая read-only просмотр. Появляется таблица ledger, а SQLite может создать файл БД. Если передать одновременно --dry --baseline, ветка baseline `:115-124` выполняется раньше и записывает все pending filenames в ledger, хотя SQL не применялись. Это может скрыть настоящие pending изменения при последующем запуске. Обычный --dry на уже существующем ledger не применяет SQL — не преувеличивать scope.

Минимум: отклонять несовместимые --dry/--baseline, реализовать read-only чтение ledger с отсутствующей таблицей как пустым набором, не открывать SQLite с create в dry. Плюс — маленький предсказуемый fix; минус — отдельный read-only код подключения. Правильно: сначала строить чистый migration plan, отдельно применять baseline/apply с явным режимом и транзакцией. Плюс — все операции reviewable; минус — рефактор runner. Effort: 2–4 часа / 1 день.

Рабочие доказательства и покрытие: [notes-database-tooling.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-database-tooling.md).

<a id="ft02"></a>

### FT02 — Medium — SQL миграции и её запись в журнал не атомарны

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/scripts/migrate.js:155](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/scripts/migrate.js:155):

```js
  for (const file of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    process.stdout.write(`Applying ${file} ... `);
    try {
      await engine.exec(sql);
      await engine.record(file);
```

Категория: целостность schema/history / recovery.

[server/scripts/migrate.js:155-160](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/scripts/migrate.js:155): `await engine.exec(sql); await engine.record(file);` — отдельные операции. SQLite exec `:92` вызывает обычный db.exec без BEGIN/ROLLBACK; PG exec `:69` и record `:80-83` используют независимые pool.query. В runner нет transaction wrapper. При failure сообщение `:165-167` обещает, что повторный запуск продолжится с этого же файла, поскольку он не recorded, но не откатывает уже выполненные эффекты.

Сценарий A: SQL успешно применился, а запись filename не удалась (обрыв подключения, остановка процесса между двумя await). Файл останется pending и применится повторно, что ломает неидемпотентные ALTER/перезапись данных. Сценарий B для SQLite: первая команда файла успешна, следующая падает, ранее выполненные команды остаются; повтор на том же файле снова падает на уже добавленном объекте. Для PostgreSQL нельзя обобщать B на каждый файл: один multi-statement pool.query без внутренних COMMIT может быть атомарен на уровне server implicit transaction, однако разрыв SQL↔ledger A остаётся в любом случае.

Чтение SQL подтвердило, что сами 23 скрипта не содержат общей BEGIN и есть неидемпотентные ADD CONSTRAINT/преобразования (в частности [server/migrations/migrate-rehearsals-to-timestamptz.sql:37–39](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/migrations/migrate-rehearsals-to-timestamptz.sql:37)). Это усиливает проблему неполного recovery, а не объявляет любой migration rerun разрушающим.

Минимум: привязанный к одному connection transaction объединяет SQL файла и INSERT ledger; для SQLite BEGIN/COMMIT вокруг обоих, rollback по любому failure. Плюс — сохраняет существующий формат; минус — нужно явно выделить DDL, который не допускается в transaction, если такой появится. Правильно: transactional migration runner с immutable checksum, advisory lock/единственным исполнителем и отдельными documented nontransactional steps. Плюс — защищает history, параллельный старт и редактирование применённого файла; минус — более широкая реализация. Effort: 0.5–1 день / 1–2 дня.

Рабочие доказательства и покрытие: [notes-database-tooling.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-database-tooling.md).

<a id="fm01"></a>

### FM01 — Medium — Историческая конверсия UTC зависит от session timezone

**Статус:** условный; требуемые условия ниже.


Точная выдержка из [rehearsal-calendar-native/server/migrations/migrate-rehearsals-to-timestamptz.sql:15](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/migrations/migrate-rehearsals-to-timestamptz.sql:15):

```sql
-- Note: We assume existing data is in UTC (as per current server logic)
-- If data is not in UTC, adjust the timezone parameter accordingly
UPDATE native_rehearsals
SET
  starts_at = (date + start_time)::TIMESTAMPTZ,
  ends_at = (date + end_time)::TIMESTAMPTZ
```

**Код:** [rehearsal-calendar-native/server/migrations/migrate-rehearsals-to-timestamptz.sql:15-20](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/migrations/migrate-rehearsals-to-timestamptz.sql:15) обещает, что существующие date/time — UTC, но выполняет:

```sql
starts_at = (date + start_time)::TIMESTAMPTZ,
ends_at = (date + end_time)::TIMESTAMPTZ
```

Аналогично [migrate-availability-to-timestamptz.sql:19-25](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/migrations/migrate-availability-to-timestamptz.sql:19): date::TIMESTAMPTZ и (date+time)::TIMESTAMPTZ без `AT TIME ZONE 'UTC'` либо `SET LOCAL TIME ZONE`. Cast timestamp-without-timezone→timestamptz интерпретирует часы в session timezone. [fix-date-column-types.sql:5-10](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/migrations/fix-date-column-types.sql:5) выполняет обратное `date::DATE` тоже в session zone и может сдвинуть календарную дату старого TIMESTAMPTZ.

**Условие/сценарий:** legacy database ещё содержит старые date/start_time/end_time, миграция применяется **впервые** в соединении с TimeZone='Asia/Jerusalem'. Старое UTC 10 сентября 10:00 становится 07:00Z (при UTC+3), хотя комментарий обещает 10:00Z. All-day UTC-midnight также сдвигается и перестаёт соответствовать календарной конвенции клиента. В среде UTC ошибка не проявляется. Фактическая timezone исторического production migration session не известна; текущая порча данных не утверждается.

Семантика casts дополнительно проверена по [официальной документации PostgreSQL Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html): отсутствие zone в timestamptz input означает timezone текущей сессии. Это подтверждает условный механизм, не фактическую настройку production.

**Последствие:** массовое смещение исторической доступности/репетиций/напоминаний при восстановлении или upgrade legacy базы. Последующие drop-old migrations удаляют исходные date/time, оставляя только ошибочно конвертированные instant values.

**Минимум:** явный `(date + start_time) AT TIME ZONE 'UTC'` и симметричное правило для ends/all-day, либо transaction с SET LOCAL TIME ZONE UTC после проверки source semantics (2–4 часа; быстро/детерминированно, предполагает что source действительно UTC). **Правильно:** документированная source timezone, preflight выборки и round-trip сверка каждой migrated группы до drop-old, утверждённый backup/rollback (0.5–1 дня; позволяет обнаружить реальные legacy неоднородности, дороже подготовки). Для уже применённой миграции нельзя просто повторно прибавить offset: сначала установить, когда/как она выполнялась.

Рабочие доказательства и покрытие: [notes-migrations.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-migrations.md).

<a id="fm02"></a>

### FM02 — Low — Повторный OAuth backfill создаёт дубли email-provider

**Статус:** условный; требуемые условия ниже.


Точная выдержка из [rehearsal-calendar-native/server/migrations/001-add-oauth-providers.sql:23](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/migrations/001-add-oauth-providers.sql:23):

```sql
  UNIQUE(provider_type, provider_user_id),  -- Prevent duplicate OAuth accounts
```

**Код:** [rehearsal-calendar-native/server/migrations/001-add-oauth-providers.sql:23](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/migrations/001-add-oauth-providers.sql:23) задаёт `UNIQUE(provider_type, provider_user_id)`, provider_user_id допускает NULL (`16`). Backfill (`77-94`) выполняет `INSERT OR IGNORE ... SELECT id,'email',email,...` без provider_user_id и без `WHERE NOT EXISTS` по user_id/provider_type.

**Условие/сценарий:** backfill запускают повторно на поддерживаемом SQLite SQL пути (ручное восстановление/повтор после partial failure). Каждая email запись опять имеет provider_user_id=NULL; NULL значения не конфликтуют с UNIQUE, INSERT OR IGNORE ничего не игнорирует, появляются повторные email-provider для одного пользователя. Обычный runner с корректно записанным native_migrations filename эту миграцию повторно не применит; актуальные duplicates в production не подтверждены.

**Последствие:** provider model теряет «один email method на пользователя», UI/счётчики методов получают дубли. Влияние на конкретный unlink/security сценарий не приписывается без дополнительной проверки; связь с A04 существования/backfill email-provider передана основному аудитору.

**Минимум:** добавить NOT EXISTS(user_id,provider_type='email') в backfill (до 1 часа; достаточно последовательного запуска, concurrent backfill всё ещё гонка). **Правильно:** уникальность (user_id,provider_type) или отдельный partial unique email index после детерминированной дедупликации + transactional upsert (2–4 часа; DB обеспечивает инвариант, нужно проверить допустимость нескольких OAuth accounts одного provider).

Рабочие доказательства и покрытие: [notes-migrations.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-migrations.md).

<a id="g01"></a>

### G01 — High — конкурентная регистрация оставляет двух владельцев одного push-токена

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/native/pushTokens.js:49](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/pushTokens.js:49):

```js
    await db.run(
      'DELETE FROM native_push_tokens WHERE device_token = ? AND user_id != ?',
      [deviceToken, userId]
    );
```

Доказательство: [server/routes/native/pushTokens.js:49-52](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/pushTokens.js:49): `DELETE FROM native_push_tokens WHERE device_token = ? AND user_id != ?`; отдельный запрос :61-69: `ON CONFLICT (user_id, device_token) DO UPDATE`. Схема [server/database/init-native-schema.sql:237](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/init-native-schema.sql:237) имеет `UNIQUE(user_id, device_token)`, не глобальную уникальность токена. [pushNotificationService.js:25-37](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/pushNotificationService.js:25) выбирает токены всех переданных userIds без проверки текущей сессии/владельца.

Сценарий: один телефон T, два ещё авторизованных запроса A и B (смена аккаунта/запоздалая регистрация). На PostgreSQL возможен порядок DELETE A → DELETE B → INSERT A → INSERT B. Даже если перед гонкой была строка A, первый DELETE её оставляет, второй удаляет; последующие INSERT создают обе строки. Обе операции возвращают 200. После этого приватные названия проектов, репетиций и имена из push A доставляются на телефон с аккаунтом B. Это гонка двух реальных регистраций одного токена, не утверждение об угадывании чужого токена. Последовательная перерегистрация уже исправлена и покрыта тестами, параллельная — нет. F/FC01 объединён сюда, не считать дважды.

Минимум: очистить дубликаты и добавить UNIQUE(device_token), заменить пару запросов атомарным UPSERT владельца (0.5–1 день; + обеспечивает одного владельца на уровне БД, − поздний запрос старой сессии всё ещё может стать последним). Правильно: привязка устройства к поколению сессии/регистрации, отклонение старых запросов и отзыв push при завершении сессии, плюс атомарная уникальность (1–3 дня; + закрывает stale ownership, − требует протокола клиента/сервера). Одна transaction без уникальности/блокировки не гарантирует отсутствие гонки. Проверить вручную через барьеры двух PostgreSQL соединений и смену A→B на устройстве; никакие запросы не запускались.

Рабочие доказательства и покрытие: [notes-notifications-delivery.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-notifications-delivery.md).

<a id="g02"></a>

### G02 — Medium — ticket Expo принят за окончательный результат; receipts не обрабатываются

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/services/notifications/pushNotificationService.js:89](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/pushNotificationService.js:89):

```js
        const tickets = await expo.sendPushNotificationsAsync(chunk);

        tickets.forEach((ticket, index) => {
          if (ticket.status === 'ok') {
            totalSent++;
          } else {
            totalFailed++;
            logger.error('[Push] Ticket error:', ticket.message, ticket.details);
```

[pushNotificationService.js:89-103](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/pushNotificationService.js:89): `const tickets = await expo.sendPushNotificationsAsync(chunk);` и `if (ticket.status === 'ok') { totalSent++; }`; ticket.id не сохраняется, removeInvalidToken вызывается только при немедленном ticket error. Поиск по server first-party JS не нашёл чтения receipts/планировщика их обработки.

Сценарий: Expo принял сообщение, затем APNs/FCM отклонил доставку из-за невалидного токена или credentials. В логах остаётся Sent, token не очищается по позднему DeviceNotRegistered, причина отсутствия push не видна. Inbox обычно остаётся доступен (записывается до отправки), поэтому это не утверждение потери всех данных уведомления. Согласно [официальной документации Expo](https://docs.expo.dev/push-notifications/sending-notifications/), ticket подтверждает приём в Expo, receipt — попытку передачи провайдеру; даже успешный receipt не доказывает показ пользователю. Источник проверен 2026-09-10.

Минимум: сохранять ticket ID с токеном, отдельным периодическим шагом читать receipts и удалять только подтверждённые невалидные токены (0.5–1.5 дня; + видны поздние ошибки, − состояния повторов ещё разрознены). Правильно: таблица доставок/outbox с accepted/provider-delivered/failed, ограниченными повторами временных ошибок и метриками (2–4 дня; + наблюдаемость и управляемые повторы, − миграция/фоновые задачи). Ручная проверка: управляемые mock-ответы ticket ok → receipt error; никакая отправка не выполнялась.

Рабочие доказательства и покрытие: [notes-notifications-delivery.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-notifications-delivery.md).

<a id="gc01"></a>

### GC01 — Medium — «Позже» в onboarding не откладывает системный запрос уведомлений

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/onboarding/screens/NotificationsScreen.tsx:55](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/onboarding/screens/NotificationsScreen.tsx:55):

```tsx
      secondaryAction={{ title: t.onboarding.notifications.later, onPress: goOn }}
```

**Код:** [src/features/onboarding/screens/NotificationsScreen.tsx:55](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/onboarding/screens/NotificationsScreen.tsx:55) задаёт `secondaryAction={{ title: t.onboarding.notifications.later, onPress: goOn }}`, а `28` только переключает на WeekStart. Завершение/skip onboarding в [src/features/onboarding/hooks/useOnboarding.ts:15](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/onboarding/hooks/useOnboarding.ts:15) пишет только `{ onboardingCompleted: true }`, не сохраняет решение о push. В основном navigator после onboarding монтируется NotificationsHandler ([src/navigation/index.tsx:274](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/navigation/index.tsx:274),402-407), который запускает `useNotifications` (`167-168`). Hook ([src/shared/hooks/useNotifications.ts:31-33](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/hooks/useNotifications.ts:31)) выполняет:

```ts
if (user && user.notificationsEnabled) {
  registerForPushNotifications()
}
```

Регистрация ([src/shared/services/notifications.ts:47-52](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/notifications.ts:47)) при отсутствии разрешения вызывает `Notifications.requestPermissionsAsync()`. Начальное notifications_enabled=true подтверждено base schema [server/database/init-native-schema.sql:49](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/init-native-schema.sql:49); source schema была прочитана root в F.

**Сценарий:** новый пользователь с default-enabled account нажимает «Позже» вместо Allow, заканчивает оставшиеся шаги. Сразу при открытии основного экрана получает системный prompt, хотя выбрал отложить. То же возможно при Skip onboarding. Это противоречит комментарию notifications onboarding (`18-21`): запрос должен расходовать системное разрешение только после осознанного действия на объясняющем экране.

**Последствие:** проигнорированное решение пользователя, случайный отказ в разрешении и невозможность повторного стандартного prompt на iOS без перехода в Settings.

**Минимум:** при background mount вызывать только `syncPushTokenIfGranted`, оставить requestPermissions только explicit Allow/profile toggle (1–2 часа; устраняет неожиданный prompt, пользователю надо явно включить позже). **Правильно:** отдельно хранить account preference, OS permission и device registration state/отложенное решение; показывать явное действие повторной настройки (0.5–1 дня; одинаковая логика onboarding/profile/restore, больше состояний UI).

Рабочие доказательства и покрытие: [notes-notifications-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-notifications-client.md).

<a id="gc02"></a>

### GC02 — Medium — Profile сообщает успешное включение push при отказе OS или backend

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:53](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:53):

```tsx
    setNotificationsEnabled(value);

    try {
      // Update database
      await updateUser({ notificationsEnabled: value });

      // Register or unregister push token
      if (value) {
```

**Код:** [src/features/profile/screens/ProfileScreen.tsx:53-66](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:53) сначала ставит local switch=true, сохраняет `{notificationsEnabled:true}`, затем `await registerForPushNotifications()` и безусловно `hapticSuccess()`. Возвращаемое значение не проверяется. Service возвращает null при denied permission (`notifications.ts:55-58`), неподдерживаемом устройстве (`41-44`) и любом exception (`91-94`):

```ts
} catch (error) {
  console.error('[Notifications] Registration error:', error);
  return null;
}
```

**Сценарий:** пользователь включает switch в Profile; OS permission уже denied либо POST регистрации токена завершается network/5xx ошибкой. Helper не бросает исключение, внешний catch Profile не срабатывает, switch остаётся включённым и показана успешная haptic обратная связь. Но устройство не получает push. Аналогично onboarding всегда идёт дальше после null, там отказ может быть нормальным ответом, однако техническая ошибка отдельно не объясняется.

**Последствие:** пользователь рассчитывает на напоминания на этом устройстве, хотя регистрация/разрешение не получены. Это рассогласование device delivery и отображаемого состояния, не доказанный обход server preference.

**Минимум:** проверять registration result, при null показывать различимое объяснение permission/registration failure и действие Settings/retry, не обозначать device setup успешным (2–4 часа; сохраняет global preference, но текущего string|null недостаточно для хорошего текста). **Правильно:** discriminated result granted+registered / denied / unsupported / transient-error и UI отдельных account/device состояний (0.5–1 дня; корректно для нескольких устройств, потребуется адаптация onboarding и profile).

Рабочие доказательства и покрытие: [notes-notifications-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-notifications-client.md).

<a id="gc03"></a>

### GC03 — Medium — Временная ошибка регистрации при запуске не повторяется после восстановления связи

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/contexts/AuthContext.tsx:154](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:154):

```tsx
    if (hasPushSynced.current) return;
    hasPushSynced.current = true;

    syncPushTokenIfGranted()
```

**Код:** [src/contexts/AuthContext.tsx:154-157](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:154):

```ts
if (hasPushSynced.current) return;
hasPushSynced.current = true;
syncPushTokenIfGranted()
```

Flag остаётся true после helper null/failure ([src/shared/services/notifications.ts:133-137](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/notifications.ts:133)). Второй путь регистрации в useNotifications зависит от `[user, refresh, markRead]` (`149`), не от состояния подключения. AppState listener (`128-129`) при `active` обновляет только unread count, регистрации повторно не вызывает. Сервисы не ставят retry/backoff.

**Сценарий:** после logout backend token был удалён; следующий login проходит, но оба параллельных token-registration запроса попадают в кратковременный server/network сбой. Связь возвращается, приложение остаётся в этой сессии и неоднократно уходит в background/возвращается. Backend token остаётся незарегистрированным до нового mount/изменения user или ручного переключения настройки. 30-секундный timeout запроса ([api.ts:198-202](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:198)) уменьшает вероятность холодного старта, но не исправляет окончательный сбой.

**Последствие:** длительное молчаливое отсутствие уведомлений после короткой сетевой ошибки, хотя другие функции приложения уже работают.

**Минимум:** считать synced только после token success; делать ограниченный no-prompt retry на foreground при enabled+granted (2–4 часа; просто, требует защиты от дублирующихся запросов). **Правильно:** единый per-session/per-device registration coordinator с single-flight, backoff, connectivity/foreground recovery, session generation и удалением токена при logout (0.5–1 дня; закрывает retry и гонки, больше lifecycle проверки).

Рабочие доказательства и покрытие: [notes-notifications-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-notifications-client.md).

<a id="ni01"></a>

### NI01 — Medium — в приложении недоступны уведомления старше первых 50

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/notifications/screens/NotificationsScreen.tsx:62](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/notifications/screens/NotificationsScreen.tsx:62):

```tsx
      const res = await notificationsAPI.list();
      setItems(res.data.notifications || []);
```

Категория: пагинация / потеря доступа к данным интерфейса.

[src/features/notifications/screens/NotificationsScreen.tsx:62-63](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/notifications/screens/NotificationsScreen.tsx:62): `const res = await notificationsAPI.list(); setItems(res.data.notifications || []);`. API wrapper [src/shared/services/api.ts:408-409](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:408) задаёт default `limit = 50, offset = 0`; сервер [notificationStore.js:94-104](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/notificationStore.js:94) действительно применяет limit/offset. FlatList `NotificationsScreen.tsx:250-269` не имеет onEndReached или иной загрузки следующей страницы.

Сценарий: у пользователя 51+ уведомление. Старые записи ещё лежат в БД, но UI при каждом открытии и refresh загружает лишь свежие 50. Если эти 50 прочитаны, а более старые нет, общий unreadCount остаётся положительным, однако hasUnread вычисляется только по загруженным items (`:122`), и кнопка «Отметить все» скрыта (`:227-235`). Нельзя ни найти старое непрочитанное, ни пометить его прочитанным через обычный путь без удаления/очистки новых записей.

Минимум: подгрузка следующей страницы по offset/hasMore с дедупликацией и показ mark-all на основании общего unreadCount. Плюс — небольшое изменение существующего контракта; минус — offset может смещаться при новых поступлениях. Правильно: cursor pagination по `(created_at,id)` с явным hasMore, отдельные total/unreadCount, обновление/удаление без пропуска страниц. Плюс — устойчиво к новым уведомлениям; минус — нужен новый API контракт. Effort: 0.5–1 день / 1–2 дня.

Рабочие доказательства и покрытие: [notes-notifications-inbox.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-notifications-inbox.md).

<a id="ni02"></a>

### NI02 — Medium — ошибка «прочитано» скрывается, а UI объявляет уведомления прочитанными

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/contexts/UnreadContext.tsx:74](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/UnreadContext.tsx:74):

```tsx
  const markRead = useCallback(async (ids?: number[]) => {
    try {
      const res = await notificationsAPI.markRead(ids);
      remember(res.data?.unreadCount ?? 0);
    } catch (error) {
      logger.warn('[Unread] Could not mark as read:', error);
    }
```

Категория: обработка сетевых ошибок / согласованность состояния.

[src/contexts/UnreadContext.tsx:74-80](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/UnreadContext.tsx:74) ловит ошибку notificationsAPI.markRead и только логирует её, возвращая fulfilled Promise<void>. Вызывающие `NotificationsScreen.tsx:75-78,89-92` всегда после await ставят локальное `read: true`.

Сценарий: список уже загружен, сеть пропала; пользователь нажал «Отметить все» либо открыл одно уведомление. POST не дошёл до сервера. Карточки теряют unread-индикатор, кнопка mark-all может исчезнуть, но count/badge остаётся прежним и БД всё ещё считает записи непрочитанными. После следующего открытия они вновь подсвечиваются. Нет видимой ошибки или очереди повторной записи; пользователь получил ложное подтверждение действия.

Минимум: markRead возвращает success:boolean либо бросает исключение; экран обновляет read только после success или откатывает optimistic state с понятной ошибкой. Плюс — соответствует уже существующему remove():boolean; минус — offline-read не сохраняется автоматически. Правильно: персистентная idempotent очередь mark-read по конкретным IDs, отдельные pending/error состояния и reconciliation со счётчиком. Плюс — надёжный offline flow; минус — сложнее синхронизация. Effort: 2–4 часа / 1–2 дня.

Рабочие доказательства и покрытие: [notes-notifications-inbox.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-notifications-inbox.md).

<a id="ni03"></a>

### NI03 — Medium — счётчик прошлого аккаунта остаётся после смены пользователя

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/contexts/UnreadContext.tsx:37](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/UnreadContext.tsx:37):

```tsx
export function UnreadProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  // Until a real number arrives — from storage or the server — there is nothing
  // worth showing, and nothing worth writing to the app icon.
  const [known, setKnown] = useState(false);
  const knownRef = useRef(false);

```

Категория: изоляция локального состояния / неверные badge.

[src/contexts/UnreadContext.tsx:37-61](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/UnreadContext.tsx:37) создаёт состояние/knownRef один раз, загружает общий storage key `'unread-count'` (`:9,55`) и не использует user/session identity. [App.tsx:33-38](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/App.tsx:33) держит UnreadProvider над AppContent/Navigation, поэтому logout/login не размонтирует provider. Auth при смене пользователя удаляет storage key ([src/contexts/AuthContext.tsx:64-75](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:64)), но не память UnreadProvider; logout (`:367-375`) также не сбрасывает unreadCount/knownRef или системный badge.

Сценарий: A имеет 8 непрочитанных, затем выходит, B входит на том же запущенном приложении. Даже после удаления `'unread-count'` на диске context всё ещё хранит 8; до успешного server refresh B видит чужой счётчик, при offline/count failure он сохраняется намеренно ([UnreadContext.tsx:67-70](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/UnreadContext.tsx:67)). Уже запущенный ответ A может после очистки вызвать remember (`:45-51,65-66`) и заново записать A count в общий storage, установив и badge (`:111-116`). Это утечка счётчика активности/ошибочный badge, не чтение тела чужих уведомлений и не обход серверной авторизации.

Минимум: зависимость provider от user.id/session generation, сброс unreadCount/knownRef/known и badge при logout/account change, игнорирование поздних ответов предыдущей сессии. Плюс — закрывает текущий переход; минус — cleanup и чтение storage нужно согласовать. Правильно: scoped storage key и query-state по userId, атомарная смена владельца кеша, cancellation/generation всех запросов. Плюс — изоляция across restart/async; минус — миграция старого ключа и контекста. Effort: 3–5 часов / 1 день.

Стык A похож по причине на BC01/ES01, но здесь отдельный store счётчика; не раздувать до общего High cross-account доступа.

Рабочие доказательства и покрытие: [notes-notifications-inbox.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-notifications-inbox.md).

<a id="ni04"></a>

### NI04 — Medium — поздние ответы возвращают старый счётчик и уже удалённые карточки

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/contexts/UnreadContext.tsx:63](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/UnreadContext.tsx:63):

```tsx
  const refresh = useCallback(async () => {
    try {
      const res = await notificationsAPI.unreadCount();
      remember(res.data?.unreadCount ?? 0);
    } catch (error) {
      // Offline, most likely. Keeping the last known count beats zeroing it and
      // hiding something the reader has not seen.
      logger.warn('[Unread] Could not refresh the count:', error);
```

Категория: гонки чтения и mutation.

[src/contexts/UnreadContext.tsx:63-77](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/UnreadContext.tsx:63) и remove/removeAll `:83-98` все безусловно передают полученный unreadCount в remember, без sequence/version guard. `NotificationsScreen.tsx:59-69` load также безусловно заменяет items, в то время как deleteOne `:124-131` и clear-all `:153-163` меняют этот же список.

Сценарий счётчика: refresh прочитал N непрочитанных и ответ задержался; mark-all завершился позже на сервере, но раньше на клиенте, вернул 0. Приходит старый refresh → remember(N) возвращает badge и persist-ит его, хотя все уже read. Сценарий списка: pull-to-refresh получил snapshot до удаления, затем deleteOne успешно завершился и убрал строку; поздний load возвращает удалённую карточку в UI. Следующий tap/delete может получить 404, и пользователя вводит в заблуждение результат успешно выполненного действия. Исправление storage-read knownRef (`:57-58`) защищает только startup read, а не сеть.

Минимум: mutation generation, игнорирование query responses, начатых до успешной mutation; инвалидировать/перезапрашивать список и count после завершения. Плюс — небольшой guard в двух местах; минус — concurrent mutations нужно учитывать отдельно. Правильно: единый keyed query/cache с cancellation, optimistic mutations и merge по notification ID/version, серверная version для authoritative count если нужен строгий порядок. Плюс — общая согласованность; минус — шире data layer. Effort: 0.5–1 день / 1–2 дня.

Рабочие доказательства и покрытие: [notes-notifications-inbox.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-notifications-inbox.md).

<a id="ni05"></a>

### NI05 — Low — сбой первоначальной загрузки показывается как пустой inbox

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/notifications/screens/NotificationsScreen.tsx:62](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/notifications/screens/NotificationsScreen.tsx:62):

```tsx
      const res = await notificationsAPI.list();
      setItems(res.data.notifications || []);
    } catch (err) {
      logger.warn('[Notifications] Could not load:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
```

Категория: обработка ошибок / неверная информация пользователю.

`NotificationsScreen.tsx:64-68` при load failure только пишет logger.warn и выключает loading; initial items=[] (`:55`). Затем FlatList рендерит empty state (`:262-267`). Готовый перевод ошибки [src/i18n/translations/notifications.ts:30](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/i18n/translations/notifications.ts:30) — «Не удалось загрузить уведомления» — не используется экраном.

Сценарий: открыть inbox при offline/HTTP500. Вместо объяснения проблемы показано «Пока тихо» и обещание будущих уведомлений, хотя сервер может содержать важные сообщения. Pull-to-refresh остаётся доступным, но причина пустоты скрыта.

Минимум: loadError state, отдельный error + retry при отсутствии кеша; при ошибке refresh оставить старый список с сообщением. Плюс — маленький UI fix; минус — offline inbox без кеша всё ещё недоступен. Правильно: scoped per-user persisted list и явные lastLoadedAt/stale/error состояния. Плюс — полезен офлайн; минус — кеш и очистка на account switch. Effort: 1–2 часа / 0.5–1 день.

Рабочие доказательства и покрытие: [notes-notifications-inbox.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-notifications-inbox.md).

<a id="ni06"></a>

### NI06 — Low — API markRead с пустым списком отмечает весь inbox

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/native/notifications.js:52](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/notifications.js:52):

```js
 * POST /api/native/notifications/read
 * Body: { ids: number[] } to mark those, or {} for the whole inbox.
 * Answers with the unread count that remains, so the client can set the badge
 * without a second round trip.
```

Категория: API контракт / обработка пользовательского ввода.

Документированный контракт [server/routes/native/notifications.js:52-55](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/notifications.js:52): `{ids:number[]}` отмечает указанные, `{}` — весь inbox. Валидация `:61-65` принимает ids=[]. [server/services/notifications/notificationStore.js:188](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/notificationStore.js:188) проверяет `Array.isArray(ids) && ids.length > 0`, поэтому пустой массив попадает в ветку `:198-201` с UPDATE всех непрочитанных пользователя. Клиентский wrapper [src/shared/services/api.ts:415-416](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/services/api.ts:415) тоже отправит явное `{ids:[]}`, поскольку массив truthy.

Сценарий достижимости: аутентифицированный API-клиент отправляет POST `/api/native/notifications/read` с `{ids:[]}`, например после фильтрации выбранных ID до пустого набора. Вместо no-op все уведомления становятся read, в том числе ещё не показанные. В текущем экране обычные вызовы передают undefined либо одиночный непустой массив, поэтому это контрактный edge case, не утверждение о ежедневном tap flow. Серверное WHERE user_id сохраняет изоляцию аккаунтов.

Минимум: различать отсутствие ids и наличие массива; [] возвращает current count без UPDATE или 400. Плюс — минимальный fix; минус — нужно задокументировать empty semantics. Правильно: отдельное явное all:true/endpoint для mark-all, строгая валидация положительных safe-integer IDs и contract tests. Плюс — исключает неоднозначность destructive scope; минус — версионирование API. Effort: 1–2 часа / 0.5 дня.

Рабочие доказательства и покрытие: [notes-notifications-inbox.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-notifications-inbox.md).

<a id="gr01"></a>

### GR01 — Medium — ошибка отправки push не освобождает reminder claim

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:141](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:141):

```js
        const claim = await db.get(
          `INSERT INTO native_push_reminders (rehearsal_id, user_id, reminder_type, sent_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (rehearsal_id, user_id, reminder_type) DO NOTHING
           RETURNING id`,
          [rehearsal.id, userId, type, now.toISOString()]
        );
        if (claim) unclaimed.push(userId);
```

Места: [server/services/notifications/reminderScheduler.js:141–174](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:141); [server/services/notifications/pushNotificationService.js:117](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/pushNotificationService.js:117),172–184,329–346 (полный send helper и его return contract проверены при сверке исходников G).

```js
// reminderScheduler.js:156–174
try {
  await notify(rehearsal, rehearsal.project_name, unclaimed);
  sent += 1;
} catch (err) {
  for (const userId of unclaimed) {
    await db.run('DELETE FROM native_push_reminders ...', [rehearsal.id, userId, type]);
  }
  throw err;
}
// pushNotificationService.js:177–183
for (const [locale, ids] of groups.entries()) {
  await sendPushNotification(ids, { title: tr.title, body: tr.body(params), data });
}
```

Сценарий: claim уже сохранён, Expo send отклонён/сетевая ошибка либо все tickets имеют status error. `sendPushNotification` ловит штатные send failures и возвращает `{sent:0,failed:N,...}` вместо throw (:117); `sendLocalizedNotification` результат игнорирует и resolve undefined; notifyRehearsal24h/1h тоже resolve undefined. Scheduler увеличивает `sent`, claims остаются. Следующий cron исключает этих пользователей через NOT EXISTS (:94–98), хотя push им не ушёл. При partial success теряются только failed recipients, но helper не возвращает их scheduler.

Проявление: уведомление на устройство не приходит и не повторяется после восстановления Expo/сети; cron сообщает отправку. Inbox-запись может быть создана до push и остаться доступной в приложении — находка не утверждает потерю inbox во всех случаях. Это отличается от отсутствия receipt polling после принятого Expo ticket, которое основной аудитор учтена отдельно: здесь уже immediate failure известен сервису, но потерян между слоями.

Тест [reminderScheduler.integration.test.js:204–216](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/__tests__/integration/reminderScheduler.integration.test.js:204) заменяет настоящий notify на `mockRejectedValueOnce(new Error('Expo is down'))`, а настоящий helper на таком сбое обычно не rejects. Тест проверяет недостоверный контракт сбоя, поэтому не доказывает работоспособность runtime retry.

Минимум (1–3 ч): возвращать результат send через localized/notify helpers, не считать all-failed успешной отправкой и освобождать соответствующие claims. Плюс: локальная поправка контракта; минус: release всех после partial success дублирует push успешно уведомлённым людям, нужен хотя бы per-user result.

Правильно (1–2 дня): per-recipient delivery state с distinction attempted/accepted/failed, адресные retry, bounded backoff и claim lease. Inbox идемпотентно привязать к reminder identity, чтобы retries push не множили уведомления. Плюс: точное восстановление и отчёт; минус: схема результата/claims и интеграция push/inbox. Runtime failure test должен пройти через реальные helper contracts с mocked Expo, не заменять notify на произвольный throw.

Актуальная эксплуатационная граница: автоматический GitHub schedule отключён на HEAD 0f655e2; дефект обработчика относится к ручному/прямому запуску или будущему возобновлению расписания.

Рабочие доказательства и покрытие: [notes-reminders.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-reminders.md).

<a id="gr02"></a>

### GR02 — Medium — ошибка или остановка между claims и notify навсегда исключает ещё не уведомлённых пользователей

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:139](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:139):

```js
      const unclaimed = [];
      for (const userId of memberIds) {
        const claim = await db.get(
          `INSERT INTO native_push_reminders (rehearsal_id, user_id, reminder_type, sent_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (rehearsal_id, user_id, reminder_type) DO NOTHING
           RETURNING id`,
          [rehearsal.id, userId, type, now.toISOString()]
```

Места: [server/services/notifications/reminderScheduler.js:139–157](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:139),162–178; [server/database/init-native-schema.sql:243–253](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/database/init-native-schema.sql:243).

```js
const unclaimed = [];
for (const userId of memberIds) {
  const claim = await db.get(
    `INSERT INTO native_push_reminders (rehearsal_id, user_id, reminder_type, sent_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (rehearsal_id, user_id, reminder_type) DO NOTHING RETURNING id`,
    [rehearsal.id, userId, type, now.toISOString()]
  );
  if (claim) unclaimed.push(userId);
}
// only now starts the try whose catch removes claims
try { await notify(...); } catch (err) { /* cleanup */ }
```

Сценарий: roster содержит A,B. INSERT claim A проходит, INSERT claim B получает DB error (например, B удалён из native_users после чтения roster и FK не даёт вставить claim, либо прервано соединение). Ошибка выходит в внешний catch :176–178, который только логирует; cleanup :162 никогда не запускается. Claim A остаётся, notify для A вообще не вызывался. Аналогично процесс/serverless function может остановиться после INSERT claim и до notify, а у постоянного claim нет expires_at/lease/state: ни следующий run, ни резервный scheduler его не подберут.

Проявление: часть пользователей навсегда пропускает конкретное напоминание из-за временного сбоя перед отправкой. Наличие UNIQUE защищает от параллельной двойной отправки, но не гарантирует доставку после claim; это две разные гарантии.

Минимум (1–3 ч): охватить claim loop общим try/cleanup, атомарно сформировать группу claims и не терять уже вставленные claimIds при исключении; удалять только claims данного run. Плюс: исправляет catch-path; минус: не восстанавливает работу после принудительного завершения процесса.

Правильно (1–2 дня): claim со status/lease/attemptId и временем истечения, безопасный повтор после истёкшего lease; завершать claim только после установленного delivery outcome. Плюс: выдерживает timeout/process crash; минус: задача доставки становится at-least-once, внешние дубли нужно минимизировать/idempotency, обещание exactly-once без поддержки провайдера давать нельзя.

Актуальная эксплуатационная граница: автоматический GitHub schedule отключён на HEAD 0f655e2; дефект обработчика относится к ручному/прямому запуску или будущему возобновлению расписания.

Рабочие доказательства и покрытие: [notes-reminders.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-reminders.md).

<a id="gr03"></a>

### GR03 — Medium — cron и workflow показывают успех при отказе БД/напоминаний

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:102](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:102):

```js
  } catch (err) {
    logger.error(`[Reminder] Could not load rehearsals for the ${type} reminder:`, err);
    return { found: 0, sent: 0 };
  }
```

Места: [server/services/notifications/reminderScheduler.js:102–105](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:102),176–181; [server/routes/cron.js:46–57](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/cron.js:46); [.github/workflows/rehearsal-reminders.yml:67–70](/Users/vadimfertik/Desktop/reh_app/.github/workflows/rehearsal-reminders.yml:67) (в HEAD `0f655e2`; ранее :49–52).

```js
// scheduler, error loading due rehearsals
catch (err) {
  logger.error(...);
  return { found: 0, sent: 0 };
}
// route after checkUpcomingRehearsals resolves
res.json({ success: true, message: 'Reminder check completed', ...result });
```

Сценарий: SQL query сломан после неполной миграции или БД временно не отвечает. Оба sendReminders возвращают found0/sent0. Route отдаёт200 success:true. Workflow считает успехом любой200 и не имеет данных, позволяющих отличить отказ от отсутствия due репетиций. Ошибки внутри claim/notify также только логируются и не попадают в result, поэтому failed run может быть зелёным.

Проявление: внешнее наблюдение не обнаруживает простой reminders, и операторы узнают о пропусках от пользователей. Комментарий [cron.js:50–52](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/cron.js:50) прямо обещает, что counts позволяют отличить «ничего не было» от «query broken», но для query error результат идентичен пустой БД. Это operational correctness, не обход авторизации cron.

Минимум (1–2 ч): при ошибке загрузки выбрасывать ошибку до route500 либо явно возвращать failed/errors и non-success status. Плюс: existing HTTP monitor сразу замечает отказ; минус: частичный успех двух windows нужно описать отдельно.

Правильно (0.5–1 день): structured per-window/per-recipient outcome, HTTP status/health для partial failure, lastSuccessfulRun и monitoring failed/expired claims. Плюс: видно реальную работоспособность и размер сбоя; минус: согласование workflow/операционных метрик. Secrets/провайдеры мониторинга при этом в аудите не настраивались.

Актуальная эксплуатационная граница: автоматический GitHub schedule отключён на HEAD 0f655e2; дефект обработчика относится к ручному/прямому запуску или будущему возобновлению расписания.

Рабочие доказательства и покрытие: [notes-reminders.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-reminders.md).

<a id="gr04"></a>

### GR04 — Low — текст «завтра»/«через1час» противоречит расширенным окнам напоминания

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:24](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:24):

```js
 * widening costs nothing. The 12-hour floor on the day-before reminder is what
 * keeps its wording honest: "Rehearsal tomorrow" should not arrive for
 * something starting this afternoon.
 */
const DAY_BEFORE_FLOOR_MS = 12 * 60 * 60 * 1000;
const DAY_BEFORE_CEILING_MS = 24 * 60 * 60 * 1000;
const HOUR_BEFORE_CEILING_MS = 60 * 60 * 1000;
```

Места: [server/services/notifications/reminderScheduler.js:24–30](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:24),42–55; [server/i18n/pushNotifications.js:60–69](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/i18n/pushNotifications.js:60) (то же en:130–139, es:200–209, de:270–279); [server/services/notifications/pushNotificationService.js:333](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/pushNotificationService.js:333),345.

```js
const DAY_BEFORE_FLOOR_MS = 12 * 60 * 60 * 1000;
const DAY_BEFORE_CEILING_MS = 24 * 60 * 60 * 1000;
const HOUR_BEFORE_CEILING_MS = 60 * 60 * 1000;
// translations
rehearsal24h: { title: 'Репетиция завтра', ... },
rehearsal1h: { title: 'Репетиция через 1 час', ... },
```

Сценарий1: scheduler/пользователь сейчас9:00, репетиция22:00 того же дня, раньше напоминание не отправлялось. Через13часов попадает в day-before window и получает «Репетиция завтра». 12часов минимальной дистанции не гарантирует следующую календарную дату даже без timezone/DST. Сценарий2: catch-up run за10минут до старта (специально допускается тестом :155–163) отправляет «через1час». Notification body содержит только проект/title, точного времени нет.

Проявление: пользователь получает неверное временное указание, хотя сама репетиция в приложении имеет правильную дату. Комментарий :24–26 об «honest tomorrow» математически неверен; тест :127–133 проверяет лишь5часов и не проверяет13часов в пределах того же дня.

Минимум (30–60 мин): нейтральный title «Напоминание о репетиции»/«Репетиция скоро», при желании точное время в body. Плюс: корректно при задержках; минус: менее конкретный title.

Правильно (0.5 дня): формировать relative/date/time wording для каждого recipient в его timezone, показывать фактический startsAt; keep широкие retry windows. Плюс: полезное сообщение независимо от задержки cron; минус: нужен recipient timezone в builder и локализация.

Актуальная эксплуатационная граница: автоматический GitHub schedule отключён на HEAD 0f655e2; дефект обработчика относится к ручному/прямому запуску или будущему возобновлению расписания.

Рабочие доказательства и покрытие: [notes-reminders.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-reminders.md).

<a id="gr05"></a>

### GR05 — Medium — старый scheduler snapshot ставит claim уже после переноса репетиции и блокирует новое напоминание

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:77](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:77):

```js
    rehearsals = await db.all(
      `SELECT r.*, p.name as project_name
       FROM native_rehearsals r
       JOIN native_projects p ON r.project_id = p.id
       -- Due, and with somebody on it who has not been told yet.
       --
       -- This used to exclude a rehearsal the moment any claim existed for it,
       -- which with one claim per rehearsal was the same question. It is not
```

Места: [server/services/notifications/reminderScheduler.js:77–100](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/notifications/reminderScheduler.js:77),119–147,157; [server/services/rehearsals/rehearsalService.js:477–510](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rehearsalService.js:477).

```js
// scheduler caches the rehearsal before awaits/claims
rehearsals = await db.all('SELECT r.*, p.name ... WHERE r.starts_at BETWEEN ? AND ? ...');
// claim does not carry the rehearsal start/revision
ON CONFLICT (rehearsal_id, user_id, reminder_type) DO NOTHING
// rehearsalService:509–510
if (existing && new Date(existing.starts_at).getTime() !== new Date(updatedRehearsal.starts_at).getTime()) {
  await db.run('DELETE FROM native_push_reminders WHERE rehearsal_id = $1', [rehearsalId]);
}
```

Конкретная последовательность: (1) cron прочитал rehearsal R, старый startsAt через20часов; (2) пока cron ожидает roster/DB, администратор перенёс R на+3дня; update записал новый startsAt и удалил старые claims; (3) прежний cron продолжает на snapshot R, вставляет claim по rehearsalId/userId/type и отправляет напоминание по старой due дате; (4) за сутки до новой даты NOT EXISTS уже видит этот поздно вставленный claim и не отправляет новое напоминание. Исправление атомарности редактирования D03 само по себе не закрывает это: stale cron snapshot не проверяет revision при вставке.

Проявление: ложное напоминание после переноса и отсутствие нужного позже. Тесты rehearsalNotifications:349–359 выполняют update после заранее созданного claim последовательно; обратное interleaving «read→update+delete→claim» ими не проверяется.

Минимум (2–4 ч): claim через условный INSERT SELECT, проверяющий, что starts_at/updated revision rehearsal всё ещё соответствует прочитанному snapshot; перед отправкой валидировать актуальность, старую задачу отменять. Плюс: предотвращает запись устаревшего claim; минус: без общего revision/lock остаются узкие races между подтверждением и внешней отправкой.

Правильно (1–2 дня): reminder identity включает rehearsal schedule revision/startsAt; due query игнорирует claims старой версии, reschedule создаёт новую immutable delivery task, state/lease/attempt ownership общие с GR02. Плюс: перенос и конкурентные runners согласованы; минус: миграция claims и изменения scheduler/update API. Releasing failed claims тоже нужно делать по claimId/attemptId, чтобы старый run не удалил claim другой версии.

Актуальная эксплуатационная граница: автоматический GitHub schedule отключён на HEAD 0f655e2; дефект обработчика относится к ручному/прямому запуску или будущему возобновлению расписания.

Рабочие доказательства и покрытие: [notes-reminders.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-reminders.md).

<a id="h01"></a>

### H01 — High — сохранённая XSS из обращения/профиля выполняется в admin origin

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/admin/dashboardPage.js:430](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/admin/dashboardPage.js:430):

```js
      body.innerHTML = d.reports.map(function(r) {
        return '<tr>' +
          '<td>' + r.name + '</td>' +
          '<td class="msg-cell">' + r.message + '</td>' +
          '<td class="screen-cell">' + (r.screen || '-') + '</td>' +
          '<td>' + statusButtons(r.id, r.status) + '</td>' +
          '<td>' + fmtDate(r.createdAt) + '</td>' +
        '</tr>';
```

[server/routes/admin/dashboardPage.js:430-438](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/admin/dashboardPage.js:430) формирует `body.innerHTML = d.reports.map(...)` и вставляет `'<td class="msg-cell">' + r.message + '</td>'`, `r.name`, `r.screen` без экранирования. Второй источник `:368-375`: firstName/lastName/email в users table тем же способом. [server/routes/native/bugReports.js:13-20](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/bugReports.js:13) принимает любую непустую строку и сохраняет message.trim(); `/auth/register:17-20,34-37` сохраняет имена без ограничения HTML. Это допустимые текстовые данные: защита нужна в HTML sink. [server/server.js:203-220](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:203) явно разрешает `scriptSrcAttr: ["'unsafe-inline'"]` для admin. Токен администратора хранится в localStorage ([dashboardPage.js:253-259](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/admin/dashboardPage.js:253)).

Сценарий: обычный зарегистрированный пользователь записывает в message (либо имя) HTML с обработчиком ошибки изображения. Когда администратор открывает dashboard, innerHTML создаёт элемент, его handler выполняется в origin административной страницы. Может читать admin_token, запрашивать `/admin/api/users`/обращения с этим токеном, менять статусы обращений. CSP connect-src self ограничивает некоторые каналы вывода, но не запрещает чтение токена, same-origin API или навигацию; это не достаточная защита. Не заявляется shell/DB admin takeover: доступ ограничен реально имеющимися административными API. Опасный payload не записывался и не выполнялся.

Минимум: textContent для каждой пользовательской ячейки либо единый проверенный HTML-escaping перед интерполяцией всех указанных полей (2–5 часов; + закрывает известные sinks, − ручная интерполяция легко оставит следующий пробел). Правильно: DOM/textContent rendering, event listeners вместо inline handlers, строгий nonce/external-script CSP, сокращение/отзыв admin sessions (1–2 дня; + защита данных и второй барьер, − переработка небольшой dashboard). Переход на httpOnly cookie сам по себе не защищает API от уже выполняющейся XSS. Ручная проверка после fix: harmless HTML marker/handler в изолированной тестовой БД, просмотр users и reports, CSP violation; никаких действий в production.

Рабочие доказательства и покрытие: [notes-public-admin.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-public-admin.md).

<a id="h02"></a>

### H02 — Medium — резервная кнопка открытия приглашения блокируется CSP

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/server.js:317](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:317):

```js
          <a href="#" onclick="openApp(); return false;" class="button" id="openButton"></a>
```

[server/server.js:317](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:317) генерирует `<a href="#" onclick="openApp(); return false;" ...>`. Основной inline script имеет nonce (:320), но onclick nonce не имеет и к nonce script не относится. Глобальный CSP `:83-101` разрешает script по nonce, не разрешает script-src-attr; Helmet default блокирует inline attributes (это прямо учтено для admin в комментариях :207-210). Invite route :255-358 не использует relaxedCsp. `window.onload` вызывает openApp (:351); через2сек показывает manual (:342-345), однако её onclick блокируется.

Сценарий: браузер не запускает custom scheme без жеста пользователя либо пользователь отклонил первоначальную попытку. После появления Open App нажимает кнопку, но она только меняет fragment на # и не вызывает openApp. Устройство с уже установленным приложением остаётся на странице. Дополнительно inline style block :267 и style attribute :315 не разрешены global style-src (:90), поэтому fallback теряет оформление/начальную скрытость. Не заявляется, что universal links никогда не работают: проблема именно browser fallback.

Минимум: назначить click через addEventListener внутри разрешённого nonce script, вынести CSS в public file (1–3 часа; + сохраняет строгую policy, − остаётся browser-dependent auto launch). Правильно: fallback с настоящим href custom scheme, progressive enhancement и явными действиями install/open, внешний JS/CSS или nonce policy без unsafe-inline (0.5–1 день; + ручное открытие работает без inline handler, − нужен QA Safari/Chrome/встроенных браузеров). Проверить реальные CSP headers и отказ автооткрытия; runtime не запускался.

Рабочие доказательства и покрытие: [notes-public-admin.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-public-admin.md).

<a id="h03"></a>

### H03 — Low — метрика неактивности принимает давний login за отсутствие использования

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/admin.js:35](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/admin.js:35):

```js
      db.get('SELECT COUNT(*) as count FROM native_users WHERE created_at >= $1', [weekAgo.toISOString()]),
      db.get('SELECT COUNT(*) as count FROM native_users WHERE created_at >= $1', [monthAgo.toISOString()]),
      db.get(`
        SELECT COUNT(*) as count
        FROM native_users
```

[server/routes/admin.js:35-39](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/admin.js:35) считает inactive через `last_login_at < monthAgo`, отображение [dashboardPage.js:341-343](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/admin/dashboardPage.js:341) называет это `User Churn (30 days)`/Inactive users. Поиск записей last_login_at по server first-party JS нашёл register/password/Google/Apple login; refresh и обычные authenticated действия дату не обновляют. При непрерывной refresh-сессии человек ежедневно пользуется приложением более30дней и учитывается ушедшим. Обратное: NULL last_login_at полностью исключён, legacy никогда не входившие не попадают в inactive numerator. Это аналитическая ошибка, не потеря доступа пользователя.

Минимум: назвать метрику «не входили заново >30дней», убрать churn вывод (30–60мин; + честно описывает имеющиеся данные, − не измеряет использование). Правильно: last_active_at с редким coalesced обновлением при реальных действиях и документированное окно retention/churn (0.5–1 день; + годится для решений о продукте, − дополнительная запись/определение активности).

Рабочие доказательства и покрытие: [notes-public-admin.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-public-admin.md).

<a id="h04"></a>

### H04 — Low — admin скрывает ошибки загрузки/смены статуса

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/routes/admin/dashboardPage.js:261](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/admin/dashboardPage.js:261):

```js
  async function api(path, opts) {
    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var res = await fetch('/admin/api' + path, Object.assign({ headers: headers }, opts || {}));
    if (res.status === 401) { clearToken(); showLogin(); throw new Error('Unauthorized'); }
    return res.json();
  }
```

[dashboardPage.js:261-268](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/admin/dashboardPage.js:261) api() проверяет только401, любой500 возвращает JSON как обычный результат. loadStats/users/bugReports :356/:377/:440 глушат catch с комментарием handled by api(), но api() не показывает network/5xx ошибки. Первоначальный spinner остаётся Loading без retry-пояснения либо старая таблица выглядит актуальной. `setBugStatus:412-418` не проверяет fetch.ok/status, после failed PATCH просто перезагружает список без сообщения: администратор не знает, что изменение не записалось.

Минимум: общий res.ok guard и видимый error/retry для каждой секции; PATCH проверять до refresh (2–3 часа; + понятный сбой, − нужна ручная повторная попытка). Правильно: явные loading/stale/error/mutation states и согласованный API helper с session invalidation (0.5–1 день; + правдивая обратная связь, − больше UI state). Отрицательные limit/offset admin-only также возвращают500; не отдельная security finding.

Рабочие доказательства и покрытие: [notes-public-admin.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-public-admin.md).

<a id="hp01"></a>

### HP01 — Medium — изменение email подтверждается, но сервер его игнорирует

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:66](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:66):

```tsx
      await updateUser({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim(),
      });

      hapticSuccess();
      Alert.alert(t.profile.profileUpdated, undefined, [
```

- Доказательство: [src/features/profile/screens/EditProfileScreen.tsx:66–73](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:66): `await updateUser({ firstName: firstName.trim(), lastName: lastName.trim() || undefined, email: email.trim() });` затем `Alert.alert(t.profile.profileUpdated, ...)`. В [server/routes/auth.js:301–323](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:301) whitelist содержит имя/фамилию и настройки, **email отсутствует**; цикл `:334–337` обрабатывает только whitelist. Поля имени всегда отправляются, поэтому запрос не попадает в `No fields to update`.
- Сценарий: пользователь меняет только email на валидный новый, нажимает Save, получает «профиль обновлён»; ответ и повторное открытие показывают прежний email. Новым адресом входить нельзя. Для аккаунта без email обязательная клиентская проверка [EditProfileScreen.tsx:47–50](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:47) дополнительно мешает сохранять имя без ввода адреса, который всё равно не сохранится.
- Минимально: убрать редактирование email и валидацию неизменяемого адреса из общей формы (плюс: честный UI и небольшой объём; минус: смена email остаётся недоступна; 1–2 ч).
- Правильно: отдельный проверяемый сценарий смены email с нормализацией, уникальностью, подтверждением адреса/учётных данных и явным состоянием ожидания (плюс: полноценная безопасная функция; минус: сервер, почтовая доставка и состояния UI; 1–3 дня). Не исправлять одним добавлением поля в whitelist.

Рабочие доказательства и покрытие: [notes-profile-onboarding.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-profile-onboarding.md).

<a id="hp02"></a>

### HP02 — Low — существующую фамилию нельзя очистить

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:68](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:68):

```tsx
        lastName: lastName.trim() || undefined,
```

- Доказательство: [src/features/profile/screens/EditProfileScreen.tsx:68](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:68): `lastName: lastName.trim() || undefined`; [server/routes/auth.js:335–337](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:335): `const value = req.body[apiField]; if (value === undefined) continue;`. JSON не передаёт undefined, поэтому пустая фамилия означает отсутствие изменения. После запроса UI сообщает успех [EditProfileScreen.tsx:73](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/EditProfileScreen.tsx:73).
- Сценарий: стереть прежнюю фамилию целиком и сохранить; сервер оставляет прежнюю фамилию, она снова видна после возврата в профиль. Простая замена фамилии работает.
- Минимально: передавать пустую строку как явное очищение (плюс: узкий фикс, текущий trimName поддерживает строку; минус: нужно согласовать представление пустоты; 0.5–1 ч).
- Правильно: закрепить patch-контракт `undefined = не изменять`, `null/пустая строка = очистить`, привести типы/сервер и проверить очистку отдельно (плюс: однозначное поведение всех optional полей; минус: небольшой совместный API/UI объём; 2–4 ч).

Рабочие доказательства и покрытие: [notes-profile-onboarding.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-profile-onboarding.md).

<a id="hp03"></a>

### HP03 — Low — ошибка «пропустить онбординг» остаётся необработанным Promise

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/onboarding/hooks/useOnboarding.ts:18](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/onboarding/hooks/useOnboarding.ts:18):

```ts
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      throw error;
```

- Доказательство: [src/features/onboarding/hooks/useOnboarding.ts:18–20](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/onboarding/hooks/useOnboarding.ts:18): catch пишет в console и `throw error`; callback системного Alert `:34–35`: `onPress: async () => { await completeOnboarding(); }` без catch. Обычное завершение в [WeekStartScreen.tsx:31–41](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/onboarding/screens/WeekStartScreen.tsx:31) в отличие от skip имеет обработку и Alert.
- Сценарий: без сети нажать Skip и подтвердить; обновление `onboardingCompleted` отклоняется, ошибка уходит из callback Alert без пользовательского сообщения. Пользователь остаётся в онбординге без объяснения; это не утверждение о native crash.
- Минимально: catch с локализованным Alert в callback Skip (плюс: ясный отказ; минус: остаётся раздельная обработка завершения; 0.5–1 ч).
- Правильно: единая операция завершения со статусом/ошибкой, защитой повторного отправления и одинаковым UI для Finish/Skip (плюс: согласованность; минус: изменение контракта hook/экранов; 2–4 ч).

Рабочие доказательства и покрытие: [notes-profile-onboarding.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-profile-onboarding.md).

<a id="hp04"></a>

### HP04 — Medium — ручная настройка timezone сбрасывается при следующем запуске/входе

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:92](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:92):

```tsx
  const handleTimezoneSelect = async (timezone: string) => {
    hapticLight();
    try {
      await updateUser({ timezone });
      setTimezoneModalVisible(false);
      hapticSuccess();
```

- Доказательство: [src/features/profile/screens/ProfileScreen.tsx:92–97](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:92): `await updateUser({ timezone });` с успешным закрытием модалки; выбор зоны доступен `:261–274`. [src/contexts/AuthContext.tsx:166–191](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:166) при login/restore один раз за сессию получает `deviceTimezone`; если отличается от `user.timezone`, безусловно выполняет `authAPI.updateMe({ timezone: deviceTimezone })` (`:176–180`). Флага ручного выбора/автоматического режима нет.
- Сценарий: на устройстве с зоной A выбрать в профиле зону B для работы с расписанием, получить успешное сохранение, перезапустить приложение с сетью. Restore молча переписывает серверную настройку обратно на A. Это подтверждённая потеря явной настройки; сами ISO timestamps не изменяются, но время в интерфейсах/API, использующих user timezone, меняет представление. Отдельно от AC03 late-session response: здесь не требуется гонка или смена аккаунта.
- Минимально: автоматически заполнять только отсутствующую timezone (плюс: ручной выбор сохраняется; минус: при поездках не следует за устройством; 1–2 ч).
- Правильно: настройка «автоматически по устройству / выбранная зона» с сохранённым режимом, auto-sync только в первом режиме (плюс: ясное поведение для поездок и удалённых проектов; минус: изменение API/настройки UI; 0.5–1 день).

Рабочие доказательства и покрытие: [notes-profile-onboarding.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-profile-onboarding.md).

<a id="hp05"></a>

### HP05 — Low — онбординг показывает подключённый календарь после отказа сохранения

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/onboarding/screens/CalendarSyncScreen.tsx:130](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/onboarding/screens/CalendarSyncScreen.tsx:130):

```tsx
      setSelectedCalendarId(calendarId);

      await updateSettings({
        exportEnabled: true,
        exportCalendarId: calendarId,
        importEnabled: true,
        // Single-calendar mode: sync only the picked one
        importCalendarIds: [calendarId],
```

- Доказательство: [src/features/onboarding/screens/CalendarSyncScreen.tsx:130–141](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/onboarding/screens/CalendarSyncScreen.tsx:130) сначала `setSelectedCalendarId(calendarId)`, затем `await updateSettings(...)`; catch `:144–148` показывает ошибку, но не откатывает selection. Зелёная галочка `:261–262` и итоговый текст «Занятые часы будут подтягиваться сами» `:295–297` выбираются только по selectedCalendarId. [useCalendarSync.ts:149–156](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useCalendarSync.ts:149) и [calendarStorage.ts:201–208](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/calendarStorage.ts:201) пробрасывают отказ AsyncStorage, поэтому это достижимая ветка, а не обработка недостижимого исключения.
- Сценарий: native storage отказывает при выборе календаря; закрыть Alert об ошибке. Визуально календарь по-прежнему подключён, Next снова доступен, хотя settings не сохранены и выбранный sync работать не будет. Другой обычный стык: при повторном входе в этот шаг локальный selectedCalendarId снова null, хотя ранее сохранённый settings может быть включён — UI вообще не производит свой статус из сохранённых настроек.
- Минимально: выставлять selection после успешного updateSettings либо откатывать к прежнему значению в catch (плюс: правильный статус после отказа; минус: повторный mount требует отдельной инициализации; 1–2 ч).
- Правильно: различать draft/saving/saved и выводить итог подключения из актуального settings; инициализировать выбор после загрузки (плюс: честные состояния и повторный вход; минус: несколько состояний экрана; 3–5 ч).

Рабочие доказательства и покрытие: [notes-profile-onboarding.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-profile-onboarding.md).

<a id="hn01"></a>

### HN01 — Medium — Приглашение теряется при первом входе через onboarding

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/navigation/index.tsx:347](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/navigation/index.tsx:347):

```tsx
  const shouldShowOnboarding = isAuthenticated && !user?.onboardingCompleted;
```

**Доказательство.** [src/navigation/index.tsx:347](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/navigation/index.tsx:347) вычисляет `shouldShowOnboarding = isAuthenticated && !user?.onboardingCompleted`. При этом обработчик URL проверяет только `isAuthenticated && navigationRef.current` и сразу вызывает `navigate('JoinProject', { code })` (`356–359`). Для отложенного приглашения эффект `380–387` делает:

```tsx
if (isAuthenticated && pendingInviteCode && navigationRef.current) {
  setTimeout(() => {
    navigationRef.current?.navigate('JoinProject', { code: pendingInviteCode });
    setPendingInviteCode(null);
  }, 500);
}
```

В этот момент `404–407` выбирает `OnboardingNavigator`, тогда как `JoinProject` объявлен в `AppNavigator` (`291–295`). Полное чтение OnboardingNavigator подтвердило тип маршрутов (`10–15`) и реальные Screen (`28–31`): только Welcome, CalendarSync, Notifications, WeekStart; JoinProject отсутствует. Декларативный linking сам отключён на onboarding (`400`). В зависимостях эффекта нет ни `shouldShowOnboarding`, ни `loading`, ни признака готовности navigator; таймер не очищается.

**Сценарий.** Пользователь открывает invite URL до входа: custom handler сохраняет код. После регистрации/первого входа `isAuthenticated` становится true, но требуется onboarding. Через 500 мс код отправляется в текущий navigator, где нет JoinProject, затем безусловно стирается. Пользователь завершает onboarding и остаётся без приглашения. Аналогично URL, открытый уже во время onboarding, не попадает в очередь из-за проверки только auth. Сценарий не требует гонки SDK: проблема в выборе ветки приложения и безусловном consume. Отдельные cold-start моменты `navigationRef.current === null` требуют проверки готовности, но для finding достаточно обычного завершения login в уже смонтированном NavigationContainer.

**Минимум.** Сохранять приглашение до `isAuthenticated && !shouldShowOnboarding && !loading` и готового navigation ref; инициировать переход при выполнении этих условий и очищать только после принятого перехода. Убирать таймер при смене состояния. Плюс: небольшая локальная правка. Минус: два параллельных обработчика linking/custom handler всё ещё требуют согласования. **Правильно.** Один слой обработки внешних intents с очередью, проверкой текущей сессии и готовности маршрута, единым consume после навигации. Плюс: применимо к invite/rehearsal/push, меньше расхождений. Минус: затрагивает wiring и сценарии восстановления. **Effort:** 3–5 часов / 1–2 дня.

Рабочие доказательства и покрытие: [notes-navigation-contexts.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-navigation-contexts.md).

<a id="hn02"></a>

### HN02 — Medium — Успешная загрузка всех проектов не снимает устаревшую отметку «просмотрено»

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/features/calendar/hooks/useRehearsals.ts:82](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useRehearsals.ts:82):

```ts
      const responses: Record<string, RSVPStatus> = {};
      const stats: Record<string, { confirmed: number; invited: number }> = {};
```

**Доказательство.** [src/features/calendar/hooks/useRehearsals.ts:82–83](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useRehearsals.ts:82) начинает сбор новых `responses`/`stats` с пустых объектов. В batch-ветке `93–95` записываются только положительные ответы:

```tsx
if (r.userResponse === 'yes') {
  responses[r.id] = 'yes';
}
```

Затем `158` передаёт объекты в `prime`. [src/contexts/SeenContext.tsx:50–58](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/SeenContext.tsx:50) сливает их со старым состоянием, в частности `54`: `setResponses((prev) => ({ ...prev, ...nextResponses }));`. Отсутствующий ключ не сбрасывается. [RehearsalCard.tsx:49–52](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/components/RehearsalCard.tsx:49),154–156 напрямую рисует этот ответ. `SeenContext:62–68` также вычисляет следующий wire status из него. Для single-project ветки `useRehearsals:130–133` null записывается при существующем response row, но ответ без row снова пропускается; это не исправляет batch-путь.

**Сценарий.** На устройстве A отметка репетиции уже `yes`. На устройстве B тот же пользователь снимает её (`no` на сервере), затем на A успешно обновляет календарь «Все проекты». Batch корректно возвращает non-yes, но A не записывает null и оставляет yes. Следующий тап пользователя «снять отметку» снова отправит no, хотя карточка должна была обновиться ещё при refresh. Тот же эффект после серверного изменения приглашений, если строка ответа удалена/заменена. Это обычный успешный последовательный refresh, а не DF06 перестановка запросов и не DD01 локальное состояние Details.

**Минимум.** Для каждого rehearsal в полном batch-снимке записывать `responses[r.id] = r.userResponse === 'yes' ? 'yes' : null`; аналогично различать подтверждённое отсутствие ответа и ошибку его загрузки в single-project ветке. Плюс: небольшой фикс без стирания других проектов. Минус: правила удаления устаревшей статистики остаются отдельными. **Правильно.** `prime` принимает авторитетный scoped snapshot (какие IDs успешно загружены, ответы и права на статистику) и заменяет значения в этом scope, сохраняя только данные других scopes. Плюс: корректны отрицательные ответы, удаление RSVP и потеря admin stats. Минус: меняется контракт loader→context. **Effort:** 2–4 часа / 0.5–1 день.

Рабочие доказательства и покрытие: [notes-navigation-contexts.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-navigation-contexts.md).

<a id="hn03"></a>

### HN03 — Medium — SeenContext сохраняет ответы предыдущего аккаунта

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/App.tsx:33](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/App.tsx:33):

```tsx
        <AuthProvider>
          <ProjectProvider>
            <SeenProvider>
              <UnreadProvider>
                <AppContent />
              </UnreadProvider>
            </SeenProvider>
```

**Доказательство.** В [App.tsx:33–39](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/App.tsx:33) SeenProvider расположен внутри AuthProvider, но выше Navigation и не имеет session key. Navigation меняет Auth/Onboarding/App ветку ([src/navigation/index.tsx:402–407](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/navigation/index.tsx:402)), не размонтируя SeenProvider. [src/contexts/SeenContext.tsx:44–58](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/SeenContext.tsx:44) хранит `responses`, `stats`, `responding` в памяти, использует только I18n и не наблюдает auth/user; метода reset в интерфейсе `12–24` нет. `toggleSeen` по завершении запроса без проверки сессии записывает stats/rollback/responding (`74–84`).

**Сценарий.** A и B состоят в одном проекте и используют одно запущенное приложение. A имеет yes для репетиции, выходит и входит B, у которого no. B получает корректные данные сервером под своим токеном, но provider всё ещё содержит yes A; batch omission из HN02 дополнительно сохраняет значение даже после успешного fetch. B видит чужую отметку как свою и первый тап отправляет no вместо ожидаемого yes. Старый запрос A, завершившийся после переключения, может также повторно записать данные в общее состояние. Находка не утверждает обход серверных прав или доступ B к телам чужих репетиций; речь о смешении персонального локального ответа и счётчиков. Отличается от BC01/NI03 конкретным store и последствиями RSVP.

**Минимум.** Сбрасывать provider по user/session key, не оставлять старые ответы/статистику/responding; проверять generation сессии перед commit асинхронных результатов. Плюс: изолирует аккаунты. Минус: сам по себе не решает HN02 внутри одной сессии. **Правильно.** Область действия всех персональных caches и mutation lifecycle привязана к userId и session generation, logout завершает/инвалидирует работу. Плюс: единая модель для Seen/Project/Unread/calendar. Минус: совместная правка контекстов и callers. **Effort:** 3–5 часов / 1–2 дня для единой модели.

Рабочие доказательства и покрытие: [notes-navigation-contexts.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-navigation-contexts.md).

<a id="hc01"></a>

### HC01 — Low — язык аккаунта записывается в cache, но не обновляет уже работающий I18nContext

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/contexts/I18nContext.tsx:23](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/I18nContext.tsx:23):

```tsx
  const loadLanguage = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && saved in translations) {
        setLanguageState(saved as Language);
      }
    } catch (error) {
      console.warn('Failed to load language preference:', error);
```

Места: [src/contexts/I18nContext.tsx:23–39](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/I18nContext.tsx:23),41–53; [src/shared/utils/storage.ts:16–28](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/storage.ts:16); [src/contexts/AuthContext.tsx:104–107](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:104),208–212; [App.tsx:32–42](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/App.tsx:32).

```tsx
const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
if (saved && saved in translations) setLanguageState(saved as Language);
useEffect(() => { loadLanguage(); }, [loadLanguage]);
// Only this context method updates state after mount
await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
setLanguageState(lang);
```

Сценарий: I18nProvider загрузил прежний device language en; пользователь входит в аккаунт, где server locale=ru. `syncUserPreferences` сохраняет userLanguage=ru в AsyncStorage, но provider не слушает user/cache изменения, loadLanguage вызывается только при mount. UI остаётся en до нового запуска/ручного выбора языка. Аналогично смена аккаунтов сохраняет язык предыдущего человека на экране, хотя cache уже новый. Это не утечка содержимого аккаунта, а рассинхронизация настройки.

Сверка профиля: [ProfileScreen.tsx:74–87](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:74) при ручной смене вызывает setLanguage, поэтому ручной выбор работает; этот сценарий не смешивается с auth synchronization. Дополнительно адресно подтверждено: [App.tsx:32](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/App.tsx:32) оборачивает AuthProvider в I18nProvider, оба не зависят от user/session; [AuthContext.tsx:210](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:210) после login вызывает syncUserPreferences, а [storage.ts:28](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/utils/storage.ts:28) пишет только AsyncStorage.multiSet. Таким образом новый auth user не перемонтирует provider и не обновляет context language. Это подтверждённая находка, а не оставленный предположительный стык.

Дополнительный стык с профилем: [ProfileScreen.tsx:80–85](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/profile/screens/ProfileScreen.tsx:80) сначала сохраняет local/context язык, затем updateUser locale. Если серверный save отказал, local остаётся новым; повторный выбор того же языка упирается в early return :77 (`newLanguage === language`) и не повторяет server save. Не отдельный count; правильное решение должно различать UI выбранный и подтверждённый server preference и разрешать retry.

Минимум (1–2 ч): при успешной загрузке/смене user синхронизировать language state через единый preference setter/provider API. Плюс: небольшая правка; минус: аккуратно разрешить порядок server preference против ещё не сохранённого пользовательского выбора.

Правильно (0.5–1 день): один user-scoped preferences store с hydration/version и явным обновлением UI+cache+server, I18nProvider получает language из него. Плюс: единый источник правды, работает при account switch; минус: затрагивает Auth/Profile/I18n.

Рабочие доказательства и покрытие: [notes-common-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-common-client.md).

<a id="hc02"></a>

### HC02 — Medium — iOS PickerModal сохраняет изменения при нажатии «Отмена»

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/src/shared/components/PickerModal.tsx:35](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/components/PickerModal.tsx:35):

```tsx
  const handleChange = (event: any, selectedValue?: Date) => {
    if (Platform.OS === 'android') {
      onChange(event, selectedValue);
      onClose();
    } else {
      onChange(event, selectedValue);
    }
```

Места: [src/shared/components/PickerModal.tsx:35–41](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/shared/components/PickerModal.tsx:35),79–98; прямой caller [src/features/calendar/screens/AddRehearsalScreen.tsx:283–313](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/screens/AddRehearsalScreen.tsx:283); [src/features/calendar/hooks/useAddRehearsalForm.ts:207–228](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/features/calendar/hooks/useAddRehearsalForm.ts:207).

```tsx
// Every spinner change goes directly to the owner
const handleChange = (event: any, selectedValue?: Date) => {
  if (Platform.OS === 'android') { onChange(event, selectedValue); onClose(); }
  else { onChange(event, selectedValue); }
};
// Cancel and Done use the identical callback
<TouchableOpacity onPress={onClose}><Text>{t.common.cancel}</Text></TouchableOpacity>
<TouchableOpacity onPress={onClose}><Text>{t.common.done}</Text></TouchableOpacity>
```

Адресная сверка подтвердила caller: AddRehearsalScreen:285/:296/:307 закрывает только show*Picker flag, onChange передаётся непосредственно в form.handleDateChange/handleStartTimeChange/handleEndTimeChange. В useAddRehearsalForm:209/:215/:227 они сразу вызывают setDate/setStartTime/setEndTime. Выбрать другое время на spinner и нажать «Отмена» оставляет новое значение. Более того, изменение start на время позже текущего end автоматически переносит end на+2ч (:217–220); отмена start picker сохраняет и это побочное изменение. Компонент не хранит draft/исходное value и не отправляет отмену/rollback, поэтому Cancel семантически равен Done. Проявление: пользователь сохраняет репетицию на отменённое время/дату. Сценарий подтверждён чтением всей цепочки, runtime не запускался.

Минимум (1–2 ч): локальный draft и onChange наружу только по Done для iOS, cancel/outside close отбрасывают draft; Android native set/dismiss оставить соответствующими платформенному событию. Плюс: локальная исправляемая ошибка; минус: надо заново инициализировать draft при каждом открытии/value смене.

Правильно (0.5 дня): явные onConfirm/onCancel contracts, единый pattern modal draft во всех editor pickers, проверки Cancel после изменения и повторного открытия. Плюс: понятные переходы состояния; минус: смена props/callers и интеграционный тест.

Рабочие доказательства и покрытие: [notes-common-client.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-common-client.md).

<a id="ic01"></a>

### IC01 — Medium — Android App Links не имеют действительной association подписи

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/server.js:242](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:242):

```js
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.rehearsal.app',
        sha256_cert_fingerprints: [
          'YOUR_ANDROID_SHA256_FINGERPRINT'
        ]
```

Места: [server/server.js:238–251](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:238), особенно :245–247; [app.json:49](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/app.json:49),54–73; навигация [src/navigation/index.tsx:66–67](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/navigation/index.tsx:66).

```js
// server/server.js:245–247
package_name: 'com.rehearsal.app',
sha256_cert_fingerprints: [
  'YOUR_ANDROID_SHA256_FINGERPRINT'
]
```

[app.json:57](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/app.json:57),60–62 запрашивает `autoVerify: true` для HTTPS `rehearsly.me/invite`, но обслуживаемый сервером assetlinks содержит placeholder вместо SHA-256 сертификата Android приложения. Строка не является fingerprint, и соответствие установленному подписанному приложению из такой association получить невозможно. Package ID совпадает, подпись отсутствует.

Сценарий: выпускается/устанавливается Android приложение с текущим tracked app.json, пользователь открывает `https://rehearsly.me/invite/<code>`; даже при правильном домене в сгенерированном manifest серверный assetlinks не подтверждает владельца. Автоматическое открытие как verified App Link не работает; пользователь остаётся в browser/chooser в зависимости от ОС и настроек. Browser landing и ручной переход по custom scheme могут оставаться работоспособными — находка не означает полный отказ принятия приглашений.

Границы: Android, по проектной документации, ещё не настроен для release; это подтверждённая незавершённая конфигурация перед Android выпуском, не доказательство сломанной текущей iOS публикации. Actual deployed endpoint/Play signing не запрашивались; оценка опирается на tracked handler. Старый домен локального ignored manifest — отдельное наблюдение ниже, не второй дефект той же release цепочки.

Минимум (1–2 ч после получения сертификата): заполнить association действительным SHA-256 сертификата распространяемой Android сборки. Плюс: минимальный public metadata fix; минус: необходимо учитывать Play App Signing, если сертификат установки отличается от upload/debug key, и разные каналы. Значение fingerprint публично и не должно заменяться приватным ключом.

Правильно (0.5–1 день + проверка устройства): держать production domain/package/fingerprints в одном контролируемом release contract; при релизе проверять сгенерированный manifest и association для каждого канала, затем открытие invite на Android. Плюс: предотвращает рассинхронизацию при смене domain/signing; минус: требует доступа к release metadata и проверки готового артефакта. Эти действия в данном read-only аудите не выполнялись.

Рабочие доказательства и покрытие: [notes-configuration.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-configuration.md).

<a id="id01"></a>

### ID01 — Low — документированные переменные срока JWT не влияют на выдачу

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/server/middleware/jwtMiddleware.js:25](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/middleware/jwtMiddleware.js:25):

```js
const JWT_EXPIRES_IN = '30d'; // Access token expires in 30 days (mobile app convenience)
const REFRESH_TOKEN_EXPIRES_IN = '90d'; // Refresh token expires in 90 days
```

- Доказательство: `server/.env.example:13–14` предлагает `JWT_EXPIRES_IN=30d` и `REFRESH_TOKEN_EXPIRES_IN=90d`. [server/middleware/jwtMiddleware.js:25–26](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/middleware/jwtMiddleware.js:25) задаёт `const JWT_EXPIRES_IN = '30d'; const REFRESH_TOKEN_EXPIRES_IN = '90d';`, а `:35–40` передаёт именно эти константы в jwt.sign. Значения process.env для сроков не читаются.
- Сценарий: оператор сокращает срок access до 15 минут, refresh до нескольких дней через предложенные env-поля и перезапускает сервер; новые токены всё равно действуют 30/90 дней. Это подтверждённая неработающая operational настройка, а не утверждение о фактическом изменении настроек production или украденных токенах. DB token_version revoke по-прежнему работает и не отменяет дефект заявленного TTL.
- Минимально: убрать нерабочие параметры из env example и явно документировать фиксированные сроки (плюс: прекращает ложное ожидание; минус: нельзя настраивать без deploy; 0.5–1 ч).
- Правильно: централизованно читать и валидировать durations с явными defaults и проверять срок в выдаваемом JWT на уровне unit contract (плюс: настройка действительно действует; минус: валидация некорректных duration и согласование политики; 2–4 ч).

Рабочие доказательства и покрытие: [notes-final-delta.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-final-delta.md).

<a id="idoc01"></a>

### IDOC01 — Low — документ API содержит устаревшие и противоречащие контракту инструкции

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/docs/api-documentation.md:987](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/docs/api-documentation.md:987):

```text
- Existing manual slots in the same time ranges are deleted before inserting new ones
- Slots from rehearsals or calendar sync are preserved
- Old format converts times using the user's configured timezone

```

1. **Bulk availability заменяет день, не только совпадающие часы.** [docs/api-documentation.md:902](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/docs/api-documentation.md:902): «Create or update multiple availability slots»; `:987`: «Existing manual slots in the same time ranges are deleted». Проверенный в C [server/routes/native/availability.js:95–117](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/availability.js:95) собирает affectedDates и удаляет manual rows этих календарных дней, прежде чем вставлять payload. Поэтому интеграция, дополняющая день одним новым интервалом по описанию, удалит другие ручные интервалы этого дня. Это документарное описание того же replace-day контракта, на котором основаны C03/CC05; источник actual evidence — `notes-availability.md`, `notes-availability-client.md`. Не дублировать как новый серверный data-loss bug. Документ должен явно требовать полный набор manual интервалов изменяемого дня и описывать timezone/day key.

2. **RSVP «не просмотрено» не удаляет приглашение, а прямой null вообще не является допустимым service input.** Документ `:683–685,:721–724` и `:1467–1469` предписывает null и утверждает «If status is null, the response record is deleted»/«Sending null deletes the response record». В [server/services/rehearsals/rsvpService.js:16](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/services/rehearsals/rsvpService.js:16) принимаются yes/no; другая величина, в том числе null, приводит к throw `:40`. Штатный клиент [src/contexts/SeenContext.tsx:62–68](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/SeenContext.tsx:62) преобразует своё null в wire-значение 'no'. В текущем production unsee сохраняет invitation row с response=no: строка определяет roster, personal batch и доступ по ID. Поэтому внешний клиент, буквально следующий примеру с null, получает ошибку вместо unsee, а реализация удаления строки нарушила бы действующий roster-контракт. `notes-rehearsals-server.md` фиксирует obsolete unlike=DELETE в старом rsvp.integration.test. Дополнительное внутреннее противоречие: пример GET responses `docs:761` содержит `response: "no"`, хотя `:792,:1468` объявляют «no 'no' statuses». Строки сверены с финальной базой.

3. **Rate limits объявлены отсутствующими, хотя уже действуют.** `docs:1754`: «Currently, the API does not enforce rate limiting». Сам документ `:1246` уже сообщает `/api/native/invite` 20/min; наличие mount limiter [server/server.js:145](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:145) подтверждено B04. Новый потребитель будет неверно рассчитывать возможность повторов/429. Защита alias остаётся отдельной B04 и этой документацией не исправляется.

4. **Внутренне расходятся enum и формат invite.** В parameters availability `docs:885,:957,:964` допускается `free`, но модель/usage `:1479,:1490` — `available`; UI Save посылает available (C/D notes). `Invite.inviteCode` `:1535` описан как «32-character hex string», хотя актуальный раздел `:1243–1245` сам объясняет новые 8-символьные коды и legacy32; production8 также подтверждён B. Эти расхождения вредят валидации/генерации типов клиентов; не утверждается новая server vulnerability из одного несовпадения текстов.

5. **Документация удаления аккаунта не раскрывает весь destructive scope.** `docs:299–301` перечисляет необратимость и удаление «user data and project memberships», но пропускает удаление всех принадлежащих пользователю проектов с их репетициями для остальных людей. Actual [server/routes/auth.js:424–450](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:424),482 и корректное предварительное UI-предупреждение проверены A/H. Это тот же documentation drift, что privacy/support sole-admin; не отдельная ошибка UI подтверждения и не новый count потери данных.

6. **GET/PUT /auth/me возвращают обёртку user.** Примеры `docs:199–211,257–268` показывают поля id/email/firstName прямо на верхнем уровне ответа. Actual GET [server/routes/auth.js:285–288](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:285) отвечает `{user: ...}`; PUT `:383–391` также возвращает user внутри response (при смене пароля может дополнительно вернуть новую пару токенов). Клиент [src/contexts/AuthContext.tsx:386–388](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/src/contexts/AuthContext.tsx:386) читает именно `response.data.user`. Интеграция по примеру будет получать undefined вместо профиля, а пропущенное описание token replacement мешает корректно обработать смену пароля. Строки сверены с финальной базой.

7. **Часы занятости участников выражены в timezone запрашивающего пользователя.** `docs:1188`: «Time ranges are returned in each user's local timezone»; модель `:1522–1523` повторяет «in user's timezone», что в контексте массива участников читается как отдельная зона каждого участника. Actual [server/routes/native/members.js:82–89](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/native/members.js:82) выбирает timezone requester и использует её для ответа (`:224–225`), а не индивидуальные зоны участников. Клиент, повторно переводящий каждую строку из зоны соответствующего участника, сдвинет часы и получит неверное пересечение доступности. Семантика подтверждена по серверному преобразованию ответа. Документ должен явно обозначить единый timezone всего ответа, желательно возвращать его отдельным полем.

**Минимум:** исправить перечисленные разделы по текущему API и добавить чёткие примеры полного replacement дня, RSVP yes/no, user-wrapper и обработки 429 (плюс: локально и быстро делает документ пригодным; минус: ручной документ снова может разойтись; 3–6 ч). **Правильно:** согласованная versioned API schema + примеры ответов и state-transition контракты, проверяемые tests реальных handlers, с отдельным описанием destructive side effects (плюс: проверяемый источник контракта; минус: schema/tooling и работа по endpoints; 1–3 дня). Сами тесты/генераторы в ходе аудита не запускались.

Рабочие доказательства и покрытие: [notes-api-documentation.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-api-documentation.md).

<a id="is01"></a>

### IS01 — Medium — secret scanner использует неверный диалект regex и пропускает секреты

**Статус:** подтверждённая цепочка в исходниках; runtime не воспроизводился.


Точная выдержка из [rehearsal-calendar-native/scripts/check-secrets.sh:51](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/scripts/check-secrets.sh:51):

```sh
for PATTERN in "${PATTERNS[@]}"; do
  # Search in tracked files
  MATCHES=$(echo "$TRACKED_FILES" | xargs grep -i -n "$PATTERN" 2>/dev/null || true)

  if [ -n "$MATCHES" ]; then
```

[rehearsal-calendar-native/scripts/check-secrets.sh:29-35](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/scripts/check-secrets.sh:29) содержит шаблоны `JWT_SECRET=[a-zA-Z0-9\-_]{20,}`, `sk-[a-zA-Z0-9]{20,}`, `password=.{8,}`. Но :53 запускает `xargs grep -i -n "$PATTERN"` без -E. В basic regex неэкранированные `{20,}`/`{8,}` не являются указанным квантификатором: обычный токен из20+символов эти правила не обнаруживают. Ошибки grep скрываются `2>/dev/null || true`; :68-69 целиком исключает Markdown. Поэтому новый секрет в обычном code file может пройти check:secrets, хотя это объявлено защитой перед commit/check.

Дополнительно :43 задаёт shell-строку `JWT_SECRET=.*\\|\\|`, которая после shell decoding попадает в basic grep как `JWT_SECRET=.*\|\|`. В GNU grep это альтернативы с пустой веткой, принимающие любую строку; такой allowlist способен выкинуть все найденные совпадения :75-77. На других grep поведение этой конструкции непереносимо; не заявляется проверенный запуск именно macOS grep. Основной дефект квантификаторов не зависит от этой дополнительной ветки. Семантика basic/extended и пустых alternatives сверена с [официальным руководством GNU grep](https://www.gnu.org/software/grep/manual/grep.html), 2026-09-11; Никакой scanner/синтетический test не запускался.

Минимум: явный -E для основных regex, исправленный allowlist с literal `\|\|` в ERE/точным контекстом, корректная обработка ошибок и null-delimited список файлов, не исключать всеmd (2–4ч; + делает существующие правила работоспособными, − coverage набором шаблонов ограничен). Правильно: специализированный scanner с redact и точечными baseline исключениями, pre-commit/CI проверка и отдельные fixtures на known fake secrets/no-secrets/ошибку чтения (0.5–1день; + поддерживаемые правила и проверяемая защита, − настройка baseline и сопровождение). Найденная неисправность не доказывает, что live secret уже опубликован.

Рабочие доказательства и покрытие: [notes-global-security.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-global-security.md).

<a id="is02"></a>

### IS02 — Medium — rate limits не общие для нескольких процессов

**Статус:** условный; требуемые условия ниже.


Точная выдержка из [rehearsal-calendar-native/server/server.js:136](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:136):

```js
app.use('/api/auth', rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
}));
// An invite code is short enough to read out, which also makes it short
```

[rehearsal-calendar-native/server/server.js:136-158](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/server.js:136) создаёт rateLimit для auth/invite/admin без store. В `server/vercel.json` backend упакован как serverless Node. Поиск productionserver не нашёл store/MemoryStore/custom limiter. [Документация express-rate-limit](https://express-rate-limit.mintlify.app/reference/stores) прямо определяет default memory-store как независимый для каждого процесса и сбрасываемый при restart.

Сценарий: два или более Vercel instances обслуживают один IP. Каждый разрешает свой набор20auth/min или5admin/15мин; новые/cold instances начинают с нуля. Объявленный общий предел не выдерживается, brute-force/abuse budget возрастает. На единственном непрерывно работающем процессе ограничение работает; число реальных productioninstances и фактический обход не измерены. B04 alias bypass — отдельный router дефект, это исправление его не закрывает.

Минимум: общий поддерживаемый store для всех replicas и корректный namespace, явная обработка отказа store (0.5дня; + единый счётчик, − внешняя зависимость/latency). Правильно: комбинированные IP+account/device limits, общий store/edge enforcement, budget тяжёлых операций и мониторинг отказов без раскрытия credentials (1–2дня; + защита границ API при масштабировании, − больше конфигурации и операционного контроля). Не включать этот условный finding в число воспроизведённых production incidents.

Рабочие доказательства и покрытие: [notes-global-security.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-global-security.md).

<a id="ia01"></a>

### IA01 — High — Apple ID token принимается без проверки приложения-получателя, если APPLE_CLIENT_ID отсутствует/пуст

**Статус:** условный; требуемые условия ниже.


Точная выдержка из [rehearsal-calendar-native/server/utils/oauthVerification.js:101](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/utils/oauthVerification.js:101):

```js
export async function verifyAppleToken(idToken) {
  try {
    // Verify the Apple ID token
    const appleIdTokenClaims = await appleSignin.verifyIdToken(idToken, {
      audience: process.env.APPLE_CLIENT_ID,
      ignoreExpiration: false, // Enforce token expiration
    });
```

[server/package-lock.json:1822](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/package-lock.json:1822) фиксирует apple-signin-auth 1.7.9 → jsonwebtoken `^9.0.0`, разрешённый root jsonwebtoken 9.0.2 (`4782`). [server/utils/oauthVerification.js:101–107](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/utils/oauthVerification.js:101) вызывает `appleSignin.verifyIdToken(idToken, { audience: process.env.APPLE_CLIENT_ID, ignoreExpiration: false })`. [server/routes/auth.js:186](/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/routes/auth.js:186) принимает этот путь входа. Чтение production refs не обнаружило другого APPLE_CLIENT_ID guard. Наличие настройки в `.env.example` не доказывает её наличие в production.

[Официальный список tags](https://github.com/a-tokyo/apple-signin-auth/tags) связывает 1.7.9 с commit `ac8b453253ec776ddbcd769a18a1aea3424fe76d`. Получен исходник этого точного commit без установки и исполнения пакета. В [apple-signin-auth 1.7.9 src/index.js:374–393](https://github.com/a-tokyo/apple-signin-auth/blob/ac8b453253ec776ddbcd769a18a1aea3424fe76d/src/index.js#L374) wrapper передаёт jwt.verify объект с `algorithms: 'RS256', issuer: ENDPOINT_URL, ...options`; обязательной проверки audience/default audience нет. В связанной locked [jsonwebtoken 9.0.2 verify.js:194–207](https://github.com/auth0/node-jsonwebtoken/blob/v9.0.2/verify.js#L194) audience проверяется только внутри `if (options.audience)`. Следовательно, undefined/пустая строка из process.env проходит wrapper и полностью пропускает этот блок.

**Сценарий и условие.** Развёртывание принимает Apple login, но APPLE_CLIENT_ID не задан либо пуст. Caller передаёт настоящий, ещё действительный Apple ID token, выданный другому client/application. Подпись и issuer продолжают проверяться библиотекой, но aud этого токена не сравнивается с приложением Rehearsal. `verifyAppleToken` возвращает доверенные sub/email/emailVerified в обычный auth flow, который теперь не различает intended recipient. Если злоумышленник получил токен жертвы для другого relying party, он может попытаться использовать его здесь; сопоставление с существующим пользователем дополнительно зависит от account-linking правил A. Для самого подтверждённого дефекта достаточно принятия токена с чужим audience. **Не утверждается возможность подделать подпись, изменить token claims или взять произвольный аккаунт без настоящего Apple token.**

Это доказанный по исходникам условный fail-open, не утверждение об уже уязвимом production deployment: **реальные значения production env не читались/не проверялись**. Непустое корректное APPLE_CLIENT_ID сохраняет нормальную audience-проверку. High относится к нарушению границы аутентификации при указанной конфигурации; runtime exploitation не проводилась. Закрывает ранее оставленный в A вопрос о поведении именно locked library, повторно как два finding не считать.

**Минимум.** До verifyIdToken проверять наличие непустого ожидаемого client ID; при отсутствии отклонять Apple login с configuration error. Плюс: небольшой fail-closed фикс, не требует обновлять библиотеку. Минус: неправильный, но непустой ID будет давать отказ всем Apple входам; конфигурацию надо проверять при развёртывании. **Правильно.** Валидировать Apple audiences при startup/deploy, задавать явный разрешённый список native/service IDs, при выключенном Apple provider не открывать соответствующий login flow. Добавить негативные contract tests с отсутствующим/пустым audience и токеном другого client ID, позитивный intended-audience test. Плюс: предсказуемая конфигурация и проверенная граница; минус: затронут env/schema, deployment и auth tests. **Effort:** 1–2 часа / 0.5 дня. Обновление package version само по себе не исправляет неверный caller config.

Итог: **1 новая условная High находка IA01 по Apple audience**, закрывающая A-styk, и **0 подтверждённых новых CVE findings для runtime приложения** в выборочном advisory sweep. Affected metadata с исключёнными/неподтверждёнными условиями эксплуатации отдельно; build/install-only риски не приравнены к server API уязвимостям. Это не исчерпывающая CVE-инвентаризация. Никаких runtime proof-of-concept, установок или project/test/package execution не выполнялось. Проверка I dependencies завершена; advisory sweep после 2026-09-11 не расширялся.

Рабочие доказательства и покрытие: [notes-dependencies.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-dependencies.md).

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

### Производительность и непрофилированные пути

Наблюдались последовательные записи roster/busy и notification fanout по одному участнику; импорт читает историю availability до фильтрации своего окна на клиенте, rehearsal batch также не ограничен временным окном. Cleanup rehearsal availability фильтрует source/external_event_id без ведущего user_id, для такого запроса отдельный подходящий индекс в first-party SQL не найден. Это кандидаты на batch/window/index улучшения после EXPLAIN и измерений на реалистичных объёмах; отдельная высокая критичность без подтверждённой нагрузки не начислена. Доказательства: [notes-database-consumers.md](/Users/vadimfertik/Desktop/reh_app/audit/notes-database-consumers.md:42). B03 отличается тем, что неограниченная синхронная генерация диапазона находится непосредственно в доступном request path.

В прочитанных routers не обнаружены платёжные операции или обработчик загрузки пользовательских файлов; отдельной финансовой логики для аудита не выявлено. Connection release и cleanup подписок проверялись в соответствующих реализациях; повреждённый pool client, platform listeners и поведение ОС требуют fault injection, доказанная универсальная утечка памяти/соединений не заявлена.

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
| 2 | D01/D02: единые roster/access guards; G01: уникальный владелец token и атомарная передача; IA01: обязательный Apple audience guard при включённом provider; A02/B03: контролируемые errors и budget диапазона. Небольшие изменения закрывают высокий ущерб | Около 2–4 дней общим пакетом, с concurrency/authorization проверками |
| 3 | ES01/EI01/C01/CC05: привязать sync к сессии/connection, исправить floating day, отправлять dirty dates с revision. Снижает потерю и перенос личных данных | 4–7 дней с проверкой двух устройств, timezone и native failures |
| 4 | B01/B02/D03/C03: транзакционные lifecycle и idempotency; F01/F02/FT02: единый provisioning/ledger. Сначала составить план миграции для существующих данных | 3–6 дней; provisioning проверять на временной БД |
| 5 | A04/AC01–AC05/BC01/NI03/HN03: единый session lifecycle и credential registry, scoped caches и защищённое хранение. Общая основа устраняет несколько проявлений сразу | 3–5 дней, пересекается с очередями 1–3 |
| 6 | EX/EO/EI recovery и mappings: не удалять ownership при ошибке, правдиво показывать частичный результат, единственная очередь settings/sync | 3–5 дней, native regression существенен |
| 7 | GR01–GR05/G02: result contract, receipts, leases и revision. Проверить до любого возобновления автоматического расписания | 2–4 дня; решение о scheduler остаётся отдельным эксплуатационным выбором |
| 8 | D/H/NI UI-контракты, profile/onboarding, date labels и picker; ID01/IDOC01/IS01/IC01; shared limiter при multi-instance deployment | Выполнять небольшими PR по карточкам, обычно 1–6 часов на локальный fix |
| Параллельно | Плановые dependency parent updates, настоящие adapter/HTTP integration checks вместо повторения SQL в тестах, фиксация актуальных контрактов | Ориентир 1–3 дня на согласованный dependency batch, далее по результатам |

Оценки пересекаются: один session coordinator или lifecycle transaction закрывает несколько ID. Их нельзя складывать как независимые задачи. Минимальные правки целесообразно выпускать отдельными проверяемыми изменениями; более широкие решения вводить вокруг существующих services и контрактов, без переписывания приложения с нуля.

Критерий завершения исправлений: воспроизведённый исходный сценарий больше не нарушает права/данные, проверен отказ и конкурентный путь, тест использует production handler/adapter там, где это существенно, документация описывает действительный контракт. Сам этот аудит никаких исправлений не применял.

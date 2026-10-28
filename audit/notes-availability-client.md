# Участок C: availability client

Статус: готов для перечисленного покрытия, завершён 2026-09-07. Только чтение; ничего не запускалось. Пути от `rehearsal-calendar-native/`.

## Подтверждённые находки

### CC01 — Medium — UTC «сегодня» запрещает редактировать текущий местный день

Код: `src/features/availability/screens/AvailabilityScreen.tsx:83`: `const today = new Date().toISOString().split('T')[0]`. При этом месяцы строятся через местный `new Date()` (`utils/calendarUtils.ts:14-17`), timed entries — с device offset (`hooks/useAvailabilitySave.ts:15-28`). Сравнение с today запрещает редактор (`Screen:264,274,301`), а prepareEntries исключает такие даты (`Save:47-48`).

Сценарий: Нью-Йорк 10 сентября 21:00 (UTC уже 11-е): 10 сентября показано прошлым и не сохраняется. В положительных смещениях после местной полуночи можно редактировать уже прошедший день до UTC полуночи. Последствие: неправильная доступность/невозможность изменить сегодняшний вечер.

Минимум: local YYYY-MM-DD вместо UTC today (до 1 часа; быстро, но остаётся вопрос profile timezone). Правильно: единый clock/date boundary в выбранной timezone, refresh при переходе суток (2–4 часа; единая семантика, больше проверки). Проверить вручную UTC− и UTC+ возле полуночи.

Дополнительное проявление неправильной UTC-конверсии календарной даты: `components/editor/EditorHeader.tsx:26` делает `new Date(selectedDate).toLocaleDateString(...)`. Для selectedDate = '2026-09-10' это UTC midnight, поэтому пользователь Нью-Йорка видит заголовок «9 сентября», хотя редактор меняет 10-е. Использовать имеющийся `shared/utils/time.ts:5-13` parseDateString или форматирование date-only без преобразования в instant. В `CalendarMonth.tsx:78-94` прошлые и будущие клетки остаются selectable, что также подтверждает достижимость CC04.

### CC02 — Medium — Автозагрузка безусловно стирает несохранённые правки

Код: `hooks/useAvailabilityData.ts:246`: `setAvailability(localData)`; `screens/AvailabilityScreen.tsx:92-95` запускает reload при focus независимо от hasChanges. Pull-to-refresh (`Screen:105-110`) тоже делает reload. В error fallback `Data:257-258` предыдущий cached snapshot так же безусловно заменяет state.

Сценарий: изменить занятость, переключить tab и вернуться/потянуть refresh до Save — ответ сервера затирает локальное изменение без подтверждения. hasChanges не сбрасывается при reload, поэтому интерфейс может ещё предлагать сохранить уже потерянные правки. Последствие: незаметная потеря введённых данных.

Минимум: не заменять dirty state при background/focus reload; ручной refresh с предупреждением (2–4 часа; быстро, надо явно показать stale state). Правильно: server baseline отдельно от dirty dates/draft и merge с конфликтами (1–2 дня; сохраняет правки и свежесть, сложнее).

### CC03 — Medium — Изменения во время Save помечаются сохранёнными, хотя не попали в запрос

Код: `hooks/useAvailabilitySave.ts:197-200`: entries берутся из переданного snapshot, после HTTP всегда `setHasChanges(false)`. На экране блокируется только Save (`Screen:473-475`); mode controls (`310,331,352`), время и add/remove остаются активны.

Сценарий: нажать Save на медленной сети, затем изменить время/другую дату. Новое изменение не входит в отправленный snapshot, но завершение старого запроса убирает dirty flag и кнопку сохранения. UI показывает новое время как будто сохранённое; после reload оно исчезнет.

Минимум: блокировать редактор до ответа (1–2 часа; просто, ухудшает отзывчивость). Правильно: revision/snapshot acknowledged state, очищать только изменения отправленной ревизии (0.5–1 дня; разрешает параллельную работу, нужен lifecycle тест).

### CC04 — Medium — «Удалить прошлые даты» может удалить выбранные будущие дни

Код: `hooks/useAvailabilityEditor.ts:39` selectedDate = selectedDates[0]; UI показывает past-delete только по первому элементу (`Screen:274`), а handler копирует и удаляет весь selectedDates (`Editor:220-225`): `Promise.all(dates.map((date) => availabilityAPI.delete(date)))`. Multi-select не ограничен однородностью дат (`Editor:70-72`).

Сценарий: выбрать прошлый день первым, затем будущий; на экране остаётся действие удаления прошлого, запросы DELETE уходят для обоих. После успешного удаления `Editor:237` ещё и безусловно сбрасывает hasChanges, включая несохранённые изменения других будущих дней.

Последствие: удаление актуальной будущей доступности и потеря признака несохранённых правок. При частичной ошибке Promise.all некоторые даты уже удалены, но локально не обновлена ни одна (`225-228`), что дополнительно даёт stale UI; серверные batch-транзакции здесь отсутствуют.

Минимум: фильтровать past dates внутри handler и не очищать общий dirty flag (2–4 часа; локально устраняет опасный путь). Правильно: разделить past/future selection и отслеживать dirty dates; атомарный batch delete либо per-date reconciliation (0.5–1 дня; честный частичный результат, затрагивает API).

### CC05 — High — Save отправляет весь старый snapshot и перезаписывает нетронутые дни

Код: `hooks/useAvailabilitySave.ts:47` проходит `Object.entries(availability)`, исключает только прошлое (`48`), а затем `197-198` отправляет все entries. Изменённые даты отдельно не учитываются. Offline fallback берёт общий cache (`Data:257-258`), UI `Screen:161-165` показывает баннер, но не запрещает редактирование/Save. Серверный аудитор подтвердил replace-by-affectedDates семантику bulk; точные server ссылки в его C notes.

Сценарий: A загружает дни X/Y. B меняет Y на другом устройстве. A меняет только X и Save — stale Y тоже приходит в bulk и заменяет свежую правку B. Более вероятно после offline fallback: сеть возвращается, пользователь сохраняет единственный изменённый день, вместе с ним уходит весь старый кеш.

Последствие: незаметная потеря актуальных отметок и ошибочная занятость в планировщике. Это отдельный сценарий от серверной C03 (два concurrent insert в пустой день): здесь последовательные сохранения старого snapshot.

Минимум: хранить dirtyDates и отправлять только их; после offline load требовать обновление перед replace (3–6 часов; уменьшает ущерб, одновременная правка одного дня остаётся). Правильно: version/ETag на день и conditional replace с разрешением конфликтов (1–2 дня; закрывает lost updates, затрагивает сервер).

### CC06 — Medium — Ветка сохранения через полночь недостижима из Save

Код: `hooks/useAvailabilitySave.ts:70-88` обещает midnight crossing: `const endsNextDay = endMinutes <= startMinutes`, затем переносит endDate на следующий день. Но `saveAvailability:186-191` сначала вызывает validateAvailability; тот вызывает validateSlot (`124`) из `utils/validationUtils.ts:17-21`, где `startMinutes >= endMinutes` всегда запрещён. Любой слот, для которого нужна overnight-ветка, отбрасывается до сериализации.

Сценарий: пользователь ставит занятость 23:00–01:00 через time picker (Screen:515-520 не ограничивает end относительно start) и нажимает Save. Получает ошибку endBeforeStart вместо сохранения двухчасовой ночной занятости; UI и сериализатор расходятся. Это не ошибка самих Date calculations: ветка вообще не вызывается из пользовательского save flow.

Минимум: явно ограничить UX одним календарным днём и дать разбиение на два дня/понятный текст, убрать обещание overnight (2–4 часа; минимальный риск, менее удобно). Правильно: единое представление start/end с датами, разрешить overnight с корректной проверкой длительности и пересечений на обоих днях (0.5–1 дня; выполняет заявленное поведение, требует согласования границ bulk delete). Не достаточно просто убрать validateSlot: slotsOverlap тоже рассчитан на часы одного дня.

## Формат и стыки с сервером

- Timed entries: `Save:15-28,87-88` — `YYYY-MM-DDTHH:mm:00±HH:mm`, offset берётся из device timezone через new Date(...).getTimezoneOffset().
- All-day: `Save:54-55,62-63` — `YYYY-MM-DDT00:00:00.000Z`–`23:59:59.999Z`, UTC midnight обозначает календарную дату. Read path `Data:104-113` сохраняет буквальные даты all-day, конвертирует в userTimezone только timed.
- Server C01 all-day deletion mismatch подтверждён главным аудитором, не дублируется здесь.
- C04 из `notes-availability.md` независимо подтверждён: `Data:137-166` выбрасывает manual, совпавший с rehearsal; при наличии другого manual slot на том же дне Save перезаписывает дату без выброшенной отметки. Тест `useAvailabilityData.test.ts:220-259` закрепляет slots=[] при совпадении, но не проверяет load→save→cancel rehearsal round trip. Отдельный клиентский ID/счёт не начисляется.
- Load timed использует `user.timezone` (`Data:40-41,106-119`), save — device timezone. Это условный риск расхождения, пока не добавлен отдельной finding: AuthContext auto-sync обычно приводит profile timezone к device. Достижим при уже открытом приложении после смены часового пояса устройства (auth effect не слушает timezone/AppState), либо временной ошибке автоматического timezone PUT. Нужно проверить ручной сценарий путешествия/смены timezone.

## Покрытие и ограничения

Полностью прочитаны:
- 4 hook implementations (`useAvailabilityData`, `useAvailabilitySave`, `useAvailabilityEditor`, `useAvailabilitySync`) + hooks/index;
- `screens/AvailabilityScreen.tsx`;
- все implementations utils (`calendarUtils`, `validationUtils`, `slotHelpers`) + utils/index;
- types + constants и их index;
- `shared/utils/time.ts` и `shared/utils/availability.ts`;
- все 6 components: CalendarMonth, EditorHeader, ModeInfo, ModeSelector, TimeSlotsEditor, TimePickerModal + все barrels;
- все 6 файлов hook-тестов полностью: `useAvailabilityData.test.ts` (494 строки), `useAvailabilityDataAllDay.test.ts` (228), `useAvailabilityDataMultiDay.test.ts` (143), `useAvailabilityOffline.test.ts` (93), `useAvailabilitySave.test.ts` (464), `useAvailabilityEditor.test.ts` (219).

Покрытие тестов всего feature — частичное: component tests (`ModeSelector.test.tsx`, `TimeSlotsEditor.test.tsx`) и `utils/__tests__/displayedMode.test.ts` здесь не читались. `src/__tests__/availabilityValidation.test.ts` и `integration/availabilityFlow.test.ts` прочитаны главным аудитором отдельно, не приписываются этому проходу. Отдельные styles исключены по границе задачи (inline styles в полностью прочитанных components не оценивались по эстетике). Новые чужие mailer/mailTokens/setup изменения не открывались.

Статические ограничения покрытия тестами:
- Save test `14-31` заменяет production validateSlot/slotsOverlap своими реализациями; проверяет запрет end-before-start (`295-323`), не проверяет полный overnight save с реальным валидатором.
- Offline tests покрывают initial fetch/cache fallback, не cover dirty draft при reload/reconnect или сохранение старого кеша (CC02/CC05).
- Editor delete tests `170-218` работают с одной выбранной датой; не проверяют mixed past/future, другие dirty dates, частичный успех Promise.all (CC04).
- Save success `263-293` проверяет callback setHasChanges(false), но не изменение draft при ожидающем запросе (CC03).
- All-day и multi-day tests проверяют load из замоканного API; не выполняют round trip bulk→DB→load и не могут обнаружить server C01.
- `ModeSelector`, `TimeSlotsEditor`, `TimePickerModal` существуют отдельно, но текущий Screen использует собственную inline реализацию controls/picker. Поэтому тесты отдельного component не доказывают поведение экрана. Например standalone TimeSlotsEditor локализует validationError (`35-38`), а Screen отображает raw editor.validationError (`377`); это расхождение UX/тестов, отдельной severity-находкой не начислено.

Тесты, приложение, скрипты, запросы к API не запускались. Для CC01–CC06 необходимы описанные ручные сценарии или новые интеграционные проверки после исправлений; статический аудит не заявляет выполненное runtime покрытие.

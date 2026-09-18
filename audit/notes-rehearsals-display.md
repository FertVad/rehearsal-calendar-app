# Участок D: отображение календаря и RSVP

Статус: готов для перечисленного покрытия. Дата 2026-09-07. Только чтение; код, тесты и HTTP запросы не запускались. Пути от `rehearsal-calendar-native/`.

## DD01 — Medium — Details ведёт вторую копию RSVP и расходится с SeenContext

**Код:** `src/features/calendar/screens/RehearsalDetailsScreen.tsx:104-117` кладёт getResponses только в local participants/stats, не вызывает `SeenContext.prime`. Затем `143-149`:

```ts
setParticipants(prev => prev.map(p =>
  p.userId === participant.userId
    ? { ...p, hasSeen: !wasSeen, hasResponded: true }
    : p
));
await toggleSeen(rehearsal!.id);
```

В `src/contexts/SeenContext.tsx:62-68` toggle вычисляется из **другой** копии: `const current = responses[rehearsalId] ?? null`. При ошибке context откатывает только свой responses и проглатывает исключение (`78-84`). Details после await читает `statsFor` из closure прежнего render (`Details:152-153`), не подписывает local stats на обновлённые context stats.

**Сценарии:** (1) Открыть details по id из notification, когда rehearsal ещё не primed календарным списком. GET responses возвращает собственный yes, пользователь пытается снять отметку. Details рисует false, context видит null и отправляет yes — сервер оставляет yes. (2) Находясь в details переключить статус без сети: global card state откатится, local строка останется оптимистически изменённой после alert. (3) После успешного переключения badge details может сохранить прежний счётчик, поскольку statsFor захватил старое context значение.

**Последствие:** отметка «просмотрено»/число подтвердивших отличаются между деталями, карточкой и сервером; действие пользователя может фактически не выполниться.

**Минимум:** prime собственный response/stats из getResponses; возвращать success/result из toggleSeen и откатывать local participants при failure, использовать возвращённые stats (3–6 часов; локально устраняет симптомы, остаются две копии state). **Правильно:** participants identities отдельным state, собственный response и агрегаты derive из одного SeenContext; явный `setResponse(id,value)` вместо toggle по непроверенному кешу (0.5–1 дня; единый источник и предсказуемый id-only flow, надо проверить карточку/details/notification).

## DD02 — Medium — Репетиция через полночь отсутствует в календаре второго дня

**Код:** `src/features/calendar/screens/CalendarScreen.tsx:183-185`:

```ts
return rehearsals.filter(r => r.date === selectedDate)
```

`src/features/calendar/components/WeeklyCalendar.tsx:58-60` считает событие только по `r.date`; ни selected list, ни count не используют startsAt/endsAt. `RehearsalDetailsScreen.tsx:232-234,272-273` и `RehearsalCard.tsx:78-79` показывают единственную дату плюс start/end HH:mm, без end date.

**Сценарий:** серверная запись 10 сентября 23:00 — 11 сентября 01:00 появляется только под 10 сентября; выбор 11 сентября показывает «нет репетиций» и нулевой badge, хотя репетиция идёт до 01:00. Более длинный интервал скрывает все дни после первого. Даже в карточке «23:00 — 01:00» не сообщает, к какой дате относится конец. Главный аудитор подтвердил: server legacy date = дата начала; create/update допускают startsAt/endsAt разных календарных дней (JS ограничения на same-day нет). Это достижимый серверный интервал, а не выдуманный неподдерживаемый формат.

**Последствие:** пользователь пропускает продолжающуюся репетицию/неверно считает день свободным. **Минимум:** включать событие в каждую пересекаемую календарную дату и показывать end date, когда она отличается (3–6 часов; исправляет отображение, необходима единая timezone). **Правильно:** отображать интервал startsAt/endsAt через общую timezone-aware модель, отдельно all-day date ranges, использовать её в strip/list/details (1–2 дня; единая семантика и DST/all-day, больше тестовых сценариев).

## DD03 — Low — Кнопка «Сегодня» не выбирает сегодняшний день

**Код:** `src/features/calendar/components/WeeklyCalendar.tsx:133-140` handleGoToToday вызывает только `scrollToIndex({index:CENTER_INDEX})` и setCurrentWeekIndex; onDaySelect(today) отсутствует. Выбранная дата хранится в CalendarScreen:27 и меняется через onDaySelect только нажатиями клеток (`WeeklyCalendar:157-159`).

**Сценарий:** выбрать старую дату, пролистать недели и нажать «Сегодня». Видимая неделя вернётся к текущей, но список ниже и selectedDate останутся для старого дня вне экрана.

**Последствие:** кнопка создаёт впечатление перехода к сегодняшним репетициям, но показывает иной день. **Минимум:** onDaySelect(formatDateToString(new Date())) в handler (до 1 часа; просто). **Правильно:** единая операция select-and-scroll для внешнего выбора даты/перехода к today, с актуализацией clock при смене суток (2–4 часа; покрывает разные входы, немного шире change).

## Стыки и неподтверждённые наблюдения

- **DF06 late responses** (другой агент): `CalendarScreen.tsx:112-115` force-fetch при смене фильтра присутствует, поэтому общий cache TTL сам по себе не объявлен багом. Но компонент принимает rehearsals hook напрямую (`65-72`), фильтрует selected list лишь по date (`185`), а не projectId. Если старый запрос hook заканчивается после нового, возвращённые записи другого проекта беспрепятственно отобразятся под новым filter label (`171-174`) до следующего fetch. Нужен guard в hook по request generation/filter key; повторная фильтрация UI — только дополнительная защита. Счёт findings остаётся за DF06.
- Серверный **D02** (member может сам присоединиться через POST /respond) не дублируется. RehearsalCard всегда показывает seen action (`144-151`) даже когда не приглашён; это интерфейсная достижимость server finding.
- `ActorSelector.tsx:43-48` трактует отсутствующую memberAvailability как «доступен», `TimeRecommendations.tsx:25-29` получает тот же input. Статус error/unknown и writer contract проверяет hooks/AddRehearsal агент; отдельной finding здесь нет.
- getById контракт подтверждён главным аудитором: возвращает legacy date/time/endTime вместе с ISO. Details (`69-71,232-234,272-273`) получает необходимые поля; баг «пустые date/time из ISO-only getById» исключён. Ни один read endpoint, по серверному аудиту, не возвращает isAllDay; семантика all-day/edit проверяется у form/backend аудиторов, отдельный count здесь не начислялся.
- Details при смене rehearsalId не сбрасывает прежние rehearsal/loadFailed (`64-81`), participant fetch без alive guard (`99-129`); возможен stale participant list, если одна route instance переиспользуется для другого id. Способ reuse navigation требует отдельной runtime проверки, поэтому отдельная находка не начисляется.
- SmartPlannerButton выбирает самый свежий adminProject (`24-32`) независимо от выбранного filterProjectId: CalendarScreen передаёт весь adminProjects (`345-349`). Это явно описано комментарием кнопки, не объявлено багом без продуктового требования; стык для planner.

## Покрытие

Полностью прочитаны production: CalendarScreen.tsx (423), RehearsalDetailsScreen.tsx (469), SeenContext.tsx (110), utils/rehearsalFormatters.ts (13), все 6 компонентов calendar: ActorSelector (350), RehearsalCard (163), SmartPlannerButton (54), TimeRecommendations (150), TodayRehearsals (124), WeeklyCalendar (353). Inline styles прочитаны как часть файлов, эстетика не оценивалась. Отдельный styles каталог не проверялся в этой части. Hooks/AddRehearsal/backend/smart-planner распределены другим аудиторам и не приписываются этому проходу.

Полностью прочитаны все обнаруженные непосредственно соответствующие тесты: `src/contexts/__tests__/SeenContext.test.tsx` (149), `src/features/calendar/components/__tests__/TodayRehearsals.test.tsx` (513), `ActorSelector.test.tsx` (557). Screen/WeeklyCalendar-specific тестов среди файлов этого участка не обнаружено. Hook tests проверяет другой аудитор; имена/исходники не приписываются этому проходу.

## Что тесты не доказывают

- SeenContext tests используют Probe, который читает response/stats прямо из store (`31-46`), и проверяют rollback (`116-125`), но Details с отдельным participants state не монтируется; DD01 ими не обнаруживается.
- TodayRehearsals тест полностью мокает SeenContext (`20-28`), поэтому не проверяет реальный fetch→prime→toggle→rollback стык. Тест delete (`302-307`) и RSVP (`350-355`) выполняет assertions только внутри `if (button)`: отсутствие самой кнопки не провалит тест. Тест «non-admin controls отсутствуют» (`310-325`) вообще не содержит expect.
- Date-label tests создают today/tomorrow через UTC toISOString (`434,453`), а production через local date; в часы расхождения UTC/local сами тестовые ожидания зависят от часового пояса. Это дефект тестового сценария, не заявленная выполненная runtime ошибка.
- ActorSelector test `494-510` закрепляет missing availability = Available, не проверяя источник «нет данных» (успешный пустой ответ vs ошибка/ещё загружается). Стык передан hooks аудитору.
- DD02 проверяется только новым сценарием с реальными startsAt/endsAt через полночь; существующие Today fixtures лежат в одном дне (`106-126`) и тест не монтирует CalendarScreen фильтрацию.

Никакие runtime проверки не выполнялись. Рекомендуемый ручной минимум после исправлений: notification id-only открытие уже seen репетиции; toggle без сети; успешное toggle с новым счётчиком; 23:00→01:00 выбор обоих дней; смена project filter с искусственно переставленными ответами; кнопка today после выбора прошлого дня.

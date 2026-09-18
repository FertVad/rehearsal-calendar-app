# Участок D — клиентский smart planner

Статический аудит 2026-09-07. Исходники не изменялись. Код, тесты, сборки, миграции и проверки выполнения не запускались. Все пути ниже относительно `rehearsal-calendar-native/`.

## Покрытие

Полностью прочитаны (не только поиск):

- `src/features/smart-planner/hooks/useSmartPlanner.ts` — 214 строк.
- `src/features/smart-planner/screens/SmartPlannerScreen.tsx` — 411 строк.
- `src/features/smart-planner/screens/SmartPlannerTabScreen.tsx` — 76 строк.
- `src/features/smart-planner/components/DayCard.tsx` — 112 строк.
- `src/features/smart-planner/components/MemberFilter.tsx` — 247 строк.
- `src/features/smart-planner/components/SlotItem.tsx` — 110 строк.
- `src/features/smart-planner/types.ts` — 28 строк.
- `src/features/smart-planner/utils/slotGenerator.ts` — 310 строк.
- `src/features/smart-planner/utils/availabilityMerger.ts` — 73 строки.
- `src/features/smart-planner/utils/__tests__/availabilityMerger.test.ts` — 96 строк.
- `src/features/smart-planner/utils/__tests__/slotGenerator.test.ts` — 255 строк.
- `src/features/smart-planner/components/__tests__/MemberFilter.test.tsx` — 122 строки.
- `src/shared/utils/conflictDetection.ts` — 99 строк.

Итого назначенный участок: 13 файлов, 2153 строки. Дополнительно полностью прочитаны непосредственные зависимости алгоритма `src/shared/utils/availability.ts` (72 строки) и `src/shared/utils/time.ts` (222 строки), чтобы проверить реальную обработку merge/time. Другие участки не аудировались этим проходом; поиск единственного production caller `checkSchedulingConflicts` показал `src/features/calendar/hooks/useAddRehearsalSubmit.ts:183`.

Пропущены: `src/features/smart-planner/styles/index.ts`, `src/features/smart-planner/styles/smartPlannerScreenStyles.ts` — выделенные стили, на алгоритмы/состояния не влияют. Inline StyleSheet внутри перечисленных компонентов прочитан вместе с файлом. Серверную часть D проверяет основной аудитор. Артефакты, зависимости, снимки экранов не проверялись.

## Восстановленное поведение

PlannerMain после загрузки проектов заменяется SmartPlanner первого проекта. SmartPlanner формирует диапазон 7/30 дней или даты DateRangePicker, параллельно загружает проект, участников и их availability. Участники без данных считаются свободными с предупреждением `membersWithoutData`. Busy и tentative интервалы объединяются по каждому участнику/дню. Рабочий день 09:00–23:00 разбивается на получасовые корзины; пересечение корзины с busy округляет занятость наружу. Соседние корзины объединяются только при одинаковом множестве занятых участников. Категории: perfect=0 busy, good≤25%, ok≤50%, bad>50%. Пустой массив selectedMemberIds явно означает «все». Для слота с хотя бы одним свободным участником доступен переход к AddRehearsal, передающий проект и границы интервала. При возвращении фокус запускает refetch.

## Подтверждённые находки

### DP01 — Medium — смена проекта закрепляет старые ID участников за новым проектом

Места: `src/features/smart-planner/screens/SmartPlannerScreen.tsx:144–154`, `src/features/smart-planner/hooks/useSmartPlanner.ts:48–52`, `src/features/smart-planner/utils/slotGenerator.ts:112–115`.

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

### DP02 — Medium — выбранный в planner состав не переносится в создание репетиции

Место: `src/features/smart-planner/screens/SmartPlannerScreen.tsx:394–402`. Стык подтверждён основным аудитором: форма AddRehearsal инициализирует выбор всеми участниками (`src/features/calendar/screens/AddRehearsalScreen.tsx:80–88`; строка :86 — `form.setSelectedMemberIds(members.map(m => m.userId))`, дополнительно сверена адресным поиском в этом проходе).

Цитата:

```tsx
navigation.navigate('AddRehearsal', {
  projectId,
  prefilledDate: slot.date,
  prefilledTime: slot.startTime,
  prefilledEndTime: slot.endTime,
});
```

Сценарий: организатор выбирает только двух актёров из десяти; окно perfect рассчитано только для них (`useSmartPlanner.ts:158–173` и `slotGenerator.ts:112–115`). Нажатие «+» открывает форму с десятью участниками. Информация о целевом составе не передана вообще. В том числе скрытые занятые участники добавляются в новый состав.

Проявление: пользователь повторно отбирает участников или создаёт репетицию с лишними приглашёнными; проверка конфликтов в форме может предупредить, но не восстанавливает выбранный состав и не отменяет дефект передачи намерения.

Минимум (1–3 ч): добавить `prefilledMemberIds` в параметры маршрута и передавать эффективный состав (при [] — текущий полный состав); форме использовать его после загрузки участников. Плюс: малый объём; минус: надо корректно отличать отсутствующий prefill от пустого выбора.

Правильно (0.5–1 день): передавать typed planner draft с датой/временем/составом и сверять состав с актуальными правами/участниками при инициализации формы. Добавить end-to-end сценарий «2 из 10 → создать». Плюс: сохраняется целостное намерение; минус: затрагивает контракт навигации и два feature.

### DP03 — Low — заголовок периода показывает предыдущий день в часовых поясах западнее UTC

Агрегация основного аудитора: в итоговом отчёте объединить с CC01/BC04 как системное отображение date-only; повторно в числе находок не учитывать.

Место: `src/features/smart-planner/screens/SmartPlannerScreen.tsx:33–49`.

Цитата:

```tsx
const start = new Date(startDate);
const end = new Date(endDate);
const startDay = start.getDate();
const endDay = end.getDate();
const startMonth = start.toLocaleDateString(locale, options);
```

Сценарий: startDate=`2026-09-07`, endDate=`2026-09-13`, устройство America/New_York. ISO date-only парсится как UTC-полночь; local getDate/toLocaleDateString получают вечер 6/12 сентября. Заголовок показывает 6–12 сентября при фактических карточках/запросе 7–13. Переход месяца также искажает подпись месяца. DayCard:24 использует local `T00:00:00`, поэтому подпись периода и карточки расходятся.

Проявление: пользователь видит неверные даты выбранного периода; создаваемая дата остаётся date слота, поэтому эта находка не утверждает сдвиг сохранённой репетиции.

Минимум (15–30 мин): использовать уже существующий `parseDateString` вместо `new Date(dateOnly)`. Плюс: минимальная правка; минус: оставляет разные способы представления calendar date.

Правильно (1–2 ч): один форматтер calendar date для period и DayCard, проверенный для отрицательных/положительных TZ и перехода месяца/года. Плюс: одинаковая семантика; минус: требуется небольшой общий контракт.

### DP04 — Low — предложение на сегодня не устаревает вместе с часами

Места: `src/features/smart-planner/hooks/useSmartPlanner.ts:153–180`, `src/features/smart-planner/utils/slotGenerator.ts:215–223`, `src/features/smart-planner/screens/SmartPlannerScreen.tsx:122–132,394–402`.

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

## Условные риски / стыки для добора H (не считать подтверждёнными уязвимостями)

### DX01 — profile timezone против timezone устройства

`useSmartPlanner.ts:31,110`: `userTimezone` только зависимость refetch; `slotGenerator.ts:222–223` использует device-local day/getHours. Экран диапазона тоже использует device-local Date (:81–102). По результату серверного аудита API отдаёт date/HH:mm в timezone requester. Если пользователь может сохранить timezone, отличный от device timezone, «сегодня/прошедшее» сравнивается по другой шкале. Пример: профиль Jerusalem, устройство New_York в момент, когда там 10:00, а профиль уже 17:00: генератор может предлагать profile 10:30 как ещё будущее. Уточнить в Auth/Profile/Calendar возможность расхождения и смысл prefill. Минимум: передавать now, спроецированный в user.timezone (1–2 ч); правильно: единый timezone-контракт планирования, формы и API (0.5–1 день). При подтверждении сделать отдельной Medium находкой либо объединить с системной timezone находкой.

### DX02 — tentative по-разному трактуется planner и формой конфликтов

`availabilityMerger.ts:57–58`: `filter(r => r.type === 'busy' || r.type === 'tentative')`; тест `availabilityMerger.test.ts:75–95` явно закрепляет calendar tentative как busy. `src/shared/utils/conflictDetection.ts:55–61`: `if (slot.type !== 'busy') return false`, т.е. tentative игнорируется. Production caller найден в `src/features/calendar/hooks/useAddRehearsalSubmit.ts:183`. Проверить, получает ли caller tentative без предварительной нормализации, и продуктовую семантику tentative. Если да, AddRehearsal не предупреждает о конфликте, который planner пометил занятым. Минимум: включить tentative в общий предикат (30–60 мин); правильно: единая явная политика типа занятости и её отражение в подсказке/подтверждении (0.5 дня). Здесь подтверждено расхождение кода, не весь пользовательский путь.

### DX03 — первый проект может не соответствовать admin-фильтру

`SmartPlannerTabScreen.tsx:20–24` выбирает `projects[0]` без прав; `SmartPlannerScreen.tsx:204` показывает в selector только `projects.filter(p => p.is_admin)`. Уточнить, какие projects попадают в context, сортировку и ограничение доступа к tab. Если tab открыт организатору хотя бы одного проекта, но первым идёт другой проект, где он только участник, вкладка начинается с проекта, отсутствующего в собственном selector. Права сервера это не обходит; последствия для кнопки создания проверить в H. Минимум: одинаковый фильтр при старте и selection (30–60 мин); правильно: единый список проектов, доступных для planner, и корректное empty state (1–2 ч).

## Проверенные свойства без отдельной находки

- Promise.all не публикует частичные данные. Cleanup `mounted=false` в useSmartPlanner:107–109 запрещает устаревшим success/error/finally менять state после смены зависимостей/размонтирования. Физической отмены HTTP нет, но конкретной гонки ответов на экране не найдено.
- После ошибки UI показывает renderError вместо устаревших рекомендаций (:367–375); не считать сохранённые в памяти старые availability сами по себе ложным успешным отображением.
- UTC-перебор date-only в генераторе устойчив к 23/25-часовым суткам; текущий момент сравнивается по времени устройства (оговорка DX01).
- Half-open пересечение busy корзины корректно для обычных положительных диапазонов; закрытие последнего слота использует актуальное множество busy, конечное время WORKDAY_END. Тесты покрывают короткие интервалы между :00/:30, последний бакет и selected subset.
- `mergeBusyRanges` копирует интервалы, сортирует и сливает пересекающиеся/соседние (включая gap≤1 минуты), не мутируя входные timeRanges. Busy/tentative фильтруются до merger; available не вычитает busy — здесь соответствует политике «занятость побеждает».
- Обещанный fallback на wrapped range в slotGenerator:64–75 проверяется unit напрямую, но реальные данные сначала проходят mergeBusyRanges:38, который отбрасывает start≥end. Согласно переданному серверному контракту endpoint уже делит интервалы по дням, поэтому реального reachable дефекта не утверждаем. При добавлении другого источника нужны сквозные тесты merger→generator, иначе этот fallback не защищает input из него.
- Снятие всех галочек возвращает режим всех участников, и summary MemberFilter:109–111 это явно сообщает. Смысл необычен, но в этом проходе не отмечен отдельной ошибкой, поскольку соответствует генератору и тексту summary.
- Нет проверки максимального диапазона в генераторе; custom UI передаёт minDate, но не maxDate. Серверное отсутствие лимита уже учитывается основной находкой B03; клиент также рендерит все дни/слоты через ScrollView/map (:359–405). Большой пользовательский диапазон требует профилирования, которое здесь запрещено.

## Ограничения тестового покрытия и ручные проверки

Прочитанные тесты не запускались. Нет тестов useSmartPlanner/SmartPlannerScreen, сценариев смены проекта, передачи состава в форму, ожидания на экране и системной/profile TZ. MemberFilter-тесты проверяют доступность элементов через test renderer; комментарий теста :63–67 верно признаёт, что такой renderer не проверяет фактический clipping/gesture native UI. Финальный ручной набор: A→B с разными составами, planner subset→форма, отрицательная TZ для дат, ожидание и полночь, profile TZ≠device, imported tentative конфликт, очень большой custom range.

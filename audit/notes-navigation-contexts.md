# H — Navigation, app entry и SeenContext

Дата завершения: 2026-09-11. Исходная база аудита: HEAD `8de99ab`; root сообщил текущий HEAD `25475e8` и отсутствие изменений в исходниках H. Чужая дельта mail/utils/tests/CLAUDE относится к отдельной проверке I и здесь не исследовалась. Все пути ниже относительно `/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native`. Только статическое чтение, поиск и заметки: приложение, тесты, сборки и команды проекта не запускались; исходники не изменялись.

## HN01 — Medium — Приглашение теряется при первом входе через onboarding

**Доказательство.** `src/navigation/index.tsx:347` вычисляет `shouldShowOnboarding = isAuthenticated && !user?.onboardingCompleted`. При этом обработчик URL проверяет только `isAuthenticated && navigationRef.current` и сразу вызывает `navigate('JoinProject', { code })` (`356–359`). Для отложенного приглашения эффект `380–387` делает:

```tsx
if (isAuthenticated && pendingInviteCode && navigationRef.current) {
  setTimeout(() => {
    navigationRef.current?.navigate('JoinProject', { code: pendingInviteCode });
    setPendingInviteCode(null);
  }, 500);
}
```

В этот момент `404–407` выбирает `OnboardingNavigator`, тогда как `JoinProject` объявлен в `AppNavigator` (`291–295`). Другой аудитор H, полностью прочитавший `src/features/onboarding/navigation/OnboardingNavigator.tsx`, подтвердил тип маршрутов (`10–15`) и реальные Screen (`28–31`): только Welcome, CalendarSync, Notifications, WeekStart; JoinProject отсутствует. Декларативный linking сам отключён на onboarding (`400`). В зависимостях эффекта нет ни `shouldShowOnboarding`, ни `loading`, ни признака готовности navigator; таймер не очищается.

**Сценарий.** Пользователь открывает invite URL до входа: custom handler сохраняет код. После регистрации/первого входа `isAuthenticated` становится true, но требуется onboarding. Через 500 мс код отправляется в текущий navigator, где нет JoinProject, затем безусловно стирается. Пользователь завершает onboarding и остаётся без приглашения. Аналогично URL, открытый уже во время onboarding, не попадает в очередь из-за проверки только auth. Сценарий не требует гонки SDK: проблема в выборе ветки приложения и безусловном consume. Отдельные cold-start моменты `navigationRef.current === null` требуют проверки готовности, но для finding достаточно обычного завершения login в уже смонтированном NavigationContainer.

**Минимум.** Сохранять приглашение до `isAuthenticated && !shouldShowOnboarding && !loading` и готового navigation ref; инициировать переход при выполнении этих условий и очищать только после принятого перехода. Убирать таймер при смене состояния. Плюс: небольшая локальная правка. Минус: два параллельных обработчика linking/custom handler всё ещё требуют согласования. **Правильно.** Один слой обработки внешних intents с очередью, проверкой текущей сессии и готовности маршрута, единым consume после навигации. Плюс: применимо к invite/rehearsal/push, меньше расхождений. Минус: затрагивает wiring и сценарии восстановления. **Effort:** 3–5 часов / 1–2 дня.

## HN02 — Medium — Успешная загрузка всех проектов не снимает устаревшую отметку «просмотрено»

**Доказательство.** `src/features/calendar/hooks/useRehearsals.ts:82–83` начинает сбор новых `responses`/`stats` с пустых объектов. В batch-ветке `93–95` записываются только положительные ответы:

```tsx
if (r.userResponse === 'yes') {
  responses[r.id] = 'yes';
}
```

Затем `158` передаёт объекты в `prime`. `src/contexts/SeenContext.tsx:50–58` сливает их со старым состоянием, в частности `54`: `setResponses((prev) => ({ ...prev, ...nextResponses }));`. Отсутствующий ключ не сбрасывается. `RehearsalCard.tsx:49–52,154–156` напрямую рисует этот ответ. `SeenContext:62–68` также вычисляет следующий wire status из него. Для single-project ветки `useRehearsals:130–133` null записывается при существующем response row, но ответ без row снова пропускается; это не исправляет batch-путь.

**Сценарий.** На устройстве A отметка репетиции уже `yes`. На устройстве B тот же пользователь снимает её (`no` на сервере), затем на A успешно обновляет календарь «Все проекты». Batch корректно возвращает non-yes, но A не записывает null и оставляет yes. Следующий тап пользователя «снять отметку» снова отправит no, хотя карточка должна была обновиться ещё при refresh. Тот же эффект после серверного изменения приглашений, если строка ответа удалена/заменена. Это обычный успешный последовательный refresh, а не DF06 перестановка запросов и не DD01 локальное состояние Details.

**Минимум.** Для каждого rehearsal в полном batch-снимке записывать `responses[r.id] = r.userResponse === 'yes' ? 'yes' : null`; аналогично различать подтверждённое отсутствие ответа и ошибку его загрузки в single-project ветке. Плюс: небольшой фикс без стирания других проектов. Минус: правила удаления устаревшей статистики остаются отдельными. **Правильно.** `prime` принимает авторитетный scoped snapshot (какие IDs успешно загружены, ответы и права на статистику) и заменяет значения в этом scope, сохраняя только данные других scopes. Плюс: корректны отрицательные ответы, удаление RSVP и потеря admin stats. Минус: меняется контракт loader→context. **Effort:** 2–4 часа / 0.5–1 день.

## HN03 — Medium — SeenContext сохраняет ответы предыдущего аккаунта

**Доказательство.** В `App.tsx:33–39` SeenProvider расположен внутри AuthProvider, но выше Navigation и не имеет session key. Navigation меняет Auth/Onboarding/App ветку (`src/navigation/index.tsx:402–407`), не размонтируя SeenProvider. `src/contexts/SeenContext.tsx:44–58` хранит `responses`, `stats`, `responding` в памяти, использует только I18n и не наблюдает auth/user; метода reset в интерфейсе `12–24` нет. `toggleSeen` по завершении запроса без проверки сессии записывает stats/rollback/responding (`74–84`).

**Сценарий.** A и B состоят в одном проекте и используют одно запущенное приложение. A имеет yes для репетиции, выходит и входит B, у которого no. B получает корректные данные сервером под своим токеном, но provider всё ещё содержит yes A; batch omission из HN02 дополнительно сохраняет значение даже после успешного fetch. B видит чужую отметку как свою и первый тап отправляет no вместо ожидаемого yes. Старый запрос A, завершившийся после переключения, может также повторно записать данные в общее состояние. Находка не утверждает обход серверных прав или доступ B к телам чужих репетиций; речь о смешении персонального локального ответа и счётчиков. Отличается от BC01/NI03 конкретным store и последствиями RSVP.

**Минимум.** Сбрасывать provider по user/session key, не оставлять старые ответы/статистику/responding; проверять generation сессии перед commit асинхронных результатов. Плюс: изолирует аккаунты. Минус: сам по себе не решает HN02 внутри одной сессии. **Правильно.** Область действия всех персональных caches и mutation lifecycle привязана к userId и session generation, logout завершает/инвалидирует работу. Плюс: единая модель для Seen/Project/Unread/calendar. Минус: совместная правка контекстов и callers. **Effort:** 3–5 часов / 1–2 дня для единой модели.

## Стыки, проверенные без новых finding IDs

- **DD01 остаётся в D.** Details `104–117` загружает participants/stats в отдельное local state, не prime; `143–149` оптимистически меняет строку, context rollback её не возвращает; `152–153` читает старый statsFor closure после await. Другой аудитор подтвердил, что все три проявления уже включены в DD01. Повторно не считать.
- **DF06 остаётся в D.** Late `useRehearsals:157–158` заменяет список/prime без generation guard. Новый HN02 воспроизводится без поздних ответов и требует исправить сам состав авторитетного snapshot.
- **BC01/BC02 остаются в B.** По поиску всех `selectedProject` consumers production выбор используется в ProjectsScreen и AddRehearsalScreen→useAddRehearsalForm. Form `75–76` копирует прежний admin-объект, `113–128` не сверяет его с актуальным объектом из списка. Удаление проекта/снятие роли оставляет старую selection; B уже учитывает это. RehearsalDetails ищет проект по rehearsal.projectId в `projects` (`83–84`), Calendar вычисляет admin по проекту конкретной репетиции (`399–401`), а не по global selectedProject. Поэтому не обнаружено отдельного route permission bypass через global selection.
- **G push navigation:** `useNotifications.ts:159–166` адресует ProjectDetail через MainTabs→Projects, соответствующие маршруты существуют в navigation/index `290` и stacks `53–56`. RehearsalDetails (`useNotifications:177–178`) существует в корневом AppStack (`navigation/index:323–325`). NotificationsHandler смонтирован в TabNavigator (`274`), то есть после auth/onboarding. Поэтому утверждение, что handler обычно монтируется на Login и теряет tap из-за отсутствующей auth route, не подтверждено wiring. Наличие registration/listener effect не означает, что SDK replay timing проверен.
- **G cold/live double handling — только ручная проверка.** `useNotifications:74–84` не отмечает handledLaunchResponse, `99–107` проверяет лишь ref boolean и не дедуплицирует notification ID/не очищает SDK response. Это возможность повторного replay при соответствующем поведении SDK, а не доказанный здесь баг. Async getLast не имеет alive/session guard, но детали navigation после logout тоже не воспроизводились. Нет отдельного H ID и нет claim cross-account server leak.
- **Deep link граница.** App linking явно содержит invite и rehearsal (`navigation/index:83,88`), но custom unauth queue ищет только invite (`352`). Для rehearsal после auth/onboarding отсутствует собственная очередь; сохранение initial URL средствами React Navigation/Expo и back-stack при cold direct details остаются сценариями ручной проверки, не объявлены статически подтверждённым дефектом SDK.
- **Два вызова useAutoCalendarSync.** AppContent (`App.tsx:16`) и TabNavigator (`navigation/index:181`) оба вызывают hook. В production hook есть module-global `currentSync` и `lastSyncAttempt` (`useAutoCalendarSync.ts:184–185`), поэтому из самого числа mounts нельзя вывести два одновременных экспорта. Overlap найден в E (EO03), lifecycle — ES01; здесь дубликата нет.
- `navigation/types.ts` использует `undefined` для вложенных tabs/MainTabs, а callers передают nested screen/params через `any`. Это снижает compile-time проверку маршрутов, но конкретные notification routes существуют. Отдельная функциональная находка не начислена.

## Покрытие и тестовые пробелы

Полностью прочитаны: `src/navigation/index.tsx` (411 строк, включая inline styles), `stacks.tsx` (99), `types.ts` (49), `App.tsx` (45), `index.ts` (8), `src/contexts/SeenContext.tsx` (110), его `__tests__/SeenContext.test.tsx` (149). Для стыков полностью перечитаны `RehearsalDetailsScreen.tsx` (469), `RehearsalCard.tsx` (163), `src/shared/hooks/useNotifications.ts` (222). `useRehearsals.ts` (179) ранее целиком прочитан в D, в H повторно проверены batch/personal-response/prime места. Отдельные фрагменты AddRehearsalForm (65–195), поисковые совпадения selectedProject/admin gating в calendar/projects/planner. Auth/Project/Unread/I18n глубоко заново не аудировались; их находки принадлежат соответствующим участкам. Onboarding проверяет отдельный аудитор H.

Файлов navigation/App-specific tests среди результатов поиска имён тестов не обнаружено. Integration auth/rehearsal и TodayRehearsals в H проверены только поиском relevant совпадений, а не полным повторным чтением; их покрытие не приписывается этому проходу. Seen suite полностью использует mock API и Probe, который напрямую читает store (`31–46`); проверяет toggle vocabulary, optimistic update/rollback, busy и merge другого rehearsal. Тест merge (`136–148`) подтверждает сохранение положительного ответа для другого ID, но не проверяет авторитетный yes→null refresh, удаление response, роли или A→B на одном provider. Нет интеграционного теста navigation+auth+onboarding+pending invite. Имена и assertions не считаются доказательством успешного запуска.

Рекомендуемые проверки после разрешения запусков: invite перед регистрацией→полный onboarding→JoinProject; invite во время onboarding; yes на A→no на B→batch refresh A; A logout→B login с общей репетицией и переставленными async ответами; live/cold push replay и navigation readiness на реальном SDK. Сейчас ничего из этого не запускалось.

Итог этого файла: **3 подтверждённые находки Medium**; статические стыки и SDK-гипотезы отдельно, без дополнительного начисления. Участок I не открывался.

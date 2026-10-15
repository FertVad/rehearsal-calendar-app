# R5 — клиент: состояние приложения

**Статус: IN_PROGRESS.** Ветка `auto/main`. Находки R5 распределены по правкам
причин из [разбора](TRIAGE_R4_R9.md). Правки №8, №12 и №13 — здесь. Остальные правки R5
(№14) — в последующих задачах.

## Правка №8: состав и расчёт планировщика привязаны к проекту

### Причина

`useSmartPlanner` не нёс информацию о том, для какого проекта загружены текущие
`members`. Эффект-сеялка в `SmartPlannerScreen` срабатывал в том же цикле
рендера, что и эффект очистки хука — в этом цикле `simpleMembers` ещё отражали
прошлый проект. Эффект засевал `selectedMemberIds` ID-шниками старого проекта
под ключом нового `projectId` и помечал его как «уже инициализированный». Когда
реальные участники нового проекта наконец загружались, сеялка выходила по ранней
защите `hasInitializedMembers.current === projectId` и старые ID оставались
навсегда.

Та же защита (`hasInitializedMembers.current === projectId`) блокировала
reconciliation при перезагрузке состава того же проекта: если участник удалялся,
а дата-диапазон менялся (смена периода «Неделя» → «Месяц»), состав перезагружался,
но `selectedMemberIds` сохранял удалённый ID. Генератор слотов получал ID, которого
нет в `simpleMembers`, считал эффективный охват нулём и не отображал кнопки создания
репетиции.

### Правка

**`useSmartPlanner.ts`** — новый стейт `membersProjectId`: `null` при очистке
(clearing-эффект по `[projectId]`), `= projectId` сразу после `setMembers` при
успешной загрузке. Возвращается из хука.

**`SmartPlannerScreen.tsx`** — эффект-сеялка переписан в два рукава:
- Охрана `membersProjectId !== projectId` ждёт подтверждённых данных (не
  возникает гонки со стейл-данными при смене проекта).
- При `hasInitializedMembers.current !== projectId` — первый подтверждённый лоад:
  засеваем всех участников, помечаем ref.
- При `hasInitializedMembers.current === projectId` — перезагрузка состава того же
  проекта: фильтруем `selectedMemberIds`, удаляя ID, которых больше нет в
  `simpleMembers`. Ручные деселекции оставшихся участников не трогаются.

Правило живёт в одном месте: хук декларирует актуальность данных через
`membersProjectId`; экран полагается на этот инвариант для обоих сценариев
(смена проекта и обновление состава).

### Изменённые файлы

- [`useSmartPlanner.ts`](../rehearsal-calendar-native/src/features/smart-planner/hooks/useSmartPlanner.ts)
- [`SmartPlannerScreen.tsx`](../rehearsal-calendar-native/src/features/smart-planner/screens/SmartPlannerScreen.tsx)

### Проверки

Коммиты правки на `auto/main`: `9d7bb83` (DP01, перенесён из `02a8549`),
`23e4342` (R5-01, перенесён из `c9f40a5`), `f95061c` (e2e-сценарий). База до
правки — `9fd6f64`.

| Тест | Что проверяет | Красный до |
|---|---|---|
| `SmartPlannerScreen.test.tsx` — 2 теста DP01 | После переключения A(3)→B(2) summary не содержит «3 of 2» | `9fd6f64` — оба теста падают |
| `SmartPlannerScreen.test.tsx` — тест R5-01 | После удаления a3 из A и смены периода summary не содержит «3 of 2» | `9fd6f64` и `9d7bb83` — тест падает |
| `e2e/flows/07-planner-project-switch.yaml` (`planner`, `projects`), версия `f95061c` | The Seagull → Hamlet → The Seagull: «2 of 2», «4 of 4», без чужих ID | `9fd6f64` — Hamlet показывает «2 of 4 selected» |
| `e2e/flows/07-planner-project-switch.yaml`, версия T-301 (ниже) | Three Sisters → The Bear → Three Sisters: счётчик и слоты по людям проекта | `9fd6f64` — «3 of 2 selected», Smirnov не в слотах |

Все прогоны — на файлах правки, возвращённых `git restore --source=<коммит>`,
с тестами из `23e4342`; источник и хеши — в
[manifest.json](evidence/R5/manifest.json) (`sourceCommit` `23e4342`,
`sourceTree` `1c0a871`).

- **«Красное до» DP01** ([planner-dp01-before.log](evidence/R5/planner-dp01-before.log),
  SHA-256 `a9577405bc2832aa2113a000c741cbf292c769a5ef5c0fbf39b2dbf38bee6d07`):
  на `9fd6f64` падают все 3 теста, «3 of 2» в DOM.
- **«Красное до» R5-01** ([planner-r5-01-before.log](evidence/R5/planner-r5-01-before.log),
  SHA-256 `8d9bf1a971b7b8645fd3f34fb1d73f983cc6aadedcd953486c9bd17405d6392c`):
  на `9d7bb83` падает только тест R5-01, оба теста DP01 проходят.
- **После** ([planner-after.log](evidence/R5/planner-after.log),
  SHA-256 `75ebd8acaaa5dd88502873d52f3501fea8bb176c5ea1ddff69160b2439a987bc`):
  на `23e4342` 3 из 3 PASS.
- **e2e, красное до** ([e2e-07-before.txt](evidence/R5/e2e-07-before.txt),
  SHA-256 `2998cd1c394abe99f523d986a3145bf66ab9c2fa05f9799aa908694664a8c6ec`):
  на `9fd6f64` планировщик открылся на The Seagull, после выбора Hamlet —
  «2 of 4 selected» (ID The Seagull под Hamlet), exit 1.
- **e2e, после** ([e2e-07-after.txt](evidence/R5/e2e-07-after.txt),
  SHA-256 `30f46df8f03ee9bcb66365df061463cf5b02aceb0b93795db91cb3666d83ed92`):
  на `23e4342` сценарий PASS.
- **Исторические файлы** — первые «красное до», записанные на ветке
  `auto/out-of-scope/T-108` (`47037a4`, `f9212b3`), оставлены как были:
  [planner-before.txt](evidence/R5/planner-before.txt) (SHA-256
  `1eb04085cc431564c415dfedf77a96f1c48207b799dd7b93da11f9e39f40e02a`; пересказ,
  не сырой вывод) и [planner-r5-01-before.txt](evidence/R5/planner-r5-01-before.txt)
  (SHA-256 `a131074ec8a4179609f4cd6da4673a9ccb56531f6e0fbd30e5cafb7b3b09e9a2`).
  Их заменяют сырые логи выше (R5-02).
- **Полная проверка:** `check:secrets` — 0 находок; `type-check` — exit 0;
  все клиентские наборы — PASS, кроме трёх тестов планировщика в прогоне на
  базе `9fd6f64` (это и есть «красное до»).
- В `06-planner-to-rehearsal.yaml` исправлен комментарий: выбор при входе
  больше не наследуется от прошлого проекта.

### Экранное покрытие (T-301)

Сценарий `07-planner-project-switch.yaml` (`planner`, `projects`) переписан на
собственные данные из `e2e/seed.mjs`: Three Sisters (режиссёр, Masha, Irina —
3 человека) и The Bear (режиссёр, Grigory Smirnov — 2), у Smirnov занятость
завтра 10:00–14:00. Шаги: Three Sisters, выбор «3 of 3» задан явно → The Bear:
«2 of 2 selected», нет «3 of 2 selected», в слотах есть «Busy: … Grigory
Smirnov» → обратно Three Sisters: «3 of 3», нет «2 of 3» и Smirnov в слотах.

- **e2e, красное до** ([e2e-07-t301-before.txt](evidence/R5/e2e-07-t301-before.txt),
  SHA-256 `b7fa15135db30cad75ac77760e891d7441104ef4fe8c696c18e8348626fb7307`):
  файлы правки на `9fd6f64` — The Bear показывает «3 of 2 selected», слоты
  посчитаны только по режиссёру (3 слота на завтра вместо 5, Smirnov не
  упомянут), exit 1.
- **e2e, после** ([e2e-07-t301-after.txt](evidence/R5/e2e-07-t301-after.txt),
  SHA-256 `f76dae530b0ff3cb60ba3f0988faa764d3fdd342ff6762ec9cd986ceee67743b`):
  на HEAD сценарий 07 PASS; 06 PASS.
- Обход DP01 из `06-planner-to-rehearsal.yaml` убран: вместо цикла
  `members-toggle-all` сценарий ждёт «4 of 4 selected» при входе в Hamlet.
  Правило в `docs/e2e.md` («не доверять выбору при входе») заменено: проект
  приходит со всем составом, другой выбор сценарий задаёт сам.
- **Ревью T-301, P2** (07 зависел от данных 06): оба проекта принадлежали
  общему режиссёру, а 06 бронирует ему репетицию — после 22:30 она приходится
  на завтра 09:00–18:00 и в The Bear перекрывает занятость Smirnov («All busy»
  вместо «Busy: … Grigory Smirnov»). Причина — общий человек, а не час: в
  `seed.mjs` у сценария 07 теперь свой режиссёр, Olga Stage
  (`stage@e2e.test`), Three Sisters и The Bear созданы под ней, общий режиссёр
  ни в одном из них не состоит. Сценарий 07 входит как `${STAGE_EMAIL}`.
  - красное до ([e2e-07-t301-own-director-before.txt](evidence/R5/e2e-07-t301-own-director-before.txt),
    SHA-256 `98bc50c548471d138a84f2a70007dad6c0930b55b19d9295cfe571c707fb6518`):
    файлы правки на `9fd6f64` — та же причина DP01, «3 of 2 selected», слоты
    только по Olga Stage, Smirnov не упомянут, exit 1;
  - после ([e2e-07-t301-own-director-after.txt](evidence/R5/e2e-07-t301-own-director-after.txt),
    SHA-256 `ac9eb038ed0ccdb53fce9cc81474c10f79d268d87ee2bd4d532d756dde828b3b`):
    07 отдельно — PASS; 06 и 07 на одной базе, 06 первым — оба PASS. Прогоны
    были до 22:30; изоляция от часа не зависит, так как 06 не трогает людей 07.

### Ревью

- **R5-01** (сверка состава при перезагрузке того же проекта) — закрыт в `23e4342`.
- **R5-02** (оформление evidence) — сырые логи, хеши, манифест, точные коммиты
  в TRIAGE; исторические файлы сохранены и помечены.

### Статусы

DP01 → READY_FOR_CHECK до проверки на устройстве DEV-19 (переключить проект в
планировщике, убедиться что состав обновляется; удалить участника и сменить
период — убедиться что кнопки создания не исчезают).

## Правка №12: состояние приложения принадлежит сессии

Находки: AC01, AC02, AC03, BC01, BC02, NI03, HN02, HN03, HC01, DF05, DF06,
ES01 (High) и NI04 (пакет R8). Задача T-112. База — `ce1a4fb`.

### Причина

У состояния не было владельца. Контексты проектов, «просмотрено» и
непрочитанного стоят над навигатором, выход их не размонтирует — и их память,
и ответы в пути переходили к следующему человеку (BC01, HN03, NI03). Ответ
применялся без вопроса, нужен ли он ещё: поздний ответ старого фильтра,
старой даты, чтения до удаления ложился поверх нового (DF06, DF05, NI04, AC03).
Синхронизация календаря, начатая под A, дописывала под токеном B — запрос
берёт токен в момент отправки (ES01). Клиент API не отличал отказ сервера
от отсутствия сети: любой сбой обновления токена стирал сессию (AC01), а
настоящий отказ никому не сообщался (AC02). Выбранный проект хранился копией
(BC02); пакетная загрузка не говорила «не просмотрено» (HN02); язык аккаунта
писался только в хранилище (HC01).

### Правка

Один механизм — модуль сессии
[`session.ts`](../rehearsal-calendar-native/src/shared/services/session.ts):
владелец (id пользователя) и поколение. Сменить владельца может только
AuthContext (`changeOwner`): вход другого человека, выход, удаление аккаунта,
окончательный отказ сервера. Тот же человек (смена адреса) сессию не меняет.

- **Состояние сессии** — `useSessionState`
  ([`useSession.ts`](../rehearsal-calendar-native/src/shared/hooks/useSession.ts)):
  новая сессия с первого кадра читает начальное значение, запись из замыкания
  прошлой сессии отбрасывается. Так держат состояние ProjectContext, SeenContext,
  UnreadContext (BC01, HN03, NI03). Сохранённый счётчик — по ключу
  `unread-count:<userId>`: общий ключ читался новым аккаунтом раньше, чем его
  стирал вход.
- **Ответ только на последний вопрос** — `useLatestRequest`: ответ ложится,
  пока не начат новый запрос и жива сессия; мутация тоже берёт очередь и
  отменяет чтение, начатое до неё. Проекты, репетиции по фильтру (DF06),
  счётчик и список входящих против удаления (NI04). Для загрузок из эффекта —
  тот же принцип по ключу вопроса: `useRehearsalAvailability` отдаёт занятость
  только для текущих проекта/дня/людей и говорит `ready`/`failed`; форма не
  сохраняет без неё (DF05).
- **Работа сессии** — `sessionWork`: импорт и экспорт календаря (входы
  `import.ts`, `export.ts`, оркестратор `useAutoCalendarSync`). Смена владельца
  ждёт её (не дольше 10 с) до записи новых токенов — ничто из неё не уходит под
  токеном следующего; сама работа проверяет сессию перед каждой записью и
  останавливается (ES01).
- **Клиент API**: запрос несёт сессию, в которой отправлен; 401 прошлой сессии
  не обновляется и не повторяется. Обновление одно на все 401 (сервер
  вращает пару). Конец сессии — только отказ сервера на refresh
  (400/401/403): он сообщается, AuthContext выходит, навигатор открывает вход
  (AC02). Нет сети или ошибка сервера — токены остаются, запрос падает как
  офлайн (AC01). 401 без токена (неверный пароль) обновление не запускает.
- Выбранный проект — id, объект читается из текущего списка; удалённый —
  первый из списка, роль — из свежего списка (BC02).
- Загрузка репетиций пишет `null` для каждой не отмеченной (HN02).
- `syncUserPreferences` — единственное место записи настроек аккаунта —
  сообщает язык работающему I18nContext (HC01).
- AC03: проверка позднего ответа профиля и пояса вошла в `a7e42d8` (ревью R3);
  здесь — регресс-тест на смену аккаунта.

Правило 11 в `CLAUDE.md` дополнено: где теперь живёт механизм.

### Проверки

Коммиты: `1a4071a` (правка и тесты), `20724bd` (e2e 14, тест DF05 без
зависимости от типов).

| Находка | Тест | Красное до (`ce1a4fb`) |
|---|---|---|
| AC01 | `api.refresh.test.ts` — сбой сети и 503 на refresh не трогают токены | токены стёрты |
| AC02 | `api.refresh.test.ts` — отказ refresh сообщается; `AuthContext.test.tsx` — сообщение ведёт на вход | не сообщается; user остаётся «7» |
| AC03 | `AuthContext.test.tsx` — поздний ответ пояса A после входа B | проходит на `ce1a4fb`; падает на `23f59cb` («7» вместо «8») |
| BC01 | `ProjectContext.test.tsx` — список и выбор A не видны B, поздний ответ A отброшен | список A у B |
| BC02 | `ProjectContext.test.tsx` — удалённый выбор, роль из свежего списка, порядок ответов | старый объект |
| DF05 | `useRehearsalAvailability.test.ts` (3), `useAddRehearsalSubmit.test.ts` (2) | поздний ответ заменил; сохранение без занятости |
| DF06 | `useRehearsals.test.ts` — поздний «Все проекты» после выбора проекта | чужие репетиции |
| ES01 | `importSession.test.ts`; `AuthContext.test.tsx` — токены B после работы A | смена не ждёт, импорт отправлен |
| NI03 | `UnreadContext.test.tsx` (2) | «3», затем «8» у B |
| NI04 | `UnreadContext.test.tsx`; `NotificationsScreen.test.tsx` | счётчик «5»; удалённая карточка вернулась |
| HN02 | `useRehearsals.test.ts` — `r2: null`, `r1: null` | ключа нет |
| HN03 | `SeenContext.test.tsx` (2) | «yes» у B |
| HC01 | `I18nContext.test.tsx` | «en» |
| экран (HN03, HN02, BC01) | `e2e/flows/14-switch-account.yaml` (`auth`, `seen`, `projects`, `rehearsals`) | у Lopakhin отметка Ranevskaya |

- **Красное до, jest** ([cause12-before.log](evidence/R5/cause12-before.log),
  SHA-256 `0999800258c0b3421cb5df6bb69724aec777ed5131be364f7444e541d9d3d87c`):
  11 наборов, 31 падение. Два старых теста счётчика падают только из-за
  переноса ключа хранения — отмечено в логе.
- **После, jest** ([cause12-after.log](evidence/R5/cause12-after.log),
  SHA-256 `151dbfe1ab8c9fdf5d2ad31215c1fd98b7381457b42d8fff99d5ebb7ea415092`):
  112/112. Весь клиент — 73 набора, 733 теста PASS; `type-check` — 0.
- **e2e, красное до** ([e2e-14-before.txt](evidence/R5/e2e-14-before.txt),
  SHA-256 `aa24787592b226e11ea7abbd31e412dda699d9394d0af0b5a57b6efbf39e73cc`):
  у Lopakhin на «Orchard walk» закрашенный глаз Ranevskaya, exit 1.
- **e2e, после** ([e2e-14-after.txt](evidence/R5/e2e-14-after.txt),
  SHA-256 `941d8660c64a873c4ccb092b79a9736030cd57520f943f5d1fb72d9b0ef80272`):
  PASS, форма открыта на «Lopakhin Holdings».

### Планка

- Смена владельца ждёт работу сессии не дольше 10 с; работа, пережившая
  предел, остановится на своей следующей проверке. Окно между проверкой и
  отправкой — особое стечение, мелко → не чинится отдельно.
- Запрос, отправленный в долю секунды между отметкой сессии и чтением токена,
  уходит с токеном новой сессии; работа синхронизации от этого защищена
  ожиданием — особое стечение.

### Ревью (Астра): правки

Замечания ревью к `1a4071a`/`20724bd`/`ac5e1ec` — та же причина, правила
те же, механизм доведён до конца.

1. **ES01 (High): шаг цепочки брал сессию, текущую в момент своего
   начала.** Вложенный `sessionWork` после задержанного `getAllMappings()`
   или созданное позже событие работали уже как следующий человек; mapping
   нового события писался до любой проверки. Теперь `sessionWork(run,
   session)` принимает поколение работы, частью которой является, и не
   начинается для закончившейся сессии. Поколение передаётся по всей
   цепочке — `useAutoCalendarSync` → `import.ts`/`export.ts` →
   `calendarMappings.ts` → API; каждый helper (создание, изменение,
   удаление события, запись и удаление mapping, кэш подключения, импорт)
   проверяет его перед своей записью, `SessionEndedError` не глотается.
   Запрос несёт свою сессию (`inSession`), и клиент API отправляет его,
   только пока она жива, — проверка после чтения токена, а смена владельца
   заканчивает сессию раньше, чем пишет токены следующего: ушедший запрос
   несёт токен своей сессии или не уходит вовсе. Это закрывает и окно
   «между отметкой и чтением токена», оставленное в планке выше.
2. **HN02: поздний ответ снимал успешно поставленную отметку.** Порядок
   чтений и изменений — в `SeenContext`: чтение начинается там
   (`beginRead`), изменение отметки получает номер, когда сделано и когда
   сервер его принял; ответ чтения ложится только для репетиций, которые с
   его начала не меняли.
3. **NI04: «Прочитать всё» не отменял старую загрузку карточек.** Все
   изменения во входящих (прочитать одну, прочитать всё, удалить, очистить)
   идут через один `change`, который берёт очередь при отправке и по
   завершении.
4. **Регресс: удаление последнего проекта оставляло вечную загрузку.**
   Пустой список, отменяя запрос, сам заканчивает `loading`/`refreshing`.
5. **e2e: экранные исправления без сценариев.** Сценарии 15–20, по одному на
   находку, с «красным до» на старом коде. Локальный e2e-сервер умеет
   задержать ответ до команды сценария (`/hold`, `/release`;
   `scripts/hold-answers.js`, `release-answers.js`): запрос обрабатывается
   сразу, ждёт только ответ — как на медленной сети. `revoke-sessions.js`
   завершает сессии аккаунта «с другого устройства». Seed входит только за
   тех, от чьего имени действует (сервер принимает 20 входов в минуту с
   адреса).

| Находка | Проверка | Красное до |
|---|---|---|
| ES01 | `syncSession.test.ts` (2): ответ mappings после смены владельца; поиск копии события во время смены; `api.refresh.test.ts` — запрос закончившейся сессии не уходит | 6 запросов ушли под сессией B; событие создано; запрос ушёл |
| HN02 | `seenOrder.test.tsx` (2) — отметка после начала чтения и во время него | отметка снята (`null`) |
| NI04 | `NotificationsScreen.test.tsx` — «Прочитать всё» против поздней загрузки; e2e 18 | кнопка «Mark all read» вернулась |
| регресс | `useRehearsals.test.ts` — последний проект удалён во время загрузки | `loading` остался `true` |
| AC02 | e2e 15 `15-session-revoked.yaml` (`auth`, `calendar`) | остался на календаре |
| NI03 | e2e 16 `16-switch-account-unread-language.yaml` (`auth`, `notifications`, `profile`) | у Dunyasha счётчик Yasha |
| HC01 | e2e 16 — только файлы HC01 на старом коде | интерфейс остался английским |
| DF06 | e2e 17 `17-filter-late-answer.yaml` (`calendar`, `rehearsals`) | «Garden debate» под фильтром Eternal Student |
| BC02 | e2e 19 `19-chosen-project-deleted.yaml` (`projects`, `rehearsals`) | форма открылась на удалённом проекте |
| DF05 | e2e 20 `20-save-before-availability.yaml` (`rehearsals`, `availability`) | репетиция сохранена без занятости |

Коммиты: `62173fd` (правка и тесты), `a081511` (e2e 15–20, задержка ответов,
seed, testID), `856a88d` (ответ можно задержать дольше таймаута приложения —
сценарий 16).

- **Красное до, jest** ([cause12-review-before.log](evidence/R5/cause12-review-before.log),
  SHA-256 `ec40c765a083d1a18556a912bfab523f3dca54d0a6597a3fd8f9f2eaf32fae1f`):
  файлы правки с `ac5e1ec`, тесты с `62173fd`; 7 падений, 22 PASS. Девять
  старых тестов изменены только под новый аргумент сессии — в лог не входят.
- **После, jest** ([cause12-review-after.log](evidence/R5/cause12-review-after.log),
  SHA-256 `f1ec5c60212ecb354e8c744691d58c7ef12f091756c4e2b8cb79f8d3cd4427c2`):
  29/29; весь клиент — 75 наборов, 742 теста PASS; `type-check` — 0;
  `check:secrets` — pass.
- **e2e, красное до** — файлы правки (17 файлов приложения) с `ce1a4fb`:
  [e2e-15-17-before.txt](evidence/R5/e2e-15-17-before.txt),
  SHA-256 `a5d4d92684652a50275b4e07eb348b9ab3093269b6c0762acbe313c6499ea20e`;
  [e2e-18-20-before.txt](evidence/R5/e2e-18-20-before.txt),
  SHA-256 `c0a9e55d923450f7a27f2b95fb33549f05d40f5831e5a3d8e7772e0c3729e1a1`;
  HC01 отдельно (на старом коде только `I18nContext.tsx`, `storage.ts`):
  [e2e-16-hc01-before.txt](evidence/R5/e2e-16-hc01-before.txt),
  SHA-256 `9197fff2a2a81fe196dcac08bafd26eb881b57623ed7ffa7fd2f511677357447`.
  Все шесть сценариев падают на своей находке.
- **e2e, после** ([e2e-14-20-after.txt](evidence/R5/e2e-14-20-after.txt),
  SHA-256 `92244b67489e79973725b841c49f3224b21679d8628abdee92e404cc118d6801`):
  14–20 и 05 — PASS (два прогона: лимит инструмента 10 минут).

Ниже планки по тому же правилу: чтения проектов и репетиций в экспорте
(`getUserProjects`, `getBatch`) идут под текущей сессией, а не поколением
работы, — их ответ ничего не пишет, перед первой записью поколение
сверяется (`exportRehearsalsIfDue`), поэтому отдельно не чинится.

### Статусы

Все 13 → READY_FOR_CHECK до ревью и проверки на устройстве: AC03, BC01, ES01,
NI03, HN03, HC01 — DEV-01; AC01, AC02, NI04 — DEV-17; DF06, HN02 — DEV-19;
BC02, DF05 — DEV-21 (новая карточка в
[notes-remediation-device-tests.md](notes-remediation-device-tests.md)).

## Правка №13: журнал без секретов

### Причина

Журнал клиента не имел правила, что в него можно писать. 81 вызов шёл прямо в
`console`, а `logger` передавал аргументы как есть. Неудачный запрос попадал
туда целиком: `AxiosError` хранит конфиг запроса, поэтому ID-токен Google лежал
в `config.data` (`/auth/google`), а bearer текущей сессии — в `config.headers`
и `request._headers`. `AuthContext` (AC04) логировал объект ошибки и тело
ответа; `notifications.ts` и `useNotifications.ts` писали push-токен открытым
текстом; `notifications.ts` отдавал `AxiosError` целиком в `logger.warn` и
`console.error`. Любой сборщик консоли — отладчик, сборщик логов, crash
reporter — получал эти токены.

### Правка

Правило живёт в одном месте — в
[`logger.ts`](../rehearsal-calendar-native/src/shared/utils/logger.ts), и это
единственный файл, который пишет в `console`:

- **Ошибки типизированы.** Ошибка (в том числе `AxiosError`) пишется как
  `LoggedError`: `name`, `message`, `code`, `status`, `method`, `path` (без
  query), `serverError` (строка `error` из ответа сервера), `stack` — только в
  development и не для HTTP-ошибок. Конфиг, заголовки, тело и native request в
  журнал не попадают.
- **Всё остальное — через `toLogSafe`.** Ключи-учётные данные (`*token*`,
  `authorization`, `password`, `secret`, `cookie`, `credential`, `api key`,
  `otp`) заменяются на `[redacted]`; `config`, `request`, `headers`, `_body…`
  выбрасываются; строки с JWT, `Bearer …`, `ExponentPushToken[…]`, параметрами
  query, в имени которых есть token, code, password или key, и кодом приглашения
  в пути (`/invite/<код>`) редактируются — и в аргументах, и в самом сообщении,
  и в `LoggedError.path`. Циклы и глубина обрезаются.
- **Один механизм.** Все 81 прямой вызов `console` в `src/` переведены на
  `logger` (`log` → `debug`, остальные уровни один к одному); три строки AC04 в
  `AuthContext` свелись к одной — статус и текст сервера уже в `LoggedError`.
  Push-токен больше не логируется вовсе. Новый прямой вызов `console` ловят тест
  (скан `src/`) и ESLint (`no-console: error` везде, кроме логгера и тестов).

Сервер не менялся: его журнал push-токены не пишет (`pushTokens.js` логирует
только id пользователя), а AC04 — находка клиента.

### Изменённые файлы

- [`logger.ts`](../rehearsal-calendar-native/src/shared/utils/logger.ts) и тест
  [`logger.test.ts`](../rehearsal-calendar-native/src/shared/utils/__tests__/logger.test.ts)
- 22 файла `src/` с прямыми вызовами `console` (список — `git show --stat f847b3e`)
- [`eslint.config.js`](../rehearsal-calendar-native/eslint.config.js) — `no-console`
- `useRehearsals.test.ts`, `useAvailabilityData.test.ts` — ждут `LoggedError`
  вместо сырого `Error`

### Проверки

Коммит правки — `f847b3e` (дерево `c610aaa`), база — `ce1a4fb`.
Экранного эффекта нет — e2e-сценарий не нужен (журнал).

| Тест | Что проверяет | Красный до |
|---|---|---|
| `logger.test.ts` — typed summary | 401 от `/auth/google`: в выводе `console.error` нет ID-токена, bearer, cookie и query; ошибка — ровно `LoggedError` | `ce1a4fb` — в выводе весь конфиг с `idToken` и `Authorization` |
| `logger.test.ts` — warn/info/debug | То же правило на всех уровнях; push-токен, `Bearer`, `token=` в URL сообщения редактируются | `ce1a4fb` — токены в выводе |
| `logger.test.ts` — plain value | Ключи-учётные данные и JWT в строках вложенных объектов | `ce1a4fb` — токены и пароль в выводе |
| `logger.test.ts` — cycle | Обычная ошибка читаема, цикл не роняет сериализацию | `ce1a4fb` — `Converting circular structure to JSON` |
| `logger.test.ts` — console scan | В `src/` нет прямых `console.*` вне логгера | `ce1a4fb` — 81 вызов |

- **«Красное до»** ([logger-ac04-before.txt](evidence/R5/logger-ac04-before.txt),
  SHA-256 `9a913d28e4492bd1a113596d873bfe2a4f5ea40c35c1f9e2ff7bc4629119e000`):
  на `ce1a4fb` 5 из 5 FAIL. Проверку `token=` в сообщении добавил после
  записи — тест warn/info/debug падал на старом коде и без неё.
- **После** ([logger-ac04-after.txt](evidence/R5/logger-ac04-after.txt),
  SHA-256 `e1c1e36fe7fda9a0ac27186d7f2a97c28c273d2bf0da2a3f233b100979173b4f`):
  5 из 5 PASS; клиент 68 наборов / 707 тестов PASS; `type-check` exit 0;
  `eslint src/` — 0 ошибок; `check:secrets` — 0 находок.
- Источник и хеши — [manifest-cause13.json](evidence/R5/manifest-cause13.json).

### Ревью: код приглашения в пути

Ревьюер (P2): правило знало секреты в query, но не в пути. Код приглашения
идёт в пути запроса — `/native/invite/<код>/join`, — а перехватчик ответа
`api.ts` пишет URL каждого отказа, поэтому сетевой отказ `joinProject` клал
код в сообщение и в `LoggedError.path`. Кто прочёл код, вступает в проект.

Правка — `94d09de` (дерево `7608f34`): ещё одно правило в `SECRET_TEXT`
того же логгера — сегмент после `/invite/` заменяется на `[redacted]` в любом
тексте. Сообщение, аргументы и `LoggedError.path` проходят через одну
`redactText`, так что правило одно на все три места; ссылки-приглашения
(`https://rehearsly.me/invite/<код>`) под него попадают тоже. Других секретов
в пути у клиента нет: остальные сегменты API — числовые id, дата и тип события.

| Тест | Что проверяет | Красный до |
|---|---|---|
| `logger.test.ts` — invite code | Сообщение и `LoggedError.path` для `POST /native/invite/ABCD2345/join` — с `[redacted]` вместо кода; ссылка с legacy hex-кодом тоже | `2f76652` — код в сообщении и в `path` |
| `api.log.test.ts` | Настоящий перехватчик ответа `api.ts`, сетевой отказ `joinProject`: кода нет в выводе `console.error` | `2f76652` — `Response Error: Network Error POST /native/invite/ABCD2345/join` |

- **«Красное до»** ([logger-ac04-invite-before.txt](evidence/R5/logger-ac04-invite-before.txt),
  SHA-256 `94f00e0fdab3575e8d5db31a6ee23b4675d2607ab6ef5f046c20853546c33968`):
  на `2f76652` 2 FAIL (оба новых), 5 PASS.
- **После** ([logger-ac04-invite-after.txt](evidence/R5/logger-ac04-invite-after.txt),
  SHA-256 `1178ba0d05222f114c10a923792166db9bb1b2fd578d7fa4c35960a5c5148c7a`):
  7 из 7 PASS; клиент 69 наборов / 709 тестов PASS; `type-check` exit 0;
  `check:secrets` — 0 находок.

### Статусы

AC04 → READY_FOR_CHECK до ревью. Проверка на устройстве не нужна: правило
целиком в логгере и проверено тестом.

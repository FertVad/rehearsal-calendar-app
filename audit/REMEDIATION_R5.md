# R5 — клиент: состояние приложения

**Статус: IN_PROGRESS.** Ветка `auto/main`. Находки R5 распределены по правкам
причин из [разбора](TRIAGE_R4_R9.md). Правка №8 — здесь. Остальные правки R5
(№12, №13, №14) — в последующих задачах.

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
| `e2e/flows/07-planner-project-switch.yaml` (`planner`, `projects`) | The Seagull → Hamlet → The Seagull: «2 of 2», «4 of 4», без чужих ID | `9fd6f64` — Hamlet показывает «2 of 4 selected» |

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

### Ревью

- **R5-01** (сверка состава при перезагрузке того же проекта) — закрыт в `23e4342`.
- **R5-02** (оформление evidence) — сырые логи, хеши, манифест, точные коммиты
  в TRIAGE; исторические файлы сохранены и помечены.

### Статусы

DP01 → READY_FOR_CHECK до проверки на устройстве DEV-19 (переключить проект в
планировщике, убедиться что состав обновляется; удалить участника и сменить
период — убедиться что кнопки создания не исчезают).

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

| Тест | Что проверяет | Красный до |
|---|---|---|
| `SmartPlannerScreen.test.tsx` — 2 теста DP01 | После переключения A(3)→B(2) summary не содержит «3 of 2» | `47037a4` — оба теста падали |
| `SmartPlannerScreen.test.tsx` — тест R5-01 | После удаления a3 из A и смены периода summary не содержит «3 of 2» | `f9212b3` — тест падал |

- **«Красное до» DP01** ([planner-before.txt](evidence/R5/planner-before.txt)):
  на коде `47037a4` оба теста DP01 падали с «3 of 2 selected» в DOM.
- **«Красное до» R5-01** ([planner-r5-01-before.txt](evidence/R5/planner-r5-01-before.txt)):
  на коде `f9212b3` тест R5-01 падал — «3 of 2 selected» после удаления участника.
- **Полная проверка после всех правок:** `check:secrets` — 0; `type-check` — exit 0;
  3 теста SmartPlannerScreen PASS; все клиентские наборы PASS.

### Статусы

DP01 → READY_FOR_CHECK до проверки на устройстве DEV-19 (переключить проект в
планировщике, убедиться что состав обновляется; удалить участника и сменить
период — убедиться что кнопки создания не исчезают).

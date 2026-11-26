# T-281: вычитка испанского (es) — отказы сервера на языке человека

## 1. Кто читал

Редактор-носитель испанского. Локализую iOS-приложения на нейтральный испанский для Испании и Латинской Америки, на «tú». Строки `errors.ts` (19ae506) сверены с `requestError.ts` и с соседними строками: `common.ts`, `projects.ts`, `rehearsals.notFound` из `calendar.ts`, `auth.rateLimited` и `auth.codeLocked`, `smartPlanner`. Сверены и с отчётами T-256, T-261, T-269, T-271, T-276.

## 2. Таблица

| Ключ | Сейчас | Вердикт | Предлагаю | Почему | Тип |
|---|---|---|---|---|---|
| `notProjectMember` | `'Ya no formas parte de este proyecto, o se ha eliminado.'` | оставить | — | Звучит по-испански. «Ya no formas parte» — те же слова, что в пуше об удалении: «Ya no formas parte del proyecto «Hamlet»». Подлежащим у «se ha eliminado» может быть только проект, другого третьего лица во фразе нет. Запятая перед «o» уместна, потому что подлежащие разные. Глагол — как «Puede que se haya eliminado» в `rehearsals.notFound`. Рода нет. | — |
| `memberNotFound` | `'Esta persona ya no está en el proyecto.'` | оставить | — | Естественно. «Esta persona» пол не угадывает. «ya no está en el proyecto» — как в `participantsLeft` («Alguien que seleccionaste ya no está en el proyecto.») и в заголовке пуша «Ya no estás en el proyecto». | — |
| `adminOnly` | `'Solo un admin del proyecto puede hacerlo.'` | заменить | `'Solo quienes administran el proyecto pueden hacerlo.'` | 1) «Solo un…» читается и с числительным: «это может сделать только один админ проекта». 2) Артикль «un» даёт человеку мужской род. Перед «admin» испанские тексты артикль не ставят («Hacer admin», «te hacen admin»), а в связном тексте пишут глагол: так в терминах T-256, и «quienes administran el proyecto» есть в T-269. 3) Тот же глагол, что в пуше о снятии роли («Ya no administras el proyecto «Hamlet»», T-261), так что видно, что случилось. Admin principal тоже администрирует, «quienes» его включает. Длина 52 вместо 41. | лучше так |
| `ownerOnly` | `'Solo el admin principal del proyecto puede hacerlo.'` | заменить | `'Solo quien es admin principal del proyecto puede hacerlo.'` | 1) Речь о конкретном человеке этого проекта, а «el» делает его мужчиной: о владелице сказали бы «la admin principal». Значок «Admin principal» в T-256 выбрали как раз для того, чтобы не угадывать пол (вместо «Propietario»). В «quien es admin principal» артикля нет, как в «te hacen admin». Обобщённый мужской род грамматически допустим, поэтому это не «ошибка». 2) Строится так же, как `adminOnly`. Длина 57 вместо 51. | лучше так |
| `alreadyMember` | `'Ya formas parte de este proyecto.'` | оставить | — | Пара к `notProjectMember`: спокойно, без упрёка. Рода нет. | — |
| `rateLimited` | `'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.'` | оставить | — | «Demasiadas solicitudes» — обычная формулировка такого отказа и в Испании, и в Латинской Америке. Фраза безличная, без «Has hecho…», упрёка нет. Вторая фраза — как в `auth.rateLimited` («Espera ${seconds} s y vuelve a intentarlo.»). «Demasiados intentos» не подходит: в приложении так сказано о неверных кодах (`codeLocked`). | — |
| `availabilityTooLarge` | `'Hay demasiados datos para este período. Elige menos días o menos miembros.'` | заменить | `'No se puede cargar tanto de una vez. Elige menos días o menos participantes.'` | 1) Совет должен называть то, что человек видит на экране. В Planner выбор людей подписан «Participantes» и «Todos los participantes» (`smartPlanner.allMembers`, T-261), в форме репетиции тоже «Participantes». Роль «Miembro» не меняется. 2) «datos» на телефоне — прежде всего мобильный интернет («datos móviles»), и «demasiados datos para este período» похоже на сообщение оператора о тарифе. К тому же человек думает о днях и людях, а не о данных. 3) «para este período» — калька с «for this range». Новая фраза — как английское «Too much to load», безличная. Глагол «cargar» тот же, что в «Cargando…» и «No se pudo cargar…». Длина 76 вместо 74. | лучше так |

## 3. Ответы на вопросы

1. **Естественно ли? Так ли пишут в iOS?**
   - Да. Как в iOS: короткое утверждение о том, что случилось, и где можно — что делать, на «tú» и с точкой.
   - Слабее два места: «Solo un admin…» можно прочесть как «только один», а «demasiados datos para este período» — калька, и «datos» уводит к мобильному интернету. Понять можно, но носитель написал бы иначе, поэтому это «лучше так», а не ошибки.
2. **Понятно ли, что случилось и что делать? Не упрёк ли?**
   - **Ясно сразу:** `notProjectMember`, `memberNotFound`, `alreadyMember` и `ownerOnly`. Кто владелец, видно по значку «Admin principal» в списке участников.
   - **С подсказкой, что делать:** `rateLimited` (подождать и повторить) и `availabilityTooLarge` после правки — она называет выбор, который виден на экране.
   - **Правило вместо факта:** `adminOnly` говорит правило, а не «у тебя забрали роль». Связь даёт глагол из пуша «Ya no administras…». Написать прямо «Ya no administras este proyecto.» значило бы менять смысл во всех языках, поэтому этого не предлагаю.
   - **Упрёка нет нигде:** строки безличные или дают совет.
3. **Совпадают ли слова с приложением?**
   - **Совпадают:**
     - «proyecto»;
     - «formar parte» и «estar en el proyecto» — как в пушах и в `participantsLeft`;
     - роли в тексте со строчной буквы, это верно.
   - **Не совпадают:**
     - перед «admin» стоит артикль, а в связном тексте приложение пишет глагол «administrar» (см. таблицу);
     - «miembros» в `availabilityTooLarge` расходится с «Participantes» в Planner. В en и de то же расхождение: «members» при «All participants» и «Mitglieder» при «Alle Teilnehmer».
   - **Не правка:**
     - «invitación» в строках нет, а `alreadyMember` и так показывается на экране приглашения;
     - тот же счётчик запросов в политике (T-269) назван «peticiones», здесь — «solicitudes». Оба слова верны.
4. **Угадывается ли пол?**
   - **Читатель — нет.** О нём только глаголы второго лица: «formas», «Espera», «vuelve», «Elige». Прилагательных и причастий нет.
   - **Другие люди.** «Esta persona» нейтрально. Артикли в «un admin» и «el admin principal» дают мужской род. Правки заменяют их на «quienes administran» и «quien es admin principal».
5. **Вид как у соседей?**
   - **Точка.** Стоит в конце всех семи строк: это целые предложения, как `noConnection`, `serverUnavailable` и `rehearsals.notFound`. У коротких строк из `projects.ts` («Proyecto no encontrado», «La invitación ha caducado») точки нет: это обрывки вроде заголовков.
   - **Обращение** везде на «tú».
   - **Длина:** одно-два предложения, 33–76 знаков. Для сравнения: `noConnection` — 65, `serverUnavailable` — 52.
   - **Мелочи:** «Solo» без тильды, «vuelve a intentarlo» — как в `auth.rateLimited`.

## 4. Итог

правок: 3 (ошибок: 0)

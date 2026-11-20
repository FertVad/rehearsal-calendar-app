# T-281 — вычитка немецкого (de): отказы сервера на языке человека

## 1. Кто читал

Носитель немецкого, редактор текстов интерфейсов iOS на «du» (окна ошибок, уведомления). Работаю с любительскими театрами и хорами, iPhone на немецком.

## 2. Таблица

Что прочитано:
- блок de в `errors.ts` (19ae506);
- `requestError.ts`;
- соседние строки: `common.ts`, `projects.ts`, `auth.ts`, `availability.ts`;
- `rehearsals.notFound`. Файла `rehearsals.ts` в 19ae506 нет, ключ лежит в `calendar.ts`;
- утверждённые слова из T-256, T-261, T-269, T-271 и T-276 (de).

| Ключ | Сейчас | Вердикт | Предлагаю | Почему | Тип |
|---|---|---|---|---|---|
| `notProjectMember` | `'Du bist nicht mehr Mitglied dieses Projekts, oder es wurde gelöscht.'` | оставить | — | Звучит естественно. «es» — это проект: «Mitglied» стоит без артикля и предметом речи не служит. Запятая перед «oder» между двумя главными предложениями необязательна, здесь она разделяет «или — или». «wurde gelöscht» — как в пуше «Das Projekt „…“ wurde gelöscht». | — |
| `memberNotFound` | `'Diese Person ist nicht mehr im Projekt.'` | оставить | — | Звучит естественно, рода нет. Тот же оборот, что в `rehearsals.participantsLeft`: «… ist nicht mehr im Projekt». | — |
| `adminOnly` | `'Das kann nur ein Admin des Projekts.'` | оставить | — | Обычный немецкий оборот: «können» здесь полный глагол, как в «Das kann nur der Vermieter». «Admin» — слово бейджа и «Adminrechte». «ein Admin» — любой админ проекта, не конкретный человек. Фраза называет правило роли, а не запрещает что-то читателю, поэтому упрёка нет. | — |
| `ownerOnly` | `'Das kann nur der Eigentümer des Projekts.'` | оставить | — | Пара к `adminOnly`, оборот тот же. «Eigentümer» — утверждённое слово бейджа. Читается и под «Fehler», и под заголовком действия, например «Projekt konnte nicht gelöscht werden». О роде — ответ 4. | — |
| `alreadyMember` | `'Du bist bereits Mitglied dieses Projekts.'` | оставить | — | Звучит естественно. «bereits» — как в `auth.alreadyVerified` и `auth.emailUnchanged`. | — |
| `rateLimited` | `'Zu viele Anfragen. Warte kurz und versuche es noch einmal.'` | оставить | — | «Zu viele Anfragen» — привычная формула немецких приложений. Других «Anfragen» в приложении нет (запросов на вступление тоже), так что спутать не с чем. Вторая фраза совпадает с `auth.rateLimited`: «Warte … s und versuche es noch einmal.» Два окна об одном и том же звучат одинаково. | — |
| `availabilityTooLarge` | `'Zu viele Daten für diesen Zeitraum. Wähle weniger Tage oder Mitglieder.'` | заменить | `'Zu viele Daten für diesen Zeitraum. Wähle weniger Tage oder Teilnehmer.'` | Строку видят в Planner, а там людей выбирают под «Alle Teilnehmer» (`smartPlanner.allMembers`). Так решили 13.11: Mitglied — в проекте, Teilnehmer — когда выбирают людей для будущей репетиции, в том числе в Planner (T-256, строка 10 и дополнение). Совет должен называть то, что человек видит на экране. «Mitglieder» снова поставило бы на один экран оба слова, которые тогда развели. «Tage» совпадает с сегментом «Tage». «Daten» здесь значит «данные», это его основное прочтение, двусмысленности нет. Длина не меняется: 71 знак. | лучше так |

## 3. Ответы на вопросы

**1. Естественно ли, так ли пишут в iOS.**
- Да. Все семь строк — обычные немецкие фразы на «du», следов перевода нет.
- В окнах iOS текст под заголовком — законченное предложение с точкой, например «Versuche es später erneut.». Новые строки построены так же.
- «Zu viele Daten» звучит немного технически, но понятно.

**2. Понятно ли и не звучит ли упрёком.**
- Что случилось, сказано в каждой строке.
- Что делать, сказано там, где человек может что-то сделать: подождать (`rateLimited`) или выбрать меньше (`availabilityTooLarge`). В остальных пяти случаях делать нечего, и строки не изображают обратного.
- Упрёка нет: ни «du darfst nicht», ни «leider nicht erlaubt», ни восклицательных знаков. Права названы через роль («Das kann nur …»), а не через запрет читателю.
- Вне строк: `alreadyMember` под «Fehler» звучит тревожнее, чем сама ситуация, ведь человек уже там, куда шёл. Это вопрос заголовка окна, сама строка верна.

**3. Слова.**
- Совпадают с экранами и бейджами: Projekt, Mitglied (о проекте), Admin, Eigentümer.
- «Einladung» в этих строках не встречается: окна о приглашениях берут готовые строки из `projects.ts`.
- Расхождение одно: «Mitglieder» в `availabilityTooLarge`. В Planner люди называются Teilnehmer, правка в таблице.

**4. Пол.**
Пол читателя не угадывается.
- К читателю — «du»: «Du bist», «Warte», «Wähle». У этих форм нет окончаний по роду.
- «Mitglied» — среднего рода. «Diese Person» годится для любого человека.
- «ein Admin» и «der Eigentümer» говорят о другом человеке, а не о читателе. Это названия ролей, как на бейдже: «Eigentümer» стоит у любого владельца, и по-немецки так говорят о функции.
- Править не предлагаю: слово роли утверждено. Если правило распространят и на третье лицо, без рода будет «Das kann nur die Person, der das Projekt gehört.», но тогда из фразы уйдёт слово роли.
- «Teilnehmer» в правке стоит во множественном числе. Это слово Planner по решению владельца.

**5. Вид строк.**
- Совпадает с `common.noConnection`, `common.serverUnavailable` и `rehearsals.notFound`:
  - законченные предложения с точкой;
  - «du» и повелительное наклонение;
  - длина 36–71 знак, не длиннее соседей (у `noConnection` 72).
- В `rateLimited` стоит «noch einmal», в `common` — «erneut». Обычны оба. Важнее, что `rateLimited` совпадает с `auth.rateLimited`.
- Строки `projects.ts` (`projectNotFound`, `inviteNotFound`, `memberActionError`) — подписи без точки. Это другой, но допустимый вид, их не переписываю.
- Одно замечание: `inviteExpired` («Die Einladung ist abgelaufen») — законченное предложение без точки. Теперь оно встаёт в то же место окна, что и новые строки с точкой. Если ключ когда-нибудь будут трогать, точку стоит добавить.

## 4. Итог

правок: 1 (ошибок: 0)

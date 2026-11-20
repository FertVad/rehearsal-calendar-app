# T-281: вычитка английского (en) — отказы сервера на языке человека

## 1. Кто читал

Носитель американского английского, редактор интерфейсов iOS-приложений (Apple Style Guide, HIG), много лет в американском театре (stage management); iPhone на English (US).

## 2. Таблица

| Ключ | Сейчас | Вердикт | Предлагаю | Почему | Тип |
|---|---|---|---|---|---|
| `notProjectMember` | `'You’re no longer a member of this project, or it has been deleted.'` | заменить | `'You are no longer a member of this project, or it has been deleted.'` | Меняется только «You’re». Английский приложения пишет без сокращений (термины T-256): «You are invited to join this project», «you may have been taken off it» в соседнем `rehearsals.notFound`. Исключения — «Don’t Save» и «You’ll stay signed in.». Если владелец когда-нибудь переведёт на сокращения всё приложение (вопрос 3 в T-256), строку оставить. Остальное верно: обычная форма «одно из двух», как «moved or deleted»; «it» читается как проект; упрёка нет. | лучше так |
| `memberNotFound` | `'This person is no longer in the project.'` | оставить | — | Естественно и коротко. «This person» не выдаёт пол и обходится без имени. «no longer in the project» верно и для того, кто ушёл сам, и для удалённого. | — |
| `adminOnly` | `'Only a project admin can do this.'` | оставить | — | Обычная формула прав в приложениях («Only admins can…»), безличная, без упрёка. «a project admin» стоит в паре с «the project owner»: админов может быть несколько, владелец один. «admin» строчными — как в «make … an admin of this project». | — |
| `ownerOnly` | `'Only the project owner can do this.'` | оставить | — | Та же формула. «owner» — как бейдж Owner. | — |
| `alreadyMember` | `'You’re already a member of this project.'` | заменить | `'You are already a member of this project.'` | То же сокращение. Строку видят на экране приглашения, где подзаголовок — «You are invited to join this project»: на одном экране вышло бы и «You are», и «You’re». | лучше так |
| `rateLimited` | `'Too many requests. Wait a moment and try again.'` | оставить | — | «Too many requests» — привычная в приложениях формула; она о запросах, а не о человеке. «attempts» здесь было бы неверно: считаются и удачные действия, например приглашения подряд. Вторая фраза — как «Wait 30 seconds and try again.» в `auth.rateLimited` и кнопка «Try Again». | — |
| `availabilityTooLarge` | `'Too much to load for this range. Choose fewer days or members.'` | заменить | `'Too much to load at once. Choose fewer days or participants.'` | **members → participants.** В Planner и в форме репетиции людей выбирают в «All participants» (`smartPlanner.allMembers`, `rehearsals.participantsEveryone`; принято после T-256, см. T-261), и человек ищет на экране слово из совета. **for this range → at once.** Голое «range» расплывчато. К тому же оно называет причиной одни даты, хотя предел — дни, умноженные на людей, а совет тут же предлагает убрать и людей. «Too much to load at once» говорит об объёме и стоит в паре с «Too many requests.». Короче на 2 знака. | лучше так |

## 3. Ответы на вопросы

**1. Естественно ли; так ли пишут в iOS.**
- Да. Короткие законченные предложения в sentence case, с точкой; сначала что случилось, потом что делать; без кодов и без слова «Error» в тексте. Так пишут текст алерта в iOS, и так написаны `noConnection` и `serverUnavailable`.
- Написание американское, апострофы типографские.
- Не вполне по-родному звучит одно место — «for this range» (в таблице). «Too many requests» чуть техничнее остального, но привычно по другим приложениям.

**2. Понятно ли, что случилось и что делать; нет ли упрёка.**
- Что случилось, понятно во всех семи строках.
- Что делать, сказано там, где человек может что-то сделать: подождать (`rateLimited`), выбрать меньше (`availabilityTooLarge`). В остальных пяти делать нечего, и строки ничего не выдумывают.
- Упрёка нет: строки о правах безличны, «Too many requests» — о запросах, а не о человеке. «You’re doing that too often» звучало бы упрёком.
- `adminOnly` называет правило, а не причину. Тот, у кого только что забрали роль, поймёт причину из правила. Сказать её прямо («You are no longer an admin of this project.») — решение о смысле для всех языков, к тому же неверное для того, кто админом не был. Правкой английского это не предлагаю.

**3. Слова.**
- Совпадают с экранами: member (Members, Remove Member?), project; admin и owner строчными внутри предложения при бейджах Admin и Owner.
- Приглашение не названо и не нужно: `alreadyMember` и так видят на экране приглашения.
- Расходится одно: «members» в `availabilityTooLarge`, а в Planner — «participants» (в таблице).

**4. Пол.** Не угадывается: «you», «This person», роли без рода, ни he, ни she.

**5. Вид рядом с соседями.**
- **Точка.** Все семь — законченные предложения с точкой, как `noConnection`, `serverUnavailable` и `rehearsals.notFound`. `projectNotFound`, `inviteNotFound`, `inviteExpired` и `memberActionError` без точки: это короткие фразы заголовочного вида. Они попадают в то же место окна, что и новые, так что разнобой есть, но мелкий и на их стороне; по брифу их не трогаю.
- **Обращение.** «you», как везде. Но «You’re» — сокращение, а в приложении их нет, кроме «Don’t Save» и «You’ll stay signed in.» (в таблице).
- **Длина.** 33–66 знаков, одно-два предложения — как `serverUnavailable` (43) и `noConnection` (64). Правки длину почти не меняют: +1, +1, −2.

## 4. Итог

правок: 3 (ошибок: 0)

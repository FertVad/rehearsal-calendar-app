# T-271 и T-272: вычитка английского (en) — выход из проекта и подсказка об аватаре

## 1. Кто читал

Редактор, носитель американского английского. Правлю интерфейсы iOS-приложений и push-уведомления для США. Много лет в американском театре (stage management). iPhone на English (US).

## 2. Часть A

Что прочитано:
- дифф `ef2e4f6..293b222`: en-блоки `projects.ts` и `pushNotifications.js`;
- `ProjectDetailScreen.tsx`: где и как показаны строки;
- соседние уведомления в том же файле;
- прошлые отчёты en: T-256, T-261, T-276, T-269.

| Ключ | Сейчас | Вердикт | Предлагаю | Почему | Тип |
|---|---|---|---|---|---|
| `leaveProject` | `Leave Project` | оставить | — | Обычная кнопка выхода в приложениях для групп: Leave Group, Leave Team. Leave — пара к Join, которым человек вошёл. Title Case, как у кнопки Delete Project, которую на этом месте видит владелец. | — |
| `leaveProjectConfirm` | `Leave Project?` | оставить | — | Тот же вид, что у соседних вопросов: Delete Project?, Remove Member?, Make Admin?. | — |
| `leaveProjectMessage` | `` `${quoteName(projectName, 'en')} will disappear from your projects, and you will be taken off its rehearsals. You can come back with an invitation.` `` | заменить | `` `${quoteName(projectName, 'en')} will no longer appear in your projects, and you will be taken off its rehearsals. You can rejoin with an invitation.` `` | **«disappear»** звучит переводом «пропадёт»: по-английски так говорят о том, что исчезло само, а не после твоего действия. Вместо него в окнах подтверждения пишут «will no longer appear». Вариант «will be removed» не подходит: человек испугается, что проект удаляется. **«come back»** разговорно и расплывчато. В интерфейсах пишут «rejoin», и это слово перекликается с кнопкой Join на экране приглашения. К тому же «rejoin» не обещает вернуть прежнее: кто вступил заново, на свои репетиции не возвращается. **«taken off its rehearsals»** оставить: это утверждённые слова. Вместе со строкой поменять проверку в `e2e/flows/100-member-leaves-project.yaml:48`: она ищет «will disappear from your projects». | лучше так |
| `leaveProjectError` | `Could not leave the project` | оставить | — | Формула ошибок приложения «Could not … the …», как Could not delete the project и Could not join the project. В коде это не заголовок окна, а его текст под заголовком «Error». Поэтому sentence case без точки верен, как у соседних строк. | — |
| `memberLeft.title` | `Member Left` | оставить | — | Короткий заголовок «кто-то ушёл», естественный для ленты событий группы. Вид как у соседей, см. вопрос 4. | — |
| `memberLeft.body` | `` `${memberName} left ${projectName}` `` → «Maya Lopez left Hamlet» | оставить | — | Пара к тексту New Member «Maya Lopez joined Hamlet»: то же время и тот же порядок слов. | — |
| `memberWasRemoved.title` | `Member Removed` | оставить | — | Тот же вид, что Project Deleted и Role Changed. Глагол тот же, что у кнопки администратора Remove from Project. | — |
| `memberWasRemoved.body` | `` `${memberName} was removed from ${projectName}` `` → «Maya Lopez was removed from Hamlet» | оставить | — | Естественно. В пассиве не сказано, кто удалил, и в нём нет рода. | — |

Проверены подстановки:
- имена «Al», «Maya Lopez», «Alexandra Montgomery-Smith»;
- проекты «Hamlet», «The Nutcracker», «Хор ДК» и «“Hamlet”» (кавычки набрал человек).

Примеры:
- «Al left Hamlet»;
- «Alexandra Montgomery-Smith was removed from The Nutcracker»;
- «“Hamlet” will no longer appear in your projects, …».

Всё читается верно, кавычки не удваиваются.

### Ответы на вопросы

**1. Естественно ли, так ли пишут в iOS и в приложениях для групп.**
- Да, кроме одного места.
- Окно устроено как в iOS: вопрос в заголовке, последствия в тексте, кнопки Cancel и красная Leave Project.
- Пуши звучат так, как пишут ленты событий в приложениях для групп: кто, что сделал, где — «Maya Lopez left Hamlet».
- Переводом звучит только текст окна: «will disappear from your projects» и «come back with an invitation». Правка в таблице.
- **Вопрос владельцу о смысле, не правка.** «Member Removed» не говорит, кто удалил, а удалять могут несколько администраторов. В приложениях для групп обычно называют и его: «Alex Kim removed Maya Lopez from Hamlet». Это новая подстановка во всех языках, а не правка английского.

**2. Пол.**
- Не угадывается: у английских «left» и «was removed» нет рода.
- Местоимений о человеке нет ни в заголовках, ни в текстах. Окно подтверждения обращается к читателю на «you».
- Трудность ru («вышла / удалён») и es («dado de baja») в английском не возникает, обходить нечего.

**3. Слова.** Совпадают с приложением и с утверждёнными в T-256:
- **project** — Leave Project, как Delete Project.
- **member** — участник проекта: Members, Remove Member?, Member removed from project. Слово participant здесь было бы ошибкой: оно для участников репетиции.
- **rehearsal** и «taken off … rehearsals» — как в пуше You Were Taken Off a Rehearsal.
- **invitation** — в предложении, как в Project Invitation. «Invite» остаётся только в подписях: invite link, invite code.
- **remove** — как действие администратора Remove from Project.
- **rejoin** (моя правка) — от Join: так подписана кнопка на экране приглашения.

**4. Вид заголовков.** Совпадает с соседями.
- Title Case, без артикля, схема «что + что случилось»: Member Removed — как Project Deleted, Role Changed, Rehearsal Canceled. Member Left построен так же и составляет пару к New Member.
- Тексты как у соседей: sentence case, без точки, имя первым, проект без кавычек. Ср. «Maya Lopez joined Hamlet», «Maya Lopez is now an administrator of Hamlet».
- Member Removed не путается с Removed from Project. Тот приходит самому удалённому, с текстом «You were removed from the project Hamlet».

## 3. Часть B

`avatarHint: 'Your avatar shows the initials of your first and last name.'`

Почему так: подсказка говорит ровно то, что рисует `UserAvatar`, и называет поля First Name и Last Name под аватаром, так что видно, откуда буквы. Про фото и почту в ней ничего нет, и тест разработчика `avatarHint.test.ts` она проходит: слово initials в ней есть, email нет.

Для разработчика. Пока я читал, коммит `b799aee` поставил временную строку «Your avatar is created automatically from your initials.». Ошибки в ней нет, но она хуже моей:
- не говорит, что инициалы берутся из имени и фамилии, а бриф просит именно этого;
- «created automatically» досталось от прежней строки и ничего не сообщает.

Мою строку ставить вместо неё. Вместе с ней поменять ожидание en `profile.avatarHint` в `proofreadingEdits.test.ts`.

## 4. Итог

правок в A: 1 (ошибок: 0); B готова

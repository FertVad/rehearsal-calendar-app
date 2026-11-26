# Админка Rehearsly по-русски

Источник — копии с auto/main 347cebc из `src/`. Я сверил их с коммитом 347cebc, они совпадают байт в байт. Смысл каждой сноски я проверял по `src/services/*.js`. Где сносок было мало, смотрел через `git show 347cebc:…` (только чтение): `roster.js` (просмотрено до начала), `pushNotificationService.js` (какие уведомления пишут какой тип), `NotificationsScreen.tsx` и `notificationStore.js` (что делает уведомление прочитанным), `useOnboarding.ts` (пропуск онбординга). Слова владельца я брал из `AUTODEV/TASKS.md` (T-293, T-294, T-295), формулировки для людей — из русской политики конфиденциальности.

Обозначения: ⍽ — неразрывный пробел (U+00A0); `{…}` — место для подстановки; « / » между вариантами — выбор по условию, оно указано в комментарии.

## 1. Строки страницы

Порядок такой, каким человек видит страницу: экран входа, шапка, фильтры, карточки, аналитика (воронка → откуда приходят → использование → проекты → уведомления), отчёты об ошибках, пользователи.

| № | Где | Английский в коде | Русский | Комментарий |
|---|---|---|---|---|
| 1 | dashboardPage.js:3 | `<html lang="en">` | `<html lang="ru">` | Это не надпись. Но без этого атрибута браузер переносит слова, а диктор читает страницу как английскую. |
| 2 | dashboardPage.js:7 | Admin — Rehearsal Calendar | Админка Rehearsly | `<title>`, имя вкладки. «Rehearsal Calendar» убран. |
| 3 | dashboardPage.js:17 | Admin Panel | Админка Rehearsly | Заголовок экрана входа. Имя то же, что у вкладки и панели: на телефоне вкладки не видно. |
| 4 | dashboardPage.js:19 | Password (`placeholder` и `aria-label`) | Пароль | В обоих атрибутах. |
| 5 | dashboardPage.js:20; dashboard.js:103, 169 | Log in | Войти | Как кнопка входа в приложении. |
| 6 | dashboard.js:149 | Logging in... | Вход… | Пока ждём ответа. «…» — один знак, как в приложении. |
| 7 | dashboard.js:57–66 | текст сервера `data.error`, иначе Login failed. Please check your password. | Свои сообщения по статусу ответа: см. раздел 3 «Вход» | Сейчас при 400/401 на экран попадает английский текст сервера: `Invalid password`, `Password must be a non-empty string`. |
| 8 | dashboard.js:163 | Login failed. Please try again. | Не удалось войти. Попробуйте ещё раз. | Остальные ошибки входа. |
| 9 | dashboard.js:54 | Your session has expired. Please log in again. | Сессия истекла. Войдите снова. | Появляется на экране входа. |
| 10 | dashboardPage.js:28 | Rehearsal Calendar Admin | Админка Rehearsly | Заголовок панели (h1). |
| 11 | dashboardPage.js:30 | Refresh | Обновить | |
| 12 | dashboardPage.js:31 | Log out | Выйти | |
| 13 | dashboardPage.js:36 | `aria-label="Filters"` | Фильтры | |
| 14 | dashboardPage.js:37 | Period | Период | |
| 15 | dashboardPage.js:39 | Last 7 days | Последние 7⍽дней | |
| 16 | dashboardPage.js:40 | Last 30 days | Последние 30⍽дней | |
| 17 | dashboardPage.js:41 | Last 90 days | Последние 90⍽дней | |
| 18 | dashboardPage.js:42 | All time | Всё время | |
| 19 | dashboardPage.js:45 | Source | Источник | Это же слово стоит в столбцах воронки и таблицы пользователей и в сносках: «фильтры «Источник» и «Язык»». Владелец сам пишет «фильтр по источнику» (T-293). |
| 20 | dashboardPage.js:47 | Everyone | Все | |
| 21 | dashboardPage.js:48 | Invited into a project | По приглашению | Те же слова — в столбцах раздела «Откуда приходят люди» и в группе воронки. |
| 22 | dashboardPage.js:49; dashboard.js:414, 416 | Own project | Свой проект | |
| 23 | dashboardPage.js:50; dashboard.js:414, 416 | No project | Без проекта | |
| 24 | dashboardPage.js:53; dashboard.js:421 | Language | Язык | Фильтр и столбец таблицы языков. |
| 25 | dashboardPage.js:55; dashboard.js:491 | All languages | Все языки | Остальные пункты списка — коды языков из данных, их не переводим. |
| 26 | dashboardPage.js:58 | Service accounts (rehearsly.me, demo.rehearsly.me and ADMIN_SERVICE_EMAILS) count in no figure. "Last N days" runs back from now. The period selects people by registration date; the cards at the top are as of now. | Служебные аккаунты (адреса на rehearsly.me и demo.rehearsly.me, а также из ADMIN_SERVICE_EMAILS) не входят ни в одну цифру. «Последние N⍽дней» отсчитываются от текущего момента. Период отбирает людей по дате регистрации; карточки вверху — на текущий момент, без учёта периода. | «Без учёта периода» — так в коде: `summary()` период не читает. Ещё две вещи сверены с кодом и в текст не вписаны. Проекты владельцев из ADMIN_SERVICE_EMAILS считаются: исключаются только проекты двух доменов (people.js:13–14, так задумано). Уведомления, коды, приглашения и проекты период отбирает по их собственным датам — это сказано в их сносках. |
| 27 | dashboardPage.js:62 | `aria-label="Statistics"` | Статистика | |
| 28 | dashboardPage.js:63, 72, 81, 105; dashboard.js:81 | Loading... | Загрузка… | |
| 29 | dashboard.js:81 | Refreshing... | Обновление… | Когда данные уже на экране. |
| 30 | dashboard.js:212 | Showing previously loaded data while refreshing. | Идёт обновление — пока показаны прежние данные. | |
| 31 | dashboard.js:226, 230 | `'Could not load ' + 'statistics' + '. ' + message` | Не удалось загрузить статистику. {message} | Название раздела склеивалось в винительном падеже, поэтому фразы даны целиком (строки 31–34). |
| 32 | dashboard.js:226, 230 | `'Could not load ' + 'analytics' + '. ' + message` | Не удалось загрузить аналитику. {message} | |
| 33 | dashboard.js:226, 230 | `'Could not load ' + 'users' + '. ' + message` | Не удалось загрузить пользователей. {message} | |
| 34 | dashboard.js:226, 230 | `'Could not load ' + 'bug reports' + '. ' + message` | Не удалось загрузить отчёты об ошибках. {message} | |
| 35 | dashboard.js:49 | Connection error. Check your connection and try again. | Нет связи с сервером. Проверьте интернет и попробуйте ещё раз. | Слово в слово как в приложении (`auth.noConnection`). То же сообщение и при входе без связи. |
| 36 | dashboard.js:67 | The request failed. Please try again. | Запрос не выполнен. Попробуйте ещё раз. | |
| 37 | dashboard.js:25 | The server returned an unexpected response. | Сервер ответил не так, как ожидалось. | |
| 38 | dashboard.js:225 | Please try again. | Попробуйте ещё раз. | {message} для остальных ошибок. |
| 39 | dashboard.js:228 | Retry | Повторить | Как в приложении. |
| 40 | dashboard.js:232 | Showing previously loaded data; it may be out of date. | Показаны прежние данные — возможно, они устарели. | |
| 41 | dashboard.js:264 | Users | Пользователи | |
| 42 | dashboard.js:267–268 | `'+' + newThisWeek + ' this week, ' + '+' + newThisMonth + ' this month'` | +{week} за 7⍽дней, +{month} за 30⍽дней | Расхождение с кодом: считаются последние 7 и 30 суток от текущего момента (`since(7)`, `since(30)`), а не календарные неделя и месяц. Сноска под карточкой говорит именно это. |
| 43 | dashboard.js:270 | Real accounts that match the source and language filter, as of now; new: registered in the last 7 and 30 days. | Аккаунты без служебных, подходящие под фильтры «Источник» и «Язык», на текущий момент; новые — зарегистрированные за последние 7 и 30⍽дней. | «Real» везде передано как «без служебных»: так оно и определено в сноске под фильтрами. |
| 44 | dashboard.js:272 | No sign-in for 30 days | Не входили 30⍽дней | Слова владельца (T-293). Точное условие («больше 30 дней») — в сноске. |
| 45 | dashboard.js:272 | `data.signIns.rate + '%'` | {rate}⍽% | Например, «12,5⍽%». |
| 46 | dashboard.js:273–274 | `'Users: ' + n + ' (sessions renew without signing in: not a measure of use)'` | Пользователей: {n} (сессия продлевается без входа, поэтому это не показатель использования) | Через двоеточие — склонять не нужно. |
| 47 | dashboard.js:275 | Last sign-in (or registration, if never) more than 30 days ago, of the users counted on the left. | Последний вход (или регистрация, если входов не было) — больше 30⍽дней назад; доля — от пользователей из карточки «Пользователи». | «Слева» заменено названием карточки: на узком экране карточки встают в столбик. Смысл тот же. |
| 48 | dashboard.js:276, 427 | Projects | Проекты | Карточка и раздел аналитики. |
| 49 | dashboard.js:277 | Every project except those owned from rehearsly.me or demo.rehearsly.me. | Все проекты, кроме проектов владельцев с адресом на rehearsly.me или demo.rehearsly.me. | На эту и следующую карточку фильтры не действуют — так и в коде. |
| 50 | dashboard.js:278 | Rehearsals | Репетиции | |
| 51 | dashboard.js:279 | All rehearsals of those projects, past and future. | Все репетиции этих проектов — и прошедшие, и будущие. | |
| 52 | dashboardPage.js:71 | Analytics | Аналитика | |
| 53 | dashboard.js:506 | `data.people + ' real people registered in the period.'` | Зарегистрировались за период: {n} (без служебных аккаунтов). | Через двоеточие — без склонения. Фильтры «Источник» и «Язык» действуют и здесь, как везде. |
| 54 | dashboard.js:404 | Newcomer funnel | Воронка новичков | Слова владельца (T-293). |
| 55 | dashboard.js:405, 461 | Week of registration | Неделя регистрации | |
| 56 | dashboard.js:405 | Source | Источник | |
| 57 | dashboard.js:405, 461 | Registered | Зарегистрировались | |
| 58 | dashboard.js:405 | Onboarding | Онбординг | Так говорит владелец. Политика для пользователей называет то же «знакомством с приложением». |
| 59 | dashboard.js:405 | In a project | В проекте | |
| 60 | dashboard.js:405 | Availability marks | Отметки занятости | Термин приложения. |
| 61 | dashboard.js:405 | Seen / own rehearsal | Просмотрено / своя репетиция | |
| 62 | dashboard.js:361 | Nothing in this period | За этот период ничего нет | Пустая таблица. Эта надпись — во всех таблицах аналитики, кроме таблицы сборок. |
| 63 | dashboard.js:182, 347, 349, 350, 370, 381, 444, 456, 634 | `'-'` (нет значения) | — | Длинное тире, как принято в русских таблицах. |
| 64 | dashboard.js:395 | All weeks | Все недели | Первые строки воронки. |
| 65 | dashboard.js:395, 397 | invited | По приглашению | Группа воронки. |
| 66 | dashboard.js:395, 397 | own / no project | Свой / без проекта | Группа `other`: свой проект или без проекта. |
| 67 | dashboard.js:380 | `part + ' (' + pct + '%)'` | {part} ({pct}⍽%) | Если знаменатель 0 — только {part}, как в коде. |
| 68 | dashboard.js:406 | People registered in the period, by the Monday (UTC) of their registration week. Each step is the share of those registered who have it now: onboarding done; an active membership; availability marks of their own or from a calendar; at least one rehearsal marked as seen (participant) or created (organizer). "Invited" is the source in the users table. | Зарегистрировавшиеся за период — по неделям регистрации; неделя обозначена её понедельником (по UTC). Каждый шаг — доля зарегистрировавшихся, у кого он есть сейчас: онбординг пройден или пропущен; человек состоит в проекте; есть отметки занятости — свои или из календаря; хотя бы одна репетиция отмечена просмотренной (как участник) или создана (как организатор). «По приглашению» — тот же источник, что в таблице пользователей. | «Пройден или пропущен» — по коду: кнопка «Пропустить» ставит тот же флаг (`skipOnboarding` → `completeOnboarding`). Политика тоже пишет «прошли или пропустили». В английском просто «done». |
| 69 | dashboard.js:401–402, 382 | `(Invited / Own / no project) + ': median from registration to a project ' + hoursText + ', to first availability marks ' + hoursText + '.'`; `hoursText`: `value + ' h (of ' + of + ')'` или `'- (no one yet)'` | {group}: медиана от регистрации до проекта — {toProject}, до первых отметок занятости — {toMarks}. Здесь {group} — «По приглашению» или «Свой / без проекта»; {toProject} и {toMarks} — «{h}⍽ч (по {of}⍽чел.)», а если никого — «пока никого». | «По 12 чел.» значит: медиана по 12 людям, у которых этот шаг есть. Сокращение «чел.» не склоняется. «(из 12)» после часов прочиталось бы как «из 12 часов». Пустое значение — без тире: иначе вышло бы «— —». |
| 70 | dashboard.js:408 | Onboarding has no time recorded, only whether it is done. The wait to a project is to the earliest membership still active. The wait to first marks is to the earliest mark still stored: saving a day again replaces its marks, so someone who rewrote their first day counts as later. | У онбординга не записано время — только сам факт, что он пройден или пропущен. Время до проекта считается до самого раннего участия, которое ещё действует. Время до первых отметок — до самой ранней из отметок, которые ещё хранятся: при повторном сохранении дня его отметки заменяются, поэтому у того, кто пересохранил свой первый день, первые отметки окажутся позже. | |
| 71 | dashboard.js:413 | Where people come from | Откуда приходят люди | |
| 72 | dashboard.js:414 | Week (Monday) | Неделя (понедельник, UTC) | «UTC» я добавил по коду: `weekOf` берёт понедельник по UTC. Без пометки было бы неясно, потому что недели удержания ниже считаются в поясе человека. |
| 73 | dashboard.js:414, 416 | Invited | По приглашению | |
| 74 | dashboard.js:415 | New real accounts registered in the period, by week and by the source shown in the users table. | Аккаунты без служебных, зарегистрированные за период, — по неделям и по источнику, как в таблице пользователей. | «New» и «зарегистрированные за период» — одно и то же, поэтому слиты. |
| 75 | dashboard.js:416 | Day (UTC) | День (UTC) | |
| 76 | dashboard.js:417 | The same, by day; days with no registrations are left out. | То же по дням; дни без регистраций не показаны. | |
| 77 | dashboard.js:418, 467, 428 | Project | Проект | |
| 78 | dashboard.js:418, 467, 428 | Owner | Владелец | В ячейке — имя владельца («Мария К.»), это данные. |
| 79 | dashboard.js:418 | Joined in period | Присоединились за период | «Присоединиться» — глагол приложения. |
| 80 | dashboard.js:418 | Of them, came through it | Из них пришли через него | |
| 81 | dashboard.js:420 | Joined: active members, not the owner, whose membership began in the period. Came through it: people registered in the period whose first project is this one, by invitation. | Присоединились: действующие участники, кроме владельца, чьё участие в проекте началось за период. Из них пришли через него: зарегистрировавшиеся за период, у которых это первый проект и попали они в него по приглашению. | «Первый проект» понимается как в столбце «Источник»: самый давний из проектов, где человек ещё состоит. Обе цифры, как и везде, считаются только по людям, подходящим под фильтры «Источник» и «Язык». В английском этого нет, в текст я не вписывал. |
| 82 | dashboard.js:421, 422, 464 | People | Людей | Столбец с числом людей. |
| 83 | dashboard.js:422 | Time zone | Часовой пояс | |
| 84 | dashboard.js:423 | Language and time zone as stored for people registered in the period. | Язык и часовой пояс — как они сохранены у зарегистрировавшихся за период. | |
| 85 | dashboard.js:453, 457 | Use of the app | Использование приложения | |
| 86 | dashboard.js:453 | No data: migration 016 is not applied. | Нет данных: миграция⍽016 не применена. | Слова владельца (T-294). |
| 87 | dashboard.js:454 | Days in the app, app builds and invitation counts are recorded once migration 016 is applied; until then there is nothing to count, which is not the same as nobody using the app. | Дни в приложении, сборки и счётчики приглашений записываются, только когда применена миграция⍽016. До этого считать нечего — а это не то же самое, что «приложением никто не пользуется». | |
| 88 | dashboard.js:458–459 | `'Active today: ' + share(day) + ' · last 7 days: ' + share(week) + ' · last 30 days: ' + share(month)` | Активных сегодня: {day} · за 7⍽дней: {week} · за 30⍽дней: {month} | Каждое {…} — в формате строки 67, например «5 (12,5⍽%)». |
| 89 | dashboard.js:460 | `'Real people the filters select (any registration date) who used the app — any request in their session — on a day in the window, by the date in their own zone. Recorded since ' + (since \|\| 'nothing yet') + '.'` | Люди без служебных, подходящие под фильтры «Источник» и «Язык» (дата регистрации любая), которые пользовались приложением — то есть в их сессии был хоть один запрос — хотя бы в один из этих дней, по дате в их часовом поясе. Записи ведутся с {since}. — Если {since} нет, последняя фраза: «Записей пока нет.» | «Этих дней» — сегодня, 7 дней или 30 дней. По коду (`activeWithin`) «7 дней» — это 7 календарных дат в поясе человека, считая сегодняшнюю. Это не то же, что «Последние 7 дней» в фильтре: там 7 суток от текущего момента. В текст я это не вписывал — решать владельцу. |
| 90 | dashboard.js:461 | Day 1 | День⍽1 | |
| 91 | dashboard.js:461 | Day 7 | День⍽7 | |
| 92 | dashboard.js:461 | Day 30 | День⍽30 | |
| 93 | dashboard.js:456 | `opened + ' of ' + of + ' (' + pct + ')'`, при `of` = 0 — `'-'` | {opened} из {of} ({pct}⍽%) / — | |
| 94 | dashboard.js:463 | People registered in the period, by the Monday of the week of their registration date in their own zone: who opened the app on the 1st, 7th and 30th day after it (the registration day is day 0). Only people whose day is over and fell after recording began are counted ("of"). | Зарегистрировавшиеся за период — по неделе, на которую пришлась дата регистрации в их часовом поясе (неделя обозначена понедельником): кто открывал приложение на 1-й, 7-й и 30-й день после регистрации (день регистрации — нулевой). В «из» входят только те, у кого этот день уже закончился и пришёлся на время, когда записи уже велись. | Владелец называет эту таблицу «удержание» (T-294). Заголовка у неё нет и в английском. |
| 95 | dashboard.js:464 | App build | Сборка приложения | |
| 96 | dashboard.js:464 | unknown | Не указана | Ни один день человека не назвал сборку (usage.js:112). См. «Коды». |
| 97 | dashboard.js:465 | Nobody active in the last 30 days | За последние 30⍽дней активных не было | Пустая таблица сборок. |
| 98 | dashboard.js:466 | Among the people active in the last 30 days, the build of their latest day that named one: what still runs before MIN_IOS_BUILD is raised. | У активных за последние 30⍽дней — сборка из их последнего дня, когда она была указана: видно, что ещё в ходу, прежде чем поднимать MIN_IOS_BUILD. | |
| 99 | dashboard.js:467 | Invitation page opened | Открытий страницы приглашения | Это счётчики событий, а не люди, поэтому родительный падеж, как «Репетиций». |
| 100 | dashboard.js:467 | Opened in the app | Открытий в приложении | |
| 101 | dashboard.js:467 | Joined | Присоединений | Тоже счётчик событий. |
| 102 | dashboard.js:469 | Since the start of the period (UTC days). Page: the invitation page opened in a browser, not counting link previews. In the app: the invitation opened in the app, through the link or the page. Joined: joins through the invitation. Counts only — nothing ties them to a person. Projects owned from rehearsly.me or demo.rehearsly.me are left out. | С начала периода (дни по UTC). Открытия страницы: страницу приглашения открыли в браузере, не считая превью ссылок. Открытия в приложении: приглашение открыли в приложении — по ссылке или со страницы. Присоединения: присоединились к проекту по приглашению. Это только счётчики — ни с кем из людей они не связаны. Проекты владельцев с адресом на rehearsly.me или demo.rehearsly.me не показаны. | Фильтры «Источник» и «Язык» сюда не действуют: счётчики ни с кем не связаны. Первым днём считается весь день UTC, в который начинается период. |
| 103 | dashboard.js:428 | Created | Создан | Дата создания проекта; мужской род — «проект». |
| 104 | dashboard.js:428 | Members | Участников | |
| 105 | dashboard.js:428 | Rehearsals | Репетиций | Всего, за всё время. |
| 106 | dashboard.js:428 | Last 4 weeks | За 4⍽недели | В коде — начавшиеся за последние 28 суток до текущего момента. |
| 107 | dashboard.js:428 | Next | Ближайшая | Дата следующей репетиции. |
| 108 | dashboard.js:428 | Seen before start (30 d) | Просмотрено до начала (30⍽дн.) | |
| 109 | dashboard.js:428 | Availability, next 14 d | Покрытие занятости (14⍽дн.) | Слова владельца (T-293: «покрытие занятости»). «Занятость на 14 дн.» читалось бы как «занят 14 дней». |
| 110 | dashboard.js:183 (вызовы: 345, 346, 429, 430, 636) | `toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })` → 26 Nov 2026 | 26.11.2026 | См. «Форматы». |
| 111 | dashboard.js:430 | `seen + ' of ' + of + ' (' + percent(rate) + ')'` | {seen} из {of} ({pct}⍽%) | При {of} = 0 предлагаю просто «—»; в коде сейчас «0 of 0 (-)». |
| 112 | dashboard.js:431 | `people + ' of ' + of + ' (' + percent(rate) + ')'` | {people} из {of} ({pct}⍽%) | |
| 113 | dashboard.js:432 | Projects created in the period or with a rehearsal starting in it; projects owned from rehearsly.me or demo.rehearsly.me are left out. Members: active members the filters select. | Проекты, созданные за период, или с репетицией, которая начинается не раньше начала периода (в том числе в будущем); проекты владельцев с адресом на rehearsly.me или demo.rehearsly.me не показаны. В столбце «Участников» — действующие участники, подходящие под фильтры «Источник» и «Язык». | Расхождение с кодом: `since_start` считает репетиции с началом не раньше начала периода и без верхней границы. Проект, у которого есть только будущая репетиция, попадает в список, а английское «starting in it» это исключает. Русский написан по коду. «The filters» здесь — только источник и язык: период на участников не действует. |
| 114 | dashboard.js:433 | Seen before start: of the people on rehearsals that started in the last 30 days, the rows marked seen whose last change was before the start. Someone taken off the project is on none of them. | Просмотрено до начала: из мест в составах репетиций, начавшихся за последние 30⍽дней (место — один человек на одной репетиции), — сколько отмечены просмотренными, причём последнее изменение отметки было раньше начала. Кого больше нет в проекте, тот не входит ни в один состав. | Цифры — это пары «человек — репетиция», а не люди (`seenBeforeStart` в roster.js): английский смешивает «people» и «rows». «Taken off» по коду — любой, кто больше не участник: и удалённый, и вышедший сам. Считаются только люди, подходящие под фильтры. |
| 115 | dashboard.js:434 | Availability: members with any mark of their own or calendar event in the next 14 days (all-day marks by UTC date, from today). An unmarked day counts as free, so this is the share who entered anything at all. | Покрытие занятости: участники, у которых в ближайшие 14⍽дней есть хоть одна своя отметка или событие из календаря (отметки на весь день — по датам UTC, начиная с сегодняшней). День без отметок считается свободным, поэтому это доля тех, кто вообще что-то внёс. | |
| 116 | dashboard.js:439 | Notifications and email | Уведомления и письма | |
| 117 | dashboard.js:440 | `'Devices for notifications: ' + people + ' of ' + of + ' (' + percent(rate) + ')'` | Есть устройство для уведомлений: {people} из {of} ({pct}⍽%) | «Устройства: 5 из 12» читалось бы как число устройств, а считаются люди. |
| 118 | dashboard.js:441 | People registered in the period with at least one device registered for push notifications. | Зарегистрировавшиеся за период, у которых есть хотя бы одно устройство, подключённое к push-уведомлениям. | «Подключено к уведомлениям» — слова приложения. |
| 119 | dashboard.js:442 | Inbox type | Тип уведомления | Входящие в приложении — это экран «Уведомления». Значения — в разделе «Коды». |
| 120 | dashboard.js:442, 446 | Created | Создано | |
| 121 | dashboard.js:442 | Read | Прочитано | |
| 122 | dashboard.js:442 | Read share | Доля прочитанных | |
| 123 | dashboard.js:442 | Median to read | Медиана до прочтения | |
| 124 | dashboard.js:444 | `row.medianMinutesToRead + ' min'` | {n}⍽мин | Другой формат предложен в разделе «Форматы». |
| 125 | dashboard.js:445 | In-app inbox entries created in the period for the people the filters select (any registration date); read: opened since. Median over the read ones. | Уведомления в приложении (экран «Уведомления»), созданные за период, у людей, подходящих под фильтры «Источник» и «Язык» (дата регистрации любая); прочитано — с тех пор открыты или отмечены кнопкой «Прочитать все». Медиана — по прочитанным. | Расхождение с кодом: `read_at` ставит и кнопка «Прочитать все» (`markRead(…, 'all')`), а не только открытие. Русский написан по коду; медиана тоже включает такие массовые отметки. И ещё: уведомление, удалённое человеком, стирается из таблицы и в «Создано» не попадает. В английском этого нет, я не вписал. |
| 126 | dashboard.js:446 | Email code | Код из письма | Как в приложении. Значения — назначения кода, см. «Коды». |
| 127 | dashboard.js:446 | Sent | Отправлено | |
| 128 | dashboard.js:446 | Not sent | Не отправлено | |
| 129 | dashboard.js:446 | Used | Использовано | |
| 130 | dashboard.js:446 | Replaced | Заменено | |
| 131 | dashboard.js:446 | Locked | Заблокировано | |
| 132 | dashboard.js:448 | Codes created in the period. Sent: accepted by the provider. Not sent: refused by it. Replaced: closed by a newer code. Locked: five wrong tries. Used: closed otherwise — entered right, or voided by a password reset or an address change, which the table does not tell apart. | Коды, созданные за период. Отправлено: почтовый сервис принял письмо. Не отправлено: сервис его отклонил. Заменено: код закрыт, когда выдали новый. Заблокировано: пять неверных попыток. Использовано: код закрыт иначе — введён верно или аннулирован сбросом пароля либо сменой адреса; таблица эти случаи не различает. | Сверено с SQL (analytics.js:219–231). Коды тоже считаются только у людей, подходящих под фильтры «Источник» и «Язык»; в английском этого нет. Код, который ещё действует или истёк, не попадает ни в «Использовано», ни в «Заменено», ни в «Заблокировано», поэтому эти три в сумме не равны «Создано». |
| 133 | dashboard.js:449 | Bug reports: their own section below. | Отчёты об ошибках — в своём разделе ниже. | |
| 134 | dashboardPage.js:80 | Bug Reports | Отчёты об ошибках | Как в приложении: «Сообщить об ошибке», «Отчёт отправлен». |
| 135 | dashboardPage.js:88 | User | Автор | Кто прислал отчёт. |
| 136 | dashboardPage.js:89 | Message | Сообщение | |
| 137 | dashboardPage.js:90 | Screen | Экран | В ячейке — название экрана (`Profile`), это данные. |
| 138 | dashboardPage.js:91 | Status | Статус | |
| 139 | dashboardPage.js:92 | Date | Дата | |
| 140 | dashboard.js:533 | new | Новая | Статусы согласованы со словом «ошибка». «Новый / исправлен» про отчёт значило бы, что исправили сам отчёт. |
| 141 | dashboard.js:533 | in progress | В работе | |
| 142 | dashboard.js:533 | fixed | Исправлена | |
| 143 | dashboard.js:640 | No bug reports | Отчётов об ошибках нет | |
| 144 | dashboard.js:552, 558 | `'Report ' + id + ': ' + 'Saving report status...'` | Отчёт №⍽{id}: сохраняем статус… | После двоеточия — со строчной буквы. |
| 145 | dashboard.js:553, 558 | `'Report ' + id + ': ' + 'Could not confirm the status change. The server may have saved it. Reload reports to check before trying again.'` | Отчёт №⍽{id}: не удалось подтвердить смену статуса. Возможно, сервер её всё же сохранил: обновите отчёты и проверьте, прежде чем пробовать снова. | |
| 146 | dashboard.js:554, 558 | `'Report ' + id + ': ' + 'Status saved. Refreshing reports...'` | Отчёт №⍽{id}: статус сохранён. Обновляем отчёты… | |
| 147 | dashboard.js:555, 558 | `'Report ' + id + ': ' + 'Status saved, but the report list could not be refreshed. Showing previously loaded data; it may be out of date.'` | Отчёт №⍽{id}: статус сохранён, но список отчётов обновить не удалось. Показаны прежние данные — возможно, они устарели. | |
| 148 | dashboard.js:556, 558 | `'Report ' + id + ': ' + 'Status saved.'` | Отчёт №⍽{id}: статус сохранён. | |
| 149 | dashboard.js:563 | Reload reports | Обновить отчёты | |
| 150 | dashboard.js:518 | Prev | Предыдущая | Под отчётами и под пользователями. |
| 151 | dashboard.js:522 | `'Page ' + n + ' of ' + pages` | Страница {n} из {pages} | |
| 152 | dashboard.js:524 | Next | Следующая | |
| 153 | dashboardPage.js:102 | Recent Users | Пользователи | По умолчанию период — «Всё время», и таблица показывает всех, начиная с новых. Заголовок «Новые пользователи» был бы неправдой. Кто в таблице, говорит сноска под заголовком. |
| 154 | dashboardPage.js:103 | Show service accounts | Показывать служебные аккаунты | Переключатель — глагол несовершенного вида. |
| 155 | dashboardPage.js:104 | People registered in the period, newest first. Steps: onboarding done; projects and roles; availability marks (own or from a calendar) and the last date they reach; calendar sync used, either way (busy times imported from a calendar, or rehearsals exported to the phone's calendar; the export records stay after sync is turned off); a device for notifications; rehearsals marked as seen, of those they are on; rehearsals they created. | Зарегистрировавшиеся за период, сначала новые. Шаги: онбординг пройден или пропущен; проекты и роли в них; отметки занятости (свои или из календаря) и последняя дата, до которой они доходят; пользовался ли человек синхронизацией календаря в любую сторону (занятость импортирована из календаря или репетиции экспортированы в календарь телефона; записи об экспорте остаются и после выключения синхронизации); устройство для уведомлений; сколько репетиций человек отметил просмотренными из тех, в составе которых он есть; сколько репетиций он создал. | «Импортированная занятость», «экспорт», «в составе» — слова приложения. «Пройден или пропущен» — см. строку 68. |
| 156 | dashboardPage.js:112 | Name | Имя | |
| 157 | dashboardPage.js:113 | Email | Почта | Слово владельца (T-293). В приложении поле подписано «Email» — можно и так. |
| 158 | dashboardPage.js:114 | Registered | Регистрация | Дата. |
| 159 | dashboardPage.js:115 | Last Login | Последний вход | |
| 160 | dashboardPage.js:116 | Last day in app | Последний день в приложении | Слова владельца (T-294). |
| 161 | dashboardPage.js:117 | Source ⓘ | Источник ⓘ | |
| 162 | dashboardPage.js:117 (`title`) | The earliest project they are still an active member of: as owner, their own project; in any other role, an invitation (an invited member later made admin stays invited). Someone who left a project loses its membership row, so a person who left every project reads "no project". | Проект, в котором человек состоит дольше всего из тех, где он ещё участник: если он там владелец — «свой проект», в любой другой роли — «приглашение» (приглашённый, которого потом сделали администратором, остаётся приглашённым). При выходе из проекта запись об участии удаляется, поэтому у того, кто вышел из всех проектов, — «без проекта». | «Earliest» по коду — по дате вступления (`joinedAt`), а не по дате создания проекта. «Состоит дольше всего» говорит именно это. Прямых кавычек в тексте нет, экранировать в атрибуте нечего. |
| 163 | dashboardPage.js:118 | Sign-in | Способы входа | Способов может быть несколько. Одно слово «Вход» путалось бы со столбцом «Последний вход». |
| 164 | dashboardPage.js:119 | Language / zone | Язык / часовой пояс | В ячейке — «ru / Europe/Moscow», это данные. |
| 165 | dashboardPage.js:120 | Steps | Шаги | |
| 166 | dashboard.js:344 | `user.email + ' [service]'` | {email} [служебный] | |
| 167 | dashboard.js:312, 347 | no data: migration 016 not applied | Нет данных: миграция⍽016 не применена | Ячейка «Последний день в приложении». |
| 168 | dashboard.js:315 | `'own project' + ' “' + project + '”'` | Свой проект «{project}» / без названия — Свой проект | |
| 169 | dashboard.js:317 | `'invited into “' + (project ?? '?') + '”' + (owner ? ' (owner ' + owner + ')' : '')` | Приглашение в «{project}» (владелец {owner}) / без владельца — Приглашение в «{project}» | Формат владельца из T-293. «Приглашение», а не «приглашён(а)»: пол человека неизвестен. Если проекта нет, `{project}` = «?», как в коде. |
| 170 | dashboard.js:319 | no project | Без проекта | |
| 171 | dashboard.js:349 | `user.signIn.join(', ')` | {способы через запятую}, например: Apple, Google, почта | Значения — в разделе «Коды». |
| 172 | dashboard.js:325 | `'onboarding ' + (onboarding ? 'done' : 'not done')` | Онбординг: да / нет | Первый шаг в ячейке, поэтому с прописной. Каждый шаг записан как «подпись: значение», без склонений. |
| 173 | dashboard.js:326 | `'projects ' + n + (roles.length ? ' (' + roles.join(', ') + ')' : '')` | проектов: {n} ({роли}) / без ролей — проектов: {n} | |
| 174 | dashboard.js:323 | `n + ' ' + role` | {роль} — {n}, например: владелец — 1, участник — 2 | Только роли с n > 0, через запятую. Названия ролей — в разделе «Коды». |
| 175 | dashboard.js:327 | `'marks ' + (marks ? marks + ' until ' + marksUntil : 'none')` | отметок: {m}, по {дд.мм.гггг} / отметок: нет | «По» включает дату: это последняя дата, до которой доходят отметки. «До» прочиталось бы как «раньше этой даты». Дату собирать из строки, не через `new Date` (см. «Форматы»). |
| 176 | dashboard.js:328 | `'calendar sync used ' + (calendar ? 'yes' : 'no')` | синхронизация календаря: да / нет | «Пользовался ли» объяснено в сноске над таблицей. |
| 177 | dashboard.js:329 | `'device ' + (device ? 'yes' : 'no')` | устройство: есть / нет | |
| 178 | dashboard.js:330 | `'seen ' + seen + ' of ' + onRoster` | просмотрено: {seen} из {onRoster} | |
| 179 | dashboard.js:331 | `'own rehearsals ' + n` | создано репетиций: {n} | |
| 180 | dashboard.js:332 | `' · '` | · | Разделитель шагов остаётся. |
| 181 | dashboard.js:355 | No users | Пользователей нет | |
| 182 | dashboardPage.js:126 | Last Login is the last sign-in, not use: the app renews its session without one. Last day in app is use: the last date, in their own zone, the app made a request in their session (kept 13 months; recorded from migration 016 on). | «Последний вход» — когда человек в последний раз входил в аккаунт, а не пользовался приложением: сессию приложение продлевает без входа. «Последний день в приложении» — это использование: последняя дата по часовому поясу человека, когда приложение обращалось к серверу в его сессии (дни хранятся 13⍽месяцев и записываются с тех пор, как применена миграция⍽016). | |

## 2. Коды из данных

Если код незнакомый (например, новый тип уведомления), страница показывает его как есть. В начале ячейки слово пишется с прописной (см. «Форматы»).

| Код | По-русски | Где и почему |
|---|---|---|
| **Роли** | | В шагах, в скобках: «владелец — 1» |
| `owner` | владелец | |
| `admin` | администратор | Полное слово, как в текстах приложения («Сделать администратором»). |
| `member` | участник | Любая неизвестная роль код тоже считает участником (people.js:233). |
| **Способы входа** | | |
| `apple` | Apple | |
| `google` | Google | |
| `email` | почта | Вход по адресу и паролю. «Вход: Apple, Google или почта» — слова владельца (T-293). |
| **Статусы отчётов** | | Согласованы со словом «ошибка» |
| `new` | Новая | |
| `in_progress` | В работе | |
| `fixed` | Исправлена | |
| **Откуда пришёл человек** | | |
| `invite` | По приглашению — в фильтре, столбцах и воронке; в таблице пользователей — «Приглашение в «{project}» (владелец {owner})» | |
| `own` | Свой проект; в таблице пользователей — «Свой проект «{project}»» | |
| `none` | Без проекта | |
| группа воронки `other` | Свой / без проекта | `own` и `none` вместе. |
| **Типы уведомлений** | | Названы заголовками самих уведомлений в русском приложении, чтобы их узнавать. Получателя я проверил по `pushNotificationService.js` на 347cebc |
| `rehearsal_created` | Новая репетиция / Вас позвали на репетицию | Один тип на два случая: новая репетиция и добавление в уже существующую (`notifyAddedToRehearsal` пишет тот же тип). |
| `rehearsal_updated` | Изменена репетиция | |
| `rehearsal_deleted` | Отменена репетиция | |
| `rehearsal_removed` | Вас сняли с репетиции | Тому, кого сняли. |
| `member_response` | Репетиция просмотрена | Администраторам: кто-то отметил репетицию просмотренной. |
| `member_joined` | Новый участник | Владельцу и администраторам. |
| `admin_appointed` | Новый администратор | Им же. |
| `member_left` | Участник вышел из проекта / Участник удалён | Владельцу и администраторам. Один тип и на выход, и на удаление (`notifyMemberLeft` с `removed`). |
| `role_changed` | Изменение роли | Тому, чью роль изменили. |
| `member_removed` | Удаление из проекта | Тому, кого удалили. |
| `project_deleted` | Проект удалён | |
| `rehearsal_reminder_24h` | Напоминание за сутки | Само уведомление озаглавлено «Репетиция {когда}». |
| `rehearsal_reminder_1h` | Напоминание за час | Само уведомление — «Скоро репетиция: {когда}». |
| **Коды из писем** | | |
| `verify` | Подтверждение адреса при регистрации | |
| `reset` | Сброс пароля | |
| `change` | Смена адреса: код на новый адрес | |
| `confirm` | Смена адреса: код на текущий адрес | |
| **Сборка** | | |
| `null` (сейчас `unknown`) | Не указана | Приложение ни в один из дней не назвало сборку. «Неизвестна» читалось бы как непонятный номер. |
| **Значения шагов** | | |
| `done` / `not done` | да / нет | Онбординг. |
| `yes` / `no` (calendar) | да / нет | Синхронизация календаря. |
| `yes` / `no` (device) | есть / нет | Устройство. |
| `none` (marks) | нет | «Отметок: нет». |

## 3. Вход

Сообщения на экране входа зависят только от статуса ответа. Текст сервера не показывается.

| Случай | Сообщение | Примечание |
|---|---|---|
| Поле пустое (проверка до запроса; на всякий случай и ответ 400) | Введите пароль. | |
| 401 | Неверный пароль. | |
| 429, есть `Retry-After` | Слишком много попыток входа. Попробуйте снова через {minutes}⍽мин. | {minutes} = `Math.ceil(seconds / 60)`, не меньше 1. «Мин» не склоняется. Если нужно полное слово, то после «через»: one — «{minutes} минуту» (1, 21), few — «{minutes} минуты» (2–4, 22–24), many — «{minutes} минут» (0, 5–20, 25–30). |
| 429, `Retry-After` нет | Слишком много попыток входа. Подождите до 15⍽минут и попробуйте снова. | Окно ограничения — 15 минут. |
| 503 | Вход не настроен: на сервере не задан пароль администратора (ADMIN_PASSWORD_HASH или ADMIN_PASSWORD). | Имена переменных — из adminAuth.js. Если они не нужны, скобки можно убрать. |
| Нет связи (`fetch` не дошёл) | Нет связи с сервером. Проверьте интернет и попробуйте ещё раз. | Как в приложении. |
| Ответ 200 без токена | Сервер ответил не так, как ожидалось. Попробуйте ещё раз. | |
| Любая другая ошибка | Не удалось войти. Попробуйте ещё раз. | |
| Сессия истекла (401 на запросе с токеном) | Сессия истекла. Войдите снова. | Показывается на экране входа. |
| Кнопка | Войти; во время запроса — Вход… | |

## 4. Форматы

- **Даты** — `дд.мм.гггг`, например 26.11.2026.
  - Моменты времени (`createdAt`, `lastLoginAt`, `createdAt` проекта, `nextRehearsalAt`, `createdAt` отчёта) форматировать через `toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })`. Пояс — браузера, как сейчас.
  - Даты без времени — строки `ГГГГ-ММ-ДД`: недели воронки, недели и дни в «Откуда приходят люди», недели удержания, `usage.since`, `lastAppDay`, `marksUntil`. Их собирать из самой строки: `s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4)`. Через `new Date(s)` нельзя: западнее UTC дата съедет на день назад (правило 3 в CLAUDE.md).
- **Недели** — дата понедельника в том же виде: 23.11.2026. В воронке и в «Откуда приходят люди» это понедельник по UTC, в удержании — по поясу человека. Пометки о поясе стоят в заголовках и сносках.
- **Дробные числа** — с запятой: `value.toLocaleString('ru-RU')` → «3,5». К целым «,0» не добавлять. Целые можно выводить как есть. Если они тоже пойдут через `toLocaleString`, тысячи отделятся пробелом — это тоже правильно.
- **Проценты** — число, неразрывный пробел и знак: «40,5⍽%», «100⍽%». Так требует ГОСТ 8.417 и так же форматирует `Intl` для русского языка. Код: `value.toLocaleString('ru-RU') + ' %'`.
- **Единицы** — после числа через ⍽: «3,5⍽ч», «45⍽мин», «(30⍽дн.)». После «ч» и «мин» точки нет, после «дн.» есть — как в приложении («5 мин назад», «3 ч назад», «2 дн. назад»). Людей в скобках медианы — «12⍽чел.».
- **Нет значения** — длинное тире «—» вместо дефиса. Исключение — медиана, где никого нет: там «пока никого», иначе получится «— —».
- **Неразрывные пробелы.** ⍽ отмечен в таблице везде, где он нужен в строках: между числом и единицей или словом («30⍽дней», «День⍽1», «За 4⍽недели»), после «№» и между словом и номером миграции («миграция⍽016»). В сносках ещё стоит ставить ⍽ перед тире, чтобы тире не начинало строку. Это можно сделать одной заменой « — » → «⍽— » на весь текст.
- **Кавычки** — «ёлочки» вокруг названий проектов. Если в названии уже есть кавычки, правило как в приложении (`quoteName`): свои кавычки не удваивать, внутренние делать „лапками“.
- **Прописная в ячейке.** Значение в ячейке начинается с прописной. После « · » и после двоеточия — строчная.
- **Предложение по столбцу «Медиана до прочтения».** До 60 минут показывать «{n}⍽мин», от 60 — часы с одной цифрой после запятой: «2,5⍽ч». Минуты растут без предела, а «1440⍽мин» читается хуже, чем «24⍽ч».
- **Предложение по ячейкам «X из 0».** В проектах сейчас выходит «0 из 0 (—)». Лучше одно «—», как уже сделано в таблице удержания.

## 5. Решения и сомнения

**Термины**

- **Название.** «Админка Rehearsly» — в `<title>`, в заголовке панели и на экране входа. Старое «Rehearsal Calendar» не осталось нигде.
- **Источник.** Фильтр и столбцы называются «Источник», раздел — «Откуда приходят люди». Значения: «По приглашению», «Свой проект», «Без проекта». Группа воронки — «Свой / без проекта».
- **«Real».** Везде передано как «без служебных».
- **Слова приложения:** «отметки занятости», «импортированная занятость», «экспорт», «в составе», «просмотрено», «присоединились» / «присоединений», «устройство для уведомлений», «Код из письма». Входящие названы «Уведомления»: так называется экран в приложении.
- **Сборка, а не версия.** В таблице номера сборок (`X-App-Build`, `MIN_IOS_BUILD`); версия вроде 1.0.0 — другое.
- **Онбординг.** Это слово владельца. В политике для людей то же называется «знакомство с приложением». Если в админке нужны слова политики — заменить в строках 58, 68, 70, 155 и 172.
- **«Пользователи» вместо «Новые пользователи».** По умолчанию период — «Всё время», и в таблице все.
- **Статусы отчётов** — «Новая / В работе / Исправлена», согласованы со словом «ошибка».
- **Почта.** Столбец и способ входа — «почта», как пишет владелец. Приложение подписывает поле «Email».
- **Smart Planner** в админке не встречается, решать нечего. В приложении он называется «Smart Planner», вкладка — «Planner».

**Где английский расходится с кодом — русский написан по коду**

1. Карточка «Пользователи»: «this week / this month» в коде — последние 7 и 30 суток. По-русски: «за 7⍽дней, за 30⍽дней».
2. «Onboarding done»: кнопка «Пропустить» ставит тот же флаг. По-русски: «пройден или пропущен».
3. Уведомления, «read: opened»: прочитанными уведомления делает и кнопка «Прочитать все». Медиана до прочтения включает эти массовые отметки.
4. Проекты, «with a rehearsal starting in it»: в коде нет верхней границы. Проект, у которого есть только будущая репетиция, тоже в списке.
5. «Seen before start»: цифры считают места в составах (человек × репетиция), а не людей. «Taken off» — любой, кто больше не в проекте, в том числе вышедший сам.
6. «Week (Monday)» в «Откуда приходят люди» — по UTC. Пометку я добавил в заголовок.
7. «The filters select» — это только «Источник» и «Язык». Период на участников, активных и уведомления не действует. Я назвал оба фильтра прямо.

**Что не так в английском, но в текст я не вписывал — решать владельцу**

- «Присоединились», «Пришли через него», «Просмотрено до начала» и коды из писем тоже считаются только по людям, подходящим под фильтры. В сносках этого нет.
- Удалённые человеком уведомления в «Создано» не попадают.
- «Активных за 7 / 30 дней» — это календарные даты в поясе человека, считая сегодняшнюю. В фильтре «Последние 7 дней» — 7 суток от текущего момента.
- «Служебные не входят ни в одну цифру» верно про людей. Но проекты владельцев из ADMIN_SERVICE_EMAILS считаются — так задумано в people.js.
- Карточку «слева» я заменил её названием «Пользователи»: на узком экране карточки встают в столбик.
- Сейчас при 400/401 на экране входа показывается английский текст сервера. Раздел «Вход» его заменяет.

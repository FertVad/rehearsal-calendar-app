# T-250 — вычитка переводов приложения (ru / en / es / de)

Коммиты: `89e7da0` (пуши: rehearsalUpdated и мелочи), `4c380ba` (экраны и письма),
`ecca467` (системный запрос iOS, de). База — `8110068`.

## Пуш «репетиция изменена» — итоговые тексты (для лендинга)

Тело теперь говорит, что изменилось; при переносе — куда. Заголовки пушей прежние
(«Изменена репетиция», "Rehearsal updated", "Ensayo actualizado", "Probe geändert").

| Что изменилось | ru | en | es | de |
|---|---|---|---|---|
| Перенос (сегодня) | Лебединое озеро: Кордебалет — теперь сегодня в 19:00 | Swan Lake: Corps de ballet — now today at 7:00 PM | El lago de los cisnes: Cuerpo de baile, pasa a hoy a las 19:00 | Schwanensee: Corps de ballet – verlegt auf heute, 19:00 |
| Перенос (завтра) | … — теперь завтра в 19:00 | … — now tomorrow at 7:00 PM | …, pasa a mañana a las 19:00 | … – verlegt auf morgen, 19:00 |
| Перенос (дата) | … — теперь вт, 6 окт. в 19:00 | … — now on Tue, Oct 6 at 7:00 PM | …, pasa al mar, 6 oct a las 19:00 | … – verlegt auf Di., 6. Okt., 19:00 |
| Перенос + новое место | … — теперь завтра в 19:00, место: Зал 2 | … — now tomorrow at 7:00 PM at Hall 2 | …, pasa a mañana a las 19:00 en Sala 2 | … – verlegt auf morgen, 19:00, Ort: Saal 2 |
| Только место | …: Кордебалет, завтра в 19:00 — новое место: Зал 2 | … , tomorrow at 7:00 PM — new location: Hall 2 | …, mañana a las 19:00 — nuevo lugar: Sala 2 | …, morgen um 19:00 – neuer Ort: Saal 2 |
| Место убрали | … — место больше не указано | … — no location now | … — ya sin lugar asignado | … – kein Ort mehr |
| Только название | …: Кордебалет, завтра в 19:00 — новое название | … — renamed | … — nuevo nombre | … – neuer Titel |

Было во всех языках: `Проект: Название, когда — дата/время` (`date/time`, `fecha/hora`, `Datum/Zeit`).
Механизм: у дня переноса свои слова (`movedTo` в `pushNotifications.js`, `reminderWhen(..., 'movedTo')`):
испанское «a el» → «al», немецкое «auf am» → «auf Di.,».

## Пуши и входящие (`server/i18n/pushNotifications.js`)

| Язык | Было | Стало | Почему |
|---|---|---|---|
| ru | Вы были удалены из проекта X | Вас удалили из проекта X | калька пассива |
| ru | Проект X был удалён | Проект X удалён | лишнее «был» |
| en | You are now an administrator / a member **in** X | … **of** X | предлог |
| es | Nuevo integrante | Nuevo miembro | на экранах «miembro» |
| de | …, heute um 19:00 — du bist nicht mehr dabei | … – du bist nicht mehr dabei | немецкое тире |

## Письма (`server/services/email/messages.js`)

| Язык | Было | Стало | Почему |
|---|---|---|---|
| ru | Адрес вашего аккаунта Rehearsly теперь X. Входите с ним. | Теперь вы входите в Rehearsly с адресом X. | «Входите с ним» — неестественно |
| es | El código vale 15 minutos. (×4) | El código es válido durante 15 minutos. | «vale» о коде — разговорно-неточно |

## Системный запрос iOS (`locales/de.json`)

| Было | Стало | Почему |
|---|---|---|
| …nur, wann du belegt bist… (×2) | …nur, wann du beschäftigt bist… | «belegt» — о комнате/линии, не о человеке; в приложении «beschäftigt» |

## Экраны — русский

| Было | Стало | Почему |
|---|---|---|
| Успех / Успешно (заголовки) | Готово | калька "Success" |
| Выберите период не длиннее ${n} дней… | …не длиннее 31 дня / 90 дней… | падеж числа (31 дней) |
| …Пока вы этого не сделали, вас считают свободным. | …Пока отметок нет, для остальных вы свободны. | род (свободным) |
| Свободен / Занят (легенда и режим дня) | Свободно / Занято | состояние дня, а не мужской род |
| Время когда занят | Время занятости | запятая, род |
| Удалить данные этой даты / Удалить данные? | Удалить отметки за этот день / Удалить отметки? | «данные даты» — канцелярит |
| Вы уверены, что хотите удалить данные занятости для этой прошедшей даты? | Отметки занятости за этот прошедший день будут удалены. | канцелярит |
| Это прошедшая дата. Вы можете удалить данные, но не редактировать. | Этот день уже прошёл. Отметки можно удалить, но не изменить. | то же |
| Вы доступны весь день для репетиций / Вы недоступны в этот день | Весь день вы свободны для репетиций / В этот день вы заняты | одно слово: свободен/занят |
| Анализируем доступность... | Смотрим, кто свободен... | калька, «доступность» |
| Ошибка создания репетиции / проекта | Не удалось создать репетицию / проект | как остальные ошибки |
| Не удалось загрузить доступность участников | …занятость участников | одно понятие — «занятость» |
| Вы уверены, что хотите создать репетицию? (конфликт) | Всё равно создать репетицию? | короче, по-русски |
| Ольга занят(а) в это время / …заняты… | В это время не может: Ольга / …не могут: … | «(а)» — угадывание рода |
| Смирнова занят 10:00–14:00 | Смирнова: занято 10:00–14:00 | мужской род для любого имени |
| Репетиция успешно обновлена | Репетиция сохранена | «успешно» — калька |
| Нет проектов, где вы являетесь администратором | Нет проектов, где вы администратор | канцелярит |
| Нет свободного времени для всех выбранных участников | Нет времени, когда свободны все выбранные участники | точнее |
| Доступ запрещён / Для использования этой функции необходим доступ к календарю | Нет доступа / Для этого нужен доступ к календарю | канцелярит |
| Удалить все экспортированные | Удалить экспортированные репетиции | нет существительного |
| Успешно синхронизировано | Синхронизировано | калька |
| 3ч назад / 2д назад / 3 дн назад | 3 ч назад / 2 дн. назад / 3 дн. назад | пробел, точка сокращения, единообразие |
| Ваша фамилия (опционально) / (опционально) | (необязательно) | калька |
| Если с X есть аккаунт, на него отправлен… | Если на X зарегистрирован аккаунт, мы отправили туда… | «с адреса есть аккаунт» |
| Это и есть ваш адрес | Это ваш текущий адрес | естественнее |
| Будет удален 1 проект… / Будут удалены N проект(а/ов)… | Будет удалён 1 / 21 проект; Будут удалены 2 проекта; 5 проектов | число с существительным |
| Остальные участники потеряют их тоже. | Остальные участники тоже их потеряют. | порядок слов |
| Аккаунт успешно удален / Профиль обновлен / Участник удален / Проект успешно удален / истек | Аккаунт удалён / Профиль обновлён / Участник удалён / Проект удалён / истёк | ё, как везде; «успешно» |
| "Название" в кавычках-лапках (приглашение, удаление проекта) | «Название» | русские кавычки |

## Экраны — English

| Было | Стало | Почему |
|---|---|---|
| Success (alert titles) | Done | "Success" alerts read machine-made |
| Try again, Add slot, Sync error, Not now, Your availability, Set up later, New rehearsal, Join with a code, Confirm your email, Send the code again, Send code, Reset password, Back to sign in, Forgot password?, New password, Change password and sign in, Another address, Address already in use, Change address, Send codes, Send the codes again, Confirm change, Address changed, Yes, delete, Unsaved changes, Turn on, Permission required, What’s where, Show the code, Join a project, Clear notifications?, Remove all rehearsals from calendar?, Choose export calendar, Settings available in profile | Title Case (Try Again, Add Slot, …, Settings Are in Your Profile) | HIG: one case for buttons and titles |
| Share the link | Share Link | HIG, button |
| Log out | Sign Out | the app says "Sign In" |
| Timezone / Select Timezone / Failed to update timezone | Time Zone / Select Time Zone / …time zone | Apple's spelling; the search already said "time zone" |
| Notifications are not allowed (title) | Notifications Not Allowed | title |
| No connection. Showing the last that loaded — … | …Showing what loaded last — … | grammar |
| Delete this date data / Delete data? / Are you sure you want to delete availability data for this past date? | Delete This Day’s Entries / Delete Entries? / Your availability entries for this past day will be deleted. | broken grammar |
| This is a past date. You can delete data, but not edit. | This day has passed. You can delete its entries but not edit them. | grammar |
| You are available all day for rehearsals | You are free all day for rehearsals | one word: free/busy |
| This is where the hours everyone can make show up. For that, people have to mark their time — … | Hours when everyone is free show up here. For that, people need to mark when they are busy — … | clumsy |
| Find the best time for rehearsal | …for a rehearsal | article |
| Error creating rehearsal / project | Could not create the rehearsal / project | as the other errors |
| No available time for all selected participants | No time when all selected participants are free | clumsy |
| Remove all rehearsals from calendar? / All rehearsals removed from calendar | …from the Calendar? / …from the calendar | article |
| …time zone was not recognised | …recognized | US spelling (en-US dates) |
| Enter the address of your account and we will send it a code. | Enter your account’s email address and we will send a code to it. | "send it a code" |
| This already is your address | This is already your address | word order |
| No connection to the server. Check the internet and try again | …Check your internet connection and try again | natural |
| You can set up week start day and calendar sync anytime in Profile → Settings | You can set the first day of the week and calendar sync at any time in Profile → Settings | grammar |
| The company sees only the hours you are taken… | Your company sees only the hours you are busy… | "taken" |
| …Everyone else in them loses them too. | …will lose them too. | tense |
| Account successfully deleted | Account deleted | filler |
| Invitation to project X / Join the project "X" / delete the project "X"? | Invitation to X / “X” | article, typographic quotes |

## Экраны — Español (одна форма обращения — «tú», как в письмах)

| Было | Стало | Почему |
|---|---|---|
| Marquen cuándo están ocupados. Hasta entonces, los demás los ven libres. | Marca las horas en que no puedes. Hasta entonces, para los demás estás libre. | ustedes → tú, род |
| …o prueben otro período. | …cada uno tiene que marcar su tiempo — o prueba otro período. | ustedes → tú |
| Hora en que estás ocupado | Horas ocupadas | род |
| Los ensayos aparecen cuando estén en un proyecto | Los ensayos aparecerán cuando estés en un proyecto | ustedes → tú |
| ${n} está ocupado/a a esa hora / …están ocupados… | ${n} no puede a esa hora / …no pueden… | «/a» — угадывание рода |
| ${n}: ocupado ${time} | ${n}: no disponible ${time} | род |
| …o que los hayan quitado de él. | …o que te hayan quitado de él. | ustedes → tú |
| No hay proyectos en los que seas administrador | No hay proyectos que administres | род (как в пушах, T-251) |
| No hay tiempo disponible para todos los participantes seleccionados | No hay ninguna hora en que estén libres todos los participantes seleccionados | калька |
| Éxito / Ensayo actualizado correctamente | Listo / Ensayo actualizado | калька |
| Sin conexión. Revisa internet e inténtalo de nuevo. (+ на сервер) | Sin conexión. Comprueba tu conexión a internet e inténtalo de nuevo. | «Revisa internet» |
| Marcar ocupado | Marcar horas ocupadas | род, неполная фраза |
| ¿No tienes cuenta? Crear una | ¿No tienes cuenta? Crea una | как «Inicia sesión» |
| Volver a iniciar sesión | Volver al inicio de sesión | читалось «войти снова» |
| …en que estás ocupado… (экран синхронизации) | …las horas que tienes ocupadas… | род |
| Acceso al calendario requerido / Ningún calendario seleccionado / Todos los ensayos eliminados del calendario / Sincronizado correctamente | Se necesita acceso al calendario / No hay calendarios seleccionados / Se eliminaron todos los ensayos del calendario / Sincronización completada | кальки |
| Aquí verán … sus proyectos. | Aquí verás … tus proyectos. | ustedes → tú |
| Cada quien marca… | Cada uno marca… | латиноамериканизм; даты — es-ES |
| ¡Bienvenido, X! / ¡Bienvenido! | ¡Te damos la bienvenida, X! / ¡Te damos la bienvenida! | род |
| Les avisamos cuando alguien los ponga… Sin ellas, se enteran los últimos. | Te avisamos cuando alguien te ponga… Sin ellas, te enterarás tarde. | ustedes → tú, род |
| Te añadieron a un ensayo (пример) | Te han añadido a un ensayo | как в самом пуше |
| Su disponibilidad / …están ocupados… Elijan… / Pueden hacerlo… / …donde son administradores | Tu disponibilidad / …no puedes… Elige… / Puedes hacerlo… / …que administras | ustedes → tú, род |
| Aquí estarán sus proyectos / Creen uno, o únanse… / Escriban el código o peguen el enlace | Aquí estarán tus proyectos / Crea uno o únete… / Escribe el código o pega el enlace | ustedes → tú |
| Hacer administrador / ¿Hacer administrador? / …convertir a X en administrador… | Hacer admin / ¿Hacer admin? / ¿Seguro que quieres que X administre el proyecto? | род |
| No se pudo unir al proyecto | Error al unirse al proyecto | «не удалось присоединить(ся)» — безлично-неверно |
| …los proyectos que posees… Los demás integrantes también los pierden. | …que son tuyos… Los demás miembros también los perderán. | одно слово «miembro», время |
| …en el que eres el único administrador | …que solo administras tú | род |
| "X" | «X» | испанские кавычки |

## Экраны — Deutsch (одна форма — «du»)

| Было | Стало | Почему |
|---|---|---|
| Erfolg / Probe erfolgreich aktualisiert / Erfolgreich synchronisiert / Konto erfolgreich gelöscht / Projekt erfolgreich gelöscht | Erledigt / Probe aktualisiert / Synchronisiert / Konto gelöscht / Projekt gelöscht | калька |
| Nicht sichern / Nicht gesicherte Änderungen | Nicht speichern / Ungespeicherte Änderungen | одно слово: «Speichern» на кнопке |
| Prüfe das Internet… (×2) | Prüfe deine Internetverbindung… | «проверь интернет» |
| … — … (тире в немецких строках) | … – … | немецкая типографика |
| Zum Freigeben den Termin im Telefonkalender löschen. | Um sie freizugeben, lösche den Termin im Kalender deines Telefons. | du, инфинитив-инструкция |
| Dafür müssen die Leute… | Dafür müssen alle… | разговорно |
| Passwort verbergen | Passwort ausblenden | как iOS |
| E-Mail ist gerade nicht verfügbar. Versuch es… | E-Mails können gerade nicht versendet werden. Versuche es… | смысл, единая форма |
| …wir schicken ihr einen Code. | …– wir schicken einen Code dorthin. | «ihr» об адресе |
| Nächste Ereignisse | Anstehende Termine | естественно для календаря |
| Teilnehmende (2 места) | Teilnehmer | одно слово на всех экранах |
| ist / sind zu dieser Zeit belegt; ${n} belegt ${t} | …beschäftigt; ${n}: beschäftigt ${t} | человек «beschäftigt», не «belegt» |
| Konnte nicht als gesehen markiert werden | Die Probe konnte nicht als gesehen markiert werden | нет подлежащего |
| Keine Projekte, in denen du Administrator bist | Keine Projekte, die du verwaltest | род (как в пушах, T-251) |
| …oder du wurdest abgemeldet. | …oder du wurdest aus der Besetzung genommen. | «abgemeldet» = вышел из аккаунта |
| …in denen du belegt bist… / …besetzt bist… | …beschäftigt bist… | одно слово |
| Alle exportierten entfernen | Alle exportierten Proben entfernen | нет существительного |
| vor 5 Min / vor 3 Std / vor 2 T | vor 5 Min. / vor 3 Std. / vor 2 Tg. | сокращения |
| …jederzeit unter Profil → Einstellungen konfigurieren | …einrichten | естественнее |
| Jeder trägt ein, wann er beschäftigt ist | Alle tragen ein, wann sie beschäftigt sind | род |
| Du hörst es, wenn dich jemand zu einer Probe einträgt… Ohne sie… | Du erfährst es, wenn dich jemand für eine Probe einträgt und wenn sich ihre Zeit ändert. Ohne Mitteilungen… | предлог, «sie» неясно |
| Du wurdest zu einer Probe eingetragen (пример) | Du wurdest zu einer Probe hinzugefügt | как в самом пуше |
| Wähl… | Wähle… | единая форма |
| Erstell eins, oder tritt… | Erstell eins oder tritt… | запятая |
| Zum Administrator machen (?) / …zum Administrator des Projekts machen? | Administratorrechte geben (?) / …wirklich Administratorrechte für das Projekt geben? | род |
| …in dem du der einzige Administrator bist… | …das nur du verwaltest… | род |
| Über | Über die App | неполное |
| „X" | „X“ | закрывающая кавычка |

Planner и Smart Planner не переводились (T-249).

## Вопросы Вадиму

1. **Перенос + переименование одним сохранением.** Пуш показывает новое название и новое время
   («Новое имя — теперь завтра в 19:00»), но не говорит «переименована»: старого названия в пуше нет.
   Нужно ли его передавать («Прогон → Генеральный прогон, теперь завтра в 19:00»)? Это уже смысл, не язык.
2. **Английский регистр — что не сделано.** Не тронуты строки, правка которых меняет не только регистр
   и задевает сценарии вне задачи: "No connection. Check the internet and try again." (13, 34, 10),
   "Cannot save" / "Understood" (10), "Synced successfully" (31, 84 — оставлено), "Project successfully
   deleted" (19), "Rehearsal updated successfully" (52). Предлагаю отдельной задачей вместе с этими сценариями.
3. **Немецкий «Teilnehmer» или «Teilnehmende».** Привёл к «Teilnehmer» (было вперемешку): короче для строк
   фильтров и как в Zoom/Teams. Если нужен гендерно-нейтральный вариант по всему приложению — скажите.
4. **Испанский «miembro» или «integrante».** Привёл к «miembro» (было 12:2). «Integrante» нейтральнее, но длиннее.
5. **Немецкий сегмент «Daten»** (период «свои даты», T-241) читается и как «данные». Вариант — «Tage»;
   не менял: это смысл кнопки, а сценарий 59 сверяет длину.
6. **Испанский: es-ES или латиноамериканский.** Даты форматируются es-ES, тексты теперь тоже
   («Cada uno», «Volver al inicio de sesión»). Если аудитория латиноамериканская — скажите.

## Проверки

- Сервер: `rehearsalNoticeText.integration.test.js` — 8 красных на старом коде, 29/29 зелёных
  (`server-red-before.txt`). Весь серверный Jest зелёный, кроме `startup/runtimeStartup` (8 из 11):
  падает в этой песочнице одинаково на старом и новом коде.
- Клиент: `npx jest --selectProjects frontend` — 1409/1409. `npm run type-check` — чисто.
- e2e, красное до: 84 (`e2e-84-red-before.txt`), 86 (`e2e-86-red-before-green-after.txt`).
- e2e, зелёные на `4c380ba`: 16, 43, 44, 56, 59, 60, 61, 62, 65, 66, 80, 81, 84, 86;
  на `ecca467` (новая нативная сборка из-за locales): 01, 60.
- `npm run check:secrets -- --staged` в этой песочнице не завершился за 2 минуты — не прогнан.

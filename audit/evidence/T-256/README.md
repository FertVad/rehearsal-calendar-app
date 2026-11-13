# T-256 — вычитка носителями (ru / en / es / de)

База — `3b16cd5`. Коммиты: `1443ab2` (пуши и письма), `6787278` (экраны, `locales`, `app.json`),
`658772a` (сценарии), `c1f6120` (сценарий 11). Номер — строка таблицы в отчёте редактора
(`T-256-natives-<язык>.md`; для en и es — строка файла, там таблицы без номеров; «Доп.» — «Дополнение 13.11»).

## Пуши (`server/i18n/pushNotifications.js`, `reminderText.js`, `pushNotificationService.js`)

Механизм: `untilTime()` — конец по часам читателя: тот же день → время; следующий день → «следующего дня» / «the next day» /
«del día siguiente» / «am Folgetag»; ровно 0:00 → «полуночи» / «midnight» / «la medianoche» / «Mitternacht» (+ UTC).
Пуш об отмене идёт через `sendAboutRehearsal`, как остальные, и говорит `when`. `reminderWhen` для es пишет дату полностью,
без запятой. Свои слова «когда» для английских заголовков (`titleWhen`), русский перенос с концом — `movedFrom` («с … до»).

| Язык | Было | Стало | Строка |
|---|---|---|---|
| ru | …назначена завтра в 19:00 | …назначена на завтра в 19:00 (new, added) | 1, 2 |
| ru | — теперь завтра в 19:00 до 22:00 | — теперь завтра с 19:00 до 22:00 | 3 |
| ru | Анна в курсе: «Репетиция» (завтра в 19:00), Гамлет | Гамлет: Репетиция, завтра в 19:00 — Анна в курсе | 4 |
| ru | …в проекте Весна 2026 (×5 пушей) | …в проекте «Весна 2026» | 5–9 |
| ru | Вас добавили в репетицию / Вас убрали из репетиции | Вас позвали на репетицию / Вас сняли с репетиции | 20, 22 |
| ru | — вас убрали из состава | — вас больше нет в составе | 23 |
| ru | Теперь вы участник проекта X | Вы больше не администратор проекта «X» | 24 |
| ru | Гамлет: Репетиция «Прогон» отменена | …«Прогон» на завтра в 19:00 отменена | Доп. 1 |
| ru | — новое название (стёрто) | — теперь без названия | Доп. 2 |
| ru | теперь до 1:00 / до 0:00 | теперь до 1:00 следующего дня / до полуночи | Доп. 3, бриф |
| en | заголовки sentence case | Title Case, напоминания тоже: Rehearsal Tomorrow at 7:00 PM, Rehearsal Soon — Today at 7:00 PM | Доп. 4, решение 3 |
| en | Rehearsal cancelled / …cancelled | Rehearsal Canceled / X, tomorrow at 7:00 PM — canceled | 134–135, Доп. 1 |
| en | — now on Thu, Nov 19 at… | — moved to Thu, Nov 19 at… | 136 |
| en | no location now / , no location | location removed | 137 |
| en | has seen “Rehearsal” | has seen the rehearsal | 138 |
| en | — renamed (стёрто) | — title removed | Доп. 2 |
| en | until 1:00 AM / 12:00 AM | until 1:00 AM the next day / until midnight | бриф, Доп. 3 |
| es | el mar, 6 oct | el martes 6 de octubre | 17 |
| es | — ya no estás en él | — ya no estás en este ensayo | 24 |
| es | … en Teatro Real | …. Lugar: Teatro Real (added, перенос) | 78, 79 |
| es | pasa a … a las 19:00 hasta las 22:00 | …a las 19:00, hasta las 22:00 | 79 |
| es | — ahora hasta las 22:30 | — ahora termina a las 22:30 | 80 |
| es | ha visto «Ensayo» | ha visto el ensayo | 81 |
| es | Nueva administración | Permisos de administrador | 82 |
| es | Ensayo pronto: | Ensayo en breve: | 83 |
| es | Ensayo «X» cancelado | Cancelado el ensayo «X» previsto para mañana a las 19:00 | Доп. 1 |
| es | — nuevo nombre / стёрто | — nuevo título / — ya sin título | Доп. 2 |
| es | hasta la 1:00 / 0:00 | hasta la 1:00 del día siguiente / la medianoche | бриф, Доп. 3 |
| de | Du wurdest von einer Probe genommen | Du bist für eine Probe nicht mehr eingeteilt | 70 |
| de | Du wurdest zu einer Probe hinzugefügt | Du wurdest für eine Probe eingeteilt (и пример в онбординге) | 51 |
| de | Hamlet: Szene am Fenster am Di… | Hamlet: Probe „Szene am Fenster“ am Di… (added, new, removed, updated, deleted) | 71 |
| de | Anna hat „X“ (…) in Hamlet gesehen | Hamlet: Anna hat die Probe „X“ (…) als gesehen markiert | 72 |
| de | ist Der Kirschgarten beigetreten | ist dem Projekt „Der Kirschgarten“ beigetreten | 74 |
| de | Neue Verwaltung / verwaltet jetzt X | Adminrechte vergeben / verwaltet jetzt das Projekt „X“ | 75, 76 |
| de | Du verwaltest jetzt X / Mitglied in X | …das Projekt „X“ / Du bist jetzt Mitglied im Projekt „X“ | 77, Доп. |
| de | aus dem Projekt X / Das Projekt X | „X“ в кавычках | 78 |
| de | Probe gleich: | Probe beginnt bald: | 79 |
| de | Hamlet: Probe abgesagt | Hamlet: Probe „Durchlauf“ morgen um 19:00 abgesagt | Доп. 1 |
| de | – neuer Titel (стёрто) | – Titel entfernt | Доп. 2 |
| de | bis 1:00 / 0:00 | bis 1:00 am Folgetag / bis Mitternacht | бриф, Доп. 3 |

## Письма (`server/services/email/messages.js`, только тексты)

| Язык | Было | Стало | Строка |
|---|---|---|---|
| ru | Введите 482913 в Rehearsly… | Введите код 482913 в приложении Rehearsly… (×4) | 25 |
| en | The code works for 15 minutes / ignore this email / stays as it is / address | expires in 15 minutes / you can safely ignore… / will stay the same / email address (×4) | 144–147 |
| en | Your Rehearsly sign-in address was changed; The email address of your… If this was not you, write to… | Your Rehearsly email address was changed; Your Rehearsly account’s email address is now…; If you did not make this change, contact us at… | 148, 149 |
| es | Introduce … (×4) | Escribe … | 84–87 |
| es | Tu dirección de Rehearsly ha cambiado | Ha cambiado el correo de tu cuenta de Rehearsly | 88 |
| de | Deine Rehearsly-Adresse wurde geändert | Die E-Mail-Adresse deines Rehearsly-Kontos wurde geändert | 80 |

## Экраны — русский

| Было | Стало | Строка |
|---|---|---|
| Присоединяйся… / Приглашение в проект X | Присоединяйтесь… / …в проект «X» | 10, 11 |
| В расчёте они считаются свободными | Без отметок участник считается свободным | 12 |
| …свободна вся команда… — или попробуйте… | …свободны все участники. Для этого им нужно отметить занятость. Или попробуйте… | 13 |
| Не удалось записать в календарь репетиций: 3 | Не удалось записать репетиций в календарь: 3 | 14 |
| Придёт сообщение… узнать последним | Придёт уведомление… позже всех | 15 |
| Отмена (common, profile, projects) | Отменить | 16 |
| …попробуйте ещё раз (×2 без точки) | …ещё раз. | 17, 18 |
| Вас добавили в репетицию (пример) | Вас позвали на репетицию | 21 |
| Загрузка... и др. (×7) | … одним знаком | 26 |
| Новое действие | Добавить | 27 |
| От: / До: (выбор дат) | С: / По: | 28 |
| Ко входу | Вернуться ко входу | 29 |
| Срок кода истёк | Срок действия кода истёк | 30 |
| Почта сейчас недоступна | Сейчас не получается отправить письмо | 31 |
| подтвердите X кодом | подтвердите адрес X кодом | 32 |
| Часовой пояс устройства… в настройках | …телефона… Проверьте настройки даты и времени | 33 |
| Ваш аккаунт Google был связан с существующим | Аккаунт Google привязан к вашему аккаунту Rehearsly (и Apple) | 34 |
| Добавить слот / Слоты не должны… / Пожалуйста, исправьте время слотов… | Добавить время / Промежутки времени… / Исправьте время и попробуйте снова | 35–37 |
| …совпадать с началом | …со временем начала | 38 |
| 1 слот / 3 слота | 1 вариант / 3 варианта | 39 |
| окажетесь в проекте | будете в проекте | 40 |
| Найти оптимальное время… | Подобрать время для репетиции | 41 |
| Редактировать репетицию | Изменить репетицию | 42 |
| Участники (5) получат уведомление | Уведомление получат 5 участников (1 участник, 2 участника) | 43 |
| …и повторите | …и попробуйте ещё раз | 44 |
| ⚠️ Конфликт расписания | ⚠️ Накладка в расписании | 45 |
| Не удалось обновить репетицию | Не удалось сохранить изменения | 46 |
| Отметить просмотренным / Не удалось отметить просмотр | Отметить как просмотренное / Не удалось отметить как просмотренное | 47, 48 |
| Предоставить доступ (×2) | Разрешить доступ | 49 |
| Удалить экспортированные репетиции | Удалить репетиции из календаря | 50 |
| …из календаря? / …удалены из календаря | …из календаря телефона | 51 |
| 1 дн. назад | вчера | 52 |
| Отметить все | Прочитать все | 53 |
| …день начала недели… Профиль → Настройки | …начало недели… «Профиль» → «Настройки». | 54 |
| Google Calendar / Apple Calendar | Google Календарь / Календарь iPhone | 55 |
| Не удалось обновить часовой пояс / начало недели | …изменить… | 56 |
| входите с X | входите с адресом X | 57 |
| Уведомления запрещены | Уведомления не разрешены | 58 |
| Вступить в проект | Присоединиться к проекту | 59 |
| Все репетиции, участники и данные… | Все репетиции и данные проекта будут удалены безвозвратно, а участники потеряют к нему доступ | 60 |

## Экраны — English

| Было | Стало | Строка |
|---|---|---|
| No connection. Check the internet… | Could not connect. Check your internet connection… | 18 |
| 1 days / 1 characters / 1 — those events are | 1 day / 1 character / that event is | 19, 27, 80 |
| Email is unavailable right now | Emails cannot be sent right now | 28 |
| Understood | OK | 51 |
| Mark all read | Mark All Read | 92 |
| Select Period / New Action | Select Dates / Quick Actions | 20, 21 |
| Repeat password, Google/Apple account, 30 s, wrong attempts, Address Already in Use, your address, is created, Latin letters, nameInvalid, resetSubtitle, resetCodeSent, New password, Another Address, auth.noConnection, requestFailed | Re-enter password, Google/Apple Account, 30 seconds, failed attempts, Email Already in Use, your email address, has been created, letters A–Z…, First name is required…, …, you a code, If an account exists for…, New Password, Use Another Email, Could not connect to the server…., …again. | 29–45 |
| what loaded last (×2) | what was last loaded; Could not connect. | 52, 53 |
| Already on this day / Busy time / Start time / End time / unavailable on this day / Nothing to show yet | Already Scheduled / Busy Time / Start Time / End Time / You are busy all day / Nothing to Show Yet | 54–59 |
| For that, people… — or try another period | …once people mark when they are busy. You can also try different dates. | 60 |
| Add rehearsal 6:00 PM | Add rehearsal, 6:00 PM | 61 |
| Rehearsal updated successfully | Rehearsal saved | 67 |
| Participants (5) will be notified | 5 participants will be notified | 68 |
| …told it is cancelled | …who will be notified | 69 |
| A, B are busy at this time / Anna busy 6:00 | Busy at this time: A, B / Anna is busy 6:00 | 70, 71 |
| You are not in the cast | Not on this rehearsal (короткий вариант редактора) | 72 |
| No members in project / you were taken off it | …in this project / you may have been taken off it | 73, 74 |
| Synced successfully / never what the events are / Calendar access required / Remove All Exported / Synchronize / No writable calendars | Synced / — never the details of your events / Calendar Access Required / Remove Exported Rehearsals / Sync Now / No editable calendars | 81–86 |
| Nothing yet / The list will be empty | No Notifications Yet / All notifications will be deleted | 93, 94 |
| skipMessage, notifications.description, Your company…, Finding a time | …choose… set up….; …you may be the last to know.; Your team… will be added automatically; Finding a Time | 100–103 |
| Change Address (×2) / New address / Address Changed / Current password / Code from the email to / Week starts on / Nothing found / deleteAccountWarning / avatarHint / phone settings | Change Email / New Email / Email Changed / Current Password / Code sent to / Start Week On / No Results / This cannot be undone… Other members… / Your avatar is generated… / in Settings | 109–120 |
| Project successfully deleted / members… deleted / Invite code | Project deleted / the member list, and other project data / Invite Code | 126–128 |
| From the calendars you pick it takes (app.json, en.json) | …you pick, it reads… | 157 |
| Failed to … (17 строк), Error loading | Could not … | 165–181 |
| ... (×7), Don't, device's, participants', everyone's | …, ’ | 189–199 |
| You were added… / A rehearsal’s time changed (примеры онбординга) | You Were Added to a Rehearsal / Rehearsal Time Changed | Доп. 4 |
| All Members (Planner) | All participants | решение 4, вопрос 2 |
| NSReminders*: …never asks for access… | Rehearsly does not use your reminders. | решение 6 |

## Экраны — Español

| Было | Стало | Строка |
|---|---|---|
| …nunca qué son los eventos | ; …nunca el nombre de los eventos | 18 |
| al buscar un hueco | cuando buscan un horario | 19 |
| Ocupados | No disponibles | 20 |
| Sin disponibilidad registrada… Se cuentan como libres | Sin datos de disponibilidad… Quien no marca nada cuenta como libre | 21 |
| No se pudieron eliminar: 1 — esos eventos… | Un evento no se pudo eliminar y sigue… / N eventos no se pudieron… | 22 |
| Propietario | Admin principal | 23, решение 5 |
| “+” → “…” (×4) | «+» → «…» | 25–28 |
| D L M X J V S | Do Lu Ma Mi Ju Vi Sá | 29 |
| Listo (common.done) | OK | 35 |
| Comprueba tu conexión a internet (×2) / Sin conexión con el servidor | Comprueba que tienes internet / No hay conexión con el servidor | 36, 37 |
| El correo no está disponible ahora | Ahora no podemos enviar correos | 38 |
| Si X tiene una cuenta, le hemos enviado… | Si hay una cuenta con X, te enviamos… a esa dirección | 39 |
| Introduce/Introdúcelo (14 мест: экраны и письма) | Escribe/Escríbelo | 40–42, 67–70, 74–75, 84–87 |
| Enviar el código otra vez / los códigos | Reenviar código / códigos | 43, 73 |
| passwordRule, nameInvalid | (72 letras sin tilde; …) / no pueden superar los 100 caracteres | 44, 45 |
| Revísala en Ajustes / en los ajustes del teléfono / Abrir ajustes | la configuración del teléfono / Abrir configuración | 46, 65, 66, решение 5 |
| Hasta entonces… | Mientras no marques nada, los demás te verán libre | 47 |
| — tus marcas (×2) | ; tus marcas | 48, 49 |
| datos de esta fecha (×4) | las marcas de este día | 50–53 |
| no deben solaparse | no pueden superponerse | 54 |
| Analizando disponibilidad... | Viendo quién está libre… | 55 |
| …marcar su tiempo — o prueba… | …marcar sus horas ocupadas. También puedes probar… | 56 |
| Los participantes (1) recibirán un aviso | 1 participante recibirá una notificación | 57 |
| No estás en el reparto | No estás en este ensayo | 58 |
| Vistos: 3 de 5 | Lo han visto: 3 de 5 | 59 |
| Marcar todas / Vaciar / ¿Vaciar las…? | Marcar como leídas / Borrar todo / ¿Borrar todas las…? | 60–62 |
| Cada uno marca cuándo está ocupado | Cada uno marca sus horas ocupadas | 63 |
| No se encontró nada | Sin resultados | 64 |
| Código del correo a X (×2) | Código enviado a X | 71, 72 |
| De los calendarios elegidos (es.json ×2) | De los calendarios que elijas | 76, 77 |
| Cargando... и др. | … | 89 |
| Todos los miembros (Planner) | Todos los participantes | решение 4 |
| NSReminders* | Rehearsly no usa tus recordatorios. | решение 6 |

## Экраны — Deutsch

| Было | Стало | Строка |
|---|---|---|
| Wird geladen... и др. (×7) | Wird geladen … (неразрывный пробел) | 1, 34 |
| Start- und Enddaten / höchstens 1 Tagen | ein gültiges Start- und Enddatum / 1 Tag | 2, 3 |
| Neue Aktion | Was möchtest du tun? | 4 |
| Tritt Rehearsly bei / oder fortfahren mit | Willkommen bei Rehearsly / oder weiter mit | 5, 6 |
| nameInvalid / Die E-Mail kann etwas dauern (×2) | Der Vorname ist erforderlich… dürfen… / Es kann etwas dauern, bis die E-Mail… ankommt | 7, 8, 62 |
| Daten (сегмент) / Ausgewählte Daten | Tage / Ausgewählte Tage | 9, 19, решение 5 |
| Alle Mitglieder (Planner) | Alle Teilnehmer | 10, решение 4 |
| Sie zählen als frei | Wer nichts eingetragen hat, zählt als frei | 11 |
| Probe hinzufügen 18:00 | Probe für 18:00 hinzufügen | 12 |
| Beschäftigte Zeit | Belegte Zeit | 13 |
| Daten … Datum (×4) | Einträge … Tag | 15–18 |
| im Kalender deines Telefons | in deiner Kalender-App | 20 |
| …ihre Zeiten eintragen – oder versuch… | …eintragen, wann sie beschäftigt sind – oder wähle… | 21 |
| Finde die beste Probezeit | Finde die beste Zeit für eine Probe | 22 |
| „X“ löschen, Do…? | „X“ (Do…) löschen? | 23 |
| …aus der Besetzung genommen / Du bist nicht in der Besetzung | …nicht mehr dafür eingeteilt / Du bist nicht eingeteilt | 24, 25 |
| am nächsten Tag | am Folgetag | 26 |
| Teilnehmer (1) werden… | 1 Teilnehmer wird benachrichtigt | 27 |
| Anna: beschäftigt 18:00 / und 1 weitere | Anna: 18:00 beschäftigt / und 1 weitere Person | 28, 29 |
| Keine Projekte, die du verwaltest | …, in denen du Admin bist | 33 |
| Keine verfügbare Zeit für alle… | Keine Zeit, in der alle… frei sind | 35 |
| Proben kommen in den Kalender… nie, was die Termine sind | Proben landen in deiner Kalender-App. Von dort übernimmt Rehearsly nur, wann du beschäftigt bist – nie, wie deine Termine heißen. | 36 |
| Synchronisiert gerade eben | Synchronisiert: gerade eben | 37 |
| vor 1 Tg. / vor 3 Tg. (×2) | gestern / vor 3 Tagen | 38, 39 |
| Alle als gelesen / Leeren / Mitteilungen leeren? / wird leer sein | Alle gelesen / Alle löschen / Alle Mitteilungen löschen? / wird geleert | 40–43 |
| …einrichten (skipMessage) | …ändern | 44 |
| in jedem Kalender / Deine Zeiten / Zeiten | bei allen im Kalender / Deine Verfügbarkeit / Verfügbarkeit | 45, 46, 50 |
| Das Ensemble sieht… | Die anderen im Projekt sehen nur, wann du beschäftigt bist – nie, womit… | 47, Доп., решение 5 |
| Google Calendar / Apple Calendar | Google Kalender / Apple Kalender | 48 |
| Was ist wo | Wo ist was? | 49 |
| Benachrichtigungen (×7), Telefon | Mitteilungen, Gerät / Geräteeinstellungen | 52–59 |
| Alle anderen darin verlieren sie ebenfalls | Auch alle anderen Mitglieder verlieren den Zugriff darauf | 60, Доп. |
| Die bisherige Adresse hat eine Nachricht bekommen | An deine bisherige Adresse haben wir einen Hinweis geschickt | 61 |
| Hier stehen deine Projekte / mit Leuten | Hier erscheinen… / mit Mitgliedern | 63, 64, Доп. |
| Administratorrechte … (×6) | Adminrechte geben / entziehen | 68 |
| Einladung zum Projekt X | …„X“ | 69 |
| NSReminders* | Rehearsly verwendet deine Erinnerungen nicht. | решение 6 |

## Не внесено и почему

1. **de 14** `availability.nextDay` «Folgetag» → «am Folgetag»: это подпись внутри кнопки времени в редакторе
   занятости (полширины строки рядом со временем); ширину на iPhone проверить нечем без нового сценария, правило —
   оставить как есть. В форме репетиции (de 26) короче — внесено.
2. **ru 19, en/de про `profileCalendar.tsx` (VoiceOver)** — правило владельца, не в этой задаче.
3. **ru 61** `monthNamesShort` — нигде не видны (заголовок месяца — полные `monthNames`).
4. **de 30–32, 34 (слово), 65–67, 73** — сняты самим редактором в «Дополнении» по решению 4 (Mitglied для проекта).
5. **en, вопрос 3 (don’t, can’t)** — решение 3: сокращений не вводить.
6. **Часовые пояса** (ru Доп. 4, es §5, de §5) — T-257.
7. **de Доп. 2, «Titel „Durchlauf“ entfernt» со старым названием** — меняет смысл (в пуш нужно передавать прежнее
   название), решение 8 его не требует. Вопрос Вадиму.
8. **ru, вопрос 2 `busyPrefix` «Заняты»** — смысл/вид строки (заголовок списка или подлежащее) — вопрос Вадиму.
9. **ru, вопрос 1 `deleteTitle`, вопрос 7 «по коду» дважды** — вопросы Вадиму, не правки.
10. **Planner, `rehearsals.loadingMembers` / `noMembers`** («Loading members…», «No members in this project») —
    оставлены: говорят о составе проекта, видны вместо строки людей только до загрузки / при пустом проекте.

## Planner: кого считают «All Members» и «All participants · 4» (решение 4)

Оба — одно множество: участники проекта, которых Planner взвешивает для будущей репетиции. «All Members» был
`noneLabel` строки людей (никто не выбран = все), «All participants · 4» — текст той же строки рядом с лицами, а лист
выбора называется «Participants / All participants». Теперь `smartPlanner.allMembers` = «All participants» /
«Todos los participantes» / «Alle Teilnehmer» (ru «Все участники» без изменений). Сценарий 59 показывает это на es.

## Проверки

- Сервер: `rehearsalNoticeText`, `reminderText`, `emailTransport` — 57 красных на старых текстах
  (`server-red-before.txt`), 108/108 зелёных. Весь серверный Jest — зелёный, кроме `startup/runtimeStartup`
  (падает в этой песочнице и на старом коде, как в T-250).
- Клиент: `proofreading.test.ts` + `DayCalendar.locales` — 35 красных на старых строках (`client-red-before.txt`),
  `npx jest --selectProjects frontend` — 1458/1458. `type-check` чисто, `eslint` — 0 ошибок.
- e2e: `e2e-red-before-green-after.txt` — 16 сценариев красные на старых словах одним прогоном каждый со списком всех
  неверных; зелёные на HEAD: 10, 13, 16, 19, 31, 34, 44, 49, 52, 56, 59, 60, 65, 80, 81, 84, 86, 89, а также 06, 11,
  20, 25, 30, 78, 85.
- `check:secrets`, `check:dead`, полный e2e — не прогонялись (супервизор).

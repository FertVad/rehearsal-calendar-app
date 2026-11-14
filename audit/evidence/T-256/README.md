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
| Folgetag (конец ночного слота в редакторе занятости) | am Folgetag | 14 |
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

1. ~~**de 14**~~ — внесено по ревью (см. «Ревью Астры» ниже): ширина проверена сценарием 87, помещается.
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

## Ревью Астры (P2 × 2)

1. **Видимые правки без сценария.** Seed (`e2e/seed.mjs`): у Анны (de) и Кабанихи (es) — репетиция их проекта
   через два дня, на которой их нет («Szene mit Kattrin» — никого; «Сцена с Тихоном» — Тихон); у Анны — ночной
   слот 23:00–01:00 (EVENING_DAY → MORNING_DAY), как у Заречной.
   - 87 (de, Анна): строка календаря «Du bist nicht eingeteilt», заголовок слотов «Belegte Zeit», конец ночного
     слота «am Folgetag».
   - 89 (es, Кабаниха): строка календаря «No estás en este ensayo», значок «Admin principal» в «Гроза».
   Красные одним прогоном на текстах 3b16cd5 (87 — три немецких, 89 — два испанских и два прежних русских), зелёные
   на новых; 56 и 90, где тоже ходит Анна, зелёные. Вывод — `e2e-review-red-before-green-after.txt`.
2. **de 14 «am Folgetag».** Ширину проверил сценарий 87 на iPhone 16 при 12-часовых часах симулятора (длинный
   случай, «1:00 AM»): подпись в одну строку (высота 14 ± 5, в две строки было бы около 29), «…» на снимке нет.
   Правка внесена.

## Ревью Астры, круг 2: покрытие каждой экранной правки

Правило (решение по делегированию, 13.11, 22:40): «ошибка», видная на экране, правка того, что рисует код, и
подписи кнопок, вкладок, чипов и заголовков в de/es — сценарием, красным до; остальные «лучше так» — Jest.

**Jest для всех.** `src/i18n/__tests__/proofreadingEdits.test.ts` (далее **J:строка**) — таблица всех 306 правок
экранов (ключ × язык; функция — с аргументами, по строке на каждую форму числа) и 16 текстов запросов iOS. Для
каждой строки две проверки: новая строка стоит в своём ключе, старой (3b16cd5, колонка «Сейчас» редактора) нет ни
в одном ключе языка. Исключение одно, с причиной в тесте: es «Listo» остаётся в `success` — заголовок «Готово»
после сохранения; правка es 35 касалась только кнопки `common.done`. Таблица снята с разницы переводов
3b16cd5..HEAD, поэтому правок без строки в ней нет. Красный — `jest-edits-red-before.txt`: один прогон,
306 + 16 неверных, каждая по имени.

**Сценарии — дополнены языковые**, новых нет: 59, 60, 86, 87, 89 и `seed.mjs` (Адела es и Каттрин de — новые, не
прошедшие онбординг; у Кабанихи — час из календаря телефона на MORNING_DAY). Каждая проверка пишет неверное слово в
общий список, сценарий падает в конце. Красный — один прогон каждого на `src/i18n/translations` из 3b16cd5,
список — `e2e-review2-red-before-green-after.txt`. «Помещается» — `no-ellipsis.js` по снимку (как с «am Folgetag»).

Сценарий:строка — строка проверки в `e2e/flows/<NN>-….yaml`; «VO» — подпись VoiceOver (Maestro её читает).

### ru

| Ключ (строка редактора) | Чем закреплено |
|---|---|
| common/projects/profile.cancel (16, ошибка) | 89:481, 85:92; J:23, 53, 57 |
| common.loading, calendar.loading, rehearsals.loadingMembers, projects.loadingInvite, smartPlanner.analyzing, calendarSync.checkingPermissions (26) | J:24, 38, 49, 55, 67, 74 (+ typography в proofreading.test) |
| profile.reportBugPlaceholder (26) | 81:43; J:56 |
| common.from / to (28) | J:25, 26 |
| actionSheet.title «Добавить» (27) | 16:72 (VO «+»); J:27 |
| auth.googleAccount…/appleAccount… (34), codeExpired (30), emailUnavailable (31), backToLogin (29), verifySubtitleUnsent (32), timezoneInvalid (33) | J:28–34 |
| auth.noConnection, requestFailed (17, 18, ошибка) | J:35, 36. Сценария нет: показываются только при входе без связи с сервером, ни один сценарий этого не проходит (82 — смена сети, там другая строка) |
| calendar.needProject (40), smartPlannerSubtitle (41), rehearsals.editRehearsal (42) | J:37, 39, 40; 85:86 (editRehearsal) |
| rehearsals.deleteNotifies (43, функция) | 89:537; J:41–43 |
| rehearsals.deleteNotifiedUnknown (44), updateError (46), seenError (48), markSeen (47) | J:44, 46–48 |
| rehearsals.scheduleConflict (45) | 89:589; J:45 |
| projects.joinByCode (59), deleteProjectWarning (60) | J:50, 54 |
| projects.shareInviteMessage / Title (10, 11, ошибка) | J:51, 52; useInviteLink.test.ts. Сценария нет: текст уходит в системный лист «Поделиться» и в чат получателя, экран приложения его не рисует |
| profile.pushDeniedTitle (58), timezoneError, weekStartError (56), emailChanged (57) | J:58–61 |
| availability.addSlot (35), slotsOverlap (36), invalidSlot/fixSlots (37), slotSameStartEnd (38) | J:62–66 |
| smartPlanner.noSlotsMessage (13, ошибка) | J:68. Сценария нет: пустой Planner бывает, только когда в периоде не осталось ни одного окна; в seed такого периода нет, а «сегодня вечером» зависит от часов прогона |
| smartPlanner.slotsCount (39, функция) | 65:72; J:69–71 |
| smartPlanner.unknownAvailability (12, ошибка) | 59:302; J:72 |
| calendarSync.grantPermission, onboarding.…grantPermission (49) | 60:67; J:73, 86 |
| calendarSync.removeAll (50), removeAllConfirm/Success (51) | J:75–77 |
| calendarSync.exportIncomplete (14, ошибка) | J:78. Сценария нет: только при сбое записи в календарь телефона, сценария с таким сбоем нет |
| calendarSync.daysAgo(1) «вчера» (52, функция) | J:79. Сценария нет: нужна последняя синхронизация вчера; телефонное хранилище сценарий не подделывает |
| notifications.markAllRead (53) | J:80 (VO-подпись значка; 86 ждёт её любой из двух) |
| onboarding.skipMessage (54) | J:81 |
| onboarding.notifications.description (15, ошибка), exampleAdded (21) | 60:98, 60:93; J:82, 83 |
| onboarding.calendarSync.google / apple (55) | J:84, 85 (кнопки появляются после доступа; 60 русский доступ отклоняет) |
| NSReminders* (решение 6) | J:337, 338 (системный запрос iOS, не экран приложения) |

### en

| Ключ (строка) | Чем закреплено |
|---|---|
| common.noConnection (18, ошибка) | 10:309, 13:51, 34:46; J:89 |
| common.dateRangeTooLong(1), auth.passwordHint(1) (19, 27, ошибка) | J:91, 94; plurals.test. На экран при 1 не выводятся: maxDays — лимит сервера, minLength — 8 |
| auth.emailUnavailable (28, ошибка) | J:101. Сценария нет: только когда почтовый сервер отказывает |
| availability.understood «OK» (51, ошибка) | 10:238; J:167 |
| calendarSync.removeAllPartial(…, 1) (80, ошибка) | J:180. Сценария нет: только при частичном сбое удаления из календаря телефона |
| notifications.markAllRead (92, ошибка) | 79:32; J:184; регистр — proofreading.test |
| NSCalendars* (157, ошибка), NSReminders* | J:339–342, 349–352; permissionTexts.test. Системный запрос iOS: сценарии выдают доступ при запуске, окна нет |
| common.loading, calendar.loading, rehearsals.loadingMembers, projects.loadingInvite, profile.reportBugPlaceholder, smartPlanner.analyzing, calendarSync.checkingPermissions, dontSave, availabilityChecking, timezoneInvalid, welcome.feature3 (189–199) | J:88, 92, 109, 116, 125, 127, 140, 143, 169, 177, 187; 10:251 (Don’t Save), 47:37 (Describe the issue…) |
| common.selectPeriod, actionSheet.title (20, 21) | 41:104, 11:90; J:90, 93 |
| auth.* (29–45): confirmPasswordPlaceholder, Google/Apple Account, resendIn, codeLocked, rateLimited, emailTakenTitle, emailNotVerified, verifySubtitleUnsent, passwordRule, nameInvalid, resetSubtitle, resetCodeSent, newPassword, otherAddress, noConnection, requestFailed | 49:115, 50:96, 11:50 (resetCodeSent); J:95–115 |
| rehearsals.deleteNotifies (68, функция), deleteNotifiedUnknown (69), rehearsalUpdated (67) | 52:236, 52:220, 52:105; J:117–119, 123 |
| rehearsals.busyAtThisTime, busyAt (70, 71, функции) | 07:91 (busyAt); J:122, 129 |
| rehearsals.notOnRoster (72), noMembers, notFound (73, 74), updateError, loadMembers/AvailabilityError (Failed to…) | 78:34; J:120, 121, 124, 126, 128, 130 |
| projects.* (126–128, Failed to…) | 19:63, 19:74; J:131–140 |
| profile.* (109–120, Failed to…): Change Email, New Email, Current Password, Code sent to, Email Changed, Start Week On, No Results, deleteAccountWarning, avatarHint, pushDeniedMessage | 44:232, 61:110; J:141–159; регистр — proofreading.test:80–83. «Change Email» — «лучше так», значение существующего ключа: Jest (J:153) |
| availability.* (52–59): couldNotLoad, lastLoadedShown, saveError, Busy Time, Already Scheduled, Start/End Time, busyAllDay | 28:48, 26:60, 26:88, 25:164; J:160–168 |
| smartPlanner.noSlots, noSlotsMessage (60), errorLoading | J:170–172. Пустой Planner — см. ru 13 |
| smartPlanner.addRehearsalAt (61, функция), allMembers (решение 4) | 59:240, 07:35; J:173, 174 |
| calendarSync.* (81–86) | 31:67, 31:90, 84:129, 84:139; J:175–179, 181, 182 |
| notifications.empty (93), clearAllConfirmBody (94) | 34:15; J:183, 185 |
| onboarding.* (100–103, Доп. 4) | 09:85, 09:86; J:186, 188–192 |

### es

| Ключ (строка) | Чем закреплено |
|---|---|
| calendarSync.explanation (18, ошибка) | 84:281; J:242 |
| availability.importedNote (19, ошибка) | 89:145; J:231 |
| smartPlanner.busyPrefix (20, ошибка) | 89:256; J:241 |
| smartPlanner.unknownAvailability (21, ошибка) | 59:95; J:239 |
| calendarSync.removeAllPartial (22, ошибка, функция) | J:244, 245. Сценария нет: только при частичном сбое удаления |
| projects.owner (23, ошибка) | 89:223; J:215 |
| onboarding.whatWhere.* (25–28, ошибка) | 60:159, 164, 169, 174; J:250–253 |
| dayNamesShort (29, ошибка) | DayCalendar.locales.test (буквы скрыты от доступности, Maestro их не читает) |
| common.done «OK» (35, кнопка) | 59:168; J:196 |
| smartPlanner.allMembers (решение 4, чип) | 59:188; J:240 |
| notifications.markAllRead (60) / clearAll, clearAllConfirm (61, 62) | 86:200, 86:207; J:246–248 (markAllRead — VO-подпись значка) |
| rehearsals.notOnRoster (58), seenCount (59, функция, VO), deleteNotifies (57, функция) | 89:71, 89:80, 89:106; J:208–211 |
| availability.deleteData (50, кнопка) | 89:176 (с 2-го числа месяца: 1-го прошедших дней в редакторе нет); J:232 |
| availability.deleteDataConfirm, deleteDataMessage, pastDateWarning (50–53) | J:233–235. Заголовок окна UIAlert — iOS переносит его сам |
| auth.resendCode (43), profile.resendCodes (73) | J:198, 227. Кнопки короче прежних («Reenviar código» 15 знаков против 25); экран кода до входа говорит на языке телефона (симулятор — en) |
| profile.openSettings (66) | J:223. Кнопка окна UIAlert «Уведомления не разрешены» — iOS раскладывает её сама; отказ в пушах сценарием не создаётся |
| profile.timezoneNotFound (64), placeholders «Escribe…» (40–42, 67–70, 74, 75) | J:213, 214, 217, 219–221 — «лучше так», текст: Jest. «Escribe el nombre / una descripción» — J:213, 214 |
| остальные «лучше так» (36–39, 44–49, 54–56, 63, 65, 71, 72, 76, 77, 89) | J:194, 195, 197, 199–207, 212, 216, 218, 222, 224–226, 228–230, 236–238, 243, 249; es.json — J:343–346 |

### de

| Ключ (строка) | Чем закреплено |
|---|---|
| smartPlanner.dates «Tage» (9, ошибка, сегмент) | 59:412; J:308 |
| smartPlanner.unknownAvailability (11, ошибка) | 59:381; J:309 |
| smartPlanner.addRehearsalAt (12, ошибка) | 59:375; J:310 |
| availability.busyTime (13, ошибка), nextDay (14) | 87:146, 87:153; J:298, 299 |
| calendar.smartPlannerSubtitle (22, ошибка, кнопка) | 87:65 (+ no-ellipsis по кнопке); J:264 |
| rehearsals.deleteTitle (23, ошибка, функция), deleteNotifies (27, функция) | 89:409, 89:414; J:265–267 |
| rehearsals.notFound (24, ошибка) | J:274. Сценария нет: экран «Probe nicht verfügbar» ни один сценарий не открывает по-немецки (и по-английски) |
| calendarSync.explanation (36, ошибка) | 84:343; J:312 |
| notifications.clearAllConfirm (42, ошибка), clearAll (41), clearAllConfirmBody (43) | 86:334, 86:346, 86:339; J:318–320 |
| actionSheet.title (4) | 87:113 (VO «+»: у листа нет заголовка, рисовать нечего); J:258 |
| rehearsals.notOnRoster (25), endsNextDay (26) | 87:102; J:268, 269 |
| smartPlanner.allMembers (10, чип) | 59:440 (+ no-ellipsis); J:311 |
| availability.selectedDates (19, заголовок, функция) | 87:186 (+ no-ellipsis); J:305 |
| availability.deleteData (15–18, кнопка) | 87:229 (с 2-го числа месяца); J:301 |
| availability.deleteDataConfirm, deleteDataMessage, pastDateWarning (15–18) | J:302–304 (UIAlert / текст) |
| projects.makeAdmin, makeAdminConfirm, makeAdminMessage (68, пункт листа и окно) | 89:351, 89:369; J:279, 281, 282 |
| projects.removeAdmin, removeAdminConfirm, removeAdminMessage (68) | J:280, 283, 284. Пункт виден только у участника-администратора; в 89 назначение меняло бы удаление аккаунта Кабанихи («единственный администратор»), а прогон с назначением и снятием не укладывался в 10 минут. «Adminrechte entziehen» короче прежнего «Administratorrechte entfernen» |
| profile.notifications «Mitteilungen» (52) | 86:261 (вкладка ищется по нему); J:286 |
| profile.push* (53–59), pushDeniedTitle | J:289–295 (окна UIAlert и строки при отказе в пушах — отказ сценарием не создаётся) |
| onboarding.calendarSync.title (46), apple (48), whatWhere.title (49), availability (50) | 60:210, 60:215, 60:243, 60:248 (+ no-ellipsis); J:325, 328, 331, 332 |
| onboarding.calendarSync.google (48) | J:327. В симуляторе нет аккаунта Google — кнопки нет |
| auth.registerSubtitle (5), orContinueWith (6) | J:259, 260. Экраны до входа говорят на языке телефона (симулятор — en) |
| rehearsals.andMore(1) (29, функция) | J:273. В немецкой форме нет двух занятых сразу ни в одном сценарии |
| calendarSync.daysAgo / notifications.daysAgo (38, 39, функции) | J:315, 316, 321. Синхронизации и уведомлений старше суток в seed нет |
| calendarSync.syncedAgo (37, функция) | 84:332; J:314 |
| notifications.markAllRead (40), onboarding.notifications.exampleAdded (51) | 86:262 (VO), 86:271; J:317, 324 |
| projects.shareInviteTitle (69) | J:278 (системный лист «Поделиться») |
| остальные «лучше так» (1–3, 7, 8, 20, 21, 33–35, 44, 45, 47, 60–64, Доп.) | J:255–257, 261–263, 270–272, 275–277, 285, 287, 288, 296, 297, 300, 306, 307, 313, 322, 323, 326, 330; de.json — J:347, 348 |

### Примеры ревьюера

- en «Change Email» — значение существующего ключа, обычная подпись: J:153 (+ Title Case — proofreading.test:80).
- es «Escribe el nombre / una descripción» — плейсхолдеры: J:213, 214.
- de «Adminrechte geben / entziehen» — пункт листа «Mitglied verwalten» и кнопка окна: «geben» — сценарий 89:351,
  369 (помещается, no-ellipsis); «entziehen» — J:280, 283, 284 (причина выше).
- ru предупреждение об удалении проекта — J:54.

### Проверки круга 2

- Jest: `proofreadingEdits.test.ts` — 5/5 зелёные на HEAD; красный — `jest-edits-red-before.txt`.
- e2e, красные одним прогоном на старых текстах и зелёные на HEAD: 59, 60, 86, 87, 89 —
  `e2e-review2-red-before-green-after.txt`.

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
| Anna: beschäftigt 18:00 / und 1 weitere | Anna: 18:00 beschäftigt / und 1 weiterer (T-258; у редактора «und 1 weitere Person» — обрезалось) | 28, 29 |
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
| common/projects/profile.cancel (16, ошибка) | 89:525, 85:92; J:23, 53, 57 |
| common.loading, calendar.loading, rehearsals.loadingMembers, projects.loadingInvite, smartPlanner.analyzing, calendarSync.checkingPermissions (26) | J:24, 38, 49, 55, 67, 74 (+ typography в proofreading.test) |
| profile.reportBugPlaceholder (26) | 81:43; J:56 |
| common.from / to (28) | J:25, 26 |
| actionSheet.title «Добавить» (27) | 16:72 (VO «+»); J:27 |
| auth.googleAccount…/appleAccount… (34), codeExpired (30), emailUnavailable (31), backToLogin (29), verifySubtitleUnsent (32), timezoneInvalid (33) | J:28–34 |
| auth.noConnection, requestFailed (17, 18, ошибка) | 93:125, 93:147; J:35, 36 (вход по-русски после выхода русского аккаунта: запрос входа обрывается — DROP; затем 400 без кода — FAIL) |
| calendar.needProject (40), smartPlannerSubtitle (41), rehearsals.editRehearsal (42) | J:37, 39, 40; 85:86 (editRehearsal) |
| rehearsals.deleteNotifies (43, функция) | 89:581; J:41–43 |
| rehearsals.deleteNotifiedUnknown (44), updateError (46), seenError (48), markSeen (47) | J:44, 46–48 |
| rehearsals.scheduleConflict (45) | 89:633; J:45 |
| projects.joinByCode (59), deleteProjectWarning (60) | J:50, 54 |
| projects.shareInviteMessage / Title (10, 11, ошибка) | J:51, 52; useInviteLink.test.ts. Сценария нет: текст уходит в системный лист «Поделиться» и в чат получателя, экран приложения его не рисует |
| profile.pushDeniedTitle (58), timezoneError, weekStartError (56), emailChanged (57) | J:58–61 |
| availability.addSlot (35), slotsOverlap (36), invalidSlot/fixSlots (37), slotSameStartEnd (38) | J:62–66 |
| smartPlanner.noSlotsMessage (13, ошибка) | 92:83; J:68 (профиль переведён в пояс, где сейчас 22:45–23:44 — late-evening.js; период — один сегодняшний день) |
| smartPlanner.slotsCount (39, функция) | 65:72; J:69–71 |
| smartPlanner.unknownAvailability (12, ошибка) | 59:302; J:72 |
| calendarSync.grantPermission, onboarding.…grantPermission (49) | 60:67; J:73, 86 |
| calendarSync.removeAll (50), removeAllConfirm/Success (51) | J:75–77 |
| calendarSync.exportIncomplete (14, ошибка) | 92:123; J:78 (календарь телефона не принимает «Трактир» — e2e/device/expo-calendar.js) |
| calendarSync.daysAgo(1) «вчера» (52, функция) | J:79; formatLastSync.test:41–48 («Синхронизировано вчера», красный на 3b16cd5: «1 дн. назад»). Время последней синхронизации пишет телефон; «вчера» появляется, только когда сдвинулись часы — docs/e2e.md: такое закрепляет Jest |
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
| auth.emailUnavailable (28, ошибка) | 93:73; J:101 (сброс пароля получает ответ сервера при недоступной почте: 503 EMAIL_UNAVAILABLE — FAIL) |
| availability.understood «OK» (51, ошибка) | 10:238; J:167 |
| calendarSync.removeAllPartial(…, 1) (80, ошибка) | 92:188; J:180 (календарь телефона не отдаёт «Святки») |
| notifications.markAllRead (92, ошибка) | 79:32; J:184; регистр — proofreading.test |
| NSCalendars* (157, ошибка), NSReminders* | J:339–342, 349–352; permissionTexts.test. Системный запрос iOS: сценарии выдают доступ при запуске, окна нет |
| common.loading, calendar.loading, rehearsals.loadingMembers, projects.loadingInvite, profile.reportBugPlaceholder, smartPlanner.analyzing, calendarSync.checkingPermissions, dontSave, availabilityChecking, timezoneInvalid, welcome.feature3 (189–199) | J:88, 92, 109, 116, 125, 127, 140, 143, 169, 177, 187; 10:251 (Don’t Save), 47:37 (Describe the issue…) |
| common.selectPeriod, actionSheet.title (20, 21) | 41:104, 11:90; J:90, 93 |
| auth.resendIn (функция) | 96:140 (кнопка после отправки кодов смены почты: «… in N seconds», «1 second»); J:98, 99 |
| auth.rateLimited (функция) | 96:181 (коды запрошены снова в ту же минуту — сервер отказывает: «Wait N seconds and try again.»); J:102, 103 |
| auth.* (29–45): confirmPasswordPlaceholder, Google/Apple Account, codeLocked, emailTakenTitle, emailNotVerified, verifySubtitleUnsent, passwordRule, nameInvalid, resetSubtitle, resetCodeSent, newPassword, otherAddress, noConnection, requestFailed | 49:115, 50:96, 11:50 (resetCodeSent); J:95–115 |
| rehearsals.deleteNotifies (68, функция), deleteNotifiedUnknown (69), rehearsalUpdated (67) | 52:236, 52:220, 52:105; J:117–119, 123 |
| rehearsals.busyAtThisTime (70, функция; изменена ветка двух и больше) | 96:76 (сохранение над двумя занятыми: «Busy at this time: Bob Acres, Lucius OTrigger»); 07:131 — ветка одного, не менялась; J:122 |
| rehearsals.busyAt (71, функция) | 07:91; J:129 |
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
| availability.importedNote (19, ошибка) | 89:146; J:231 |
| smartPlanner.busyPrefix (20, ошибка; с T-258 — по числу: «No disponible» / «No disponibles») | 89:293 («No disponible» — один занятый; приведено к T-258 15.11, e2e-supervisor-run-15-11.txt); 59 (T-258, один занятый); J:241 (обе формы) |
| smartPlanner.unknownAvailability (21, ошибка) | 59:95; J:239 |
| calendarSync.removeAllPartial (22, ошибка, функция) | 92:251 (форма с одним событием); J:244, 245 |
| projects.owner (23, ошибка) | 89:260; J:215 |
| onboarding.whatWhere.* (25–28, ошибка) | 60:159, 164, 169, 174; J:250–253 |
| dayNamesShort (29, ошибка) | DayCalendar.locales.test (буквы скрыты от доступности, Maestro их не читает) |
| common.done «OK» (35, кнопка) | 59:168; J:196 |
| smartPlanner.allMembers (решение 4, чип) | 59:188; J:240 |
| notifications.markAllRead (60) / clearAll, clearAllConfirm (61, 62) | 86:200, 86:207; J:246–248 (markAllRead — VO-подпись значка) |
| rehearsals.notOnRoster (58), seenCount (59, функция, VO), deleteNotifies (57, функция) | 89:72, 89:81, 89:107; J:208–211 |
| availability.deleteData (50, кнопка) | 89:177 (с 2-го числа месяца: 1-го прошедших дней в редакторе нет); J:232 |
| availability.deleteDataConfirm, deleteDataMessage (50–53) | 89:197, 89:202 (+ no-ellipsis 89:214, окно открыто кнопкой прошедшего дня); J:233, 234 |
| availability.pastDateWarning (50–53) | J:235 («лучше так», текст) |
| auth.resendCode (43), profile.resendCodes (73) | 94:126, 94:193 (+ no-ellipsis 94:138, 94:205: после минуты ожидания; экран входа по-испански — после выхода испанского аккаунта); J:198, 227 |
| profile.openSettings (66) | 94:63 (+ no-ellipsis 94:75: телефон, где отказали в уведомлениях — rehearslyPushDevice "denied"); J:223 |
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
| rehearsals.deleteTitle (23, ошибка, функция), deleteNotifies (27, функция) | 89:453, 89:458; J:265–267 |
| rehearsals.notFound (24, ошибка) | 95:136 (ссылка на репетицию чужого проекта — сервер отвечает 404); J:274 |
| calendarSync.explanation (36, ошибка) | 84:343; J:312 |
| notifications.clearAllConfirm (42, ошибка), clearAll (41), clearAllConfirmBody (43) | 86:334, 86:346, 86:339; J:318–320 |
| actionSheet.title (4) | 87:113 (VO «+»: у листа нет заголовка, рисовать нечего); J:258 |
| rehearsals.notOnRoster (25), endsNextDay (26) | 87:102; J:268, 269 |
| smartPlanner.allMembers (10, чип) | 59:440 (+ no-ellipsis); J:311 |
| availability.selectedDates (19, заголовок, функция) | 87:186 (+ no-ellipsis); J:305 |
| availability.deleteData (15–18, кнопка) | 87:229 (с 2-го числа месяца); J:301 |
| availability.deleteDataConfirm, deleteDataMessage (15–18) | 87:249, 87:254 (+ no-ellipsis 87:266); J:302, 303 |
| availability.pastDateWarning (15–18) | J:304 («лучше так», текст) |
| projects.makeAdmin, makeAdminConfirm, makeAdminMessage (68, пункт листа и окно) | 89:388, 89:406 (заголовок окна целиком: старый «Administratorrechte geben?» теперь в списке ошибок), 89:413; J:279, 281, 282 |
| projects.removeAdmin, removeAdminConfirm, removeAdminMessage (68) | 95:83 (+ no-ellipsis 95:90), 95:105, 95:110 (Wang — администратор проекта Шен Те); J:280, 283, 284 |
| profile.notifications «Mitteilungen» (52) | 86:261 (вкладка ищется по нему); J:286 |
| profile.pushDeniedTitle (заголовок окна) | 94:109 (окно отказа открыто и на немецком: «Mitteilungen sind nicht erlaubt» целиком, + no-ellipsis 94:116); J:290 |
| profile.push* (53–59), кроме pushDeniedTitle | J:289, 291–295 («лучше так», новые значения существующих ключей в тексте окна и строк профиля) |
| onboarding.calendarSync.title (46), apple (48), whatWhere.title (49), availability (50) | 60:210, 60:215, 60:243, 60:248 (+ no-ellipsis); J:325, 328, 331, 332 |
| onboarding.calendarSync.google (48) | J:327. Без сценария (решение по делегированию 14.11, пункт 5): кнопка появляется, только если у календаря телефона источник с «google»/«gmail» в имени (`getCalendarProvider`, `CalendarSyncScreen.tsx`); аккаунт Google в симуляторе не завести — ограничение стенда, а не пробел сида |
| auth.registerSubtitle (5), orContinueWith (6) | J:259, 260. Экраны до входа говорят на языке телефона (симулятор — en) |
| rehearsals.andMore(1) (29, функция) | 95:172 (форма из Planner на завтра 10:00: заняты Wang и Yang Sun; «… beschäftigt und 1 weiterer» точно до конца) + no-ellipsis 95:179; J:273. Строка T-258, окончательная |
| notifications.daysAgo (39, функция) | 95:211 (уведомление Шен Те трёхдневной давности: «vor 3 Tagen»); J:321 |
| calendarSync.daysAgo (38, функция) | J:315, 316; formatLastSync.test:41–48 («Synchronisiert: gestern») и :56 («vor 2 Tagen»), красные на 3b16cd5. Время последней синхронизации пишет телефон; «gestern» появляется, только когда сдвинулись часы — docs/e2e.md: такое закрепляет Jest |
| calendarSync.syncedAgo (37, функция) | 84:332; J:314 |
| notifications.markAllRead (40), onboarding.notifications.exampleAdded (51) | 86:262 (VO), 86:271; J:317, 324 |
| projects.shareInviteTitle (69) | J:278 (системный лист «Поделиться») |
| остальные «лучше так» (1–3, 7, 8, 20, 21, 33–35, 44, 45, 47, 60–64, Доп.) | J:255–257, 261–263, 270–272, 275–277, 285, 287, 288, 296, 297, 300, 306, 307, 313, 322, 323, 326, 330; de.json — J:347, 348 |

### Примеры ревьюера

- en «Change Email» — значение существующего ключа, обычная подпись: J:153 (+ Title Case — proofreading.test:80).
- es «Escribe el nombre / una descripción» — плейсхолдеры: J:213, 214.
- de «Adminrechte geben / entziehen» — пункт листа «Mitglied verwalten» и окно: «geben» — сценарий 89:388 (пункт,
  помещается), 89:406 (заголовок окна), 89:413 (текст окна); «entziehen» — 95:83 (пункт, + no-ellipsis 95:90),
  95:105, 95:110 (окно).
- ru предупреждение об удалении проекта — J:54.

### Проверки круга 2

- Jest: `proofreadingEdits.test.ts` — 5/5 зелёные на HEAD; красный — `jest-edits-red-before.txt`.
- e2e, красные одним прогоном на старых текстах и зелёные на HEAD: 59, 60, 86, 87, 89 —
  `e2e-review2-red-before-green-after.txt`.

## Ревью Астры, круг 3: оставшиеся экранные правки — сценарием

Замечание 1 (ошибки и функции без сценария) и 2 (кнопки и заголовки de/es, старый заголовок в 89) закрыты: у
каждой строки выше, где стояло «Сценария нет», теперь сценарий:строка. Состояния, которых в стенде не было:

- **Сбой, который сервер даёт в недостижимом стенду состоянии** — `hold-answers.js` с `FAIL` (статус, `CODE`,
  `ERROR`): запрос не доходит до сервера, ответ — как сервер отвечает сам. Почта недоступна: `503
  EMAIL_UNAVAILABLE` (passwordReset.js); ответ без кода: `400` (93).
- **Календарь телефона отказывает** — `e2e/device/expo-calendar.js` подставляется вместо `expo-calendar` только в
  e2e-сборке (как `expo-device`/`expo-notifications`): по аргументу запуска не пишет событие с одним названием и
  не удаляет с другим, как iOS с календарём «только для чтения». Сбои серверных привязок экспорт проглатывает,
  так что других путей к «не удалось записать/удалить» нет (92). В коде приложения крючков нет; кнопке «удалить
  всё» добавлен только `testID`.
- **Телефон, где отказали в уведомлениях** — `rehearslyPushDevice: "denied"` (94).
- **Пустой Planner** — `late-evening.js` переводит профиль в пояс, где сейчас 22:45–23:44; период — один этот
  день, рабочий день Planner кончается в 23:00 (92).
- **Экраны до входа на ru/es** — язык последнего вошедшего аккаунта: вход и выход (93, 94).
- **Репетиция «не найдена»** — ссылка на репетицию чужого проекта, сервер отвечает 404 (95).
- **Двое занятых сразу, уведомление старше суток, администратор-участник** — новые люди seed: Шен Те с Wang
  (админ), Yang Sun, Shu Fu (95); Торцов (92), Глумов (93), Ерма (94).

Заголовок «Adminrechte geben?» в 89 теперь читается целиком (89:406): на старых текстах он в общем списке.
Окно удаления отметок прошедшего дня — de 87:249/254, es 89:197/202, оба + no-ellipsis. «Помещается» в
сценариях 87, 89, 94, 95 — `no-ellipsis.js` с `RECORD`: обрезка попадает в общий список, а не обрывает прогон.

Красный и зелёный — `e2e-review3-red-before-green-after.txt`: 92, 93, 94, 95 (новые), 87, 89 — каждый одним
прогоном на `src/i18n/translations` из 3b16cd5 называет все неверные слова; на HEAD зелёные.

### Не внесено / вопросы круга 3

- **de 29 `andMore(1)` «und 1 weitere Person»** — внесено (ошибка редактора: «weitere» без существительного).
  Строка о занятых в форме однострочная по замыслу (полный список — в листе участников) и на немецком телефоне
  (24 ч) обрезается: «Wasser: 10:00–14:00 beschäftigt und 1 weitere Per…» (`95-two-busy-de`). Старое «und 1
  weitere» помещалось с фамилией из шести букв и обрезалось с более длинной. Это не кнопка, вкладка, чип или
  заголовок; сценарий читает слова целиком и обрезку не проверяет. Вопрос Вадиму: короче по-немецки (например,
  «und noch 1») — решает носитель. **Закрыто T-258:** носитель выбрал «und 1 weiterer»; строка взята из T-258,
  сценарий 95 читает её точно и проверяет обрезку (см. круг 4).
- **ru 52 / de 38 `calendarSync.daysAgo`** — без сценария по правилу docs/e2e.md о часах (см. строки таблиц).

## Круг 4 (14.11): перенос поверх T-258 и пять пунктов reviews/T-256-r2.md

**Перенос.** 12 коммитов auto/deferred/T-256 перенесены `cherry-pick -x` поверх 9b29497 (T-258). Конфликты — по
смыслу: `availability.ts` (es `busyPrefix` — функция T-258), `calendar.ts` (de `busyAt` — T-256, `andMore` — T-258),
сценарий 59 (оба описания и обе проверки в одном списке), `seed.mjs` (одно описание Шен Те, Wang, Yang Sun, Shu Fu
и «Der gute Mensch»; занятость Wang и Yang Sun — один раз; к ним добавлены Торцов, Глумов, Ерма, час Кабанихи),
сценарий 95 (одна версия: админские права, недоступная репетиция, «vor 3 Tagen» и строка занятых, как её
проверяет T-258 — точное совпадение «… beschäftigt und 1 weiterer» и `no-ellipsis.js`). Из T-258 взяты: de
`rehearsals.andMore(1)` «und 1 weiterer», `smartPlanner.busyPrefix` по числу (ru «Не может / Не могут», es «No
disponible / No disponibles», en «Busy», de «Beschäftigt»), ru `onboarding.whatWhere.projectWhere` «По
приглашению: …». `proofreading.test.ts` и `proofreadingEdits.test.ts` приведены к ним (сравнение точное: «und 1
weiterer» содержит «und 1 weitere»). Сценарии T-258 после переноса зелёные: 59, 60, 95.

**Пункты.**

| # | Ключ | Чем закреплено |
|---|---|---|
| 1 | en `auth.resendIn` | 96:140 — смена почты Лидии: после отправки кодов кнопка «You can ask for a new code in N seconds» / «1 second»; J:98, 99 |
| 2 | en `auth.rateLimited` | 96:181 — коды запрошены снова в ту же минуту (экран закрыт и открыт заново): сервер отказывает по лимиту одного человека (`issueCode`, 429 `RATE_LIMITED`, `retryAfter`) — один запрос, общий лимит `/api/auth/*` не задет; J:102, 103 |
| 3 | en `rehearsals.busyAtThisTime`, двое и больше | 96:76 — Лидия сохраняет репетицию из Planner на завтра 10:00, заняты Bob Acres и Lucius OTrigger: «Busy at this time: …»; J:122. Ветка одного — 07:131, не менялась |
| 4 | de `profile.pushDeniedTitle` | 94:109 — окно отказа из 94 открыто и на немецком (язык Ермы переключён на Deutsch и обратно), заголовок «Mitteilungen sind nicht erlaubt» целиком; обрезка — no-ellipsis 94:116; J:290 |
| 5 | de `onboarding.calendarSync.google` | J:327, без сценария: кнопка появляется, только если у календаря телефона источник Google (`getCalendarProvider`, `CalendarSyncScreen.tsx`); аккаунт Google в симуляторе не завести — ограничение стенда (решение по делегированию 14.11) |

Сид: новые люди Lydia Languish (en), Bob Acres, Lucius OTrigger и проект «The Rivals»; Acres и OTrigger заняты
завтра 10:00–14:00. Сценарий 96 новый; 94 дополнен немецким окном.

**Красное до** — `e2e-review4-red-before-green-after.txt`: один прогон каждого сценария на `auth.ts`,
`calendar.ts`, `profile.ts` из 9b29497 (до переноса T-256): 96 называет все три английские формы, 94 — немецкий
заголовок (и прежние испанские слова тех же файлов). На HEAD 94 и 96 зелёные.

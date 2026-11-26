# T-406 — for the native speakers' reading (ru, es, de; en for reference)

Every new string is marked in the code with
`// T-406: new, for the native speakers' reading.` Nothing here was read by a
native speaker yet; the wording is Claude's. Replies as `T-406-natives-<lang>.md`.

The feature: a person's weekends — the days off of the country of their
profile's time zone (Israel: Fri and Sat; Russia: Sat and Sun) — are marked
busy by default. A switch in the Profile, right under "Start Week On", turns
it off and on. The onboarding asks about it outright right after the greeting.
In the availability editor a weekend day busy by default says so.

`{days}` is the days' short names from the app's date formats, joined by the
language's "and": "пт и сб", "Fri and Sat", "vie y sáb", "Fr und Sa".
`{path}` is "Profile → Weekends Busy" in the language's own labels.

## Profile (src/i18n/translations/profile.ts)

| key | en | ru | es | de |
|---|---|---|---|---|
| weekendsBusy — the switch's label | Weekends Busy | Выходные заняты | Fines de semana ocupados | Wochenenden belegt |
| weekendsBusyDays — under it | Your weekend: {days} | Ваши выходные: {days} | Tu fin de semana: {days} | Dein Wochenende: {days} |
| weekendDaysJoin — the "and" | and | и | y | und |
| weekendsBusyError — the switch could not be saved | Could not change the weekends | Не удалось изменить выходные | No se pudieron cambiar los fines de semana | Die Wochenenden konnten nicht geändert werden |

## Onboarding, the step after the greeting (onboarding.ts, `weekends`)

| key | en | ru | es | de |
|---|---|---|---|---|
| question — the title | Mark all weekends ({days}) as busy? | Отметить все выходные ({days}) как занятые? | ¿Marcar todos los fines de semana ({days}) como ocupados? | Alle Wochenenden ({days}) als belegt markieren? |
| description | Then the planner will count your weekends as busy. Any single day can be changed in Availability. | Тогда в подборе времени ваши выходные будут заняты. Любой отдельный день можно поменять в «Занятости». | Así, al buscar un horario, tus fines de semana contarán como ocupados. Cualquier día suelto se puede cambiar en Disponibilidad. | Dann gelten deine Wochenenden bei der Terminsuche als belegt. Jeden einzelnen Tag kannst du unter Verfügbarkeit ändern. |
| note — under the question | You can turn this on or off later in {path} | Это можно включить и выключить позже: {path} | Puedes activarlo o desactivarlo más tarde en {path} | Du kannst das später unter {path} ein- oder ausschalten |
| yes — the main button | Yes, Mark Them | Да, отметить | Sí, marcarlos | Ja, markieren |
| no — the button above the bar | No, Leave Them Free | Нет, оставить свободными | No, dejarlos libres | Nein, frei lassen |

Questions for the editors: is "Weekends Busy" (and its translations) a good
label for a switch whose meaning is "mark my weekends busy by default"? Does
the description need the planner at all? Spanish: "fin de semana" for a Friday
and Saturday weekend (Israel) — natural, or "días de descanso"?

## Availability editor (availability.ts)

| key | en | ru | es | de |
|---|---|---|---|---|
| weekendDefault — on a weekend busy by default | Weekend: busy by default. Change it like any other day, or turn the default off in {path} | Выходной: занят по умолчанию. Его можно поменять, как любой день, а отметку по умолчанию выключить: {path} | Fin de semana: ocupado por defecto. Cámbialo como cualquier otro día o desactiva esta opción en {path} | Wochenende: standardmäßig belegt. Ändere ihn wie jeden anderen Tag oder schalte das unter {path} aus |

## Privacy policy (server/public/privacy.html), revised 25.11.2026

In each language, three places (the tests are `server/__tests__/utils/privacyWeekends.test.js`):

1. "What we collect", the time zone row: now also "whether your weekends are
   marked busy by default", and its purpose "your time zone also tells which
   days are your weekend".
2. The availability row: "Your weekends are marked busy by default: the days
   off of the country of your time zone, a year ahead, except days you mark
   yourself"; "When" — "As you mark them; the weekends by the app, unless you
   turn this off" (was "As you mark them").
3. "Your rights": "Stop marking your weekends busy — Profile → Weekends Busy.
   This removes the weekends marked by default from today on; days you marked
   yourself stay."

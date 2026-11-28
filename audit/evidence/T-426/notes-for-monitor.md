# T-426: what the monitor should look at with the editor

**The report.** `AUTODEV/notes/T-425-natives-ru.md` is outside this worktree (not readable
from it). `natives-ru.md` here is a copy of `audit/evidence/T-425/natives-ru.md`, the same
report (T-425…T-428, the editor's final after two rounds, its T-426 section word for word
the owner's note); `git diff --no-index` finds no difference. The strings are copied
from it word for word, ⍽ as U+00A0 (`typeset()` in `dashboard.js`, `&nbsp;` in
`dashboardPage.js`). None was changed.

Where the code and a string could part — none found that needs a change; for the record:

1. **«Календарь подключён»** is `fact.calendar` (`services/admin/people.js`): a row with the
   source `apple_calendar` / `google_calendar`, or a `native_calendar_connections` row (made by
   the first export, never deleted). Matches the funnel's note, the projects' note and the
   users note («записи об⍽экспорте остаются и⍽после выключения синхронизации»).
2. **The median to the calendar** is the earliest `created_at` among the connection rows and
   the imported rows still kept — «до⍽самой ранней из⍽хранящихся записей: первого экспорта
   репетиций или импортированной занятости». A person changing the phone calendar gets a
   second connection row; the earliest one stays, so it is still the first export.
3. **«Ручные отметки»** are rows with the source `manual` only; `weekend` (017) and
   `rehearsal` are neither step — as the note says («выходные, занятые по⍽умолчанию,
   и⍽события из⍽календаря не в⍽счёт»).
4. **Users table.** «ручных отметок: {N}» and «отметок из⍽календаря: {M}» count every row
   kept, past ones too (as «отметок» did); «по⍽{дата}» is the last date the hand marks
   reach — an import reaching further no longer moves it.
5. **«Проекты», «Календарь подключён»** — of the same members as «Участников» and
   «Покрытие занятости» (the «Источник» and «Язык» filters), «X из Y (Z⍽%)».
6. **«Покрытие занятости»** — the number is unchanged (still `MARK_SOURCES`: manual and
   both calendars; weekends were already left out); only the note is the editor's new one.
7. The cohort's two rows stand where the editor's T-425 list puts them, after «В проекте»;
   the T-427 rows between «Создали проект» and «В проекте» are still not there (T-427).

**API names** (English, as the API names it): funnel steps `calendar`, `manual` (was
`marks`); medians `toCalendarHours/Of`, `toManualHours/Of` (was `toMarksHours/Of`); cohort
columns `calendar`, `manual`; users `steps.manualMarks`, `steps.calendarMarks` (was
`steps.marks`), `marksUntil` by hand marks; projects `calendar: { people, of, rate }`.
The page ships with the server, so the old and new names never meet.

**Not the task's, seen on the way.** `__tests__/startup/runtimeStartup.test.js` fails 8 of 11
here, the same on the base code (`import-failed` of the copied server) — the machine, not
this change. ESLint (`npm run lint`) covers `src/` only, not the server.

**No Maestro flow**: the admin is a web page, not the app; the on-screen part is the
browser tests (`browser-red-before.txt`).

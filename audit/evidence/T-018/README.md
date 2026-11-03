# T-018 — the rehearsal form: errors under the fields, the date on a month, Save after a change

Base `1075f17`. Fix `896e11f`, flows `d42ffa2`.

| Point | What changed | Proved by |
|---|---|---|
| 1 Errors under the fields | `useAddRehearsalSubmit` holds `issues` from the conditions `canSubmit` reads: no project (under the project), an end at the start (under the end), the members failed to load, the day's availability on its way or failed (under the participants; a failure with Retry). Said as soon as it is so; Create is not offered while any holds; `handleSubmit` stops on them without an alert. Members still loading: the participants row already says so. The conflict check on save is untouched (T-010) | `AddRehearsalScreen.test.tsx`, `useAddRehearsalSubmit.test.ts`; flows 26 (end), 20 (availability) |
| 2 Date on a month | `DayCalendar`: react-native-calendars `Calendar` in the form, opened and closed by the date row. Week from `useWeekStart`, today from `useToday` (the phone's date unmarked, `withToday`). Days before today marked disabled with no touch, but the edited rehearsal's own (`savedDate`), which stays shown and chosen. The row names the weekday (`formatDisplayDate`). The date's wheels are gone. What it shares with `DateRangePicker` moved to `profileCalendar.tsx` | screen tests (the library's own Day drawn from the form's marks: a past day's touchable is disabled); flow 55 |
| 3 Save after a change | In an edit the button is disabled while `form.hasChanges` is false — T-013's mark | screen test; flow 52 |
| 4 | Field order unchanged; the close button untouched | — |

Not done (owner, 30.10): VoiceOver. The single chosen day keeps the period
picker's day labels.

Flow 54 saved an edit with nothing changed (10:07 kept); that Save is no longer
offered, so it changes the place and still checks the 10:07.

`participantsLoading` (an alert text) is gone; `availabilityChecking` lost
"Wait a moment and save again", since there is nothing to press.

Files: `jest-red-before.txt`, `e2e-red-before.txt`, `green-after.txt`.

Review r1 [P2]: the month threw in Spanish and German — `profileCalendar.tsx`
had the library's words for `ru` and `en` only, and both calendars set the
app's language as its default. `calendarLocales` is now a
`Record<Language, …>`, registered for all four. Red on 882c4d5 and green on
a16d601: `DayCalendar.locales.test.tsx` (the real library's month, every
language) and flow 56 (Spanish and German profiles open the form's month).
File: `review-r1-locales.txt`.

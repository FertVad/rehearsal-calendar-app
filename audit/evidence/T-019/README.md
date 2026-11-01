# T-019 — the calendar: header, strip of days, month

Base `c353ad1`. Fix and flow `39e17db`.

| Point | What changed | Proved by |
|---|---|---|
| 1 Empty "Today" hidden | `TodayRehearsals` returns nothing on a day with no rehearsals (not loading); the upcoming list stays. `calendar.noRehearsals` gone from the four languages | `TodayRehearsals.test.tsx`; flow 57 (screenshots) |
| 2 72 pt strip, days ≥ 44 | The strip is 72 pt; a day 48 wide (44 on any screen, 49's 50±6) | `WeeklyCalendar.test.tsx`; flow 49 |
| 3 Selected day in the middle | `WeeklyCalendar` is a FlatList of days (a year each side of today), padded by half the strip less half a day, so the day at `index` is in the middle at offset `index × 48`; `snapToInterval` 48. The selected day is scrolled there whenever it changes (tap, "Today", month); where a swipe stops (`onMomentumScrollEnd`, or a drag let go on a day) the day in the middle is selected. Count under the date kept. The week's first day no longer in the strip | `WeeklyCalendar.test.tsx` (tap at the edge, swipe, "Today", opens centred); flows 57, 41 |
| 4 Month by its name | The month name (`calendar-month`) opens `DayCalendar` under the header: `firstDay` from `useWeekStart`, today from `useToday`, rehearsal days dotted (`dotted`), the past open (`pastOpen`), bounded by the strip's days. A pick selects, closes, centres; the name again closes | `WeeklyCalendar.test.tsx`; flow 57 |
| 5 Smart Planner | Unchanged, under the calendar | — |

Day labels for VoiceOver unchanged (owner): the cell's texts are as before.

Flow 57 (`tags: calendar`), Telegin (new in the seed, one project of his own):
"Tea on the terrace" today, "Guitar tuning" three days on (the strip's right
edge with today in the middle), "Tree planting" twelve days off in this month.
After the edge day, "Today" and a day picked in the month, it taps the
strip's middle (`tapOn id: calendar-strip, point: 50%,50%`): the day stays
selected only if it is the one in the middle.

Red before: the four source files at `c353ad1` (`git restore --source=c353ad1`),
the new tests and flow in place. Jest: 10 new tests fail, the rest pass.
Flow 57: on 1 November 2026, a Sunday, the week strip ended on today, and the
day three on was on the next page — not on the screen to tap.

Files: `jest-red-before.txt`, `e2e-red-before.txt`, `green-after.txt`.

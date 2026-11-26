# T-292 — a day not marked is drawn free on the month grid, from today on

Fix: `f67e68b`. Base for red-before: `32ca8f0` (the two source files are the
same at `32ca8f0` and at `6fd056a`, the HEAD the fix went on). Node 22, run in
`rehearsal-calendar-native`.

Source files of the change: `src/features/availability/utils/calendarUtils.ts`
(`getDayStatus` takes the day unmarked days are free from),
`src/features/availability/screens/AvailabilityScreen.tsx` (passes today; not
when the load failed and nothing is cached — an empty screen is not proof of
an empty diary, the banner already says the load failed).

Unchanged on purpose: the save, the editor's "Free" button, the planner, the
strings (none new). A day with an entry — marked, or with an event from the
phone's calendar — is drawn as before; a day before today with no entry keeps
no dot.

## Red before (32ca8f0)

Those two files restored with `git restore --source=32ca8f0 -- …`, the new
tests and flows kept, then `git restore --source=HEAD -- …`.

Jest (`npx jest --selectProjects frontend --testPathPatterns
'AvailabilityUnmarkedFree|displayedMode'`): 2 failed, 17 passed of 19.

- `AvailabilityUnmarkedFree.test.tsx` (the real screen and `CalendarMonth`,
  today 2026-11-24): "today and a day to come with no mark are free" —
  `Expected: "24, Free"`, `Received: "24"`. Passed already, as guards: a past
  day with no mark has no dot ("23", "1"); busy, partial, marked free, a day
  with only a calendar event (Partial) and a past busy day read as before; a
  failed load with nothing cached calls nothing free.
- `displayedMode.test.ts`: "calls a day with no entry free from today on" —
  got 'none'.

e2e:

```
npm run e2e -- e2e/flows/10-availability-days.yaml
[Failed] Availability saves the day it changed (1m 55s) (Assertion is false: "\d+, Free", id: day-2026-11-24 is visible)

npm run e2e -- e2e/flows/25-past-midnight-availability.yaml
[Failed] A busy slot past midnight is one slot, on both days (2m 2s) (Assertion is false: "\d+, Free", id: day-2026-11-28 is visible)

npm run e2e -- e2e/flows/28-trip-under-free-day.yaml
[Failed] A trip from the calendar shows on a day marked free (1m 50s) (No visible element found: "\d+, Free", id: day-2026-11-30)
```

## Green with the fix (f67e68b)

Jest, the same plus `CalendarMonth`: 21 passed of 21. The whole frontend
project: 1705 passed of 1705. `npm run type-check` clean, `npm run
check:dead` clean, ESLint on `src/features/availability`: 0 errors.

e2e:

```
[Passed] Availability saves the day it changed (3m 46s)
[Passed] A busy slot past midnight is one slot, on both days (3m 24s)
[Passed] A trip from the calendar shows on a day marked free (1m 50s)
[Passed] Imported busy times removed, what was marked by hand kept (2m 3s)
```

## The flows

Every `id: day-…` with `text:` in `e2e/` was read (flows, subflows, store).
Changed to the new rule:

- 10: today reads "N, Free" on opening; yesterday, where it is on screen, the
  digits alone; BEFORE_DAY and AFTER_DAY beside the saved day, digits alone
  before, now "N, Free".
- 25: AFTER_DAY, the day before Zarechnaya's evening, nothing on it: "N, Free".
- 28: OTHER_DAY, the day after Dorn's trip, nothing on it: "N, Free", beside
  the trip's Busy.
- 99: MARK_DAY after its imported hour is removed was "no label at all"; now
  "N, Free".

Left as they are: the Busy/Partial checks (unchanged by this), 64 and 68's
"Free" (days saved free, still free), 87/89's YESTERDAY_DAY (past), and the
taps by id alone.

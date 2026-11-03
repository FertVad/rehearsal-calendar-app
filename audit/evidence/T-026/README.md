# T-026: collapsing the "Busy" editor asks; a planner slot is 52 pt

Fix: `1dd7ad6`. Base for "red before": `8b5fe30`.
Files put back to the base for the red runs (`git restore --source=8b5fe30 --`):
`src/shared/hooks/useLeaveGuard.ts`, `src/features/availability/hooks/useAvailabilityData.ts`,
`src/features/availability/screens/AvailabilityScreen.tsx`,
`src/features/smart-planner/components/SlotItem.tsx`. The editor's new testIDs
(`availability-collapse`, `availability-deselect`) stayed, so the flow finds the buttons
and fails on what they do.

## Mechanism

`useLeaveGuard` has one more way out, `leave(go)`: a sheet of the screen put away
while the screen stays. The same question as the screen's close (T-013): nothing to
lose — `go()` at once; otherwise "Don't Save / Save / Cancel". "Save" runs the
screen's own save (not `leaving`: the toast, the reload, the selection dropped) and
goes once it went through; a failed save leaves the editor up with its error.
"Don't Save" calls the new `discard` (`useAvailabilityData.discardChanges`: every
changed day back to what was saved, the counters cleared), then goes. The editor's
arrow and "Deselect" both call `guard.leave(editor.clearSelection)`.

## Jest — red before (base code)

```
FAIL frontend src/features/availability/screens/__tests__/AvailabilityLeave.test.tsx
  ● Collapsing the editor (T-026) › with days changed, it asks Don't Save, Save, Cancel, and Cancel leaves it as it was
    Expected number of calls: 1
    Received number of calls: 0
    > 228 |     expect(showSheet).toHaveBeenCalledTimes(1);
  ● Collapsing the editor (T-026) › Don't Save puts the days back as saved and collapses; the screen stays
  ● Collapsing the editor (T-026) › Save saves, as the screen's own Save does, and collapses once it went through
  ● Collapsing the editor (T-026) › a save that fails leaves the editor up with its changes
FAIL frontend src/features/availability/hooks/__tests__/useAvailabilityDrafts.test.ts
  ● … › "Don't Save" of a collapse puts every changed day back as saved (T-026)
FAIL frontend src/features/smart-planner/screens/__tests__/SmartPlannerScreen.test.tsx
  ● The planner's list, dense (T-020) › heads a day with 28 pt and gives a slot a row of 52 (T-026)
    Expected: 52
    Received: 56
Test Suites: 3 failed, 3 total
Tests:       6 failed, 26 passed, 32 total
```

## Jest — green after (1dd7ad6)

```
npx jest --selectProjects frontend --silent
Test Suites: 121 passed, 121 total
Tests:       1103 passed, 1103 total
```
`npm run type-check`: clean.

## e2e — red before (base code)

```
npm run e2e -- e2e/flows/64-availability-collapse-asks.yaml e2e/flows/58-planner-dense.yaml
[Failed] Availability editor asks before collapsing (1m 31s) (Assertion is false: "Don't Save" is visible)
[Failed] Planner list is dense (57s) (Assertion is false: id: planner-row-2026-11-04-09:00, Size: nullx52(tolerance: 1) is visible)
2/2 Flows Failed
```

## e2e — green after (1dd7ad6)

```
npm run e2e -- e2e/flows/64-availability-collapse-asks.yaml e2e/flows/58-planner-dense.yaml e2e/flows/10-availability-days.yaml
[Passed] Availability editor asks before collapsing (1m 57s)
[Passed] Planner list is dense (1m 7s)
[Passed] Availability saves the day it changed (3m 3s)
3/3 Flows Passed in 6m 7s

npm run e2e -- e2e/flows/20-save-before-availability.yaml e2e/flows/25-past-midnight-availability.yaml
[Passed] Save before the availability is in (1m 35s)
[Passed] A busy slot past midnight is one slot, on both days (2m 36s)
2/2 Flows Passed in 4m 11s
```
Flows 20 and 25 run the screen's close question of T-013 through the same guard.

## Review (Astra): the last day picked, tapped again, collapsed unasked

The calendar's `onDayPress` went straight to `editor.handleDayPress`; taking the
only day out of the selection put the editor away, its Save with it, past the
guard. Now a tap on the only day picked is the editor collapsing and goes through
`guard.leave(editor.clearSelection)`, as the arrow and "Deselect" do — the
selection cleared, not toggled, so "Save" (whose own save already drops the
selection) does not pick the day back. Any other tap picks or lets go as before.

Base for "red before": `b8023ab`. File put back to it for the red runs:
`src/features/availability/screens/AvailabilityScreen.tsx`. The Jest mock of
react-native got `Animated.FlatList` and `RefreshControl`, so the screen test can
render the month list.

Flows 10 and 25 let go of a changed day to have the editor down with the change
unsaved — the very behaviour removed. They now meet the question there, cancel
it, and go on with the close question as before; flow 25 checks the tap on the
day during the save by "no question, still busy" instead of "editor not opened".

### Jest — red before (b8023ab screen)

```
npx jest --selectProjects frontend --testPathPatterns AvailabilityLeave
  ✕ … › by tapping the last day picked again › with days changed, it asks, and Don't Save puts them back and collapses
    Expected number of calls: 1
    Received number of calls: 0
  ✕ … › by tapping the last day picked again › Save saves and collapses; the day is not picked back
  ✕ … › by tapping the last day picked again › with nothing changed, it collapses at once
    Expected number of calls: 1
    Received number of calls: 0
  ✓ … › by tapping the last day picked again › another day, the editor staying up, is picked without asking
Tests:       3 failed, 13 passed, 16 total
```

### Jest — green after

```
npx jest --selectProjects frontend --silent
Test Suites: 121 passed, 121 total
Tests:       1107 passed, 1107 total
```
`npm run type-check`: clean.

### e2e — red before (b8023ab screen)

```
npm run e2e -- e2e/flows/64-availability-collapse-asks.yaml
[Failed] Availability editor asks before collapsing (2m 31s) (Assertion is false: "Don't Save" is visible)
1/1 Flow Failed
```
Every earlier step passed (screenshots 64-collapse-asks, 64-dont-save-day-as-it-was,
64-save-saved-and-collapsed taken); it fails at step 109, the day tapped again:
the editor gone without a word, the day's unsaved busy dot left on the calendar.

### e2e — green after

```
npm run e2e -- e2e/flows/64-availability-collapse-asks.yaml
[Passed] Availability editor asks before collapsing (2m 29s)
npm run e2e -- e2e/flows/10-availability-days.yaml
[Passed] Availability saves the day it changed (3m 17s)
npm run e2e -- e2e/flows/20-save-before-availability.yaml
[Passed] Save before the availability is in (1m 19s)
npm run e2e -- e2e/flows/25-past-midnight-availability.yaml
[Passed] A busy slot past midnight is one slot, on both days (3m)
```
Before their update, flows 10 and 25 failed on the fix ("Element not found:
availability-close" — the question's popover was up where they expected the
editor gone).

## Review 2 (Astra): "Delete Data" put the editor away past the guard

`deletePastDates` ended in `clearSelection()`: with a future day changed and a past day
picked, deleting the past day took the whole selection, the editor and its Save with it,
and left the future day unsaved, unasked.

Fix: `9dae404`. Base for "red before": `a366fbd`. Files put back to it for the red run:
`src/features/availability/hooks/useAvailabilityEditor.ts`,
`src/features/availability/screens/AvailabilityScreen.tsx`.

### Every way the selection empties

| Way | Before | Now |
|---|---|---|
| The editor's arrow, "Deselect" (`EditorHeader.onClear`) | `guard.leave(clearSelection)` on the screen | `editor.collapse` → `putAway` → `guard.leave` |
| The last day picked tapped again | intercepted on the screen → `guard.leave` | in `handleDayPress` itself → `collapse` |
| Another day let go of while more are picked | toggled off | the same; the selection is not empty, the editor stays |
| "Delete Data" of the past days picked | `clearSelection()`, unasked | only the deleted days let go of; none left → `putAway` after the render that has them settled, so they are not asked about |
| The editor's Save / the question's Save gone through | `clearSelection()` | the same: nothing is left unsaved (the screen takes no taps while a save is out) |
| "Don't Save" of the question | `discard`, then `clearSelection` | the same, from `guard.leave` |

The hook now takes `putAway` (required) and empties its selection only through it, save
for the save gone through; the screen wires it to `guard.leave`. `setSelectedDates([])`
is nowhere else.

### e2e

Not for the deletion path: the month list begins with the current month, so on the 1st
there is no past day on the screen to pick, and the owner ruled out moving the date
(03.11). Jest on the real screen and hooks instead, `AvailabilityPutAway.test.tsx`.
Flows 64, 10 and 25 rerun on the fix: the collapse and the last-day tap moved from the
screen into the hook.

### Jest — red before (a366fbd hook and screen)

```
npx jest --selectProjects frontend --testPathPatterns 'AvailabilityPutAway|useAvailabilityEditor' --verbose
    ✕ lets go of the deleted days only; the editor stays up with the rest (T-026, review 2)
    ✕ with none left picked, puts the editor away through the screen (T-026, review 2)
    ✕ by the last day picked tapped again goes through the screen, as the arrow does (T-026)
    ✓ with the day changed, it asks; Don't Save puts it back and collapses
    ✓ Save saves and collapses; the day is not picked back
    ✓ with nothing changed, it collapses at once
    ✓ another day picked, the one let go of goes without asking
    ✕ a future day changed and picked stays picked, its Save with it, and nothing is asked
      Expected: 1
      Received: 0
      > 178 |     expect(picked(screen)).toBe(1);
    ✕ none left picked with a day still unsaved: the editor goes down only once asked
      Expected number of calls: 1
      Received number of calls: 0
      > 194 |     expect(showSheet).toHaveBeenCalledTimes(1);
    ✓ none left picked and nothing unsaved but the deleted day: the editor goes down unasked
Tests:       5 failed, 19 passed, 24 total
```
The green ones on the base: the last-day tap was already guarded on the screen (review 1),
and the last case guards the fix against asking about the deleted day itself.

### Jest — green after (9dae404)

```
npx jest --selectProjects frontend --silent
Test Suites: 123 passed, 123 total
Tests:       1119 passed, 1119 total
```
`npm run type-check`: clean. `npm run check:secrets`: pass, 0 findings.

### e2e — after (9dae404)

```
npm run e2e -- e2e/flows/64-availability-collapse-asks.yaml
[Passed] Availability editor asks before collapsing (2m 31s)
npm run e2e -- e2e/flows/10-availability-days.yaml
[Passed] Availability saves the day it changed (3m 34s)
npm run e2e -- e2e/flows/25-past-midnight-availability.yaml
[Passed] A busy slot past midnight is one slot, on both days (3m 23s)
```

## Seen on the simulator

On this iOS the action sheet is a popover: "Don't Save" and "Save", no "Cancel"
button — a tap outside it is Cancel — and the screen behind it is out of
Maestro's reach. Flow 64 cancels with a tap at the top of the screen.

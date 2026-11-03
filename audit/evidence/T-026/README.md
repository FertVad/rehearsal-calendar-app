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

## Seen on the simulator

On this iOS the action sheet is a popover: "Don't Save" and "Save", no "Cancel"
button — a tap outside it is Cancel — and the screen behind it is out of
Maestro's reach. Flow 64 cancels with a tap at the top of the screen.

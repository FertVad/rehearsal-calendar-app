# T-013: unsaved changes are not lost on closing a sheet

Base: `ad8d513`. Fix: `1a69413`. Simulator: iPhone 16 (393×852 pt),
Honolulu, iOS 26. Each red run kept the fix's flows, tests, test mocks and
strings and put only the fix's own files back to `ad8d513`, then restored them
from `HEAD`:

```
src/features/availability/hooks/useAvailabilitySave.ts
src/features/availability/screens/AvailabilityScreen.tsx
src/features/calendar/hooks/useAddRehearsalForm.ts
src/features/calendar/hooks/useAddRehearsalSubmit.ts
src/features/calendar/screens/AddRehearsalScreen.tsx
```

For the e2e red run the old `AddRehearsalScreen.tsx` got only
`testID="rehearsal-close"` on its close button, so flow 20 fails at the
question, not at finding the button.

## Cause

"Mark Busy" (`MarkBusy`) and the rehearsal form (`AddRehearsal`) are
`presentation: 'modal'`. The close button calls `goBack()`; the swipe down and
back remove the route too. Nothing stood in front of the removal — no
`beforeRemove`, no `usePreventRemove` anywhere — so every way out closed the
sheet and dropped what was in it.

## Fix

`shared/hooks/useLeaveGuard.ts`, one guard for both screens, on the removal
itself (`usePreventRemove`): the close button, the swipe and back all pass it,
and the native stack holds the swipe while it is on. With changes it asks
with `ActionSheetIOS` (HIG `sheets.md` › Mobile, `modality.md` › Best
practices): "Don't Save" (destructive), "Save" only when the changes can be
saved as they stand, "Cancel" (on iOS 26 a tap outside the menu). Without
changes there is no guard and the sheet closes at once. The choice
re-dispatches the held action, so a swipe ends as a swipe.

- Mark Busy: changes are its changed days (`hasChanges`). "Save" is offered
  when the days it would send pass validation (`canSave`); it saves without
  the "Availability saved" alert (`announce: false`) — an alert over a sheet
  being dismissed goes with it — and closes once the save went through. A
  failed save leaves the sheet open.
- Rehearsal form: a change is a field the person touched that differs from
  what it held before the first touch. What the form fills in itself (default
  project, planner prefill, edit load, the starting participants) goes
  through the plain setters and is never counted. "Save" is offered when
  `canSubmit` (project, a non-empty range, participants settled, the day's
  availability in); it runs Create as the button does, and a successful save
  marks the form saved, so its own `goBack` is not asked about.

Strings: `common.dontSave`, `common.unsavedChanges` (Android title), four
languages.

## Red before (fix files at `ad8d513`)

```
npx jest --selectProjects frontend --silent \
  src/features/availability/screens/__tests__/AvailabilityLeave.test.tsx \
  src/features/calendar/screens/__tests__/AddRehearsalScreen.test.tsx
FAIL AvailabilityLeave.test.tsx
  ● with days changed, a way out asks: Don't Save, Save, Cancel
    Expected: false  Received: true      > expect(__remove(swipe)).toBe(false)
  ● Don't Save closes it the way it was being closed; Cancel keeps it open
  ● Save saves the days, without an alert over the closing sheet, and then closes it
  ● a save that fails leaves the sheet open
  ● changes that cannot be saved as they are offer no Save
FAIL AddRehearsalScreen.test.tsx
  ● Leaving with changes (T-013) › something typed, a way out asks: Don't Save, Save, Cancel
    Expected: false  Received: true      > expect(leave()).toBe(false)
  ● Leaving with changes (T-013) › Don't Save closes it the way it was being closed, and nothing is sent
  ● Leaving with changes (T-013) › Save creates it, and the way out after that is not asked about
  ● Leaving with changes (T-013) › while the people are still loading, Save is not offered
Tests: 9 failed, 12 passed, 21 total
  (the 12: the closes-at-once cases and the earlier tests of the form)

npm run e2e -- e2e/flows/10-availability-days.yaml
[Failed] Availability saves the day it changed (3m 29s) (Assertion is false: "Don't Save" is visible)

npm run e2e -- e2e/flows/20-save-before-availability.yaml
[Failed] Save before the availability is in (1m 28s) (Assertion is false: "Don't Save" is visible)

npm run e2e -- e2e/flows/25-past-midnight-availability.yaml
[Failed] A busy slot past midnight is one slot, on both days (2m 38s) (Assertion is false: "Don't Save" is visible)
```

Each fails at the first close with changes: the old sheet closed at once.
The closes-without-changes steps before it passed on the old code too.

## Green after (`HEAD`)

```
npx jest --selectProjects frontend --silent
Tests: 1 failed, 927 passed, 928 total
  the one: useSmartPlannerLimits "does not generate recommendations from old
  availability while the new range is pending or rejected" — timing under the
  full run, not touched here; alone: Tests: 9 passed, 9 total
npm run type-check      clean
npm run check:secrets   {"summary":"pass","findings":0}

npm run e2e -- e2e/flows/10-availability-days.yaml
[Passed] Availability saves the day it changed (2m 31s)
npm run e2e -- e2e/flows/20-save-before-availability.yaml
[Passed] Save before the availability is in (1m 44s)
npm run e2e -- e2e/flows/25-past-midnight-availability.yaml
[Passed] A busy slot past midnight is one slot, on both days (2m 33s)
```

What the flows show: 10 — saved, closes at once; with an overlapping slot
unsaved, asks with no "Save" (the save would refuse it), "Don't Save" closes.
20 — location typed, asks, "Don't Save" closes and nothing is created; opened
again untouched, closes at once. 25 — saved, closes at once; the day picked
again, asks, "Save" saves and closes. Screenshots `10-close-asks`,
`20-close-asks`, `25-close-asks`.

## Flow 20: the close button under the sheet's edge

The first green runs of flow 20 failed at the question with the fix in. The
close tap never reached `onPress` (a log in it stayed silent): scrolled down to
the location, the form's header sits above the sheet's top edge, and Maestro
tapped the button at y=29–61 pt — the status bar, which scrolled the form to
the top instead. The flow now swipes the form back to its top and waits for
`rehearsal-project` before the tap. Not a defect of the guard; the header
scrolling with the form is how the screen already was.

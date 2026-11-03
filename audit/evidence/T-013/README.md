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

## Review (Astra): two findings

Base `b0af89a`. Fix `9a0b459`, flow `f90f8d1`. Fix files:

```
src/features/availability/hooks/useAvailabilityData.ts
src/features/availability/hooks/useAvailabilitySave.ts
src/features/availability/screens/AvailabilityScreen.tsx
src/shared/hooks/useLeaveGuard.ts
```

**[P1] "Save" from the question lost an edit made while it was out.** The
sheet stays usable during the save; `markSaved` correctly left a day edited
meanwhile unsaved, but the guard's `leave()` ran as soon as the request came
back and closed the sheet past it. Cause: the way out went on by what was
sent, not by what was left. Now `useLeaveGuard` holds the action until the
save has rendered: nothing left unsaved, it is dispatched; something left,
the question comes again for it. The form (`AddRehearsal`) is unaffected: its
"Save" is Create, which closes the form on its own.

**[P2] Mark Busy asked about an unchanged day.** The guard read `hasChanges`,
"some day was touched": the mode of a day of hours picked again counted. Now
`useAvailabilityData` keeps what the server holds per day (as last loaded or
saved — `markSaved` gets the days sent) and `differsFromSaved` compares each
changed day with it (`sameDay`: the mode, and the hours in custom mode; no
state is not the same as a declared free day, since a save would write one).
The guard reads `differsFromSaved`; `hasChanges`, what a save would send,
still drives the Save button, so re-saving a day as it is (flow 25's own
check of the past-midnight slot) still works.

Flow 25 no longer treats a re-picked mode as a change (the step at line 122
the review named): picked again, closed — no question. Then a real change
(busy), the save's answer held (`hold-answers.js`, `PUT
/availability/days$`, `OPEN`), "Save", the day back to hours while it is out,
release — the question comes again (`25-asks-again`), "Don't Save" closes.

### Red before

```
# fix files at b0af89a, tests from 9a0b459
npx jest --selectProjects frontend --silent \
  src/features/availability/screens/__tests__/AvailabilityLeave.test.tsx \
  src/features/availability/hooks/__tests__/useAvailabilityDrafts.test.ts \
  src/features/availability/hooks/__tests__/useAvailabilitySave.test.ts
FAIL AvailabilityLeave.test.tsx
  ● a day edited while that save was out is not closed away: the question comes again (review)
    Expected number of calls: 0  Received number of calls: 1
    > expect(navigation.dispatch).not.toHaveBeenCalled();
FAIL useAvailabilitySave.test.ts  (markSaved now gets the days sent, 3 tests)
FAIL useAvailabilityDrafts.test.ts
  ● Test suite failed to run
    TS2339: Property 'differsFromSaved' does not exist on type ...
    TS2554: Expected 1 arguments, but got 2.   (markSaved)
Tests: 4 failed, 22 passed, 26 total
```

The real-hook P2 tests fail on types on the old code: the flag they read is
the fix. P2 is shown red on behaviour by flow 25:

```
# all four fix files at b0af89a
npm run e2e -- e2e/flows/25-past-midnight-availability.yaml
[Failed] A busy slot past midnight is one slot, on both days (3m 35s)
  (Assertion is false: "Don't Save" is not visible)
  step 93, after 25-evening-slot-whole: the mode picked again, closed — it asked

# only useLeaveGuard.ts at b0af89a (P2 fixed, P1 not)
npm run e2e -- e2e/flows/25-past-midnight-availability.yaml
[Failed] A busy slot past midnight is one slot, on both days (3m 50s)
  (Assertion is false: "Don't Save" is visible)
  step 113, after 25-close-asks and the release: the sheet had closed and the
  calendar tab was on screen; the hours set while the save was out were gone
```

### Green after (`f90f8d1`)

```
npx jest --selectProjects frontend --silent     Tests: 934 passed, 934 total
npm run type-check                              clean
npm run check:secrets                           {"summary":"pass","findings":0}
npm run e2e -- e2e/flows/25-past-midnight-availability.yaml
[Passed] A busy slot past midnight is one slot, on both days (4m 14s)
npm run e2e -- e2e/flows/10-availability-days.yaml
[Passed] Availability saves the day it changed (2m 32s)
npm run e2e -- e2e/flows/20-save-before-availability.yaml
[Passed] Save before the availability is in (1m 49s)
```

The first green run of 25 failed on an `assertVisible: availability-legend`
under the repeated question: iOS takes the content under an action sheet out
of the accessibility tree. The step was dropped; the question itself is the
proof (screenshot `25-asks-again`: the sheet open, the question over it).

## Flow 20: the close button under the sheet's edge

The first green runs of flow 20 failed at the question with the fix in. The
close tap never reached `onPress` (a log in it stayed silent): scrolled down to
the location, the form's header sits above the sheet's top edge, and Maestro
tapped the button at y=29–61 pt — the status bar, which scrolled the form to
the top instead. The flow now swipes the form back to its top and waits for
`rehearsal-project` before the tap. Not a defect of the guard; the header
scrolling with the form is how the screen already was.

## Review round 2: an edit while the save is out

Astra (reviews/T-013-r2.md): both screens stayed editable while a save was
out, and "saved" was what the screen held when the answer came, not what was
sent. Mark Busy: a day saved busy, made free, saved from the question, made
busy again meanwhile — compared with the server as unchanged, the sheet closed
unasked and the save wrote free. The form: "Room A" saved from the question,
"Room B" typed meanwhile, `markSaved()` cleared the whole form and OK closed B
away.

By the owner's decision (30.10 22:19) the cause is fixed once, in
`useLeaveGuard`: every save of both screens — the question's and the screen's
own button — goes through it. While one is out the screen takes no taps
(`pointerEvents="none"`, the form's text fields `editable={false}`), shows it
is saving (Mark Busy: `availability-saving` in the header; the form: its
button's spinner), and a way out waits silently; gone through, the way out
asked for goes on; failed, the screen keeps its changes and the save's alert
says why. Saved is what was sent: Mark Busy already marked the days it sent
(`markSaved(sent, availability)` of the save's own render); the form now marks
its `fields` as they were when the save began, a field holding something else
since staying unsaved. The form's Save from the question closes it without
the success alert, as Mark Busy does: the alert would go with the sheet.

Flow 25 drops the edit made while the save is out — it cannot be made any
more — and shows the lock instead: the saving indicator, a tap on the day that
does not open it, then the sheet closing unasked and the day read back busy.

### Red before (base `8aee22c`, the task's commits before this fix)

Unit tests on the real screens and hooks: `r2-red-before.txt` — 2 of 3 in
`AvailabilitySaving.test.tsx` and the 2 new edit-while-saving tests in
`AddRehearsalScreen.test.tsx` fail, the edit going into the screen.

```
git restore --source=8aee22c -- src/shared/hooks/useLeaveGuard.ts src/features/availability/screens/AvailabilityScreen.tsx src/features/calendar/hooks/useAddRehearsalForm.ts src/features/calendar/hooks/useAddRehearsalSubmit.ts src/features/calendar/screens/AddRehearsalScreen.tsx
npm run e2e -- e2e/flows/25-past-midnight-availability.yaml
[Failed] A busy slot past midnight is one slot, on both days (3m 10s) (Assertion is false: id: availability-saving is visible)
git restore --source=HEAD -- <the same files>
```

### Green after (`ad93876`)

```
npx jest --selectProjects frontend --silent     Tests: 964 passed, 964 total
npx tsc --noEmit -p .                           clean
npm run check:secrets                           {"summary":"pass","findings":0}
npm run e2e -- e2e/flows/25-past-midnight-availability.yaml
[Passed] A busy slot past midnight is one slot, on both days (3m 33s)
npm run e2e -- e2e/flows/20-save-before-availability.yaml
[Passed] Save before the availability is in (2m 23s)
npm run e2e -- e2e/flows/10-availability-days.yaml
[Passed] Availability saves the day it changed (2m 20s)
```

# T-213: flow 51 "An admin swipes a rehearsal away, an actor has no swipe" was flaky

Red run: T-017 checks, commit cd3d075, 2026-10-31 (e2e/out/failed/
T-017-2026-10-31T17-16-21-091Z, artifacts `e2e/out/artifacts/2026-10-31_184328`,
not in git). Failed step: `extendedWaitUntil ".*Play within.*"`, the first
step after Gertrude signs in. A rerun of the same commits passed.

## Cause

`red-run-timeline.txt`. The screenshot shows iOS's "Save Password?" sheet over
the calendar, "Play within" drawn under it; Maestro's hierarchy at the failure
holds only the sheet - while it is up, none of the app is visible to a flow.
`sign-in-form.yaml` had tapped "Not Now" once (`tapOn`, optional) and gone on.
That tap was lost in the simulator: backboardd registered its digitizer twice
and dropped the touch ("didn't see a previous touch down ... skipping event",
"digitizer did disappear", 19:08:24.49), the T-207 lost tap
(docs/e2e.md, "A lost tap"); Maestro reported it done, as it does every one.
Nothing checked that the sheet went, so the flow waited 30 s for a calendar it
could not see. Not in flow 51, the app, or the server: any flow's sign-in can
fail this way.

## Red before

- `red-run-timeline.txt` - the red run's lost tap on "Not Now", on one clock
  with Maestro's commands (T-207's `timeline.mjs`).
- `red-before.txt` - attempts to have it again: `not-now-scan.mjs` over every
  run kept (1 of 72 taps on "Not Now" dropped - this one), and flow 51 three
  times in a row on the old code (T-207's `repeat-e2e.mjs`): no tap on "Not
  Now" lost. A lost tap cannot be had on demand (T-207); the failure the fix
  answers - a tap on "Not Now" that leaves the sheet up - is made on purpose
  in `tap-and-see-gone-check.txt`, check 1, red.

## Fix

The owner's rule for a lost tap (T-207, 25.10.2026): one shared mechanism,
checked, one more tap at most, printed.

- `e2e/subflows/tap-and-see.yaml` takes `GONE` - a text the tap takes off the
  screen - instead of `SEE`: tap, wait for it to go; if it has not, say so to
  the run (`tap-again.js`), tap once more, wait again - it must go. A GONE seen
  gone is not asked again (a notVisible costs a second at every sign-in).
- `e2e/subflows/sign-in-form.yaml` taps "Not Now" through it
  (`GONE: "Not Now"`, `WAIT_MS: 5000`), when the sheet is there.
- `docs/e2e.md`: "A lost tap" and "Writing flows" say so.

## Green after

- `tap-and-see-gone-check.txt` - check 1 (the old bare tap, red), 2 (through
  tap-and-see with GONE, green, one tap taken again, printed), 3 (a text that
  never goes: two taps, no third, fails).
- `green-after.txt` - flow 51 on the new code, passed: both sign-ins through
  tap-and-see, no second tap; "Edit" in the details through tap-and-see's SEE.

The bug flow 51 guards (T-016: the swipe and the details' Edit/Delete for an
admin only) has not come back: in the red run and in this one the admin's
swipe showed Delete and Edit, the deletion named "Court scene", its day,
15:00 and "Participants (2)", the card went, the details had Edit and Delete
and Edit opened the form; in this run Gertrude's swipe showed neither and her
details had neither.

## Tools

- `not-now-scan.mjs [artifacts dir]` - taps on "Not Now" across the kept
  artifacts, and the ones dropped (uses `audit/evidence/T-207/timeline.mjs`).
- `check/` - the GONE checks, run from rehearsal-calendar-native:
  `npm run e2e -- ../audit/evidence/T-213/check/<file>.yaml`.

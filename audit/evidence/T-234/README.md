# T-234: flow 42 "Details count when the projects come late" was flaky

Red run: supervisor's checks on T-229, 0fc37bc, 2026-11-07
(e2e/out/failed/T-229-2026-11-07T15-15-54-322Z, not in git). Failed step:
`assertNotVisible: "0/1"`, before the release. A rerun passed.

## Cause

`red-run-timeline.txt`. The flow made its hold on `GET /api/native/projects`
before `sign-in-form.yaml`. A hold lapses a minute after it is made
(`HOLD_WINDOW_MS`, so a failed flow does not slow the next). That sign-in took
75 s: the cold keyboard dropped the email, its check failed after 17 s and the
retry typed it again. "Sign In" was tapped 67.8 s after the hold, which was
gone; `server.log` has no "holding" at all. The projects came at once, Olga
was an admin when the details opened, and the count was there too early.
Not a lost tap (none taken again, the button went at once), not the app.

## Red before

The keyboard's dropped typing cannot be had on demand; its time can. Flow 42
on the old code with a 65 s wait between the hold and the sign-in fails the
same way, with no "holding" in `server.log` (`red-before.txt`).

## Fix

The hold goes on just before the step that asks, not before steps whose time
no flow knows.

- `e2e/subflows/sign-in-form.yaml` is now its two halves, unchanged:
  `sign-in-fill.yaml` (types and checks the email and password) and
  `sign-in-submit.yaml` (taps "Sign In" through tap-and-see.yaml, puts away
  "Not Now").
- Flow 42 runs them itself, with the hold between: from the hold to the
  request is the tap and the sign-in's answer, not the typing.
- `docs/e2e.md`: a hold's minute counts from the hold; where a hold on a
  sign-in's requests goes.

No limit raised, no retry added.

## Green after

`green-after.txt`: the fixed flow with the same 65 s wait passes (the
projects held and released), and as committed with flow 01 (sign-in.yaml).
The bug flow 42 guards has not come back.

## Review 1: flow 38 failed in the checks on 545b8ed

The checks ran every flow (sign-in-form.yaml changed). Flow 42 passed; flow
38 "Switch accounts - a push registration answered late" failed at its last
`scrollUntilVisible: profile-notifications` (artifacts
e2e/out/artifacts/2026-11-07_202939, not in git).

Cause, from the red run's journal (`review1-flow38-lost-tap.txt`): after the
`launchApp` restart, `tapOn: tab-profile` at 21:28:35.928 was reported done,
and at 21:28:36.448 backboardd logged "we already have a service for
senderID", then "didn't see a previous touch down ... skipping event": the
simulator lost the tap (docs/e2e.md, "A lost tap", T-207). The failure
screenshot is the calendar, not the profile; the scroll searched it 20 s for a
switch that is on another tab. Flow 44 lost the same tap after a restart
(T-212). Not the sign-in split: the sign-in before it passed and the calendar
was on screen.

Check without the tap (`review1-red-without-tap.txt`): flow 38 with that tap
skipped fails the same way, "No visible element found: id:
profile-notifications".

Fix: flow 38's three taps on the profile tab go through
`e2e/subflows/tap-and-see.yaml` (`SEE: ".*Language, English.*"`, as flows
30, 44 and 71). No limit raised, no retry of its own.

Green after (`review1-green-after.txt`): flow 38 passes, and its last step —
Andrei's switch still off after Natasha's late answer was released (EXPECT 1)
— holds, so the bug it guards (cause fix 20) has not come back. Flow 42
passes too.

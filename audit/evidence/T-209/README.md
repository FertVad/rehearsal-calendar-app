# T-209: flow 11 "Password reset by emailed code" was flaky

Red run: T-121 checks, commit 20180d1, 26.10.2026 22:50 local (artifacts
`e2e/out/artifacts/2026-10-26_224010`, logs `e2e/out/failed/T-121-2026-10-26T21-22-36-455Z`,
not in git). Failed step: `extendedWaitUntil id: tab-create` after the tap on
"Change password and sign in".

## Cause

A lost tap (docs/e2e.md, "A lost tap"; T-207): backboardd registered XCTest's
per-tap digitizer twice, the touch down and the lift went to two touch states,
and the touch was cancelled. Maestro reported the tap done. The form was
filled (code and both passwords in the failure's hierarchy), no error showed:
the press never reached the button. Not in the app or the server.

Flow 11 tapped three things it then waited on with bare `tapOn`:
"Forgot password?", "Send code", "Change password and sign in". It was missed
when T-207 moved such taps to `tap-and-see.yaml` (only flows that had already
failed on one were moved).

## Red before

`red-before.txt`: the red run's timeline; then the old flow 5 times in a row
(all passed) and 3 times with every core busy - r1 lost the tap on "Forgot
password?" the same way and failed. Lost taps are a race under load; they come
with load, not on demand.

## Fix

The three taps go through `e2e/subflows/tap-and-see.yaml` with the text each
brings on screen: the request step's subtitle, the "code is on its way"
subtitle, and the tab bar's "New Action" or iOS's "Not Now". Each may be taken
twice: the second comes only when the first left the screen as it was; a
second code request within the minute sends nothing. No longer waits, no
retries of its own. `docs/e2e.md` names flow 11 next to flow 30.

## Green after

`green-after.txt`: the new flow twice under the same load and once alone,
passed, no tap taken again.

## The bug the flow guards

Flow 11 guards T-130/A01: the sign-in screen resets a forgotten password with
an emailed code, the reset signs in, and the new password signs in from a
fresh install. It has not come back: the red run's form was correct and
untouched by the app, and every finished run here asserted `tab-create` twice
(after the reset and after signing in with the new password).

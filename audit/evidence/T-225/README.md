# T-225: flow 59 "The planner's filters fit in Spanish" was flaky

Red run: full e2e on auto/main 98a8125, 2026-11-06 (e2e/out/failed/
full-e2e-98a8125-2026-11-06T19-52-08-097Z, not in git). Failed step:
`extendedWaitUntil id: calendar-filter` (30 s), the first step after
Bernarda signs in. A rerun passed.

## Cause

`red-run-timeline.txt`. `sign-in-form.yaml` typed the email and the password
(both checked), then tapped "Sign In" with a bare `tapOn`. That tap was lost in
the simulator: backboardd registered its digitizer twice ("we already have a
service for senderID", 20:21:08.985), dropped the touch ("didn't see a
previous touch down ... skipping event") and cancelled it - the T-207 lost tap
(docs/e2e.md, "A lost tap"). Maestro reported it done, as it does every one.
The screen at the failure is the sign-in form, filled in; nothing was sent.
Not in flow 59, the app or the server: any flow's sign-in could fail this way.

## Red before

A lost tap cannot be had on demand (T-207). Flow 59 on the old code passed
(`green-after.txt`, 2). What the lost tap leaves is made on purpose:
`check/1-submit-lost.yaml` - flow 59's start on the old sign-in-form.yaml with
its "Sign In" tap taken out - fails as the red run did (`red-before.txt`).

## Fix

The owner's rule for a lost tap (T-207): one shared mechanism, one more tap at
most, printed.

- `e2e/subflows/tap-and-see.yaml` takes `GONE_ID` - an id the tap takes off the
  screen - beside `SEE` and `GONE`. "Sign In"'s label is in whatever language
  the sign-in screen speaks (the last account's, the phone's), its id is not.
- `e2e/subflows/sign-in-form.yaml` taps "Sign In" through it
  (`TAP_ID`/`GONE_ID: login-submit`, `WAIT_MS: 10000` - the wait for "Not Now"
  it had). The button goes when the app moves on to the calendar, or when
  iOS's "Save Password?" sheet hides the app. A second tap comes only if it is
  still there after 10 s: the press did not take.
- `docs/e2e.md`: "A lost tap" and "Writing flows" say so.

## Green after

`green-after.txt`: check 2 (a copy of tap-and-see.yaml with its first tap
taken out: one tap taken again, printed, passed), flow 59, and flows 16 and 60
(sign-in screens not in English).

The bug flow 59 guards (T-020: the planner's filters in Spanish ran past the
screen) has not come back: the screenshot shows the three filters in the row,
each cut and keeping its chevron.

## Tools

- `make-checks.mjs <base>` - builds the check subflows from the real ones, one
  tap out each. Run before the checks:
  `node audit/evidence/T-225/make-checks.mjs d289dff`, then from
  rehearsal-calendar-native `npm run e2e -- ../audit/evidence/T-225/check/<n>.yaml`.

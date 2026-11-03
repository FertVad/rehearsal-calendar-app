# T-212: flow 44 "The profile's language, kept by the account" was flaky

Red run: T-008 checks, commit e8d9d23, 29.10.2026 22:43 local (artifacts
`e2e/out/artifacts/2026-10-29_224300`, logs `e2e/out/failed/T-008-2026-10-29T20-49-00-353Z`,
not in git). Failed step: `scrollUntilVisible id: profile-logout`, right after
the tap on the profile tab that follows the restart.

## Cause

A lost tap (docs/e2e.md, "A lost tap"; T-207): backboardd registered XCTest's
per-tap digitizer twice, the touch down and the lift went to two touch states,
and the touch was cancelled. Maestro reported the tap done, and the flow
scrolled the calendar for 20 s looking for the sign-out. The failure's
screenshot is the calendar, in Russian, with all of its tabs: the app had
started right and was waiting; nothing in it navigated back (metro.log after
the restart: /auth/me, projects, unread count - no push, no link). Not in the
app or the server.

Flow 44 tapped the profile tab three times with bare `tapOn` and then waited
on the profile: after sign-in, after the restart (the one lost), and before
going back to English. T-207 moved such taps only in flows that had already
failed on one.

## Red before

`red-before.txt`: the red run's timeline and the device log at the tap, set
against the same tap 15 s earlier that landed; touch-scan over every kept run.
Then the old flow under full CPU load: one copy passed, two longer runs were
cut by the 10-minute command limit, no tap lost in any. The loss comes with
load, not on demand.

## Fix

The three profile-tab taps go through `e2e/subflows/tap-and-see.yaml` with
the language row the profile shows (`.*Language, English.*`,
`.*Язык, Русский.*`); the id checks on `profile-language` stay after them. A
second tap on the profile tab comes only if the first left the calendar on
screen, and is harmless. No longer waits, no retries of its own.
`docs/e2e.md` names flow 44 next to flows 30 and 11.

## Green after

`green-after.txt`: the new flow once alone and once under the same load,
passed, no tap taken again.

## The bug the flow guards

Flow 44 guards T-005/HC01: the language chosen in the profile is the
account's - it holds across a restart and comes back from the account after
signing out and a cleared app. It has not come back: in the red run, the tabs
were Russian at once and after the restart (screenshots 44-russian and
44-russian-after-restart, asserted on `tab-calendar`, `tab-projects`,
`tab-profile`, `profile-language`), and both green runs passed every step,
including Russian after the cleared app and sign-in (`44-russian-from-account`)
and English again.

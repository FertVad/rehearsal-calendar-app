# T-207: flow 30 "A sync whose import fails still exports" was flaky

Red run: T-117 checks, commit e78a10a, 2026-10-25 08:36 local (artifacts
`e2e/out/artifacts/2026-10-25_081811`, not in git). Failed step: `extendedWaitUntil
".*Synchronize.*"` right after the tap on "Apple Calendar". The screenshot shows
Apple Calendar checked (set by the screen's own default-calendar load) but Auto
Sync off - the tap never reached `handleSelectProvider`: metro.log has no
"[CalendarSync] Enabled apple calendar sync", which a passing run logs at once.

## Cause

The tap was lost on the device. `device-simulator.log`, 08:36:11.817: backboardd
gets the touch-down, then "didn't see a previous touch down ... skipping event"
for every move and the lift, and the touch is cancelled when the synthetic
digitizer goes. Every other tap of the flow has its lift ("presence: none").

What was moving at that moment: the step-033 screenshot (08:36:10.9) shows the
app's "Refreshing..." banner. That is React Native's DevLoadingView: on an HMR
`update-start` it makes a UIWindow of its own over the app (backboardd, 08:36:10.25:
"new scene host settings ... com.rehearsal.app-default -> foreground") and takes
it down on `update-done`; the screen changed again right after the tap (Maestro:
"Something have changed in the UI") - the banner leaving.

Why Metro sent an update: the e2e run's Metro watches the whole project, and
Maestro writes its screenshots (`.png`) and view hierarchies (`.json`) into
`e2e/out/artifacts` while the flows run. Both are watched extensions; Metro's
DeltaCalculator emits a change for any watched file, in the bundle or not, and
the HMR server answers with `update-start`. So every screenshot Maestro takes
puts the banner up. In flow 30 the optional "Grant Access" / "Allow Full Access"
steps are WARNED (access is already there), Maestro screenshots them, and the
banner goes up and down exactly around the tap on Apple Calendar.

## Fix

`metro.config.js`: with `REHEARSLY_E2E` the block list also holds `e2e/out/`, so
what the run writes is not in Metro's file map and is no change. The app's own
files are still watched (run.mjs keeps the watcher on so an edit reaches the
app). No limit raised, no retry.

`e2e/__tests__/metro-watch.test.mjs` (in `npm test` with the other e2e infra
tests): Metro's real file map with the project config; a screenshot and a
hierarchy written into `e2e/out` must not be changes, a source file beside it
must be (so the test is not blind with the watcher off).

## Files

- `red-before.txt` - the test on the base config: both artifacts heard as
  changes; flow 30 on the base config: banner on the WARNED-step screenshots.
- `green-after.txt` - the test green, flow 30 green with no banner, cause fix 17
  still holding (export ran after the failed import), the other checks.

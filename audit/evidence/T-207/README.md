# T-207: flow 30 "A sync whose import fails still exports" was flaky

Red run: T-117 checks, commit e78a10a, 2026-10-25 08:36 local (artifacts
`e2e/out/artifacts/2026-10-25_081811`, not in git). Failed step: `extendedWaitUntil
".*Synchronize.*"` right after the tap on "Apple Calendar". The screenshot shows
Apple Calendar checked (set by the screen's own default-calendar load) but Auto
Sync off - the tap never reached `handleSelectProvider`: metro.log has no
"[CalendarSync] Enabled apple calendar sync", which a passing run logs at once.

## Review 1 (Astra): the banner was a hypothesis - it does not hold

The first round blamed the "Refreshing..." banner (Metro watching e2e/out) and
showed it only by a watcher test. Asked to make flow 30 itself fail on the base
config, this round could not, and the logs say why: the banner is not the cause.

- `red-before.txt` - 9 runs of flow 30 on the base config (alone, three in a
  row, with Maestro's writes multiplied, with every core busy) and a stress flow
  (`banner-taps.yaml`) with 48 taps right after a banner: all passed, no tap
  lost after a banner.
- `red-run-timeline.txt` - what happened to the red tap: XCTest's Recap makes a
  virtual digitizer for each tap and plays the touch at once; backboardd matched
  the new service 20 ms after it was added (0.7 ms for the tap two before), the
  first event came in before it, and backboardd made two touch states for one
  digitizer. The touch down went to one, the lift to the other, the touch was
  cancelled. A window going away does not appear in it.
- `lost-taps.txt` - the same in every log kept here: 83 lost taps in 20606, in
  28 flow names, on both configs (the 10:18 run, after f14c44d, lost its login
  tap). Most are the first tap of sign-in, which `sign-in-form.yaml` types and
  checks inside `retry`, so those flows passed. And Maestro 2.11 never noticed
  one: in 9198 taps its "did the screen change?" check said "Something have
  changed" 9198 times, so its own tap-again never runs.

## Cause

The simulator drops about one tap in 250 (a race in backboardd when it is busy
as XCTest's per-tap digitizer comes up), and Maestro cannot tell. Any tap whose
effect a flow then waits for fails the flow when it is the one dropped; in flow
30 that was "Apple Calendar". It is not in the app, not in the flow's waits, and
not in Metro.

## What changed in this round

- `metro.config.js`: the e2e/out exclusion stays (Metro has no business with
  what the run writes, and the banner no longer covers screens under test or
  their screenshots), its comment no longer claims it stops lost taps.
- `README.md`, `red-before.txt` rewritten; `green-after.txt` keeps the first
  round's checks, corrected.

## Not fixed - needs a decision

Within the task's rules (no retries, no raised limits) the flake has no fix in
this repository: the touch is lost below the app, and the tool that should
catch it does not. What would fix it, each a decision for the owner:

1. Taps whose effect a flow waits for are taken again when the effect does not
   come - the way `sign-in-form.yaml` already does for the login fields (a
   subflow "tap X until Y shows", used in place of the bare taps). The tap on
   "Apple Calendar" is safe to repeat (`handleSelectProvider` only turns sync
   on again).
2. A Maestro whose tap check works (or `retryTapIfNoChange` that can see "no
   change"), or an Xcode/simulator without the race.

The bug flow 30 guards (cause fix 17) has not come back: every finished run of
flow 30 this round (110324, 112454 x3, 115003 x3) exported after the failed import ("[Sync] ✅ Export completed" in metro.log,
"Exported rehearsals: 1" asserted).

## Tools (all in this folder, run from the root of the tree)

- `touch-scan.mjs` - lost taps, double registrations, Maestro's verdicts, over
  `e2e/out/artifacts`.
- `timeline.mjs <flow artifacts dir>` - one flow's Maestro commands and the
  simulator's touch handling on one clock.
- `repeat-e2e.mjs [times] [flow]` - one flow N times in one e2e run
  (`clean` removes copies a killed run left).
- `churn-e2e.mjs`, `load-e2e.mjs`, `banner-taps.yaml` - the same under writes
  into e2e/out, under CPU load, and with a banner before every tap.

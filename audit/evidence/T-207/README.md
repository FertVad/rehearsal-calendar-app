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

## The owner's decision (25.10.2026, 12:23) and the fix

Within the task's rules the flake had no fix in this repository, and that was
put to the owner. The decision: a tap may be taken again, by one shared
mechanism only, checked, at most once, with no pauses and no longer waits, and
every second tap printed by the run.

- `e2e/subflows/tap-and-see.yaml`: tap (`TAP_ID` or `TAP`), wait for `SEE` for
  the flow's own `WAIT_MS`; if it is not there, report it
  (`e2e/scripts/tap-again.js` -> the mailbox -> `e2e/out/taps-again.log`), tap
  once more, wait for `SEE` again - which must come.
- `e2e/run.mjs` prints `[e2e] taps taken again (tap-and-see.yaml): N` and each
  one after the flows.
- Flow 30's tap on "Apple Calendar" goes through it (a second tap only turns
  sync on again, `handleSelectProvider`). Flows 27-29 tapped + up to three
  times until "Mark Busy" showed: now through it too. The `retry` blocks of
  sign-in and flows 11-12 retype text after a slow first keyboard - typing,
  not a lost tap - and stay; flow 07's toggle and the pickers' steps in 26-27
  tap until a state, by design.
- The rule and the cause are in `docs/e2e.md`, "A lost tap".

`tap-and-see-check.txt`: the mechanism on a tap whose first press leaves no
result, made so on purpose (Olga Stage's planner, two of three selected:
"Select All" first selects all, only the second clears to "All Members").
Red: the bare tap-and-wait flow 30 used fails. Green: through tap-and-see it
passes, one second tap printed. Bound: a result that never comes - two taps,
no third, the flow fails.

`after.txt`: flows 30, 27, 28, 29 through it, all passed.

## On "red before" (review 1)

A tap lost by the simulator cannot be had on demand - nine runs of flow 30,
writes into e2e/out, load on every core and 48 taps after a banner did not
lose one (`red-before.txt`). What proves the failure is the logs kept from
the runs that had it: the red run's tap was dropped in backboardd
(`red-run-timeline.txt`), 83 taps were dropped the same way across the kept
runs, and Maestro reported every one of them done (`lost-taps.txt`). The
failure the fix answers - a tap with no result, then a wait for it - is shown
red and green on purpose in `tap-and-see-check.txt`.

The bug flow 30 guards (cause fix 17) has not come back: every finished run of
flow 30 (110324, 112454 x3, 115003 x3, 130533) exported after the failed
import ("[Sync] ✅ Export completed" in metro.log, "Exported rehearsals: 1"
asserted).

## Tools (all in this folder, run from the root of the tree)

- `touch-scan.mjs` - lost taps, double registrations, Maestro's verdicts, over
  `e2e/out/artifacts`.
- `timeline.mjs <flow artifacts dir>` - one flow's Maestro commands and the
  simulator's touch handling on one clock.
- `repeat-e2e.mjs [times] [flow]` - one flow N times in one e2e run
  (`clean` removes copies a killed run left).
- `churn-e2e.mjs`, `load-e2e.mjs`, `banner-taps.yaml` - the same under writes
  into e2e/out, under CPU load, and with a banner before every tap.

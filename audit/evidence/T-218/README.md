# T-218: flow 25 "A busy slot past midnight is one slot, on both days" was flaky

Red run: full e2e on Node 26.13.0, claude/systematic-repair 1e8f24c,
2026-11-03 19:23-20:39 (logs `e2e/out/failed/node26-full-e2e-1e8f24c-2026-11-03`,
artifacts `e2e/out/artifacts/2026-11-03_192404`, main tree, not in git). 70 of
71; flow 25 failed at `extendedWaitUntil "Don't Save"` after Busy and a tap on
the day. A rerun on the same Node passed, and so did Node 22 on 8f8a610.

## Cause

A lost tap (docs/e2e.md, "A lost tap"; T-207), on mode-busy:
`red-run-timeline.txt`. backboardd registered the tap's digitizer twice and
skipped the touch ("we already have a service for senderID", then "didn't see
a previous touch down ... skipping event", 19:47:57.545-.663); Maestro said
the tap was done, as it does for every one. 2.4 s later the hierarchy still had
the day "8, Partial" (a busy day reads "8, Busy"). Nothing differed from the
saved day, so its tap put the editor away without asking, which is right
with nothing to lose.

Not the screen. The question was whether the guard sees an edit made just
before the tap, a reload answering in between or not: it does
(`guard-probe.txt`, `guard-probe.test.tsx`, run on the old code, green; not
kept in the suite, it fixes nothing). Not Node 26 either: the lost tap is in
the simulator, and the same run lost three more in other flows that recovered
or did not depend on them; the green rerun lost one too, at sign-in, and its
`retry` recovered it.

## Red before

`red-before.txt`: the old flow under load (cut by the 10-minute limit), and
once alone (passed, no tap lost). A lost tap cannot be had on demand. What one
on Busy does is made on purpose in `check/1-busy-tap-lost.yaml`, flow 25's
last part without that tap: red, `Assertion is false: "Don't Save" is
visible`, the red run's failure word for word.

## Fix

The rule for a lost tap (T-207): the tap on mode-busy goes through
`e2e/subflows/tap-and-see.yaml`, `SEE: "You are unavailable on this day"`,
the note the editor shows only for a day busy all day, `WAIT_MS` 5000. A
second tap comes only if the first left no note, and Busy taken twice is the
same Busy. No longer waits, no retries of its own. `docs/e2e.md` names flow 25
with the others.

## Green after

`green-after.txt`: the new flow passed; the note came after the first tap, no
tap taken again.

## The bug the flow guards

Flow 25 guards cause fix 15/CC06 (a busy slot past midnight is one slot: the
evening holds 23:00-01:00 "next day" and saves it whole, the morning shows its
end "from the day before") and T-013/T-026 (a day changed and let go of asks;
the close asks; while the save is out the sheet takes nothing; picking the mode
again is no change). It has not come back: in the red run every step before
the lost tap passed (the slot whole, saved, read back on the morning and on
the evening, the mode picked again closing unasked), and in the green run
every step passed, to the day "Busy" after the save.

## Review 1 (Astra)

1. The second tap. The owner's decision (03.11.2026, 21:53, as on T-207's of
   25.10.2026): a tap the simulator loses goes through `tap-and-see.yaml`,
   one shared mechanism, at most one second tap, only when the first left
   nothing on screen, each one printed by the run. The task's "no retries"
   is about retries of a flow's own and raised limits, not this. The flow
   stays as it is: no tap is lost without the mechanism, and there is no
   other way past one, the loss being in backboardd (above).
2. Red before, green after, on the same failure. A lost tap cannot be had
   on demand: about one in 250, under load, never in nine tries and 48 taps
   made for it (T-207 `red-before.txt`); here the old flow once alone passed,
   and under load was cut by the 10-minute limit (`red-before.txt`). What
   stands for it, piece by piece:
   - the failure is a lost tap: `red-run-timeline.txt`, backboardd skipped
     the touch on mode-busy and the day stayed "8, Partial";
   - a lost tap on Busy gives this failure: `check/1-busy-tap-lost.yaml`,
     the tap left out, red with `"Don't Save" is visible`, word for word;
   - the screen is not in it: `guard-probe.txt`, the guard sees a Busy made
     just before the tap on the day, a reload in between or not;
   - the second tap, when the first left no result, gets the flow through,
     and no third comes: T-207 `tap-and-see-check.txt`, red bare, green
     through `tap-and-see.yaml` with one second tap printed, and the bound;
   - the new flow passes: `green-after.txt`, the note after the first tap,
     the steps after it as before.

## Tools

- `check/1-busy-tap-lost.yaml` - run from rehearsal-calendar-native:
  `npm run e2e -- ../audit/evidence/T-218/check/1-busy-tap-lost.yaml`.
- `guard-probe.test.tsx` - copy to
  `rehearsal-calendar-native/src/features/availability/screens/__tests__/`
  and run with `npx jest --selectProjects frontend --testPathPatterns <name>`.
- T-207's `timeline.mjs`, `touch-scan.mjs`, `load-e2e.mjs`.

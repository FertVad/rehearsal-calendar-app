# T-206: flow 17 "Calendar filter against a late answer" was flaky

Red run: T-116 checks, commit 1151041, 2026-10-25 00:45 UTC (artifacts
`e2e/out/artifacts/2026-10-25_020939`, not in git). Failed step: `extendedWaitUntil
notVisible ".*Garden debate.*"` right after the tap on "Eternal Student"; the
screenshot shows the dropdown still open with "All Projects" checked - the tap
never reached the option.

## Cause

The flow held the `GET /rehearsals/batch` answer with a plain hold. A plain
hold lets the answer go on its own after nine seconds (`HOLD_LIMIT_MS`, inside
the app's ten-second timeout). Between the hold and the pick the flow takes a
pull, a tap on the filter and the tap on the option; Maestro's waits make that
8 s on a quiet machine and over 9 s on a busy one. Then the answer goes while
the dropdown is open: `refreshing` turns false, the pull-to-refresh spinner
closes, the scroll content moves up 60 pt, and Maestro's tap - aimed by the
hierarchy read before - lands below the option.

| Run | swipe start -> tap on the option | result | `calendar-filter` y at the tap / after |
|---|---|---|---|
| T-116 (red) | 9.45 s | FAIL | 177 / 166 (spinner still closing) |
| repro r1 | 7.83 s | pass | |
| repro r2 | 10.42 s | FAIL | 177 / 117; option at 261-303, tap at y=342 |
| repro r3 | 8.00 s | pass | |
| repro r4 | 8.01 s | pass | |
| repro r5 | 7.88 s | pass | |

The same clock made the flow blind when it did pass slowly: with the answer
already gone before the pick there is no late answer at all, and the flow goes
green even with the DF06 bug back (`mutation.txt`, slow-plain).

## Fix

- Flow 17 holds the answer `OPEN: "1"`: the connection stays open until
  `release-answers.js`, however long the steps take - no clock to race.
- `e2e/server-with-mailbox.mjs`: an open hold forwards the request without
  `If-None-Match` / `If-Modified-Since`. Its 200 is sent before the server is
  asked; iOS sent the cached ETag, the server said 304, and the app got an
  empty body instead of the late "All Projects" list (found by the mutation
  run, first attempt in `mutation.txt`).
- `docs/e2e.md`: a hold across several steps is `OPEN`.

## Files

- `repro-before.txt` - old flow 17 five times in a row: 1/5 red, same failure.
- `mutation.txt` - DF06 put back (`if (!current()) return;` removed in
  useRehearsals.ts): fixed flow 17 and slow-open red, old hold (slow-plain)
  green, i.e. blind.
- `green-after.txt` - fixed flow 17 several times, slow-open, flow 22 (the
  other open hold): green.
- `repro-*.yaml` - the repeat and slow-simulator flows (run from
  `rehearsal-calendar-native/e2e/repro/`, not kept in the tree).

# T-220 — flaky e2e: A sync whose import fails still exports

Red: night run at d670967, 2026-11-05 —
`rehearsal-calendar-native/e2e/out/failed/full-e2e-d670967-2026-11-05T01-15-53-702Z/`
(working tree, not in git). `[Failed] … (Assertion is false: "Sync error" is visible)`.

## Not T-207

T-207 was the simulator losing a tap. Here the log shows none lost:
tap-and-see saw "Synchronize" after its first tap (`taps taken again: 0`),
and the tap on Synchronize worked — `handleSynchronize` ran, and the screen at
the failure is its alert, "Synced successfully, Imported: 0, Exported
rehearsals: 1". The import did not fail. Details: `red-run-log.txt`.

## Cause

The flow made the import fail by holding its answer 40 s (`MS: "40000"`) and
counting on the app to give up after ten. Those ten seconds are axios's
`timeout`, which React Native hands to NSURLSession as the request's
`timeoutInterval` — iOS gives up, not the app's JS. In the red run the task,
`timeouts(10.0, …)`, heard nothing for 40.0 s, then received the 200 the
lapsing hold sent (`transaction_duration_ms=40024, response_status=200`).
The import succeeded and the 40 s wait for "Sync error" ran out three seconds
after the success alert. In green runs the same task does give up at ten
(`ECONNABORTED timeout of 10000ms exceeded`). The flow's outcome was iOS's
timer.

## Fix

The flow is about what follows a failed import (the export still runs, the
alert names both), not how long the app waits. It now fails the import
directly: a new hold mode, `DROP: "1"` (`e2e/scripts/hold-answers.js`,
`&drop=1` in `e2e/server-with-mailbox.mjs`), closes the request's connection
at once — the network gone — and the app's request fails then
(`ERR_NETWORK`). No timer in between. The wait for "Sync error" is 20 s
instead of 40: it no longer has a 10-second timeout inside it. Documented in
`docs/e2e.md` (holds) and in the server's header.

No limit raised, no retry added. The app is unchanged: this is the test's
way of making a request fail.

## Red before, green after

- `red-before.txt`: the red is the night run at d670967 (its own logs,
  `red-run-log.txt`). Reproduction of the unchanged flow, as the review asked
  — in the night's order (71, 49, 30), after flow 70, in series, under 8, 12
  and 16 threads of load, and once with the whole client and harness at
  d670967: 12 runs, 12 green, iOS giving up at ten seconds each time. **Not
  reproduced on order**; the night's red stands on its primary logs alone. The
  earlier `OPEN` check is kept there, marked as not a reproduction.
- `green-after.txt`: the fixed flow, two runs, both green; one import request
  dropped each time, import failed, export success 1.

Review (Astra, P2, "red before not reproduced"): the reproduction was run as
asked and is saved with its output; it stays green. Cell: simple × minor.
What is left for the supervisor to accept or not is that this flaky red
comes from iOS skipping a timer once in a night, which no series here
brought back.

## Checked

- The guarded bug (cause fix 17, EO02 — a failed import skipping the export)
  has not come back: both green runs show the import failed and the export
  wrote the rehearsal (`Run completed`: import failed, export success 1).
- Other flows hold answers past ten seconds with `MS` (34: 40000, 36: 30000,
  52: 15000) and so also lean on iOS giving up. Not changed here (outside this
  task); they are named for the supervisor.
- Observed, not changed: the app's ten-second limit is iOS's idle timer; in
  the red run it did not fire in 40 s. Whether that happens on a phone is not
  shown by this run.

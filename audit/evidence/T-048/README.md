# T-048 — e2e flows do not wait for iOS to give up at ten seconds

Cause: T-220 (`audit/evidence/T-220/red-run-log.txt`). `REQUEST_TIMEOUT_MS`
(10 s) is NSURLSession's `timeoutInterval`, a timer of silence kept by iOS; in
the night run of 05.11 it did not fire in 40 s. A flow that held an answer past
ten seconds (`MS`) and waited for the app to give up leaned on that timer.
Red before is not reproducible on order (T-220: 12 runs, 12 green); the
night's log is the evidence of the cause, as the task says.

## Each place, by its point

| Flow | Place | Point | Now |
|---|---|---|---|
| 10 | the sheet's Save | the save fails | `DROP` + `ONCE`; the release with `EXPECT: "1"` gone (nothing is held: the error on screen is the proof) |
| 10 | the close question's Save | the save fails | same |
| 16 | her unread count | "does not come at all, as offline" | `DROP` (every read until the release) |
| 34 | the inbox list | "does not come at all, as offline" | `DROP` |
| 34 | Mark all read | "goes nowhere" | `DROP` (was `BEFORE` + `MS`) |
| 36 | the first "read" | a read that fails *late*, after "Mark all read" landed | rebuilt: `BEFORE` + `DROP` + `ONCE` — held, and its connection closed on `release-answers.js` (`EXPECT: "1"`), which the flow calls once "Mark all read" is through. Before, the failure was iOS's ten seconds; had iOS waited, the request would have reached the server and the flow passed without the failure ever happening |
| 37 | Mark all read, released after sign-out | a late answer, refused 401 | `MS` kept. It needs iOS *not* to have given up before the release: ten seconds of silence are the least iOS waits, and the flow keeps tap→release inside them (as before). iOS waiting longer (T-220) changes nothing. Comment corrected |
| 52 | the sheet's read after a save | "the read does not come at all" | `DROP` without `ONCE`, released before the next save |
| 52 | the roster before Delete | the read is lost | `DROP` without `ONCE`, released before "Try again" |

No flow among these checks the timeout itself.

`ONCE` dropped for GETs: iOS resends a GET whose connection dropped by itself —
one request in `metro.log`, three "dropped" lines in `server.log` (flows 16,
34, 52). With `ONCE` the resend would have gone through and the read
succeeded: a green that never took the failure path. PUT and POST are not
resent (flows 10, 34, 36: one drop each).

New in `e2e/server-with-mailbox.mjs`: `&drop=1` with `&before=1` holds the
request and closes its connection on release or lapse, never handing it to the
server. `docs/e2e.md`: when `DROP`, when `MS`. `docs/known-issues.md`: the
paragraph on iOS's timer and why the app sets no total limit. App unchanged.

Not in the task's list, named only: flow 13 loses a create's answer by a
13-second database trigger (`e2e/seed.mjs`) and so also waits on iOS's ten
seconds. Not changed here.

## Green after (`green-after.txt`)

## Supervisor's `npm test` on 206a8fe: `metro-watch.test.mjs` red

`e2e/__tests__/metro-watch.test.mjs` failed with "the watcher heard nothing at
all: []". The commit touched neither the test nor `metro.config.js`. The cause
is in the test: on macOS Metro's watcher is `fs.watch` with `recursive` over
FSEvents. Its stream starts on a thread of its own after `build()` resolves,
and a file written before the stream listens is never heard. The test wrote
its one app file right after `build()`. Alone, the stream is up in time. Under
load it is not.

Fix: the test writes an app file until it is heard (every 500 ms, up to 10 s).
Only then does it write the e2e/out files, then a second app file until that
is heard, and only then check that nothing from e2e/out came through.

`metro-watch-parallel.mjs` here runs the test N times at once to make that
load (`node audit/evidence/T-048/metro-watch-parallel.mjs 48`):

| Test | Runs | Red |
|---|---|---|
| 206a8fe (before), `git restore --source=206a8fe` | 3 × 48 | 1, 2, 4 — all "the watcher heard nothing at all: []" |
| 394ae22 (after) | 5 × 48 | 0 |

The fix still catches what the test is for. With `metro.config.js` from before
f14c44d (no blockList for e2e/out) it fails: "files written into e2e/out
reached Metro as changes".

In this session `lock.test.mjs` "what a dead run left running…" is red as
well. The session's sandbox does not let `ps` run, so `startedAt` is empty.
The test was green in the supervisor's run, and this task does not touch it.

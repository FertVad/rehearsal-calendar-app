# T-205 — e2e "fetch failed" before any flow (T-304, 40c3f78)

The red run: `rehearsal-calendar-native/e2e/out/failed/T-304-2026-10-12T16-28-43-371Z/`
(working tree, not in git). Supervisor checks at 40c3f78, 2026-10-12; a rerun of
the same commits passed.

## What the logs show

- `checks.log`: `e2e/run.mjs` started at 16:22:25Z; the steps reach
  `checking the bundle talks to the local server`, then `[e2e] fetch failed`.
  No flow ran (`junit.xml` has none).
- The failure folder was written at 16:28:43Z — about 6.3 minutes after the
  start: a minute or so of PostgreSQL, schema, server, seed and Metro start,
  then five minutes waiting for the bundle.
- `metro.log`: Metro starts with an empty cache (`--clear`, "Bundler cache is
  empty, rebuilding") and the last line is `iOS ./index.ts ... 79.8% (1103/1244)`.
  There is no "Bundled" line and no error: the build was still going.
- `server.log`: nothing wrong on the server side.

## Cause

Node's built-in `fetch` (undici) gives up when response headers take more than
five minutes (`headersTimeout` 300 s) and reports only "fetch failed". Metro
sends no headers until a cold bundle is built, and under the machine's load
(the full `npm test` had just run) the build took longer than five minutes.
Nothing in T-304 or the app's code is involved; the rerun passed because the
build fit in the five minutes.

## Fix

Already made and merged into auto/main: **902d4a6** — "fix(e2e): the bundle is
fetched without Node's five-minute header limit". The bundle is read with
`node:http` (`rehearsal-calendar-native/e2e/http.mjs`) under an explicit
30-minute deadline; running out of it is the machine (exit 75), an error status
from Metro is still the change's (exit 1). Regression:
`e2e/__tests__/http.test.mjs`, part of `npm test`.

## Red before, green after (review round 1)

`repro.mjs` stands in for a cold Metro: it accepts the bundle request and holds
the headers back for N seconds. Against it, at the same time, it runs the
bundle expression from `run.mjs` at 902d4a6^ (lines 384-385), copied exactly,
`await (await fetch(url)).text()`, and `getText` from `e2e/http.mjs` (902d4a6+)
with run.mjs's 30-minute deadline. Output: `repro-red-green.txt`.

- 0.3 s (the delay the unit test uses): both pass. So that test alone would
  not notice a return to `fetch`, as the review said.
- 310 s: the old code fails after **301.7 s** with `fetch failed`, cause
  `UND_ERR_HEADERS_TIMEOUT` (undici's `headersTimeout`, 300 s, Node 22.16.0):
  the same bare message as in the T-304 `checks.log`. The new code gets the
  bundle at 310.1 s.

This confirms the mechanism. Whether this exact timeout fired in the T-304
run comes from the logs: the bare message, the ~5 minutes between Metro
starting and the failure folder being written, and Metro still building with
no error. The original logs are only on the supervisor's machine.

Five minutes is too long for `npm test`, so a fast guard was added to
`e2e/__tests__/http.test.mjs`: every `run.mjs` line that requests the bundle
must use `getText`. It fails on run.mjs from 902d4a6^ and passes now
(`guard-red-green.txt`). The slow check is `node audit/evidence/T-205/repro.mjs`.

## Checked for T-205

- The bug the fix guards against has not come back: on the current tree,
  `getText` waits through 310 s of held headers, and run.mjs's bundle request
  goes through it (the guard). Other `fetch` calls in run.mjs (`/ready`, the
  mailbox, Metro `/status`) answer at once, so the header limit does not
  apply to them.
- `node --test e2e/__tests__/http.test.mjs`: 4 of 4 pass.
- No other change was made for this task.

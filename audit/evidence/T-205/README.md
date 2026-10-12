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

## Checked for T-205

- The logs above match the cause 902d4a6 describes: same step, same bare
  message, same five-minute wait, Metro mid-build without an error.
- `node --test e2e/__tests__/http.test.mjs` on auto/main (987f3fc): 3 of 3 pass
  (a slow answer is waited for; past the deadline it is `DEADLINE`; a 500 is an
  error with its body).
- No other change was made for this task.

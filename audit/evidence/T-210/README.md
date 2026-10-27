# T-210: server test authLogin.test.js was flaky

Red run: T-004 checks, commit 20d3580, 27.10.2026 17:24 local (log
`e2e/out/failed/T-004-2026-10-27T15-10-15-177Z/checks.log`, not in git and no
longer at that path). All 7 tests of `server/__tests__/routes/authLogin.test.js`
failed with "Exceeded timeout of 5000 ms for a hook": the file's `beforeAll`
did not finish. The whole `npm test` took 288 s that run, against about 70 s
for the server suite on a quiet machine: the machine was loaded. The test file
in 20d3580 is blob 95a093e, the same as in 708b61d, the base of T-210.

## Cause

`beforeAll` loaded express, supertest, bcrypt and the whole `routes/auth.js`
module graph, and the hook has 5 s. Loading those modules takes from tens of
milliseconds to several seconds depending on the machine's load, and more for
the first file of a Jest run: the probe saw this hook at 1.0-10.3 s and the
same pattern in signInMethods' hook at up to 8.9 s (`review1-cause.txt`,
section 2). The test's own setup, the fixture hash and inserts, is a small part.

## Fix

The modules load at the top of the file (ESM top-level await, as
`calendarMappingLookup.test.js` and `reminderScheduler.integration.test.js`
already do): the database mock is registered and the routes imported while the
module evaluates, which Jest does not run against a hook timeout. `beforeAll`
keeps only the fixtures. No timeout raised, no retry; assertions unchanged.

The fixture hash stays at cost 4 (commit e3c9b9a), as in the other route tests.
It was not the cause.

## The first fix was wrong (review 1)

e3c9b9a lowered the fixture hash from cost 10 to 4 and took that for the cause.
`red-before.txt` and `green-after.txt` are its evidence, kept as they were made.
They name no source commit, and their green (5 of 5) was luck: the same test at
e3c9b9a, alternated with 708b61d's under the same load, fails as often
(4 of 16 against 3 of 16, `ab-runs.txt` section A).

## Red before, green after

`ab-runs.txt`, made with `ab-repro.mjs`. Each run prints HEAD, the working-tree
diff and the blob of each side. The "before" side is the test taken from
708b61d by SHA. Both sides run alternately in the same load (24 busy loops on 8
cores), one in-band Jest run each:

| side | source | red |
|---|---|---|
| before | 708b61d, blob 95a093e | 4 of 18, 1 of 18; always the checks' 7 failures, hook at 5000 ms |
| after | this fix, blob 23df641 | 0 of 18, 0 of 18 |

In pairs 11-14 of run B the old file timed out four times running, and the new one passed next to it each time.

`load-repro.mjs` runs files over and over under load; `review1-cause.txt`
section 1 has its single-file runs. `probe-*.test.js.txt` are the step-timing
probes.

## Not fixed here

Other route tests load modules in `beforeAll` the same way (signInMethods,
providerSignIn, passwordReset, emailChange and others). They are exposed the
same way, but none was seen red in these runs. They are left to the
supervisor, outside T-210.

The whole server suite here: 71 of 72 files pass. The exception is
`startup/runtimeStartup.test.js`, which starts the app in a child process that
reads `server/.env` (`config/env.js`). The OS forbids that read in this session,
and the file does not touch authLogin.

## The bug the test guards

authLogin.test.js guards two fixed bugs: an OAuth-only account (no
password_hash) answered a password attempt with 500, telling it apart from an
unknown address; and unlinking the email provider left the password usable.
Neither has come back: `routes/auth.js` still answers a missing hash with the
same 401 as a wrong password, `utils/accountLinking.js` still sets
`password_hash = NULL` on unlink, and all 7 tests pass with the fix, the 401
and identical-body checks and the null-hash check after unlink included.

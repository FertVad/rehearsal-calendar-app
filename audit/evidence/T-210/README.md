# T-210: server test authLogin.test.js was flaky

Red run: T-004 checks, commit 20d3580, 27.10.2026 17:24 local (log
`e2e/out/failed/T-004-2026-10-27T15-10-15-177Z/checks.log`, not in git). All 7
tests of `server/__tests__/routes/authLogin.test.js` failed with "Exceeded
timeout of 5000 ms for a hook": the file's `beforeAll` did not finish. The
whole `npm test` took 288 s that run, against about 70 s for the server suite on
a quiet machine: the machine was loaded.

## Cause

`beforeAll` hashed the fixture password with `bcrypt.hash(PASSWORD, 10)`,
production's cost. Every other route test hashes its fixtures at cost 4. Login
compares at the cost stored in the hash, so cost 10 bought the test nothing.

The probe (`probe.test.js.txt`, a copy of the hook with time marks) shows where
the hook's time goes. Quiet: about 0.7-1.1 s, of it the cost-10 hash 170-200 ms.
With every core busy: about 4-5 s, of it the hash 0.9-1.1 s (cost 4: 3-29 ms).
The imports (express, supertest, routes/auth.js) are the same in every route
test and grow the same way; the hash is the second of the hook's five that only
this file spends, and it is what pushed it over.

## Red before

`red-before.txt`, made with `load-repro.mjs` (24 busy loops on 8 cores, in-band
Jest as the checks run it): the probe's timings, then authLogin red in 4 of 6
loaded runs with the checks' 7 failures, while providerSignIn, passwordReset,
signInMethods and emailChange (same imports, cost-4 hashes) stayed green in the
same runs.

## Fix

The fixture hash is made at cost 4, as in the other route tests. No timeout
raised, no retry.

## Green after

`green-after.txt`: the same load, 5 runs, authLogin green in all 5 and no longer
reported as slow; alone, all 7 tests pass.

Round 4 there lost one test of signInMethods ("lists the password of a new
registration", 5000 ms for a test). That test goes through POST /auth/register,
which hashes at cost 10 in `routes/auth.js` itself; not this test's fixture and
outside T-210, left for the supervisor.

## The bug the test guards

authLogin.test.js guards two fixed bugs: an OAuth-only account (no
password_hash) answered a password attempt with 500, telling it apart from an
unknown address; and unlinking the email provider left the password usable.
Neither has come back: `routes/auth.js` still answers a missing hash with the
same 401 as a wrong password, `utils/accountLinking.js` still sets
`password_hash = NULL` on unlink, and all 7 tests pass, including the 401 and
identical-body checks and the null-hash check after unlink.

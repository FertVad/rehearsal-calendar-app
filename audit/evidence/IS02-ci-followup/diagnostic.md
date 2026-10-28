# IS02 CI investigation — run 35427268043

Read-only diagnosis of the authorized repair-branch Application checks run.
No cancellation, rerun, source/evidence-manifest edit, deployment or production
access was performed.

Observed via official GitHub CLI/REST:

- Run head: 66246511b33062912679c9c3ea9289e1ccc05a51.
- Check job 105855264453 started 2026-09-19 06:41:02 UTC.
- Required check step started 06:41:56 UTC and was still in_progress at the
  latest observed status after 06:55 UTC.
- Dependency installation and Chromium/Linux dependency setup succeeded.
- postgres-a02 job 105855264313 succeeded at 06:41:49 UTC, including the real
  disposable PostgreSQL security scenarios.
- Exact committed workflow uses ubuntu-24.04, .nvmrc Node 22.16.0, and a
  20-minute check-job deadline. Its required command is npm run check.
- gh run view --job --log refuses until job completion. The official job/logs
  REST endpoint returned BlobNotFound HTTP 404. Check-run annotations_count is
  zero with no output text/summary. No browser surface is available for live UI.

The command performs worktree scanner, TypeScript check, mandatory synthetic
scanner CLI cases, Jest, browser tests and persisted-content Jest/browser tests.
Only the single shell step is visible while running, so its current substage is
not yet established.

The changed IS02 tests were read at exact committed source, rather than the R2
worktree. Middleware fake timers restore real timers in afterEach. HTTP tests
close their owned servers, but their individual supertest calls have no explicit
timeout; an unresolved HTTP exchange could leave cleanup pending. This is only a
hypothesis, not a finding or explanation of this run. Native SQLite's previously
observed cross-VM matcher problem was fixed before this run and cannot be assumed
to be the cause without the completed job log.

Next decisive evidence: download the finalized job log after natural completion
or its existing 20-minute timeout; locate the final successful stage/test and any
Jest timeout/open-handle report before proposing a source or fixture change.

## Finalized log: exact stage identified

The job completed cancelled at 07:01:17 UTC. Its GitHub check annotation states
`The job has exceeded the maximum execution time of 20m0s`. No agent cancelled
it. Full downloaded log:
`/private/tmp/reh-is02-ci-35427268043-check.log`.

- All 87 Jest suites and 1259 tests PASS at 06:43:07 UTC (56.954 seconds).
  The earlier HTTP/Jest/fake-timer hypotheses are not supported by this run.
- At 06:43:07.543 the runner starts the mandatory admin DOM/CSP browser suite.
- At 06:43:08.612 its first test, `untrusted admin API values remain literal
  text, even without CSP`, reports PASS.
- There is then no further output until cancellation at 07:01:14.968.
- The next test in exact committed source is `production CSP loads admin
  assets, blocks inline execution and preserves per-response nonces`.
  No second-test result or failed assertion is emitted. The stall is inside
  that test or its cleanup, not the completed Jest stage. Browser suites after
  this one were never reached.

The adminDashboard browser fixture registers `t.after(server.close)` before
`t.after(context.close)`. An open browser or API-request connection can prevent
server.close from finishing, so the context close that would release it is never
reached. This second test additionally opens page.request API connections. It
has no node:test deadline. This file is unchanged between IS01 and IS02.

A bounded synthetic check on Node 22.16.0 created one owned loopback HTTP server
and a raw preconnect socket, then called server.close. At 150 ms it remained
pending; after destroying the client socket it immediately resolved. Actual
exit 0 and both owned sockets cleaned. This proves the cleanup hazard, not the
identity of the particular Chromium connection in the completed CI job.

Recommended narrow follow-up: a single teardown closes the browser context
before waiting for HTTP server closure, with tracked owned-socket cleanup and a
bounded fallback; give browser tests an explicit test deadline. Do not weaken
assertions, force successful exit, skip the suite, or change IS02 runtime SQL to
address this evidence. Root has the exact log and findings; no source change or
rerun was performed by this investigation.

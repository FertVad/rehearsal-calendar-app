# T-294 — admin: days in the app, builds and invitation openings (migration 016)

Commits: `3265a9d` (016, recording, admin), `d771c31` (privacy policy),
`012f49b` (the failed-join test fails the join's own transaction),
`9d6fa2a` (the day's write never waits behind a sign-in). Base for red-before: `477ea2f`.
Node 26.13.0, PostgreSQL 15.13.

## Red before (477ea2f)

[red-before.txt](red-before.txt): the production files restored to the base, the
new tests kept. 41 of 167 fail across `usageStatistics`, `adminUsage`,
`privacyPage`, `privacyProcessors`; two invariants pass on the old code as they
should (refused requests write nothing; the invite page goes out with the
database down). PG `--t294-only` fails: no `native_usage_days`. The SKIP LOCKED
fix is red on `012f49b` through R3_AUTH (401 instead of 200).

## Green (9d6fa2a)

[green.txt](green.txt): the task's suites green; whole backend Jest 1425 passed,
8 failed — `runtimeStartup`, the same on the base (this sandbox forbids reading
`.env` files). Admin browser tests 10/10, 18/18, 6/6. knip, type-check clean,
lint 0 errors.

## PostgreSQL

[postgres.txt](postgres.txt): T294_USAGE (8 contracts), R2_SCHEMA fresh and
upgrade through 016 (25 tables), R2_MIGRATIONS, and every other scenario by
mode — all PASS except R2_STARTUP, which fails identically on the base (the same
`.env` sandbox).

## Mutations

[mutations.txt](mutations.txt): savepoint removed (PG join 500), day recorded
before the session checks, join counted before its transaction (caught after the
test was fixed to fail the join's own transaction), SKIP LOCKED removed (the
request hangs). A count after the commit is not caught and is correct.

## e2e

[e2e.txt](e2e.txt): 98-invite-page-in-safari, 08-invite-before-sign-in, 01-login
— passed.

## For the owner

- 016 is a manifest step after 013; the v1 hashes are re-pinned as for 012 and
  013. That is valid only while no database anyone keeps recorded a v1 history
  (OPS-R2-ADOPT open): the owner's `--dry` on production says which.
- The server works before 016 is applied: one log line, nothing recorded, the
  admin says "no data: migration 016 not applied".

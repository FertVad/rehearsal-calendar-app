# T-294 — admin: days in the app, builds and invitation openings (migration 016)

Commits: `3265a9d` (016, recording, admin), `d771c31` (privacy policy),
`012f49b` (the failed-join test fails the join's own transaction),
`9d6fa2a` (the day's write never waits behind a sign-in), then the rework below
(016 as schema version 2; the policy's retention). Base for red-before: `477ea2f`
(the rework's: `43b5e86`).
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

## Rework after the review of 24.11

The first version re-pinned v1's hashes on the assumption that no kept
database had a v1 history. Wrong: production was created by `migrate --fresh`
on 2026-10-28 (release 8a6dd5e = 477ea2f's migrator) and its root is `fresh`
`rehearsly-pg-current-v1`; that code would have answered `HISTORY_INVALID`
there. Fixed in the commit after `43b5e86`: v1's artifacts are back to 477ea2f
byte for byte, 016 is version 2 (`init-native-schema-v2.sql`,
`schema/catalog-v2.json`, `schema/inspect-v2.mjs`, profile
`rehearsly-pg-current-v2`), its step is rooted in the v1 profiles and verified
by v2. Then the privacy policy's four places (monitor's correction of 24.11).

[upgrade.txt](upgrade.txt): red on 43b5e86 (`HISTORY_INVALID` at the first
`--dry` on a database created by 477ea2f's own CLI; the identity test 4/4),
green here (`T294_UPGRADE`: `--dry` plans 016 alone, `--apply` applies it, the
next `--dry` is clean, the catalog equals fresh v2, the server records the
day), and every PG mode again.

## For the owner

- Production: `npm run migrate -- --dry` should answer `state: managed`,
  `rootId: rehearsly-pg-current-v1`, `stepIds: ["016-usage-statistics"]`. Then
  `--apply` adds the two tables and records one history row after the
  untouched root. Nothing else changes; the root record stays as written on 28.10.
- New empty databases (`--fresh`) are version 2, 25 tables.
- The server works before 016 is applied: one log line, nothing recorded, the
  admin says "no data: migration 016 not applied".

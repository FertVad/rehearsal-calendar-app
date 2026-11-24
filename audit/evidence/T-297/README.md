# T-297: T294_UPGRADE without 477ea2f in git history

CI (`actions/checkout`, depth 1) failed T294_UPGRADE: the scenario took
477ea2f's migrator from git (`git ls-tree`/`git show 477ea2f`), and a clone of
one commit has no 477ea2f (run 45320175318, job postgres-a02).

## Way chosen

477ea2f's migrator **code** is a fixture, byte for byte:
`server/__tests__/postgres/fixtures/migrator-477ea2f/` — `scripts/migrate.js`,
`database/migrations/{artifacts,cli,core,errors,history,sql}.mjs`,
`database/schema/manifest.mjs` (≈45 KB). `t294Upgrade.mjs` pins each file's
sha256 literally (from `git show 477ea2f:…`, `extract-fixture.mjs`).

The **v1 artifacts** its manifest names (`init-native-schema.sql`,
`catalog.json`, `inspect.mjs`, `availability-conflict-key-v1.sql`, migrations
007–013) are taken from this tree. They are immutable (schema README), the
scenario pins the same 11 hashes the old manifest pins, checks that the old
manifest names exactly these, and the old CLI itself refuses a changed one
(CHECKSUM_MISMATCH). So copying another 130 KB of identical bytes is not needed.

Why not "this tree's migrator with a v1-only manifest": production's database
was made by 477ea2f's code, not by today's. Today's `artifacts.mjs` already
knows group 016 (`tableGroups`), so a database it creates is not exactly the
one production has; running the real old code keeps the scenario's claim.
The root it writes is asserted literally as before: fresh
`rehearsly-pg-current-v1`, bootstrap `48284687…`, definition `8bf27697…`.

No git, no network: the scenario reads only files in the checkout. The
workflow is unchanged. knip ignores the fixture (`knip.jsonc`, with the reason):
its `./inspect.mjs` import resolves only in the temporary directory where the
scenario runs it.

## Evidence

- `red-before.txt` — depth-1 clone of auto/main (23f9b48; same server tests
  and migrator as ffc81af): `fatal: Not a valid object name 477ea2f`.
- `green.txt` — depth-1 clone of 5cfeffd: T294_UPGRADE PASS; mutation of one
  fixture byte fails it; check:dead, lint, check:secrets.
- `postgres.txt` — `--security-only` locally: all scenarios PASS except
  R2_STARTUP, which the sandbox cannot run (it refuses to read any `.env`).
- `depth1.mjs`, `security-rest.mjs`, `extract-fixture.mjs` — how to repeat.

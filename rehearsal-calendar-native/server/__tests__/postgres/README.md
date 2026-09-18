# Disposable PostgreSQL: regression controls and original-defect probes

Use Node **22.16.0**, pinned in the repository `.nvmrc`, and install native
dependencies with that same Node version. From `server/`:

```sh
# Focused release regression: controls plus the repaired A02 contract.
npm run test:r0-postgres -- --a02-only

# Required CI regression: controls plus A02, B03, B04 and H04.
npm run test:r0-postgres -- --security-only

# Individual shared-budget contracts.
npm run test:r0-postgres -- --b03-only
npm run test:r0-postgres -- --b04-only

# Admin bug-report status contract.
npm run test:r0-postgres -- --h04-only

# Full diagnostic run: repaired contracts and remaining original defects.
npm run test:r0-postgres
```

Unknown or repeated command-line arguments fail before Docker or database work.

Requires a running local Docker context (default `desktop-linux`; override via
`R0_DOCKER_CONTEXT`), Docker CLI at `/usr/local/bin/docker` (override via
`R0_DOCKER_BIN`), and a locally installed
official `postgres:15` image. The runner never pulls an image or accepts a
database URL. It resolves the local image ID, creates its own temporary container
with a random name/password, publishes PostgreSQL only on 127.0.0.1 and uses tmpfs
for data. No host DB directories or credentials are mounted. An ownership label
and a DB nonce guard cleanup/schema mutations. The container is removed in
`finally` on completion or test failure; after a forcibly killed runner, inspect
`docker --context desktop-linux ps -a --filter label=rehearsly.r0` and remove only
that abandoned test container after checking its label/name.
If a context override was used, inspect that same context for cleanup.
Every context, including overrides, must resolve to a local `unix://` socket;
remote Docker endpoints are rejected before container creation.

The separate `postgres-a02` job in `.github/workflows/check.yml` retains its ID
and runs `--security-only` on every push and pull request. It installs server dependencies with
the pinned Node version, explicitly pulls `postgres:15`, and uses GitHub's local
Docker `default` context with the discovered Docker CLI path. Image acquisition
is visible in the workflow; the runner itself still cannot pull an image.

Each probe has a fresh worker process and schema. Workers receive a closed list
of synthetic environment variables, never `.env`; outbound socket connections
are limited to the allocated local DB and HTTP ports. Real `createApp`, handlers,
services, JWT middleware and production PG adapter execute. The notification
inbox is real SQL, with zero registered devices and no external sends.

`fixture.sql` is a deliberately small PostgreSQL diagnostic schema, **not** a
replacement bootstrap/migration. A02 adds `timezone` and `last_login_at` columns
inside its disposable fixture so availability preprocessing and a real admin
users listing can execute. The production bootstrap file is executed separately
in a transaction and currently fails with SQLSTATE 42601 (F01).
Fresh-install/upgrade correctness remains an R2 gate.

The controls verify successful project+owner creation, a non-admin 403 without
writes, a valid rehearsal roster/availability/inbox, the real adapter rollback
and commit observed from a second connection, and admin CSP/assets.

A02 now asserts the **desired application contract**, not the original crash:

- Rename the actual PostgreSQL users table: protected GET and POST return exactly
  HTTP 500 `{ "error": "Internal server error" }` within three seconds. SQL,
  stacks and driver details must not leak. Health remains 200 during the fault.
- Restore the table: authorized traffic returns 200 again, and an independent
  SQL connection confirms all application rows are unchanged.
- Rename the timezone column while authentication still works: availability's
  pre-transaction DB read returns the same bounded generic 500 without killing
  the worker. Restore the column and confirm no application rows changed.
- Null entries and numeric `startsAt` receive 400 through both availability
  mounts. Full entry/date/source validation remains C02 work.
- Use real bcrypt with a generated synthetic hash: missing/null/number/object
  passwords receive 400, a wrong string receives 401, and the correct password
  yields a 200 and a token that can read the real admin users endpoint. A fresh
  app/listener for the wrong/correct pair preserves the production five-attempt
  rate limiter without exhausting it with the malformed-input cases.

The worker runs with `--unhandled-rejections=strict`; timeout, crash or an
incorrect status/body is a test failure. Exit 0 from `--a02-only` means controls
and these A02 contracts passed. This does not establish production migration or
mobile/device correctness.

The default diagnostic run also reproduces these **unfixed contracts**:

- B02: a trigger rejects membership insertion; project creation returns 500 but leaves the project row.
- D01: an outsider participant is accepted and gets an invitation and busy slot.
- F01: current mixed-dialect bootstrap is rejected by PostgreSQL.

Exit 0 from the full run means controls/A02/B03/B04/H04 passed **and** those three known
failures were reproduced. It does not mean B02/D01/F01 are safe. These probes
remain outside normal Jest discovery. When treating each remaining finding,
write its desired behavior as a regression assertion and retire/update that
baseline probe; never keep asserting the defective outcome as the release gate.
Historical R0 evidence retains the original A02 crash and source hashes.

B03 verifies bounded availability work, real SQL/response sentinels and one
account budget shared by two application instances. B04 verifies migration008,
IP/account invite budgets shared by canonical and legacy join paths, HEAD and
IP normalization, management compatibility, bounded storage, concurrent
allocation/pruning, and fail-closed recovery. Both run the actual additive
migration twice and assert business rows stay unchanged on denied requests.
Neither probe applies migrations to an existing or production database.

H04 uses a synthetic bug-report table and real admin login to check positive
int4 IDs, enum statuses, authentication before SQL, missing/deleted-report 404,
and successful/idempotent `UPDATE ... RETURNING`. An independent connection
checks every business table after invalid requests and after real trigger/table
failures. The failing trigger writes a side row before raising: both writes must
roll back, the client receives a generic 500, health remains available, and
valid updates recover once storage is restored. H04 adds no production schema
or migration changes.

The existing adapter has no public shutdown hook, so worker termination closes
its pool. A temp cwd with no `server/database` directory prevents the existing
SQLite fallback from touching repository data; `isPostgres === true` is required.
Fail-closed adapter configuration and an explicit lifecycle remain R2 work.

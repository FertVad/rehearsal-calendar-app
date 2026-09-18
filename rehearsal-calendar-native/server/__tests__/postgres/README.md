# R0: disposable PostgreSQL and original-defect probes

From `server/`, using the same Node major as installed native dependencies
(verified: Node 20.19.2):

```sh
npm run test:r0-postgres
```

Requires a running local Docker Desktop context `desktop-linux`, Docker CLI at
`/usr/local/bin/docker` (override via `R0_DOCKER_BIN`), and a locally installed
official `postgres:15` image. The runner never pulls an image or accepts a
database URL. It resolves the local image ID, creates its own temporary container
with a random name/password, publishes PostgreSQL only on 127.0.0.1 and uses tmpfs
for data. No host DB directories or credentials are mounted. An ownership label
and a DB nonce guard cleanup/schema mutations. The container is removed in
`finally` on completion or test failure; after a forcibly killed runner, inspect
`docker --context desktop-linux ps -a --filter label=rehearsly.r0` and remove only
that abandoned test container after checking its label/name.

Each probe has a fresh worker process and schema. Workers receive a closed list
of synthetic environment variables, never `.env`; outbound socket connections
are limited to the allocated local DB and HTTP ports. Real `createApp`, handlers,
services, JWT middleware and production PG adapter execute. The notification
inbox is real SQL, with zero registered devices and no external sends.

`fixture.sql` is a deliberately small PostgreSQL diagnostic schema, **not** a
replacement bootstrap/migration. The production bootstrap file is executed
separately in a transaction and currently fails with SQLSTATE 42601 (F01).
Fresh-install/upgrade correctness remains an R2 gate.

The controls verify successful project+owner creation, a non-admin 403 without
writes, a valid rehearsal roster/availability/inbox, the real adapter rollback
and commit observed from a second connection, and admin CSP/assets.

The other probes reproduce **unfixed application contracts**:

- A02: a real DB read error terminates an isolated strict-rejection worker.
- B02: a trigger rejects membership insertion; project creation returns 500 but leaves the project row.
- D01: an outsider participant is accepted and gets an invitation and busy slot.
- F01: current mixed-dialect bootstrap is rejected by PostgreSQL.

Exit 0 means the **diagnostic harness** passed and reproduced the known defects.
It does not mean those contracts are safe. These probes are intentionally kept
outside normal Jest discovery. When treating each finding, write the desired
behavior as a regression assertion and retire/update that baseline probe; never
keep asserting the defective outcome as the release gate. R0 evidence retains
the original outcomes and source hashes.

The existing adapter has no public shutdown hook, so worker termination closes
its pool. A temp cwd with no `server/database` directory prevents the existing
SQLite fallback from touching repository data; `isPostgres === true` is required.
Fail-closed adapter configuration and an explicit lifecycle remain R2 work.

# Server runtime and database lifecycle

PostgreSQL is the only supported server database, including local development.
SQLite remains an isolated test fixture. Runtime initialization never creates a
SQLite file or silently changes databases. This contract was selected by the
owner on 19 September 2026; it does not authorize a production connection.

## Local environment

The server uses `process.env`. To select a local environment file, explicitly
set `SERVER_ENV_FILE` to its absolute path; external variables retain precedence.
There is no implicit `.env` discovery. A missing/unreadable explicitly selected
file is a configuration error. Vercel supplies environment variables directly.

The repository's existing `server/.env` contains the production database URL.
Do not select it for local development or tests. Prepare an isolated PostgreSQL
instance and provide its URL as `DATABASE_URL` (or `POSTGRES_URL`), together with
appropriate synthetic local signing/admin configuration. Only then run
`npm start` or `npm run dev` from `server/`.

Automated PostgreSQL tests create their own disposable Docker database with
ownership checks; they do not accept a user database URL or load `.env`.
Startup tests copy known source/assets into a temporary fixture and execute
that copied entrypoint with a controlled environment.

## Startup and availability

`server.js` exports the Express application. A direct local invocation opens a
listener; importing the module or running with `VERCEL` set does not open one.
The default-export contract follows [Vercel's Express documentation](https://vercel.com/docs/frameworks/backend/express#using-a-default-export).
The existing explicit build/routes and public-file inclusion remain in place;
a local handler test is not a Vercel deployment test.

Public documents, association files, invite fallback, admin HTML/assets and
`GET /api/health` do not initialize PostgreSQL. Health is process liveness only.
The first DB-dependent API request shares a single initialization attempt with
concurrent requests (after a failure, see the pause below). An unavailable or missing PostgreSQL target yields generic
503 with `Cache-Control: no-store` before business/auth/crypto work.

`GET /api/ready` initializes when needed and performs an explicit bounded
`SELECT 1`. It returns200 `{ "status": "ready" }` or503
`{ "status": "unavailable" }`, always uncached. It proves connectivity at that
moment, not the presence of every application table/index or future availability.
It is never called by an added timer, scheduler or background monitor. Calling
readiness can wake a sleeping database and incur compute charges.

After failed initialization the process keeps serving public pages and answers
DB-dependent requests and readiness with 503 for a pause of 15 seconds, counted
from the end of the failed attempt, without touching the database. The first
DB-dependent or readiness request after the pause starts one new attempt;
concurrent requests share it, exactly like the first one. If it fails too, a
new pause begins. Traffic therefore never causes more than one connection
attempt per pause, however many requests arrive, and nothing retries on its
own: there is no timer, scheduler or background monitor, so an idle database
can still scale to zero.

Why a pause and not "unavailable until restart": on Vercel nobody restarts the
process. An instance lives for minutes, and before T-037 an instance whose first
attempt met a still-waking Neon compute answered 503 to all its traffic
(observed for about four minutes after a redeploy on 4 November 2026, with a
healthy database). Why 15 seconds: it is longer than one whole attempt (10 s
connection timeout plus the 2 s probe), so attempts never run back to back, and
it caps retry traffic at four attempts a minute per instance; at the same time
it is short against an instance's life, so the users of that instance recover
within seconds of the database becoming reachable. A broken configuration or a
database that stays down still yields 503 everywhere; restore it, and the next
request after the pause picks it up without a restart.

After successful initialization the driver may acquire replacement connections
as required by real queries; SQL is never automatically replayed by this
adapter.

Security configuration remains fail-fast: invalid JWT configuration/TTL or
missing required production settings can still prevent startup. The public-page
guarantee concerns database failure with otherwise valid application settings.
An application SQL/schema error after successful initialization is not converted
into a startup outage; the existing route/error handling still applies.

## Adapter contract

Importing `database/db.js` performs no file or network access. `initDatabase()`
validates an explicit PostgreSQL URL, tests a candidate pool and publishes the
adapter only after success. Concurrent calls share the same attempt. A successful
adapter remains bound to its original URL until explicit close/reinitialization.
`getDatabaseStatus()` reports lifecycle state; `ready` alone does not prove live
connectivity. `testConnection()` is the explicit connection probe.

`run()` returns `{ lastInsertId, changes }`, where `changes` is the driver's
`rowCount`, including0 for an unmatched mutation. `get()` returns one row or
undefined; `all()` returns all rows. Legacy question-mark placeholders and
implicit INSERT RETURNING id remain supported; new SQL should use PostgreSQL
placeholders. This layer does not translate SQLite schema/SQL into PostgreSQL.

`transaction(async tx => ...)` owns one connection. All operations in the
transaction must use `tx`, and every query must be awaited. Completion commits;
failure rolls back. A failed rollback discards the connection. A COMMIT that
PostgreSQL answers with ROLLBACK cannot be reported as success. Captured `tx`
handles reject after the callback ends.

The pool admits at most10 connections and100 queued acquisition requests.
Acquisition, including opening a new connection, times out after10 seconds;
timed-out queued work does not execute later. The number covers waking the
database: Neon suspends an idle compute ([scale to zero](https://neon.com/docs/introduction/scale-to-zero))
and the next connection waits while it starts. Neon describes that start as
usually a few hundred milliseconds, but its
[connection latency and timeouts](https://neon.com/docs/connect/connection-latency)
guidance warns it can take seconds and recommends raising client connection
timeouts to allow for it, in the order of 10 seconds rather than driver defaults
of a few. The previous 2 seconds was shorter than an observed wake-up (T-037).
A database that is really unreachable still fails within one bounded request
(at most 10 s to connect plus the 2 s probe). Connection probes keep their
own 2-second read timeout once connected and discard uncertain clients. Business SQL has no blanket statement deadline: operations such as
IS02 set their own lock/statement limits. HTTP deadlines do not imply SQL
cancellation or cancellation of an arbitrary JavaScript callback.

`closeDatabase()` immediately stops new admissions, invalidates captured adapter
handles and waits for issued leases/transactions and pending acquisition cleanup.
Repeated calls share close completion. Active callbacks may finish their scoped
SQL; a callback that never completes can keep graceful close pending. No hard
shutdown deadline or forced callback cancellation is promised.
`isPostgres` retains the engine identity while issued PostgreSQL leases drain;
it becomes false after close finishes. New admissions are already closed during
that interval, even though active transactions can still select their SQL dialect.

## Schema changes and production

Runtime initialization never provisions schema or runs migrations. Use the
separate [migration contract](server-migrations.md) for canonical fresh targets,
verified adoption and atomic forward changes. Legacy time conversions and
credential backfills require their own reviewed profiles; a successful startup
or readiness probe does not prove schema or historical data correctness.

Production access, migration, deployment and actual deployment smoke require
the owner's separate decision under [the access rules](../../audit/PRODUCTION_ACCESS.md).
The repair branch's automatic deployment and all reminder schedules remain off.

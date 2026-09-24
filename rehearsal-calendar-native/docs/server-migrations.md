# PostgreSQL schema management

The server uses PostgreSQL. Runtime startup never provisions schema, reads the
migration directory or applies upgrades. The migration CLI is an explicit
operator action, separate from deployment. SQLite is a test fixture only;
`better-sqlite3` is a development dependency, with its locked version unchanged.

## Select the target explicitly

Use Node22.16.0 and the locked server dependencies. Settings come from the process
or an explicitly selected absolute `SERVER_ENV_FILE`; no `.env` search occurs.
Process settings take precedence over that file. `DATABASE_URL` (or `POSTGRES_URL`)
must identify the intended PostgreSQL database. `MIGRATION_SCHEMA` selects an
already existing application schema, default `public`. It accepts a lowercase
identifier of at most63 characters and rejects system `pg_` names.
The tool does not create the schema or guess its ownership.

The checkout's `server/.env` contains production credentials. For local work use
the disposable test harness below or a separately owned local database. Reading
production configuration, inspection, adoption, migration and deployment each
remain subject to [the owner gate](../../audit/PRODUCTION_ACCESS.md).

From `server/`, after selecting the intended environment:

```sh
npm run migrate -- --help
npm run migrate -- --dry
```

Help and invalid arguments return before environment-file loading or database
access. Unknown, repeated, positional or conflicting arguments are errors.
`--baseline` always refuses, including together with `--dry`.

## Inspect, then choose one operation

| Mode | Contract |
|---|---|
| `--dry` | Inspect a repeatable read-only snapshot; no schema, business, sequence or history writes |
| `--fresh` | Provision the reviewed current snapshot only in an empty selected schema |
| `--adopt PROFILE` | Verify a named existing schema and record its actual starting state; no business SQL |
| `--apply` or no arguments | Apply approved pending steps from a verified root/history |

Dry is a separate mode. It reports eligible operations, not a future apply
authorization or a guarantee that the target cannot change. Write invocations
acquire their own lock and inspect the target again. Normal PostgreSQL read locks
and compute usage still occur during dry; READ ONLY does not mean zero I/O.

Fresh refuses a nonempty schema, including an old migration ledger or an unrelated
sentinel table. It executes `database/init-native-schema.sql`, validates its
catalog/data postconditions and records one fresh root atomically. It does not
pretend that every historical migration ran. Existing IDs are int4; fresh generated
IDs use database-owned identity sequences. Instants use timestamptz, while project
calendar dates use date. Fresh provider metadata remains text, preserving the
active declared contract. Fresh bug-report creation time is timestamptz; existing
naive timestamps are not silently converted.

The modern adoption profiles require the expected columns, types, defaults,
validated constraints, usable conflict targets and indexes. An index name alone
does not prove uniqueness. Extra restrictive constraints, triggers, RLS, partial
budget groups and incompatible legacy columns fail inspection.

The domain profile permits wholly absent approved budget groups007/008/009;
`--apply` installs the missing groups in explicit order after adoption. Existing
groups must have valid structures and consistent counters. The explicit
pre-import-key profile permits a missing availability conflict key only when
the duplicate preflight is clean; its first forward step creates that key.
No duplicate is deleted to make the index fit. Manual entries with NULL external
IDs remain legal. Reconciliation of conflicting imported rows needs a separate
reviewed policy.

## Transactions and history

One write invocation is one transaction on one owned PostgreSQL client. A fixed
transaction advisory lock serializes cooperating migrators, including through
transaction pooling. Existing target-table locks prevent application DML and
ordinary table DDL from invalidating adoption checks before history is recorded.
They can fail on a busy application; schedule an operator-controlled maintenance
window rather than removing the guard. These locks do not coordinate the retired
runner or arbitrary creation of unrelated/missing objects.

Connection timeout is2s, lock timeout1s, statement timeout30s, client read
timeout35s and idle transaction timeout60s. These are separate limits, not a
single total run deadline. A client timeout does not prove instant server-side
cancellation. The client closes after failure; no automatic SQL replay occurs.
Before COMMIT, an error rolls back every pending step in this invocation,
including its history rows. Previously committed runs remain intact.
If the COMMIT response is lost, the result is explicitly unknown: inspect history
before deciding on a new invocation. Never assume that uncertain COMMIT rolled back.

`native_schema_history` distinguishes fresh, adoption and actually executed
forward SQL. It validates ordinals, IDs, predecessor state and immutable hashes.
Adoption records the verified profile and inspected legacy evidence, not invented
execution checksums. Existing `native_migrations` rows remain unchanged. Later
history drift, an edited approved artifact or an unknown old filename refuses.
Use a new reviewed forward artifact for changes; never edit an applied migration.
Every referenced v1 checker, descriptor, bootstrap and forward SQL file is
immutable after release. Future profiles use new versioned paths; each profile
pins its own checker and each step declares its applicable root profiles. A new
fresh default does not replace the checker for an existing history lineage.

SQL is read from a curated manifest, validated and snapshotted before connecting.
Unlisted files are not automatically runnable. Transaction control and unsupported
nontransactional steps are rejected; there is no generic escape hatch that
pretends those steps are atomic. CLI output uses stable codes and reviewed IDs,
without credentials, raw SQL errors or business row values.

## Historical files are names, not steps

`server/migrations/` is the record of what older databases ran by hand. The
runner reads those filenames only to verify an existing `native_migrations`
ledger; the only files it executes are the reviewed forward steps named in
`database/schema/manifest.mjs` (007, 008, 009 and the availability key). Do not
run the others with `psql` either. Two of them are known to corrupt data:

- **FM01.** `migrate-*-to-timestamptz.sql` cast `date + time` with a bare
  `::TIMESTAMPTZ`, which reads the wall clock in the *session* zone. In an
  `Asia/Jerusalem` session a documented 10:00 UTC rehearsal becomes 07:00Z and an
  all-day date lands on the previous day. A database still in that DATE + TIME
  layout is refused by every mode here; converting one needs a new reviewed
  profile with an explicit UTC source, not these files.
- **FM02.** `001-add-oauth-providers.sql` is SQLite dialect and fails on
  PostgreSQL. Its backfill inserts a second email-provider row per user on every
  rerun, because the NULL subject never conflicts. There is no SQLite path left
  to rerun it on. Keeping one email method per user is credential work (A04/R3),
  not this file's.

Neither fix says anything about data those files already converted. Production
ran them by hand (the conversions are dated 2025-12-10) and was baselined by the
old runner on 2026-08-26 with 17 filenames; that ledger records what was
claimed, not what the catalog or the historical instants actually are.

## Local verification and remaining legacy work

The harness creates and deletes its own loopback Docker PostgreSQL. It accepts
no database URL and requires an already installed postgres:15 image:

```sh
npm run test:r0-postgres -- --r2-migrations-schema-only
```

The same schema/migration cases are required in the PostgreSQL CI job. They must
verify fresh and supported-upgrade catalog parity, actual application operations,
read-only dry, failure between SQL and ledger, serialization, checksum/history
refusal, and unchanged rows on rejected upgrades.

Modern adoption is not a universal legacy upgrade. Old date/time semantics,
already shifted instants, naive timestamps, old reminder claims and OAuth/email
backfills require explicit separate profiles and data checks. No old fields or
claims are discarded by this stage. Runtime/fixture success does not establish
the actual production schema, ledger or historical data quality.

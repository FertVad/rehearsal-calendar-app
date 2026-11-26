# Canonical PostgreSQL schema, versions 1, 2 and 3

The canonical fresh snapshot is `../init-native-schema-v3.sql` (version 3,
profile `rehearsly-pg-current-v3`). The migration CLI
selects it through the reviewed manifest; it is not a startup hook. Fresh requires
an empty, explicitly selected application schema and commits DDL, verified
postconditions and the new history record in one transaction. The snapshot has
no table drops, historical data conversion or implicit environment loading.

Version 1 — `../init-native-schema.sql`, `catalog.json`, `inspect.mjs` — defines
23 application tables: 13 domain tables, the six tables
of the approved 007/008/009 budget groups, the two of group 010 (email
address proof, R3), the one of group 011 (push tickets awaiting their
receipts, R8) and the one of group 012 (idempotency keys of creates, R4).
Version 2 — `../init-native-schema-v2.sql`, `catalog-v2.json`, `inspect-v2.mjs`
— is version 1 plus the two tables of group 016 (the days someone used the
app and the invitation counts, T-294): 25 tables. Version 3 —
`../init-native-schema-v3.sql`, `catalog-v3.json`, `inspect-v3.mjs` — is version 2
plus group 017, three columns of `native_users` (weekends busy by default,
T-406): `weekends_busy`, `weekends_through`, `weekends_days`. Still 25 tables.
Both supply the availability conflict
key, notification indexes and other historical structural postconditions that
the old mixed-dialect bootstrap omitted. Fresh `provider_metadata` is TEXT;
`native_bug_reports.created_at` and other instant columns are TIMESTAMPTZ.
No existing column is silently cast to those types.

## Named profiles

- `rehearsly-pg-current-v3`: all 25 tables of version 3 with the three
  weekends_* columns. `--fresh` creates it; adoption is allowed. Its checker is
  `inspect-v3.mjs`.
- `rehearsly-pg-current-v2`: all 25 tables of version 2, required
  constraints/indexes, and consistent budget gate rows. No longer created by
  `--fresh` (its manifest entry stays as recorded); adoption is allowed; `--apply`
  adds 017. Its checker is `inspect-v2.mjs`.
- `rehearsly-pg-current-v1`: all 23 tables of version 1. No longer created by
  `--fresh`, but production's history root (see below), so it stays exactly
  as recorded. `--apply` adds 016, then 017.
- `rehearsly-pg-domain13-v1`: the complete modern domain schema, with each budget
  group either wholly absent or fully compatible. After adoption, an explicit
  `--apply` installs the missing approved groups in 007, 008, 009, 010, 011, 012, 013 order, then 016 and 017.
- `rehearsly-pg-domain13-pre-import-key-v1`: the same modern predecessor, except
  that the availability imported-event unique key is absent and the aggregate
  duplicate count is zero. Adoption requires this explicit profile. Apply first
  runs `availability-conflict-key-v1.sql`, then missing budget groups. The repair
  only creates the index; it never deletes rows or chooses a duplicate winner.

An old `native_migrations` row is unverified historical evidence. Adoption leaves
that table unchanged and records a verified profile in `native_schema_history`.
It does not fabricate execution records or checksums for historical SQL files.
Only SQL actually executed by the new runner receives a migration history entry.
Whole existing budget groups are validated rather than marked newly executed.

## Catalog contract

`catalog.json` is a reviewed, generated catalog reference captured from the
canonical snapshot in an owned PostgreSQL 15 fixture. `inspect.mjs` uses scoped
catalog reads and aggregate data checks; it does not create objects, run stored
user expressions, discover environment files or open its own connection. The
inspector works in a read-only transaction. The caller owns connection settings,
transaction isolation and locks.

The contract compares column type, width, nullability, default and generator
semantics; validated primary/foreign/check constraints and referential actions;
and index keys, ordering, predicate, access method, operator class, collation,
uniqueness, immediacy, validity, readiness and NULL semantics. Object names and
OIDs are not substitutes for those checks. Owned int4 SERIAL and BY DEFAULT
identity generators normalize to the same API contract. An immediate unique
constraint or equivalent unique index supplies the same conflict target.

The profile is deliberately strict. It rejects extra columns, unknown checks,
unique or expression indexes, triggers, rewrite rules, RLS, inheritance, partial
budget groups, and unknown incoming foreign keys from other/retired tables.
Disabled or replica-only internal FK triggers are also rejected: PostgreSQL's
validated constraint metadata alone does not prove that writes enforce the FK.
Nonunique index definitions also must match reviewed index semantics; arbitrary
expressions or operator classes can change writes. Known retired tables may
remain untouched only when they add no unknown incoming dependencies. Legacy
reminder uniqueness on `(rehearsal_id, reminder_type)` is incompatible even when
the newer per-recipient key is present.

The repair index name is reserved. A different index/table/sequence occupying
`idx_availability_imported_event` fails preflight before DDL. Budget gate rows and
actual key counts are read in a single statement per group, so ordinary limiter
transactions cannot create an artificial cross-statement mismatch. Nonzero,
consistent counters are legal and excluded from the schema evidence fingerprint.

PostgreSQL 15 is the tested catalog reference, not a statement about the current
production version. Versions below 15 receive `UNSUPPORTED_PG_VERSION` before
version-dependent catalog queries. A later version must still satisfy the strict
catalog checks; this does not claim that its version-specific behavior has been
tested. Expressions are compared using PostgreSQL's canonical catalog output;
this is a defined compatible profile, not a proof that arbitrary SQL expressions
are logically equivalent.

Existing JSONB provider metadata, naive timestamp columns, old date/time layouts,
pre-recipient reminders and OAuth backfills require separately named, reviewed
profiles and appropriate read/write or conversion evidence. They are not silently
accepted by v1. Nullable retained legacy source fields likewise need their own
explicit successor profile. FM01/FM02 transitions remain separate work; refusing
an unexplained legacy shape does not close those findings.

## Immutable artifacts and future profiles

The manifest contains literal checked-in hashes. Import never recalculates an
expected hash from the current file. The loader verifies immutable byte snapshots,
including the descriptor's binding to its fresh bootstrap. Each profile pins its
own inspector artifact. Each forward step declares the root profile IDs to which
it applies, so unrelated future profiles do not silently alter a v1 plan.

After the verified v1 source is committed, **every referenced v1 artifact remains
immutable**: `inspect.mjs`, `catalog.json`, `../init-native-schema.sql`, this
version's repair SQL, and the approved historical 007/008/009 bytes. A future
profile uses new versioned checker, descriptor, bootstrap and forward-artifact
paths. The exported dispatcher/manifest may add those profiles while retaining
the original v1 hashes and definitions. Do not replace the old bootstrap path or
recompute old expected hashes to make previously recorded history appear valid.

One exception, taken before this rule could bite: on 2026-09-25 R3 extended v1
with group 010 (the 010 step, its tables in the snapshot and the descriptor, the
inspector's group list) and re-pinned the hashes. No persistent database had
recorded a v1 history then — production was not adopted and every test schema
is disposable — so no recorded root changed meaning. The owner confirmed on
2026-09-25 that the new migrator has never run against a database anyone kept.
From the first production adoption on, changes take new versioned paths as
described above.

On 2026-10-14 R4 (cause fix 11, G01) changed a domain table the same way, still
before any adoption: `native_push_tokens` is unique on `device_token` alone
instead of `(user_id, device_token)`, and the plain token index is gone. The
snapshot, catalog and manifest were re-pinned. This is group 013, a key rather
than tables: the inspector counts it present when the token is unique on its
own, and otherwise checks `native_push_tokens` against its predecessor shape.
`migrations/013-push-token-owner.sql` is its forward step (dropping all but the
most recently active holder of each token), installed by `--apply` after 012.

That was the last change inside v1. Production's database `rehearsly` was
created on 2026-10-28 by `migrate --fresh` (release 8a6dd5e, whose migrator and
manifest are 477ea2f's) and is kept by this runner: its history root is
`fresh` `rehearsly-pg-current-v1` with bootstrap `48284687…`, descriptor
`3ed03aaa…` and inspector `a38f465f…`, and the owner's `--dry` on 16.11 and
20.11 answered `state: managed`, budgets 007–013, no steps. From then on the
rule above binds: re-pinning any v1 hash would make every later run there
answer `HISTORY_INVALID`.

T-294 (group 016: `native_usage_days`, `native_invite_counts`) is therefore
version 2, on new paths: `../init-native-schema-v2.sql`, `catalog-v2.json`,
`inspect-v2.mjs`, profile `rehearsly-pg-current-v2` (fresh and adopt), and the
forward step `migrations/016-usage-statistics.sql`. The step's roots are the
three v1 profiles and it is verified by `rehearsly-pg-current-v2`, so a v1
database receives 016 by `--apply` after its own missing groups, and every run
after that checks it with version 2's checker. The v1 artifacts are byte for
byte those of 477ea2f, and the manifest keeps their hashes and definitions;
`__tests__/database/schemaHistoryIdentity.test.js` pins the recorded
identities, and `__tests__/postgres/t294Upgrade.mjs` creates a database with
477ea2f's own CLI and upgrades it with this one. The checker is chosen per
profile by the dispatcher `inspectSchema` that `manifest.mjs` exports.

`r2Schema.mjs` checks actual fresh and adopted schemas through the real migration
runner and application HTTP/adapter code, plus independent catalog drift and
data-preservation controls. It explicitly reproduces PostgreSQL `42P10` on an
owned missing-key fixture. That negative control is not a claim that the original
mixed-dialect bootstrap successfully provisioned PostgreSQL.

T-406 (group 017: the weekends_* columns of `native_users`) is version 3 the
same way: `../init-native-schema-v3.sql`, `catalog-v3.json` (version 2's catalog
plus the three columns, checked against a `--fresh` on PostgreSQL 15 by
`r2Schema.mjs`), `inspect-v3.mjs`, profile `rehearsly-pg-current-v3`, and the
forward step `migrations/017-weekend-defaults.sql`, rooted in the three v1
profiles and in `rehearsly-pg-current-v2` and verified by v3. Like 013 it is no
table: the checker finds the group by the three columns. Version 2's artifacts
and definitions are byte for byte those of b8722df, pinned by
`schemaHistoryIdentity.test.js` with v1's; `__tests__/postgres/t406Upgrade.mjs`
builds production's database with 477ea2f's `--fresh` and b8722df's 016 and
applies 017 with this tree.

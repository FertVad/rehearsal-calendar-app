# Canonical PostgreSQL schema, version 1

The canonical fresh snapshot is `../init-native-schema.sql`. The migration CLI
selects it through the reviewed manifest; it is not a startup hook. Fresh requires
an empty, explicitly selected application schema and commits DDL, verified
postconditions and the new history record in one transaction. The snapshot has
no table drops, historical data conversion or implicit environment loading.

The snapshot defines 19 application tables: 13 domain tables and the six tables
from the approved 007/008/009 budget groups. It supplies the availability conflict
key, notification indexes and other historical structural postconditions that
the old mixed-dialect bootstrap omitted. Fresh `provider_metadata` is TEXT;
`native_bug_reports.created_at` and other instant columns are TIMESTAMPTZ.
No existing column is silently cast to those types.

## Named profiles

- `rehearsly-pg-current-v1`: all 19 tables, required constraints/indexes, and
  consistent budget gate rows. Fresh and adoption are both allowed.
- `rehearsly-pg-domain13-v1`: the complete modern domain schema, with each budget
  group either wholly absent or fully compatible. After adoption, an explicit
  `--apply` installs the missing approved groups in 007, 008, 009 order.
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

`r2Schema.mjs` checks actual fresh and adopted schemas through the real migration
runner and application HTTP/adapter code, plus independent catalog drift and
data-preservation controls. It explicitly reproduces PostgreSQL `42P10` on an
owned missing-key fixture. That negative control is not a claim that the original
mixed-dialect bootstrap successfully provisioned PostgreSQL.

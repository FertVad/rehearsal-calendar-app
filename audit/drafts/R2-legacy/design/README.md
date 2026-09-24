# FM01 / FM02: explicit legacy transitions

Design only, 2026-09-19. Repository source was read as text. No legacy SQL,
runner, database, application entrypoint or `.env` was executed/read as an
environment file. No production catalog or data was inspected. No repository
files were changed. These documents are proposals, not passing evidence.

## Recommended bounded implementation

1. **FM01:** implement a named PostgreSQL transition from the documented UTC
   DATE + TIME layout to instants. Preserve source values. Accept only the
   enumerated layout and data preconditions in [FM01.md](FM01.md). Reject any
   prefilled destination instant on a first application. Do not execute or edit
   the historical migrations in place.
2. **FM02:** implement a named PostgreSQL email-provider backfill for a
   duplicate-free registry, protected by a partial unique index on user_id for
   email rows, and a matching ON CONFLICT target. Existing provider rows,
   passwords, sessions and OAuth identities remain intact. Duplicate groups
   refuse unchanged; an optional lossless reconciliation is a separate
   transition, not an implicit MIN(id) deletion. See [FM02.md](FM02.md).
3. Prove the supported transitions with owned real PostgreSQL fixtures before
   marking them implemented. [TESTPLAN.md](TESTPLAN.md) separates migration
   mechanics, concurrency and current-consumer compatibility from deployment.

## Integration with the in-progress F01/F02/FT01/FT02 work

Read `/private/tmp/reh-r2-schema-design/design.md`, schema inspector interface
provided by h02_contract, and `/private/tmp/reh-r2-migrations-design/interface.md`
plus the current tmp core. The current frontier intentionally knows only modern
domain v1, availability conflict key and budget groups. It cannot truthfully
represent a legacy conversion merely by adding another SQL filename.

Add explicit versioned predecessor/postcondition profiles and frontier states
for these transitions; keep existing profile/artifact hashes immutable. A new
profile may allow the precisely listed retained source columns or email index;
the generic modern-v1 checker must continue rejecting unexplained extras/drift.
Selection of a legacy profile must be explicit. Do not silently add legacy
conversion SQL to the existing default apply list before the manifest/parser
can represent its preconditions. Exact public names below are proposals.

The tmp core currently binds every profile definition to one inspector hash.
Future extension must retain the exact historical validator/definition identity
or introduce an explicit versioned compatibility mechanism: editing a shared
inspector must not silently regenerate different hashes for already-recorded
roots. This is an integration requirement for the later FM manifest, not a
request to weaken current history/checksum validation.

The runner owns the connection, whole-batch transaction, fixed advisory lock,
sorted SHARE ROW EXCLUSIVE locks on every affected known table, timeouts,
artifact snapshot and history commit. A lock on the migration runner alone does
not stop application DML. Repeat inspection and data preflight after acquiring
the table locks. Dry remains REPEATABLE READ READ ONLY: no ledger, archive,
sequence operation, DDL or repair. A dry result is a snapshot, not a reservation.
Existing history records actual artifact checksums; never assert the old001 or
date conversion filenames executed. A commit whose outcome is unknown is
resolved by later explicit history inspection, not blind replay.

The runner currently normalizes its session to UTC. FM01 SQL must nevertheless
contain explicit UTC conversion, and direct artifact tests must use non-UTC
sessions; otherwise the runner setting can hide the very defect being repaired.

## What needs a decision, and what does not

| Question | Boundary |
| --- | --- |
| Explicit UTC expressions, safe index predicate, transaction/locks, refusal on ambiguous input | Implementable locally under the existing task; no new user preference needed. |
| Are actual legacy values documented UTC, local wall time, or mixed? Which types/columns/constraints/history remain? | Cannot infer from source comments. A future approved production catalog/data preflight or an owner-provided sanitized snapshot is required before choosing a real target profile. No access is requested or attempted here. |
| Have filled instants already been shifted, or legitimately edited? | Requires provenance/data-specific reconciliation. Never derive an offset from current TimeZone, user timezone or the date alone. |
| Which conflicting duplicate provider metadata/identity is authoritative? | Refuse by default. A separate reviewed, non-loss reconciliation plan is necessary; no arbitrary winner. Identical-row archival can have a deterministic technical policy, but actual archive retention/access and a real data plan remain deployment concerns. |
| Should old all-day intervals become next-midnight half-open intervals or 23:59:59.999? | R6 contract change. FM01 preserves historical 00:00–23:59 UTC semantics. |
| Should an email be verified, a password cleared, accounts merged, sessions revoked, or unlink redefined? | A01/A04/R3 product/security flow. FM02 provides none of that authority. |
| Backup, maintenance window, deployment/production migration | Separate production authorization; local fixture success does not prove readiness or authorize a run. |

## Sources inspected

- `audit/notes-migrations.md`, `notes-auth.md`, `notes-availability.md`, R2/R3/R6
  plan and current registry.
- Historical `migrations/001-add-oauth-providers.sql`, both
  `migrate-*-to-timestamptz.sql`, `fix-date-column-types.sql`, both drop-old
  files, and both all-day flag migrations, as text only.
- `database/init-native-schema.sql`; `routes/auth.js`,
  `utils/accountLinking.js`, `routes/native/availability.js`,
  `services/rehearsals/rehearsalService.js`, `slotService.js`,
  `utils/timezone.js`, and client `useAvailabilitySave.ts`.
- Official PostgreSQL 15 documentation, solely to verify SQL semantics:
  [date/time](https://www.postgresql.org/docs/15/functions-datetime.html),
  [partial indexes](https://www.postgresql.org/docs/15/indexes-partial.html),
  [INSERT](https://www.postgresql.org/docs/15/sql-insert.html),
  [table locks](https://www.postgresql.org/docs/15/explicit-locking.html).

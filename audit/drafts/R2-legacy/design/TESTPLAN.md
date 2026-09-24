# Real PostgreSQL evidence required before implementation claims

No tests below have been executed for this design. Use one owned disposable
PostgreSQL instance, explicit schemas/databases and controlled clients/processes.
Never load a checkout `.env`, production entrypoint or historical runner.
Tests must execute the actual new artifacts and inspector/runner, not copied
happy-path SQL. Historical expressions may be evaluated only in an approved
synthetic fixture to capture the original defect; no historical runner needed.

## FM01

1. Before: source 2026-09-10 10:00/12:00, old expression in Asia/Jerusalem
   produces shifted epochs. After: actual new artifact yields exact 10:00Z /
   12:00Z under UTC, Asia/Jerusalem and America/Los_Angeles. Include winter,
   summer and DST transition dates, fractional seconds and month/year edges.
   Assert epochs/UTC SQL components, not display text in the current session.
2. Availability true flag gives exactly 00:00Z–23:59Z regardless of session;
   ignored source clock NULL/noncanonical values survive. Rehearsals preserve
   their own source interval even with an all-day flag. Ordinary timed rows
   preserve flag/type/source/external ID/ownership/title/notes exactly.
3. Wrong type, missing/null flag, missing dates/timed clocks, infinity/out of
   runtime range, 24:00, equal/reversed interval and unsupported date timestamp
   shape each refuse with stable codes and identical pre-state. Separate optional
   UTC-midnight-timestamptz profile needs positive/negative nonmidnight fixtures.
4. Each target variant: absent/declared both-empty succeeds; starts filled,
   ends filled, both filled or a mixed cohort refuses without overwriting a
   single value. Include a filled value already equal to the candidate.
5. Capture all source/related rows and relevant catalog/ledger before; require
   exact preservation except explicitly added targets/indexes/constraints and
   relaxed legacy source NOT NULL. Failure injected after target updates and
   before history must restore both data and DDL, including column nullability.
6. Real runtime adapter + createApp consumers read converted rows and create a
   new rehearsal/availability row without legacy fields. New source fields are
   NULL; old source values remain. Edit an existing target through the runtime,
   rerun the already-committed transition, and prove it neither reconverts nor
   rejects the legitimate edit as historic source drift.
7. Two runner processes race the same transition: one commit, no double update
   or duplicated history; busy peer can explicitly retry unchanged. Hold an
   app write lock to prove migration lock timeout rolls back. Hold migration
   preflight via an observed barrier and prove concurrent DML cannot alter the
   source until commit. No sleep-only assertion of serialization.

## FM02

1. Before: the historical nullable-subject conflict target admits two email
   rows for one user. After: several eligible users receive exactly one each;
   NULL/empty-password OAuth-only users receive none. Real bcrypt password
   login still works, OAuth identity lookup works, and token_version/hash bytes
   remain unchanged. Avoid a new-account OAuth trust-flow test in this scope.
2. Existing matching email row with sentinel metadata/timestamps is unchanged;
   NULL provider_email remains unknown. Missing user timestamps do not violate
   provider NOT NULL; new record timestamps reflect the migration and no new
   last_used_at/verification evidence is fabricated. Compare all users and
   preexisting provider records, not only counts.
3. Repeat through actual history is unchanged. Deliberately unlink in a fixture
   after a completed migration and rerun: applied history must not secretly
   re-add a row. A separate requested later repair requires a new artifact/ID.
4. Race two real connections/processes at the missing-email insertion. Exercise
   runner serialization, and independently exercise the installed index with
   the actual INSERT statement from two transactions that do not use the
   runner advisory lock. Require one row per eligible user, no unique error
   hidden as success, no unrelated OAuth conflict swallowed. Include users with
   distinct NULL email subjects and two OAuth subjects for the same user to
   prove the key was not broadened accidentally.
5. Same-name wrong/partial-wrong/invalid index, duplicate email group, unexpected
   email external subject, stale email-with-no-password, or non-NULL mismatched
   provider email: strict profile refuses with complete rows/history unchanged.
   Optional exact-duplicate archival, if implemented, requires reconstruction
   of every original row; a differing metadata/time field must refuse.
6. Actual SQL failure/trigger after index creation or during insertion rolls
   back inserted rows, new index and history together. Repeat successfully after
   fault removal. Contending password/provider write is blocked through commit
   or causes bounded migration refusal, never an unverified partial backfill.

## Cross-cutting / integration

- Dry for every supported/refused profile leaves catalog, history, row values
  and sequence state unchanged and creates no archive or local data artifact.
- Artifact/checksum mismatch, untrusted old ledger and unsupported mixed schema
  refuse. Old native_migrations rows remain exact; no invented execution marks.
- Redaction tests seed distinct synthetic email/hash/metadata/time markers and
  force errors; stdout/stderr/JSON contain only allowed codes and counts.
- Fresh schema and the supported upgraded successor satisfy the same runtime
  constraints/indexes, allowing only explicitly declared preserved source or
  archival extras. Inspect table schemas rather than matching object names.
- A transient runner lock or SQL timeout may fail safely; success is not required
  under unavailable resources. No auto-retry after ambiguous COMMIT.
- No claim about actual production history/data/timezone, complete A04 registry
  consistency, account verification, R6 all-day correction or migration rollout
  follows from these fixture results.

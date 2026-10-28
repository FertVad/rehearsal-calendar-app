# FM01/FM02 draft transitions — owned fixture evidence

Status: actual before/after proof for draft SQL, not repository integration or
finding closure. Prepared 2026-09-19. All new files are in this tmp directory;
the repository, schema frontier, modern manifest and historical evidence were
not edited. No production access, environment file, old runner or application
entrypoint was used. The three historical SQL files were copied as text from
HEAD `aa00ffd5874b3b5e4c402b42b120ceb876e637e2` before execution on owned fixtures.

## Actual result

| Run | Result | Scope |
| --- | --- | --- |
| before.txt | exit 1; 1 control PASS / 4 desired regressions FAIL | Exact historical full time SQL succeeds under UTC but shifts both timed/all-day instants under Jerusalem and Los Angeles. Exact SQLite001 replay produces 2 email rows. The documented PostgreSQL nullable conflict-target equivalent produces 2 rows per eligible user. |
| after.txt | exit 0; 26/26 PASS | Actual forward SQL through the draft transaction helper, plus direct concurrent INSERT from the same artifact. All PG containers were removed in finally after ownership-label validation. |

The PostgreSQL before INSERT is explicitly a materialization of the commented
PG ON CONFLICT example, not a claim that SQLite001 is PostgreSQL syntax. It uses
timestamp fallbacks solely to isolate the nullable-key defect. The exact active
SQLite file itself was executed twice on `:memory:` with synthetic users.

Node v22.16.0; PostgreSQL 15.13, locally installed official image
`sha256:b8e11f8a8b383e19589a086a78b10f9ca69a39d6c9dcdd9342a8697544e8b3a0`.
The runner accepts only before/after, never a supplied database URL; it creates
its own loopback-only container, random credentials and ownership marker.
No image is pulled. Children receive only the generated fixture URL/nonce and
minimal environment. Logs expose source hashes, labels and counts, not row or
credential values. `source-hashes.json` records exact local artifact identities;
this is not a historical repository evidence manifest.

## Draft files and validated behavior

- `forward/fm01-utc-instants-v1.sql`: two-table DATE/TIME profile; both targets
  absent or both nullable/all-NULL. Explicit UTC expressions retain microseconds,
  historical all-day 00:00–23:59 endpoints and ignored source clocks. It refuses
  any prefilled target, bad types, NULL flags, equal intervals, infinite dates or
  24:00; takes original snapshots and rejects changes to every original field.
  Original columns remain, with only their NOT NULL relaxed for modern inserts.
- `forward/fm02-email-backfill-v1.sql`: duplicate-free modern registry profile,
  partial email(user_id) uniqueness, targeted ON CONFLICT, existing rows intact.
  Duplicate/stale/mismatched/subject-bearing email records, overlong source
  email and same-name wrong key refuse unchanged. New registry timestamps mean
  creation now; last_used_at and metadata stay unknown, with no verified claim.
- `forward/draftTransition.mjs`: tmp-only scoped transaction/lock wrapper with
  `fm_draft_history`, hashes and minimum touched-structure replay checks. SQL,
  postconditions and the draft history commit atomically. Applied history skips
  data backfill after legitimate instant edits or explicit provider deletion.
- `tests/after.mjs`: real SQL rollback before history, unchanged source snapshots,
  source-change trigger detection, real bcrypt compatibility with unchanged
  hashes/token versions, multiple OAuth subjects unaffected, actual two-client
  index contention observed via pg_stat_activity Lock, migration peer busy plus
  explicit retry, user writes held through commit, bounded writer-lock refusal.

The post-conversion insert assertion exercises the current consumers' column
shape (only instants supplied), **not createApp HTTP**. Bcrypt comparison proves
one synthetic stored password remains usable; it is not a complete auth route
or A04 registry test. Two clients genuinely contend on the index without the
migration advisory lock in that test; the runner-peer test is a distinct case.

## Remaining before repository integration

1. The wrapper and narrow synthetic table schema are not the modern production
   runner/catalog checker. Add explicit predecessor/successor profiles with
   preserved nullable time columns and email key, while retaining historical
   descriptor identities. Reuse the actual modern history/transaction boundary;
   do not ship a second fm_draft_history system or silently extend modern-v1.
2. Full catalog preflight must reject unknown triggers/RLS/extra restrictive
   constraints, bad types/defaults and identity/FK/index drift. The SQL tests
   deliberately inject a trigger to prove source-change rollback, but this is
   not permission for an arbitrary trigger in a supported real schema.
3. Integrate required equivalent indexes/constraints via the canonical checker.
   The draft uses dedicated fm01 names and refuses collisions instead of
   silently trusting IF NOT EXISTS. Full normalized fresh/upgrade parity and
   all current handlers still require the schema/HTTP integration stage.
4. Run read-only dry/real history/checksum/adoption tests using the actual new
   manifest; this draft has no CLI dry/profile selection support. Its 26 PASS
   cases are not evidence for those future interfaces.
5. Add owned real PostgreSQL createApp read/create/edit/login/provider assertions
   on the complete supported upgraded schema. No runtime writer fix, archive
   consolidation, broad timestamp conversion, prefilled-instant repair, A01/A04
   policy or R6 semantic change is included.

An actual production profile still needs separately authorized catalog/data
preflight, provenance and backup/recovery planning. Present tests do not infer
whether historical production data has either defect.

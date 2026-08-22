# Quick Reference - Critical Rules

## NEVER / ALWAYS

| NEVER | ALWAYS | Why |
|-------|--------|-----|
| `req.user.id` | `req.userId` | req.user is undefined |
| `WHERE id = ?` | `WHERE id = $1` | PostgreSQL uses $N |
| `VALUES (NOW())` | `VALUES ($1)` + `[new Date().toISOString()]` | Consistency |
| All-day: `T23:59:00+02:00` | All-day: `T23:59:59.999Z` | UTC only for all-day |
| `WHERE is_active = 1` | `WHERE is_active = TRUE` | PostgreSQL boolean syntax |
| 404 for "nothing found" | 200 with `null` | Absence is the usual answer for a lookup; a 404 makes the common path look like a failure and hides the real ones |
| Rebuild availability, then set participants | Participants first | `bookRehearsalSlots` reads the roster from the responses table |
| Treat `response = 'no'` as declined | It means invited, not yet seen | Dropping the row takes the person off the rehearsal |

## Most Common Errors

1. **"Cannot read properties of undefined (reading 'id')"**
   - Fix: `req.user.id` → `req.userId`

2. **"violates check constraint chk_availability_time_order"**
   - Fix: Use UTC (`.000Z`) for all-day events, not `+02:00`

3. **"operator does not exist: boolean = integer"**
   - Fix: Use `TRUE`/`FALSE` for PostgreSQL, not `1`/`0`

4. **A query works in production but fails only under test**
   - The in-memory schema in `server/__tests__/integration/setup.js` is written
     by hand and drifts from the shipped one. Compare it against
     `database/init-native-schema.sql` before suspecting the query.
   - It also rewrites `$1, $2 …` into `?`. Postgres lets the same `$n` appear
     twice — upserts do — so the translator maps each occurrence back to its
     parameter. New SQL shapes may need it taught more.

5. **A test that passes on one machine and fails on another**
   - Usually a timezone: an expectation computed with the machine's zone while
     the code under test is mocked to UTC. Pin `timeZone` in the expectation.
   - Or a hardcoded future date that has since become the past.

---

**Full docs**: [CLAUDE.md](../../CLAUDE.md)

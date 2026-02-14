# Quick Reference - Critical Rules

## NEVER / ALWAYS

| NEVER | ALWAYS | Why |
|-------|--------|-----|
| `req.user.id` | `req.userId` | req.user is undefined |
| `WHERE id = ?` | `WHERE id = $1` | PostgreSQL uses $N |
| `VALUES (NOW())` | `VALUES ($1)` + `[new Date().toISOString()]` | Consistency |
| All-day: `T23:59:00+02:00` | All-day: `T23:59:59.999Z` | UTC only for all-day |
| `WHERE is_active = 1` | `WHERE is_active = TRUE` | PostgreSQL boolean syntax |

## Most Common Errors

1. **"Cannot read properties of undefined (reading 'id')"**
   - Fix: `req.user.id` → `req.userId`

2. **"violates check constraint chk_availability_time_order"**
   - Fix: Use UTC (`.000Z`) for all-day events, not `+02:00`

3. **"operator does not exist: boolean = integer"**
   - Fix: Use `TRUE`/`FALSE` for PostgreSQL, not `1`/`0`

---

**Full docs**: [CLAUDE.md](../../CLAUDE.md)

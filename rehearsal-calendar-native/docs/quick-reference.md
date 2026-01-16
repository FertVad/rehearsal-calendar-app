# AI Quick Reference - Critical Rules

> **⚡ Ultra-short version**. For details see [.claude/AI_INSTRUCTIONS.md](.claude/AI_INSTRUCTIONS.md)

## 🚨 Before You Start
```bash
# Read these files FIRST:
1. .claude/AI_INSTRUCTIONS.md                       ← Start here
2. rehearsal-calendar-native/PROJECT_INFO.md        ← Architecture
3. rehearsal-calendar-native/server/API_STANDARDS.md ← API rules
```

## ❌ NEVER Do This → ✅ ALWAYS Do This

| ❌ NEVER | ✅ ALWAYS | Why |
|---------|----------|-----|
| `req.user.id` | `req.userId` | req.user is undefined |
| `WHERE id = ?` | `WHERE id = $1` | PostgreSQL uses $N |
| `VALUES (NOW())` | `VALUES ($1)` + `[new Date().toISOString()]` | Consistency |
| All-day: `T23:59:00+02:00` | All-day: `T23:59:59.999Z` | UTC only for all-day |

## 📋 Before Commit
```bash
cd rehearsal-calendar-native/server && npm run check  # ← Run this!
```

## 🔥 Most Common Errors Fixed

1. **"Cannot read properties of undefined (reading 'id')"**
   - Fix: Change `req.user.id` → `req.userId`

2. **"violates check constraint chk_availability_time_order"**
   - Fix: Use UTC for all-day events (`.000Z` not `+02:00`)

3. **Calendar sync broken**
   - Fix: Always use `req.userId`, always use `$N` placeholders

---

**Full docs**: [.claude/AI_INSTRUCTIONS.md](.claude/AI_INSTRUCTIONS.md)

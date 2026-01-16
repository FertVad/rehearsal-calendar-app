# Claude Code Instructions Directory

This directory contains **mandatory documentation for AI assistants** working on this project.

## 📁 Files Overview

### 🔴 [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) - **READ THIS FIRST**
Complete guide with:
- Critical rules (authentication, database, timestamps)
- Common mistakes and solutions
- Code standards summary
- Testing procedures
- Best practices

**When to read**: At the start of EVERY session

---

### 🟡 [CHECKLIST.md](CHECKLIST.md) - **Use Before Every Change**
Step-by-step checklist covering:
- Pre-flight checks
- Development guidelines
- Pre-commit verification
- Error prevention patterns
- Emergency rollback procedures

**When to use**: Before making ANY code changes

---

### 🟢 [GETTING_STARTED.md](GETTING_STARTED.md) - **First 5 minutes guide**
Quick onboarding guide for AI assistants:
- Quick start (30 seconds)
- Full learning path (15 minutes)
- File overview and success checklist
- Emergency reference

**When to read**: First time working on this project

---

### 🟢 [settings.local.json](settings.local.json) - Claude Code Settings
Custom settings for this project (if any).

---

## 🔗 Related Documentation

### In Project Root
- [../rehearsal-calendar-native/docs/quick-reference.md](../../rehearsal-calendar-native/docs/quick-reference.md) - Ultra-short version of critical rules
- [DOCUMENTATION_MAP.md](../DOCUMENTATION_MAP.md) - Navigation guide for all docs

### In rehearsal-calendar-native/
- [../rehearsal-calendar-native/docs/project-info.md](../../rehearsal-calendar-native/docs/project-info.md) - Full project architecture and tech stack
- [server/API_STANDARDS.md](../../rehearsal-calendar-native/docs/api-standards.md) - Detailed API conventions
- [server/database/MIGRATION_TO_TIMESTAMPTZ.md](../rehearsal-calendar-native/server/database/MIGRATION_TO_TIMESTAMPTZ.md) - Timestamp handling
- [server/scripts/check-consistency.js](../rehearsal-calendar-native/server/scripts/check-consistency.js) - Automated checker

---

## 🎯 Quick Start for AI Assistants

**First time on this project?**
```
1. Read: .claude/AI_INSTRUCTIONS.md      (5 min)
2. Skim: PROJECT_INFO.md                 (3 min)
3. Reference: ../rehearsal-calendar-native/docs/quick-reference.md      (1 min)
4. Keep open: .claude/CHECKLIST.md       (use continuously)
```

**Returning to this project?**
```
1. Quick refresh: ../rehearsal-calendar-native/docs/quick-reference.md  (30 sec)
2. Check latest: git log --oneline -5    (see recent changes)
3. Review: CHECKLIST.md                  (before changes)
```

---

## 🚨 Critical Rules Summary

| Rule | Do This | Not This |
|------|---------|----------|
| Auth | `req.userId` | `req.user.id` |
| DB | `WHERE id = $1` | `WHERE id = ?` |
| Dates | `new Date().toISOString()` | `NOW()` |
| All-day | `T23:59:59.999Z` | `T23:59:00+02:00` |

---

## 🔄 Keeping Documentation Updated

**When to update this directory:**
1. New pattern discovered ➡️ Update AI_INSTRUCTIONS.md
2. New common error ➡️ Update CHECKLIST.md
3. Architecture change ➡️ Update PROJECT_INFO.md
4. New API convention ➡️ Update server/API_STANDARDS.md

**Who updates:** Any AI assistant who discovers something important

**How often:** Immediately when pattern/error is identified

---

## 📊 Success Metrics

These docs are working if:
- ✅ No `req.user.id` errors
- ✅ No timestamp constraint violations
- ✅ Consistency checker shows 0 errors
- ✅ Fewer questions about "how to do X"
- ✅ New AI sessions are productive immediately

---

**Last Updated**: December 25, 2025
**Maintained by**: AI assistants (Claude, etc.)
**Purpose**: Prevent errors, maintain consistency, speed up development

# Getting Started - For AI Assistants

> **Your first 5 minutes on this project**

---

## 🚀 Quick Start (30 seconds)

1. **Open this file**: [QUICK_RULES.txt](QUICK_RULES.txt)
   - Pin it to top of your screen
   - Refers to it constantly while coding

2. **Critical Rules** (memorize these):
   - ✅ `req.userId` not `req.user.id`
   - ✅ `$N` placeholders not `?`
   - ✅ `new Date().toISOString()` not `NOW()`
   - ✅ UTC `.000Z` for all-day events

3. **Before changing code**:
   - Read: [CHECKLIST.md](CHECKLIST.md)
   - Run: `cd rehearsal-calendar-native/server && npm run check`

---

## 📚 Full Learning Path (15 minutes)

### Step 1: Critical Rules (5 min)
Read [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) sections:
- § Critical Rules (Must know!)
- § Mandatory Checklist
- § Common Mistakes

### Step 2: Architecture (5 min)
Read [../../rehearsal-calendar-native/docs/project-info.md](../../rehearsal-calendar-native/docs/project-info.md) sections:
- § Technology Stack
- § Database Tables
- § API Structure

### Step 3: Code Patterns (5 min)
Skim [CODE_EXAMPLES.md](CODE_EXAMPLES.md) for:
- Authentication pattern
- Database query pattern
- Route template

---

## 🎯 Your First Task

When you get your first task:

```
1. Read task description
2. Check CHECKLIST.md for relevant rules
3. Look at CODE_EXAMPLES.md for similar pattern
4. Read the file you'll modify (use Read tool)
5. Make minimal changes following existing patterns
6. Run: npm run check
7. Test the change
```

---

## 🔥 Emergency Reference

**Something broke?**
1. Check [QUICK_RULES.txt](QUICK_RULES.txt) - did you violate a rule?
2. Run `npm run check` - automated error detection
3. See [CHECKLIST.md § Emergency Rollback](CHECKLIST.md#-emergency-rollback)

**Not sure what to do?**
1. Check [CODE_EXAMPLES.md](CODE_EXAMPLES.md) for similar code
2. Read [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) for the topic
3. Look at existing code in the same file for patterns

---

## 📂 File Overview

| File | Purpose | When to Use |
|------|---------|-------------|
| **QUICK_RULES.txt** | ASCII cheat sheet | Keep visible always |
| **AI_INSTRUCTIONS.md** | Complete guide | Read at session start |
| **CHECKLIST.md** | Step-by-step verification | Before every change |
| **CODE_EXAMPLES.md** | Copy-paste patterns | When writing code |
| **README.md** | Meta-documentation | Understanding .claude/ |
| **GETTING_STARTED.md** | This file | First session |

---

## ✅ Success Checklist

You're ready to code when you can answer YES to:

- [ ] I know to use `req.userId` not `req.user.id`
- [ ] I know to use `$N` placeholders in SQL
- [ ] I know to use JavaScript dates not `NOW()`
- [ ] I know all-day events use UTC timestamps
- [ ] I know to run `npm run check` before commit
- [ ] I have CHECKLIST.md open for reference
- [ ] I've skimmed CODE_EXAMPLES.md

---

## 🎓 What Makes This Project Different

**Common pitfalls in THIS project** (not general coding):

1. **Authentication**: Uses `req.userId` directly (not `req.user.id`)
2. **Database**: PostgreSQL with `$N` (wrapper auto-converts `?` but prefer `$N`)
3. **Timestamps**: All-day events MUST use UTC to avoid constraint violations
4. **Deduplication**: Rehearsal > Manual > Imported slots (priority system)

---

## 💡 Pro Tips

1. **Read before write**: Always use Read tool before Edit
2. **Copy existing patterns**: Look at similar routes in the same file
3. **Test incrementally**: Don't change 10 files at once
4. **Use consistency checker**: `npm run check` catches 90% of errors
5. **Check server logs**: Most errors show there first

---

## 🎯 Your Mission

**Goal**: Make changes without introducing the errors this documentation prevents.

**How**: Follow the rules, use the checklists, copy the patterns.

**Result**: Consistent, working code that fits the project's style.

---

**Ready? Start with [QUICK_RULES.txt](QUICK_RULES.txt) and [CHECKLIST.md](CHECKLIST.md)!**

Good luck! 🚀

# Pre-Change Checklist for AI Assistants

Use this checklist **every time** before making code changes.

## ✅ Pre-Flight Check

- [ ] Read [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md)
- [ ] Read [../rehearsal-calendar-native/docs/project-info.md](../../rehearsal-calendar-native/docs/project-info.md) for context
- [ ] Read [server/API_STANDARDS.md](../../rehearsal-calendar-native/docs/api-standards.md) for API rules
- [ ] Understand what files will be modified

## ✅ During Development

### Authentication
- [ ] Used `req.userId` (not `req.user.id`)
- [ ] Checked that route has `requireAuth` middleware

### Database Queries
- [ ] Used `$N` placeholders (not `?`)
- [ ] Used `new Date().toISOString()` for timestamps (not `NOW()`)
- [ ] Parameterized all user inputs (no SQL injection risk)

### Timestamps & Dates
- [ ] All-day events use UTC format (`.000Z`)
- [ ] Timed events use timezone offset format
- [ ] Checked for `ends_at > starts_at` constraint

### Error Handling
- [ ] All async routes have try-catch
- [ ] Error responses include descriptive messages
- [ ] Used console.error with `[RouteName]` prefix

### Code Quality
- [ ] Followed existing code patterns in the file
- [ ] Validated required parameters
- [ ] Added comments for complex logic
- [ ] No hardcoded values (use env variables)

## ✅ Before Committing

### Testing
- [ ] Ran consistency checker: `cd rehearsal-calendar-native/server && npm run check`
- [ ] Restarted server and checked logs
- [ ] Tested affected endpoints
- [ ] Verified no TypeScript errors (if frontend changed)

### Code Review
- [ ] Used Read tool before editing files
- [ ] Made minimal changes (no over-engineering)
- [ ] No backwards-compatibility hacks
- [ ] Deleted unused code completely

### Documentation
- [ ] Updated comments if logic changed
- [ ] Updated API_STANDARDS.md if new pattern added
- [ ] Updated this checklist if new rule discovered

## ✅ Common Error Prevention

### Check for these patterns (WRONG):
```javascript
❌ req.user.id
❌ WHERE id = ?
❌ VALUES (NOW())
❌ startsAt: "2025-12-25T23:59:00+02:00" with isAllDay: true
❌ Async route without try-catch
❌ Missing input validation
```

### Replace with these patterns (CORRECT):
```javascript
✅ req.userId
✅ WHERE id = $1
✅ VALUES ($1) with [new Date().toISOString()]
✅ startsAt: "2025-12-25T23:59:59.999Z" with isAllDay: true
✅ try { } catch (error) { }
✅ if (!param) return res.status(400).json({error: '...'})
```

## 🚨 Emergency Rollback

If you introduced a breaking change:

1. Identify the broken commit
2. Check git diff to see changes
3. Revert changes to working state
4. Test that rollback fixes the issue
5. Understand what went wrong before trying again

## 📊 Success Metrics

Good session indicators:
- ✅ Consistency checker: 0 errors
- ✅ Server starts without errors
- ✅ All tests pass
- ✅ No TypeScript errors
- ✅ User confirmed functionality works

---

**Use this checklist EVERY TIME** - it prevents 95% of common errors!

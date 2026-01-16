# AI Assistant Instructions - Rehearsal Calendar Native App

> **CRITICAL**: Read this file BEFORE making any code changes. These instructions prevent common errors and maintain codebase consistency.

---

## 🚨 CRITICAL RULES - DO NOT VIOLATE

### 1. Authentication
```javascript
// ✅ ALWAYS use this
const userId = req.userId;

// ❌ NEVER use this (req.user is undefined)
const userId = req.user.id;
```
**Why**: The `requireAuth` middleware sets `req.userId` directly.

### 2. Database Queries
```javascript
// ✅ RECOMMENDED - Use $N placeholders
await db.get('SELECT * FROM users WHERE id = $1 AND status = $2', [userId, 'active']);

// ⚠️ Works but NOT RECOMMENDED - ? placeholders (auto-converted)
await db.get('SELECT * FROM users WHERE id = ? AND status = ?', [userId, 'active']);
```
**Why**: PostgreSQL uses `$N` syntax. While `?` works (auto-converted internally), prefer `$N` for clarity and consistency.

### 3. Timestamps
```javascript
// ✅ ALWAYS use JavaScript dates
const now = new Date().toISOString();
await db.run('INSERT INTO table (created_at) VALUES ($1)', [now]);

// ❌ NEVER use SQL NOW()
await db.run('INSERT INTO table (created_at) VALUES (NOW())');
```
**Why**: Consistency across codebase.

### 4. All-day Events
```javascript
// ✅ ALWAYS use UTC for all-day events
{
  startsAt: "2025-12-25T00:00:00.000Z",
  endsAt: "2025-12-25T23:59:59.999Z",
  isAllDay: true
}

// ❌ NEVER use timezone offset for all-day
{
  startsAt: "2025-12-25T00:00:00+02:00",  // ❌ Can cause ends_at < starts_at!
  endsAt: "2025-12-25T23:59:00+02:00",
  isAllDay: true
}
```
**Why**: Timezone offset causes database constraint violations when converted to UTC.

---

## 📋 MANDATORY CHECKLIST Before Any Change

Before making changes, run:
```bash
cd rehearsal-calendar-native/server && npm run check
```

After making changes:
1. ✅ Run consistency checker: `npm run check`
2. ✅ Restart server and check logs for errors
3. ✅ Test affected endpoints
4. ✅ Verify no TypeScript errors (frontend)

---

## 📚 Required Reading

**ALWAYS read these files before starting work:**

1. **[../rehearsal-calendar-native/docs/project-info.md](../rehearsal-calendar-native/docs/project-info.md)** - Project architecture, tech stack, database schema
2. **[server/API_STANDARDS.md](../rehearsal-calendar-native/docs/api-standards.md)** - Detailed API conventions
3. **[server/database/MIGRATION_TO_TIMESTAMPTZ.md](rehearsal-calendar-native/server/database/MIGRATION_TO_TIMESTAMPTZ.md)** - Timestamp handling rules

---

## ⚠️ Common Mistakes to Avoid

### Mistake 1: Using req.user.id
**Error**: `TypeError: Cannot read properties of undefined (reading 'id')`
**Fix**: Use `req.userId` instead

### Mistake 2: All-day events with timezone offset
**Error**: `new row violates check constraint "chk_availability_time_order"`
**Fix**: Use UTC timestamps for all-day events

### Mistake 3: Using ? instead of $N placeholders
**Problem**: Works (auto-converted), but creates inconsistency
**Fix**: Prefer `$N` placeholders for clarity and consistency

### Mistake 4: Not restarting server after route changes
**Problem**: Changes not reflected, old code still running
**Fix**: Kill and restart server process

---

## 🔧 Project Structure

```
server/
├── routes/native/        # API routes for React Native app
│   ├── auth.js          # Authentication
│   ├── projects.js      # Project management
│   ├── rehearsals.js    # Rehearsal scheduling
│   ├── availability.js  # User availability
│   ├── calendarSync.js  # Native calendar integration
│   ├── members.js       # Project members
│   └── invites.js       # Invite system
├── database/
│   ├── db.js           # Database wrapper (auto-converts ? → $N)
│   └── migrate-native-app.js
├── middleware/
│   └── jwtMiddleware.js # Sets req.userId
└── scripts/
    └── check-consistency.js  # Automated checks
```

---

## 🎯 Code Standards Summary

### Error Handling
```javascript
router.post('/endpoint', requireAuth, async (req, res) => {
  try {
    // Your code here
    res.json({ success: true });
  } catch (error) {
    console.error('[RouteName] Error:', error);
    res.status(500).json({ error: 'Error message' });
  }
});
```

### Response Format
```javascript
// ✅ Success
res.json({ success: true, data: result });

// ✅ Error
res.status(400).json({ error: 'Error message' });
```

### Validation
```javascript
if (!requiredParam) {
  return res.status(400).json({ error: 'requiredParam is required' });
}
```

---

## 🗄️ Database Schema Key Points

- **TIMESTAMPTZ**: All timestamps are timezone-aware
- **Constraint**: `ends_at > starts_at` (enforced at DB level)
- **Event Sources**: `rehearsal`, `manual`, `apple_calendar`, `google_calendar`
- **Deduplication**: Prioritize `rehearsal > manual > imported`

---

## 🧪 Testing Changes

### Backend
```bash
# Restart server
cd server && npm start

# Check logs
# Look for errors in console output

# Test endpoint
curl -X GET http://localhost:3001/api/native/... \
  -H "Authorization: Bearer $TOKEN"
```

### Frontend (React Native)
```bash
# Type check
npm run type-check

# Restart Metro
npx expo start

# For iOS physical device changes
# May need: cd ios && pod install && rebuild in Xcode
```

---

## 🆘 When Things Break

1. **Check server logs** - Most errors show there first
2. **Run consistency checker** - Catches common issues
3. **Review recent changes** - Use git diff
4. **Check database constraints** - Especially for timestamp errors
5. **Restart everything** - Server, Metro, app

---

## 💡 Best Practices

1. **Read before writing** - Always read files before modifying
2. **Test incrementally** - Don't change many files at once
3. **Follow existing patterns** - Look at similar code in the same file
4. **Use descriptive logging** - Include `[RouteName]` prefix
5. **Validate inputs** - Check required params before using
6. **Handle edge cases** - All-day events, timezones, null values

---

## 📝 Documentation Updates

When you add new features:
1. Update this file if new patterns emerge
2. Update API_STANDARDS.md for new API conventions
3. Update PROJECT_INFO.md for architecture changes
4. Add inline comments for complex logic

---

**Last Updated**: December 25, 2025
**Maintained by**: AI assistants working on this project
**Review frequency**: After any major architectural change

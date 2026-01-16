# API Standards & Best Practices

## Authentication

### ✅ CORRECT - Use req.userId
```javascript
router.get('/endpoint', requireAuth, async (req, res) => {
  const userId = req.userId;  // ✅ Correct
  // ...
});
```

### ❌ WRONG - Don't use req.user
```javascript
router.get('/endpoint', requireAuth, async (req, res) => {
  const userId = req.user.id;  // ❌ Wrong - req.user is undefined
  // ...
});
```

**Why:** The `requireAuth` middleware sets `req.userId` directly, not `req.user`.

---

## Database Queries

### PostgreSQL Parameter Syntax

**Use `$1, $2, $3` syntax (preferred):**

```javascript
// ✅ RECOMMENDED - Clear and explicit
await db.all(
  'SELECT * FROM users WHERE id = $1 AND status = $2',
  [userId, 'active']
);

// ⚠️ WORKS BUT NOT RECOMMENDED - Auto-converted internally
await db.all(
  'SELECT * FROM users WHERE id = ? AND status = ?',
  [userId, 'active']
);
```

**Why:**
- PostgreSQL natively uses `$N` placeholders
- While `?` (SQLite syntax) technically works due to auto-conversion in `db.js`, using `$N` makes code clearer and more consistent
- All route files now use `$N` syntax consistently ✅

**Technical Note:** The db wrapper auto-converts `?` → `$N` using this transform:
```javascript
sql.replace(/\?/g, () => `$${++idx}`)
```
However, explicit `$N` syntax is preferred for code clarity.

---

## Error Handling

### All async routes MUST have try-catch:

```javascript
// ✅ CORRECT
router.post('/endpoint', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    // ... your code
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error message' });
  }
});

// ❌ WRONG - No error handling
router.post('/endpoint', requireAuth, async (req, res) => {
  const userId = req.userId;
  // ... your code - can crash server if error occurs
  res.json({ success: true });
});
```

---

## Response Format

### Consistent JSON responses:

```javascript
// ✅ Success response
res.json({
  success: true,
  data: result
});

// ✅ Error response
res.status(400).json({
  error: 'Error message',
  details: 'More info'
});

// ❌ WRONG - Inconsistent
res.send('OK');  // Don't use plain text
res.json(result); // Don't send raw data without wrapper
```

---

## Timestamps

### All-day events MUST use UTC timestamps:

```javascript
// ✅ CORRECT - All-day events in UTC
{
  "startsAt": "2025-12-25T00:00:00.000Z",
  "endsAt": "2025-12-25T23:59:59.999Z",
  "isAllDay": true
}

// ✅ CORRECT - Timed events with timezone
{
  "startsAt": "2025-12-25T14:00:00+02:00",
  "endsAt": "2025-12-25T16:00:00+02:00",
  "isAllDay": false
}

// ❌ WRONG - All-day with timezone offset
{
  "startsAt": "2025-12-25T00:00:00+02:00",
  "endsAt": "2025-12-25T23:59:00+02:00",  // Can cause end < start!
  "isAllDay": true
}
```

**Why:** All-day events represent calendar dates, not specific moments in time. Using UTC prevents timezone offset issues.

---

## Logging

### Consistent log prefixes:

```javascript
// ✅ CORRECT
console.log('[RouteName] User logged in:', userId);
console.error('[RouteName] Error:', error);

// ❌ WRONG
console.log('User logged in');  // No context
```

---

## Validation

### Validate input before using:

```javascript
// ✅ CORRECT
router.post('/endpoint', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required' });
    }

    // ... process
  } catch (error) {
    // ...
  }
});

// ❌ WRONG - No validation
router.post('/endpoint', requireAuth, async (req, res) => {
  const { name, email } = req.body;
  // ... directly using without checking
});
```

---

## Running Consistency Checks

Run before committing:

```bash
node server/scripts/check-consistency.js
```

This will check for:
- `req.user.id` usage (should be `req.userId`)
- Mixing `?` and `$N` placeholders
- Missing error handling in async routes
- Other common issues

---

## Testing Changes

After making changes to routes:

1. ✅ Restart the server
2. ✅ Test the affected endpoints
3. ✅ Run consistency checker
4. ✅ Check server logs for errors

---

Last updated: December 25, 2025

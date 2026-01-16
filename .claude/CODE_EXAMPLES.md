# Code Examples - Common Patterns & Fixes

> **Copy-paste ready examples** for common scenarios in this project.

---

## 🔐 Authentication

### ❌ WRONG - Will crash with "Cannot read properties of undefined"
```javascript
router.get('/endpoint', requireAuth, async (req, res) => {
  const userId = req.user.id;  // ❌ req.user is undefined!
  // ...
});
```

### ✅ CORRECT
```javascript
router.get('/endpoint', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;  // ✅ Set by requireAuth middleware
    // ... your code
    res.json({ success: true });
  } catch (error) {
    console.error('[RouteName] Error:', error);
    res.status(500).json({ error: 'Failed to ...' });
  }
});
```

---

## 💾 Database Queries

### ❌ WRONG - Inconsistent style
```javascript
// Using ? placeholders (SQLite style)
const user = await db.get(
  'SELECT * FROM users WHERE id = ? AND status = ?',
  [userId, 'active']
);

// Using NOW() function
await db.run(
  'UPDATE users SET updated_at = NOW() WHERE id = ?',
  [userId]
);
```

### ✅ CORRECT - PostgreSQL style with $N
```javascript
// Using $N placeholders (PostgreSQL style)
const user = await db.get(
  'SELECT * FROM users WHERE id = $1 AND status = $2',
  [userId, 'active']
);

// Using JavaScript dates
await db.run(
  'UPDATE users SET updated_at = $1 WHERE id = $2',
  [new Date().toISOString(), userId]
);
```

---

## 📅 Timestamps - All-day Events

### ❌ WRONG - Will cause constraint violation
```javascript
// Frontend sending all-day event
const payload = {
  startsAt: createTimestamp(date, '00:00'),  // → "2025-12-25T00:00:00+02:00"
  endsAt: createTimestamp(date, '23:59'),    // → "2025-12-25T23:59:00+02:00"
  isAllDay: true
};

// When converted to UTC, this becomes:
// startsAt: "2025-12-24T22:00:00Z"  (previous day!)
// endsAt:   "2025-12-25T21:59:00Z"
// Violates: ends_at > starts_at ❌
```

### ✅ CORRECT - Use UTC for all-day events
```javascript
// Frontend sending all-day event
const payload = {
  startsAt: `${date}T00:00:00.000Z`,  // UTC timestamp
  endsAt: `${date}T23:59:59.999Z`,    // UTC timestamp
  isAllDay: true
};

// Always stays within the same day in UTC
// No timezone conversion issues ✅
```

---

## 📅 Timestamps - Timed Events

### ✅ CORRECT - Use timezone offset for timed events
```javascript
// For specific time events, include timezone
const payload = {
  startsAt: createTimestamp(date, '14:00'),  // "2025-12-25T14:00:00+02:00"
  endsAt: createTimestamp(date, '16:00'),    // "2025-12-25T16:00:00+02:00"
  isAllDay: false
};

// Database stores as TIMESTAMPTZ, preserves user's timezone ✅
```

---

## 📝 Creating New Route

### ✅ CORRECT Template
```javascript
import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';

const router = Router();

/**
 * POST /api/native/your-endpoint
 * Description of what this endpoint does
 */
router.post('/your-endpoint', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { requiredParam, optionalParam = 'default' } = req.body;

    // Validate required parameters
    if (!requiredParam) {
      return res.status(400).json({
        error: 'requiredParam is required'
      });
    }

    // Database query with $N placeholders
    const result = await db.get(
      'SELECT * FROM table WHERE user_id = $1 AND param = $2',
      [userId, requiredParam]
    );

    if (!result) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Insert with JavaScript date
    await db.run(
      'INSERT INTO table (user_id, data, created_at) VALUES ($1, $2, $3)',
      [userId, requiredParam, new Date().toISOString()]
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[YourRoute] Error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

export default router;
```

---

## 🔍 Dynamic Queries with Conditional Parameters

### ✅ CORRECT - Properly numbered placeholders
```javascript
router.get('/items', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { category, status } = req.query;

    let sql = 'SELECT * FROM items WHERE user_id = $1';
    const params = [userId];

    if (category) {
      sql += ' AND category = $2';
      params.push(category);
    }

    if (status) {
      sql += ` AND status = $${params.length + 1}`;  // Dynamic numbering
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const items = await db.all(sql, params);
    res.json({ items });
  } catch (error) {
    console.error('[Items] Error:', error);
    res.status(500).json({ error: 'Failed to get items' });
  }
});
```

---

## 🗑️ Delete with Ownership Verification

### ✅ CORRECT Pattern
```javascript
router.delete('/items/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const itemId = parseInt(req.params.id);

    // Verify ownership before deleting
    const item = await db.get(
      'SELECT id FROM items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete
    await db.run('DELETE FROM items WHERE id = $1', [itemId]);

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error('[Items] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});
```

---

## 🔄 Update with Optimistic Locking

### ✅ CORRECT Pattern
```javascript
router.put('/items/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const itemId = parseInt(req.params.id);
    const { name, description } = req.body;

    // Validate
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Check ownership
    const existing = await db.get(
      'SELECT id FROM items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Update
    await db.run(
      'UPDATE items SET name = $1, description = $2, updated_at = $3 WHERE id = $4',
      [name, description, new Date().toISOString(), itemId]
    );

    // Fetch updated item
    const item = await db.get('SELECT * FROM items WHERE id = $1', [itemId]);

    res.json({ success: true, item });
  } catch (error) {
    console.error('[Items] Update error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});
```

---

## 🔐 Parsing Availability Time Ranges

### ❌ WRONG - Doesn't handle all-day events correctly
```javascript
const startTime = record.startsAt.substring(11, 16);  // Extract HH:MM
const endTime = record.endsAt.substring(11, 16);
// For all-day event "2025-12-25T02:00:00+02:00" → "02:00" ❌
```

### ✅ CORRECT - Special handling for all-day events
```javascript
const isAllDay = record.isAllDay ?? record.is_all_day;

if (isAllDay) {
  startTime = '00:00';  // ✅ Always show full day
  endTime = '23:59';
} else {
  // Extract time from timestamp for timed events
  const startsAtDate = new Date(record.startsAt);
  const endsAtDate = new Date(record.endsAt);
  startTime = `${String(startsAtDate.getHours()).padStart(2, '0')}:${String(startsAtDate.getMinutes()).padStart(2, '0')}`;
  endTime = `${String(endsAtDate.getHours()).padStart(2, '0')}:${String(endsAtDate.getMinutes()).padStart(2, '0')}`;
}
```

---

## 📊 Batch Insert

### ✅ CORRECT Pattern
```javascript
// Insert multiple items efficiently
const items = [
  { name: 'Item 1', value: 100 },
  { name: 'Item 2', value: 200 },
];

for (const item of items) {
  await db.run(
    'INSERT INTO items (user_id, name, value, created_at) VALUES ($1, $2, $3, $4)',
    [userId, item.name, item.value, new Date().toISOString()]
  );
}

// Or use transaction for better performance
// Note: Check db.js for transaction support
```

---

## 🧪 Testing Database Queries

### ✅ Test Pattern
```javascript
// Example test script (scripts/test-query.js)
import db from '../database/db.js';

(async () => {
  try {
    const result = await db.get(
      'SELECT * FROM users WHERE id = $1',
      [1]
    );
    console.log('Result:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
```

---

## 📝 Response Patterns

### ✅ Success Responses
```javascript
// Simple success
res.json({ success: true });

// Success with data
res.json({ success: true, data: result });

// Success with message
res.json({ success: true, message: 'Item created' });

// Success with multiple data fields
res.json({
  success: true,
  item: item,
  count: totalCount
});
```

### ✅ Error Responses
```javascript
// Bad request (400)
res.status(400).json({ error: 'Missing required parameter' });

// Unauthorized (401)
res.status(401).json({ error: 'Invalid or expired token' });

// Forbidden (403)
res.status(403).json({ error: 'Access denied' });

// Not found (404)
res.status(404).json({ error: 'Resource not found' });

// Server error (500)
res.status(500).json({ error: 'Internal server error' });
```

---

## 🔍 Debugging Tips

### ✅ Useful Console Logs
```javascript
// Log with context
console.log('[RouteName] Processing request:', { userId, itemId });

// Log query parameters
console.log('[RouteName] Query params:', req.query);

// Log request body
console.log('[RouteName] Body:', req.body);

// Log database result
console.log('[RouteName] DB result:', JSON.stringify(result, null, 2));
```

---

**Remember**: Copy these patterns, don't reinvent them!

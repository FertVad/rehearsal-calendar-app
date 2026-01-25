# Server Utility Scripts

This directory contains utility scripts for development and testing.

## Subscription Management Scripts

### `add-test-subscription.js`

Adds a Lifetime Premium subscription to a test user (default: user ID 3).

**Usage:**
```bash
node scripts/add-test-subscription.js
```

**What it does:**
1. Finds user by ID (default: 3)
2. Creates an active Lifetime subscription
3. Creates a test payment transaction record
4. Sets `next_billing_date` to `NULL` (lifetime subscriptions don't recur)

**Example output:**
```
🔌 Connecting to database...
✅ Found user: Олеся (test2@mail.com)
✅ Found plan: Lifetime (176.00 ILS)
✅ Created new Lifetime Premium subscription!
✅ Created payment transaction record
🎉 User ID 3 now has Premium access!
```

### `check-subscription.js`

Checks the subscription status of any user.

**Usage:**
```bash
node scripts/check-subscription.js [userId]

# Examples:
node scripts/check-subscription.js      # Checks user 3 (default)
node scripts/check-subscription.js 5    # Checks user 5
```

**Example output:**
```
📊 User Subscription Status:
================================
👤 User: Олеся (test2@mail.com)
🆔 User ID: 3
✅ Status: active
💎 Plan: Lifetime (Навсегда)
💰 Price: 176.00 ILS
📅 Started: Sat Jan 24 2026 20:27:12 GMT+0200
📅 Next Billing: N/A (Lifetime)

🎉 User has PREMIUM access!
================================
```

### `test-subscription-api.js`

Tests the subscription API endpoint with a generated JWT token.

**Usage:**
```bash
node scripts/test-subscription-api.js [userId]
```

**What it does:**
1. Generates a valid JWT access token for the user
2. Makes an API call to `GET /api/native/subscriptions/current`
3. Displays the API response

**Note:** Requires the server to be running on `http://localhost:3001`.

## Prerequisites

All scripts require:
- PostgreSQL database (Neon.tech) connection configured in `.env`
- `DATABASE_URL` environment variable set
- Dependencies installed (`npm install`)

## Environment Variables

Required in `.env`:
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
```

## Database Tables Used

- `native_users` - User accounts
- `native_subscription_plans` - Available subscription plans
- `native_user_subscriptions` - User subscription records
- `native_payment_transactions` - Payment history

## See Also

- [API Documentation](../../docs/api-documentation.md)
- [Subscription System Overview](../services/subscriptionService.js)

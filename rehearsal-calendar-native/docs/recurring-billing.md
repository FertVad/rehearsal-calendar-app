# AllPay Recurring Billing Documentation

> **Status**: ✅ Production Ready (requires schedule change for production)

## Overview

Автоматическая система рекуррентных платежей для подписок с использованием AllPay (Israeli payment provider). Система полностью протестирована и работает с test plan (биллинг каждую минуту).

---

## Architecture

### Flow Diagram

```
User subscribes → AllPay payment → Token saved → Cron runs → Auto-billing
```

**Detailed Flow:**
1. User selects subscription plan
2. Backend creates AllPay checkout → returns `checkoutUrl` + `orderId`
3. WebView opens AllPay payment page
4. User completes payment
5. AllPay webhook fires → Backend verifies signature
6. Backend retrieves AllPay token via `gettoken` API
7. Subscription created in DB with `allpay_token`
8. Frontend polling detects subscription → WebView closes
9. **Cron job runs** (every minute for test / daily at 2 AM for prod)
10. For each active subscription with `next_billing_date <= NOW`:
    - Charge `allpay_token` via `getpayment` API
    - Update `next_billing_date` to +1 period
    - Record transaction
11. **User cancels** → Status = 'cancelled' → Billing stops

---

## Key Files

### Backend

**Core Logic:**
- [`server/services/subscriptionService.js`](../server/services/subscriptionService.js) - Business logic
  - `createSubscription()` - Creates subscription with token
  - `processRecurringBilling()` - Main recurring billing function
  - `cancelSubscription()` - Cancels subscription

**Jobs:**
- [`server/jobs/recurringBilling.js`](../server/jobs/recurringBilling.js) - Cron job wrapper

**Routes:**
- [`server/routes/native/subscriptions.js`](../server/routes/native/subscriptions.js) - API endpoints
- [`server/routes/cron.js`](../server/routes/cron.js) - Vercel Cron endpoint

**Middleware:**
- [`server/middleware/subscriptionMiddleware.js`](../server/middleware/subscriptionMiddleware.js) - Access control

**Utils:**
- [`server/utils/allpayClient.js`](../server/utils/allpayClient.js) - AllPay API wrapper

**Configuration:**
- [`server/vercel.json`](../server/vercel.json) - Vercel Cron Jobs config
- [`server/server.js`](../server/server.js) - Node-cron scheduler (lines 236-246)

### Frontend

- [`src/features/subscriptions/screens/SubscriptionScreen.tsx`](../src/features/subscriptions/screens/SubscriptionScreen.tsx) - UI

### Database

**Tables:**
- `native_subscription_plans` - Available plans (Monthly, Quarterly, Lifetime, test_1min)
- `native_user_subscriptions` - User subscriptions with tokens
- `native_payment_transactions` - Payment history
- `native_allpay_webhook_events` - Webhook audit log

---

## Database Schema

### `native_user_subscriptions`

```sql
CREATE TABLE native_user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES native_users(id),
  plan_id INTEGER NOT NULL REFERENCES native_subscription_plans(id),
  status VARCHAR(20) NOT NULL, -- 'active', 'cancelled', 'expired'

  -- AllPay tokenization
  allpay_token VARCHAR(255),  -- Used for recurring charges
  allpay_subscription_id VARCHAR(255),
  allpay_customer_id VARCHAR(255),

  -- Billing cycle
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  next_billing_date TIMESTAMP,  -- NULL for lifetime plans

  -- Timestamps
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Important:**
- `allpay_token` is the key for recurring billing
- `next_billing_date` NULL = no recurring billing (lifetime)
- `status = 'active'` required for billing to process

---

## API Endpoints

### For Frontend

**Get Plans**
```http
GET /api/native/subscriptions/plans
Response: [{ id, name, price_usd, billing_period, features, ... }]
```

**Get Current Subscription**
```http
GET /api/native/subscriptions/current
Headers: Authorization: Bearer <jwt>
Response: { subscription, plan details }
```

**Create Checkout**
```http
POST /api/native/subscriptions/checkout
Headers: Authorization: Bearer <jwt>
Body: { planId: 7 }
Response: {
  checkoutUrl: "https://api.allpay.to/...",
  orderId: "ORDER-..."
}
```

**Check Pending Subscription** (for polling)
```http
GET /api/native/subscriptions/check-pending/:orderId
Headers: Authorization: Bearer <jwt>
Response: {
  exists: true/false,
  subscription: { ... }
}
```

**Cancel Subscription**
```http
POST /api/native/subscriptions/cancel
Headers: Authorization: Bearer <jwt>
Response: { success: true }
```

### For AllPay (Webhook)

```http
POST /api/native/subscriptions/webhook
Body: {
  order_id, status,
  transaction_id, amount,
  sign (signature)
}
Response: { success: true }
```

### For Vercel Cron

```http
POST /api/cron/recurring-billing
Headers: Authorization: Bearer <CRON_SECRET>
Response: {
  success: true,
  result: {
    processed: 1,
    successful: 1,
    failed: 0,
    expired: 0,
    errors: []
  }
}
```

---

## Timezone Handling (Critical)

### Problem

PostgreSQL column `next_billing_date` has type `timestamp without time zone`, but server runs in Jerusalem timezone (UTC+2). This caused comparison issues where dates were stored in local time but compared as UTC.

### Solution

**1. Set Session Timezone to UTC**
```javascript
await db.run('SET timezone = \'UTC\'');
```

**2. Explicit UTC Conversion in SQL**
```javascript
await db.run(`
  UPDATE native_user_subscriptions
  SET next_billing_date = ($1::timestamptz AT TIME ZONE 'UTC')::timestamp
  WHERE id = $2
`, [nextBillingDate.toISOString(), subscriptionId]);
```

**3. Calculate Dates from Current Time**
```javascript
// ❌ WRONG - uses old value with timezone issues
const newPeriodEnd = new Date(subscription.current_period_end);
newPeriodEnd.setUTCMinutes(newPeriodEnd.getUTCMinutes() + 1);

// ✅ CORRECT - calculates from current time
const newPeriodEnd = new Date(now);
newPeriodEnd.setUTCMinutes(newPeriodEnd.getUTCMinutes() + 1);
```

**Files with Timezone Fixes:**
- `server/services/subscriptionService.js`:
  - `createSubscription()` - Line 95: `SET timezone = 'UTC'`
  - `processRecurringBilling()` - Line 241: `SET timezone = 'UTC'`
  - Period calculation - Line 314: Calculate from `now` instead of `current_period_end`
  - UPDATE query - Lines 330-340: Explicit `AT TIME ZONE 'UTC'` conversion

---

## Cron Configuration

### Local Development (node-cron)

**File:** `server/server.js` (lines 236-246)

```javascript
// TEST MODE: Runs every minute
cron.schedule('* * * * *', async () => {
  logger.info('[Cron] Triggering recurring billing job');
  try {
    await runRecurringBilling();
  } catch (error) {
    logger.error('[Cron] Recurring billing job failed:', error);
  }
});
```

**For Production:** Change to `'0 2 * * *'` (daily at 2:00 AM UTC)

### Vercel Production (Vercel Cron Jobs)

**File:** `server/vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/recurring-billing",
      "schedule": "* * * * *"
    }
  ]
}
```

**Current:** `* * * * *` (every minute for testing)
**For Production:** `0 2 * * *` (daily at 2:00 AM UTC)

**Security:**
```env
# Add to Vercel Environment Variables
CRON_SECRET=<generate-random-secret>
```

Endpoint validates: `Authorization: Bearer <CRON_SECRET>`

---

## Subscription Plans

### Production Plans

| Plan | Price | Billing Period | Max Projects | Max Members |
|------|-------|----------------|--------------|-------------|
| Monthly | $9 USD (₪32 ILS) | 30 days | ∞ | ∞ |
| Quarterly | $15 USD (₪54 ILS) | 90 days | ∞ | ∞ |
| Lifetime | $49 USD (₪176 ILS) | Never (NULL) | ∞ | ∞ |

### Test Plan

**test_1min** (for testing only):
- Price: $13 USD (₪46.80 ILS)
- Billing Period: 1 minute
- Purpose: Test recurring billing without waiting 30 days
- **Status:** ✅ Tested successfully (14 recurring charges recorded)

**Test Results:**
- ✅ Period duration: 60 seconds
- ✅ Recurring charges every minute
- ✅ Cancelled subscriptions stop billing
- ✅ Timezone handling works correctly

---

## Business Logic

### Subscription Middleware

**File:** `server/middleware/subscriptionMiddleware.js`

```javascript
import { requireSubscription } from '../middleware/subscriptionMiddleware.js';

// ✅ CORRECT - Require subscription for project creation
router.post('/projects', requireAuth, requireSubscription, async (req, res) => {
  const subscription = req.subscription; // Set by middleware
  // User can only reach here if they have active subscription
});

// ✅ CORRECT - Other features remain free
router.get('/projects', requireAuth, async (req, res) => {
  // All users can view projects
});
```

**Business Model:** All features free, subscription only required for **creating projects**.

### Billing Periods

```javascript
// Monthly
currentPeriodEnd.setUTCMonth(currentPeriodEnd.getUTCMonth() + 1);
nextBillingDate = new Date(currentPeriodEnd);

// Quarterly
currentPeriodEnd.setUTCMonth(currentPeriodEnd.getUTCMonth() + 3);
nextBillingDate = new Date(currentPeriodEnd);

// test_1min (testing only)
currentPeriodEnd.setUTCMinutes(currentPeriodEnd.getUTCMinutes() + 1);
nextBillingDate = new Date(currentPeriodEnd);

// Lifetime
currentPeriodEnd.setUTCFullYear(currentPeriodEnd.getUTCFullYear() + 100);
nextBillingDate = null; // No recurring billing
```

### Cancellation Logic

```javascript
export async function cancelSubscription(userId) {
  await db.run(`
    UPDATE native_user_subscriptions
    SET status = 'cancelled', cancelled_at = $1
    WHERE user_id = $2 AND status = 'active'
  `, [new Date().toISOString(), userId]);

  // Note: Does NOT call AllPay API to cancel token
  // Token remains valid but won't be charged (status check)
}
```

**Cron behavior:**
- `status = 'active'` → Processes recurring billing
- `status = 'cancelled'` → Skipped by cron
- `status = 'expired'` → Skipped by cron

---

## AllPay Integration

### API Client

**File:** `server/utils/allpayClient.js`

**Key Methods:**

```javascript
// Create checkout page
await allpayAPI.createPayment({
  amount: 46.80,
  currency: 'ILS',
  orderId: 'ORDER-123',
  description: 'Test Plan (1 min)',
  successUrl: 'https://...',
  cancelUrl: 'https://...'
});

// Retrieve token after payment
await allpayAPI.getToken(orderId);

// Charge token (recurring)
await allpayAPI.chargeToken({
  allpayToken: '69889C1C176492-55289317',
  amount: 46.80,
  currency: 'ILS',
  orderId: 'SUB-5-1234567890',
  description: 'Recurring payment - test_1min'
});

// Check payment status
await allpayAPI.getPaymentStatus(orderId);
```

**Signature Verification:**
```javascript
// All requests include signature for security
const sign = crypto
  .createHmac('sha256', ALLPAY_API_KEY)
  .update(paramsString)
  .digest('hex');
```

### Webhook Verification

```javascript
export function verifyWebhookSignature(params) {
  const { sign: receivedSign, ...data } = params;
  const sortedParams = Object.keys(data)
    .sort()
    .map(key => `${key}${data[key]}`)
    .join('');

  const calculatedSign = crypto
    .createHmac('sha256', ALLPAY_WEBHOOK_SECRET)
    .update(sortedParams)
    .digest('hex');

  return calculatedSign === receivedSign;
}
```

---

## Testing

### Manual Testing Steps

**1. Create Test Subscription**
```bash
cd rehearsal-calendar-native
npm start

# In app:
# 1. Profile → Subscription
# 2. Select "Test (1 min) - 13 USD" plan
# 3. Complete payment with test card: 4580458045804580
# 4. Wait for WebView to close
# 5. Verify subscription appears in profile
```

**2. Verify Recurring Billing**
```bash
# Check server logs (every minute)
tail -f /path/to/server/logs

# Or check database
node -e "
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query('SELECT * FROM native_payment_transactions WHERE transaction_type = \'recurring\' ORDER BY id DESC LIMIT 5');
console.log(result.rows);
await pool.end();
"
```

**3. Test Cancellation**
```bash
# In app: Profile → Subscription → Cancel

# Verify billing stops (check logs after 1+ minutes)
# Should see: "Found 0 subscriptions due for renewal"
```

### Test Card

```
Card Number: 4580458045804580
CVV: 123
Expiry: 12/25
Name: Test User
```

### Expected Behavior

**Active Subscription:**
```
[Cron] Triggering recurring billing job
[Cron] Starting recurring billing job...
[Recurring Billing] Found 1 subscriptions due for renewal
[AllPay] API request: getpayment {...}
[AllPay] API response: {"order_id":"SUB-5-...","status":1}
[Recurring Billing] Successfully charged subscription 5
[Recurring Billing] Completed. Processed: 1, Successful: 1, Failed: 0
```

**Cancelled Subscription:**
```
[Cron] Triggering recurring billing job
[Cron] Starting recurring billing job...
[Recurring Billing] Found 0 subscriptions due for renewal
[Recurring Billing] Completed. Processed: 0, Successful: 0, Failed: 0
```

---

## Production Deployment Checklist

### 1. Change Cron Schedule

**File:** `server/server.js` (line 238)
```javascript
// Change from:
cron.schedule('* * * * *', async () => { ... });

// To:
cron.schedule('0 2 * * *', async () => { ... });
```

**File:** `server/vercel.json` (line 25)
```json
{
  "crons": [{
    "path": "/api/cron/recurring-billing",
    "schedule": "0 2 * * *"
  }]
}
```

### 2. Add CRON_SECRET

**Vercel Environment Variables:**
```bash
# Generate secret
openssl rand -base64 32

# Add to Vercel:
CRON_SECRET=<generated-secret>
```

### 3. Disable Test Plan

```sql
UPDATE native_subscription_plans
SET is_active = FALSE
WHERE name = 'test_1min';
```

### 4. Switch to Production Mode

**File:** `server/.env`
```env
ALLPAY_TEST_MODE=false
```

**Vercel Environment Variables:**
```env
ALLPAY_TEST_MODE=false
```

### 5. Verify Production Settings

- [ ] Cron schedule = `0 2 * * *`
- [ ] CRON_SECRET configured in Vercel
- [ ] ALLPAY_TEST_MODE = false
- [ ] test_1min plan disabled
- [ ] Database backups enabled
- [ ] Monitoring/alerts configured

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Billing Success Rate**
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as success_rate
   FROM native_payment_transactions
   WHERE transaction_type = 'recurring'
     AND created_at >= NOW() - INTERVAL '7 days';
   ```

2. **Active Subscriptions**
   ```sql
   SELECT status, COUNT(*)
   FROM native_user_subscriptions
   GROUP BY status;
   ```

3. **Failed Charges**
   ```sql
   SELECT * FROM native_payment_transactions
   WHERE transaction_type = 'recurring'
     AND status != 'completed'
   ORDER BY created_at DESC;
   ```

### Recommended Alerts

- [ ] Alert if billing success rate < 95%
- [ ] Alert if any charge fails (immediate notification)
- [ ] Alert if cron job doesn't run for 25+ hours
- [ ] Daily summary of billing activity

---

## Troubleshooting

### Issue: Billing finds 0 subscriptions

**Possible causes:**
1. `next_billing_date` is in the future
2. `status != 'active'`
3. `allpay_token IS NULL`
4. Timezone mismatch

**Debug:**
```sql
SELECT
  id, status,
  next_billing_date,
  next_billing_date::text as nbd_text,
  CURRENT_TIMESTAMP::text as now,
  (next_billing_date <= CURRENT_TIMESTAMP) as should_bill
FROM native_user_subscriptions
WHERE status = 'active'
  AND allpay_token IS NOT NULL;
```

### Issue: Timezone comparison fails

**Solution:** Ensure `SET timezone = 'UTC'` is called before queries in:
- `createSubscription()`
- `processRecurringBilling()`

### Issue: Period duration incorrect

**Check calculation logic:**
```javascript
// Must calculate from NOW, not old period_end
const newPeriodEnd = new Date(now);
newPeriodEnd.setUTCMinutes(newPeriodEnd.getUTCMinutes() + 1);
```

### Issue: AllPay charge fails

**Common errors:**
- Invalid token (expired or cancelled)
- Insufficient card balance
- Network timeout

**Check AllPay response:**
```javascript
if (chargeResult.status !== 1) {
  logger.error('[AllPay] Charge failed:', chargeResult);
  // Handle error (email user, retry later, etc.)
}
```

---

## Security Considerations

### 1. Webhook Signature Verification

**Always verify AllPay webhook signatures:**
```javascript
if (!verifyWebhookSignature(req.body)) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### 2. Cron Endpoint Protection

```javascript
const authHeader = req.headers.authorization;
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### 3. Token Storage

- AllPay tokens are stored encrypted in PostgreSQL
- Never expose tokens in logs or API responses
- Rotate database credentials regularly

### 4. PCI Compliance

- Card data never touches our servers (handled by AllPay iframe)
- No card storage in our database
- AllPay is PCI DSS Level 1 compliant

---

## Future Improvements

### Potential Enhancements

1. **Retry Logic for Failed Charges**
   - Retry failed charges 3 times over 72 hours
   - Email user before final attempt

2. **Proration for Plan Changes**
   - Calculate prorated amount when upgrading/downgrading
   - Apply credit to next billing cycle

3. **Subscription Analytics Dashboard**
   - MRR (Monthly Recurring Revenue)
   - Churn rate
   - LTV (Lifetime Value)

4. **Dunning Management**
   - Auto-retry failed payments
   - Grace period before cancellation
   - Email reminders

5. **Invoice Generation**
   - PDF invoices for each charge
   - Email delivery
   - Tax calculation

---

## References

- **AllPay API Docs:** https://www.allpay.co.il/api-docs
- **Vercel Cron Jobs:** https://vercel.com/docs/cron-jobs
- **PostgreSQL Timezone:** https://www.postgresql.org/docs/current/datatype-datetime.html

---

## Change Log

### 2026-02-08 - Timezone Fixes (v1.0)
- ✅ Added `SET timezone = 'UTC'` in billing functions
- ✅ Explicit UTC conversion in SQL queries
- ✅ Fixed period calculation logic
- ✅ Tested with test_1min plan (14 successful charges)
- ✅ Verified cancellation stops billing

### 2026-02-05 - Initial Implementation
- ✅ AllPay integration
- ✅ Token-based recurring billing
- ✅ Webhook handling
- ✅ Vercel Cron Jobs setup

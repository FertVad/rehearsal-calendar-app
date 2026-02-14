# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rehearsal Calendar** is a React Native mobile app for theatrical rehearsal planning with availability management, smart time recommendations, and multi-project support. It consists of a React Native frontend and Express.js backend.

## Common Development Commands

### Frontend (React Native)
```bash
cd rehearsal-calendar-native

# Development
npm start                    # Start Expo dev server
npm run ios                  # Run iOS simulator (requires Xcode)
npm run android              # Run Android emulator (not configured yet)

# Code Quality
npm run lint                 # Run ESLint
npm run lint:fix             # Fix ESLint errors
npm run type-check           # TypeScript type checking
npm test                     # Run Jest tests
npm run test:watch           # Run tests in watch mode
npm run check                # Run all checks (secrets, type-check, tests)

# Security
npm run check:secrets        # Check for exposed secrets/API keys
```

### Backend (Express.js)
```bash
cd rehearsal-calendar-native/server

# Development
npm start                    # Start server (production)
npm run dev                  # Start server with --watch (auto-reload)

# Database
npm run migrate:native       # Initialize SQLite schema (development)
npm run migrate:neon         # Run migrations on PostgreSQL (production)

# Testing
npm test                     # Run Jest tests
npm run test:watch           # Run tests in watch mode
npm run test:coverage        # Run tests with coverage report
```

### Running Both Servers (Typical Workflow)
```bash
# Terminal 1: Backend
cd rehearsal-calendar-native/server && npm run dev

# Terminal 2: Frontend
cd rehearsal-calendar-native && npm start

# Terminal 3: iOS Simulator (optional)
# Open ios/rehearsalcalendarnative.xcworkspace in Xcode and press ⌘R
```

## Architecture Overview

### Frontend Structure (Feature-Based)
```
src/
├── features/              # Feature modules (auth, calendar, projects, etc.)
│   ├── auth/             # Authentication screens & logic
│   ├── calendar/         # Rehearsals, calendar display
│   ├── projects/         # Project management
│   ├── availability/     # User availability management
│   ├── subscriptions/    # Subscription plans & payment (AllPay integration)
│   └── profile/          # User profile & settings
├── navigation/           # React Navigation setup
├── contexts/             # React Context providers (Auth, I18n, Theme)
├── shared/
│   ├── components/       # Reusable UI components
│   ├── services/         # API client, calendar sync
│   ├── utils/           # Helper functions
│   └── types/           # TypeScript types
└── i18n/                # Translations (Russian/English)
```

### Backend Structure
```
server/
├── routes/              # API routes
│   ├── auth.js         # Authentication endpoints
│   └── native/         # Native app endpoints (projects, rehearsals, availability, subscriptions)
├── services/           # Business logic layer (subscriptions, notifications)
├── jobs/               # Cron jobs (recurring billing)
├── database/           # Database setup & migrations
├── middleware/         # Auth middleware, subscription checks, timezone conversion
├── utils/              # AllPay client, timezone utilities, helpers
└── constants/          # Shared constants (availability types, etc.)
```

### Database
- **Development**: SQLite (`native_database.db`)
- **Production**: PostgreSQL (Neon.tech)
- **Tables**: All prefixed with `native_*` (native_users, native_projects, native_rehearsals, native_user_availability, native_subscription_plans, native_user_subscriptions, native_payment_transactions, native_allpay_webhook_events, etc.)
- **Schema**: [rehearsal-calendar-native/server/database/init-native-schema.sql](rehearsal-calendar-native/server/database/init-native-schema.sql)
- **Note**: SQLite uses `1`/`0` for booleans in dev, PostgreSQL uses `TRUE`/`FALSE` in production

## Critical Patterns & Conventions

### 1. Authentication Middleware
```javascript
// ✅ CORRECT - Use req.userId
router.get('/endpoint', requireAuth, async (req, res) => {
  const userId = req.userId;  // Set by requireAuth middleware
});

// ❌ WRONG - Don't use req.user
const userId = req.user.id;  // req.user is undefined!
```

### 2. Database Query Syntax
```javascript
// ✅ RECOMMENDED - PostgreSQL parameterized queries
await db.all('SELECT * FROM users WHERE id = $1 AND status = $2', [userId, 'active']);

// ⚠️ WORKS BUT AVOID - SQLite syntax (auto-converted but less clear)
await db.all('SELECT * FROM users WHERE id = ? AND status = ?', [userId, 'active']);
```

### 3. Timezone Handling (CRITICAL)
All dates/times use **ISO 8601 with timezone** (TIMESTAMPTZ in PostgreSQL):

```javascript
// Frontend → Backend: Send ISO 8601 strings with timezone
{
  startsAt: '2025-12-13T08:00:00+02:00',
  endsAt: '2025-12-13T16:00:00+02:00'
}

// Backend storage: PostgreSQL automatically converts to UTC
// Backend → Frontend: Return ISO 8601 strings (client handles display in local time)

// All-day events: MUST use UTC with .000Z suffix
{
  startsAt: '2025-12-13T00:00:00.000Z',
  endsAt: '2025-12-13T23:59:59.999Z',
  isAllDay: true
}
```

**Common Timezone Errors:**
- ❌ Using `+02:00` for all-day events → violates DB constraints
- ❌ Forgetting to convert between local and UTC
- ❌ Using wrong Date format (must be ISO 8601)

### 4. Availability Types & Sources
```javascript
// Use constants from server/constants/timezone.js
AVAILABILITY_TYPES = {
  AVAILABLE: 'available',   // User is free
  BUSY: 'busy',            // User is occupied (custom mode + rehearsals)
  TENTATIVE: 'tentative'   // Imported calendar events
}

AVAILABILITY_SOURCES = {
  MANUAL: 'manual',              // User-created
  REHEARSAL: 'rehearsal',        // Auto-created from rehearsals
  GOOGLE: 'google_calendar',     // Imported from Google
  APPLE: 'apple_calendar'        // Imported from Apple Calendar
}
```

### 5. Like System (Rehearsal Responses)
Binary system: `'yes'` (liked) or `NULL` (unliked/deleted). No 'no' or 'maybe' statuses.

```javascript
// API: POST /api/native/rehearsals/:id/respond
{ response: 'yes' }  // Like rehearsal

// To unlike: Send same endpoint with response: null (handled by backend as DELETE)
```

### 6. API Response Format
```javascript
// Success
res.json({
  success: true,
  data: result
});

// Error
res.status(400).json({
  error: 'Error message',
  details: 'Additional info'
});
```

### 7. Internationalization (i18n)
```typescript
// Access translations via I18nContext
const { t, language, changeLanguage } = useI18n();

// Static strings
<Text>{t.common.save}</Text>

// Dynamic strings (functions)
<Text>{t.rehearsals.selectedCount(3, 10)}</Text>  // "Selected: 3 of 10"

// Localized dates
date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')
```

### 8. Subscription Middleware
**Business Model**: All features are free, subscription only required for **creating projects**.

```javascript
import { requireSubscription } from '../middleware/subscriptionMiddleware.js';

// ✅ CORRECT - Require subscription for project creation
router.post('/projects', requireAuth, requireSubscription, async (req, res) => {
  const userId = req.userId;        // Set by requireAuth
  const subscription = req.subscription;  // Set by requireSubscription
  // User can only reach here if they have active subscription
});

// ✅ CORRECT - Other features remain free (no requireSubscription)
router.get('/projects', requireAuth, async (req, res) => {
  // All users can view projects
});
```

**Subscription Plans**:
- Monthly: $9 USD (₪32 ILS)
- 3 Months: $15 USD (₪54 ILS)
- Lifetime: $49 USD (₪176 ILS)

**Key Implementation Details**:
- Recurring billing via cron job (daily at 2:00 AM)
- AllPay tokenization for monthly/quarterly charges
- Lifetime subscriptions: `next_billing_date = NULL` (excluded from recurring billing)
- WebView checkout flow for payment

## Key Features & Implementation

### Smart Planner
**Location**: `src/features/smart-planner/`

Analyzes member availability and recommends optimal rehearsal times:
- Loads availability for all project members in a date range
- Categorizes slots: Perfect (100% free), Good (80%+), Possible (50%+), Difficult (<50%)
- Supports filtering by specific members
- Uses batch API endpoint for performance

### Calendar Sync
**Location**: `src/shared/services/calendarSync.ts`

Bi-directional sync with iOS/Google Calendar:
- **Export**: Rehearsals → device calendar events (batch processing, 10 parallel)
- **Import**: Calendar events → user availability (chunks of 50)
- Tracks mappings in AsyncStorage (`@rehearsal_calendar_map`, `@imported_calendar_events`)

### Payment & Subscription System
**Location**: `server/services/subscriptionService.js`, `src/features/subscriptions/`

AllPay (Israeli payment provider) integration for recurring subscriptions:

**Architecture**:
- **Backend**: `allpayClient.js` (API wrapper), `subscriptionService.js` (business logic), `subscriptionMiddleware.js` (access control)
- **Frontend**: `SubscriptionScreen.tsx` (plan selection + WebView checkout)
- **Database**: 4 tables (plans, user_subscriptions, payment_transactions, webhook_events)
- **Cron Job**: `recurringBilling.js` (runs daily at 2:00 AM for monthly/quarterly renewals)

**Payment Flow (Token-Based, Self-Managed)**:
1. **User selects plan** → Backend creates AllPay checkout (NO subscription parameter)
2. **WebView opens** → Hosted Fields checkout page (dark theme wrapper with AllPay iframe + pay button)
3. **User completes payment** → AllPay webhook fires
4. **Webhook handler**:
   - Verifies signature
   - Retrieves token via `gettoken` API
   - Creates subscription in local DB with token
5. **Frontend polling** → Checks every 2s if subscription created
6. **WebView auto-closes** → Shows success message when detected
7. **Recurring billing** → Vercel Cron (daily 2 AM UTC) charges token via `getpayment` with `allpay_token`
8. **Cancellation** → Local DB update only (no AllPay API call)

**Key Files**:
- `server/utils/allpayClient.js` - AllPay API client (signatures, tokenization, charges)
- `server/services/subscriptionService.js` - Subscription business logic
- `server/middleware/subscriptionMiddleware.js` - `requireSubscription` middleware
- `server/jobs/recurringBilling.js` - Automated monthly billing
- `server/routes/native/subscriptions.js` - API endpoints (plans, checkout, webhook, cancel)

**API Endpoints**:
- `GET /api/native/subscriptions/plans` - List all plans (no auth)
- `GET /api/native/subscriptions/current` - Get user subscription
- `POST /api/native/subscriptions/checkout` - Create checkout session (returns checkoutUrl + orderId)
- `GET /api/native/subscriptions/checkout-page` - Hosted Fields HTML page (dark theme wrapper with AllPay iframe)
- `POST /api/native/subscriptions/webhook` - AllPay callback (signature verification)
- `GET /api/native/subscriptions/check-pending/:orderId` - Poll subscription status (for WebView auto-close)
- `POST /api/native/subscriptions/cancel` - Cancel subscription (local DB only)
- `GET /api/cron/recurring-billing` - Vercel Cron endpoint (GET, protected by CRON_SECRET)

**Recurring Billing (Production Ready)**:
The system automatically charges active subscriptions using saved AllPay tokens. See [docs/recurring-billing.md](rehearsal-calendar-native/docs/recurring-billing.md) for full documentation.

**Key Implementation Details:**
- **Vercel Cron**: `GET /api/cron/recurring-billing` runs daily at 2:00 AM UTC (configured in `vercel.json`)
- **node-cron**: `server/server.js` also has `0 2 * * *` schedule (only works locally, not on serverless Vercel)
- **Timezone Fix**: `SET timezone = 'UTC'` + explicit `AT TIME ZONE 'UTC'` conversions in SQL
- **Date Calculation**: Uses current time instead of old `current_period_end` to avoid timezone issues

**Production Checklist:**
1. Add `CRON_SECRET` to Vercel environment variables
2. Set `ALLPAY_TEST_MODE=false`
3. Disable `test_1min` plan: `UPDATE native_subscription_plans SET is_active = FALSE WHERE name = 'test_1min'`

### Batch API Endpoints
Optimize N+1 queries by loading data in batches:
```javascript
// ✅ Good - Single batch request
GET /api/native/rehearsals/batch?projectIds=1,2,3

// ❌ Bad - Multiple sequential requests
for (const projectId of projectIds) {
  await GET /api/native/projects/${projectId}/rehearsals
}
```

## Common Pitfalls

### 1. Authentication
❌ **Problem**: `Cannot read properties of undefined (reading 'id')`
✅ **Fix**: Change `req.user.id` → `req.userId`

### 2. Database Constraints
❌ **Problem**: `violates check constraint chk_availability_time_order`
✅ **Fix**: Use UTC (`.000Z`) for all-day events, not `+02:00`

### 3. PostgreSQL Boolean Comparison
❌ **Problem**: `operator does not exist: boolean = integer`
✅ **Fix**: Use `TRUE`/`FALSE` for PostgreSQL boolean comparisons, not `1`/`0`

```javascript
// ❌ WRONG - Works in SQLite, fails in PostgreSQL
await db.all('SELECT * FROM plans WHERE is_active = 1');

// ✅ CORRECT - Works in both SQLite and PostgreSQL
await db.all('SELECT * FROM plans WHERE is_active = TRUE');
```

### 4. API URL Configuration
The app auto-detects API URL based on environment:
- **iOS Simulator**: `http://localhost:3001/api`
- **Android Emulator**: `http://10.0.2.2:3001/api`
- **Physical Device**: Auto-detects from Expo debuggerHost
- **Override**: Set `EXPO_PUBLIC_API_URL` in `.env`

Server must listen on `0.0.0.0:3001` (not `127.0.0.1`) for physical device access.

### 5. Xcode Build Configuration
Ensure Xcode scheme uses **Debug** build configuration (not Release):
- File: `ios/rehearsalcalendarnative.xcodeproj/xcshareddata/xcschemes/rehearsalcalendarnative.xcscheme`
- Check: `LaunchAction` should have `buildConfiguration = "Debug"`
- Symptom if wrong: `__DEV__` returns false, app connects to production server

### 6. OAuth Implementation (Google & Apple Sign-In)

**Implemented OAuth Providers:**
- ✅ **Google Sign-In** - Fully configured and working
- ✅ **Apple Sign-In** - Implementation ready (requires paid Apple Developer account)

**Architecture:**
- **Frontend**: `src/shared/services/googleAuth.ts` - OAuth flow using `expo-auth-session`
- **Backend**: `server/utils/oauthVerification.js` - Token verification using Google/Apple APIs
- **Account Linking**: `server/utils/accountLinking.js` - Merges OAuth accounts with existing email accounts

**Google OAuth Setup:**
See [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) for detailed setup instructions.

**Key Points:**
- OAuth tokens are verified server-side to prevent forgery
- Accounts are automatically linked by email if user already exists
- New users are created with OAuth provider details (name, avatar, email)
- Check `native_auth_providers` table for account linking status
- Supports multiple providers per user (can link both Google and Apple to same account)

### 7. Push Notifications on iOS Simulator
❌ **Problem**: `Invariant Violation: new NativeEventEmitter() requires a non-null argument`
✅ **Fix**: Wrap notification setup in try-catch blocks

**Root Cause**: iOS Simulator doesn't support push notifications, causing crashes when initializing Expo Notifications module.

**Solution**: All notification-related code is wrapped in try-catch blocks:
```javascript
// In notifications.ts
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ ... }),
  });
} catch (error) {
  console.log('[Notifications] Setup failed (expected on simulator):', error);
}

// In useNotifications.ts
try {
  notificationListener.current = addNotificationReceivedListener(...);
  responseListener.current = addNotificationResponseReceivedListener(...);
} catch (error) {
  console.log('[useNotifications] Listener setup failed (expected on simulator):', error);
}
```

**Files with try-catch protection**:
- `src/shared/services/notifications.ts` - Handler setup
- `src/shared/hooks/useNotifications.ts` - Listener registration and cleanup

### 8. PostgreSQL Timezone Issues in Recurring Billing
❌ **Problem**: Recurring billing finds 0 subscriptions even when `next_billing_date` should be in the past
✅ **Fix**: Set timezone to UTC and use explicit conversions

**Root Cause**: PostgreSQL `timestamp without time zone` column stores values without timezone info, but interprets them based on session timezone. When server runs in Jerusalem (UTC+2) but timestamps are stored as UTC, comparisons fail.

**Solution (Already Implemented)**:
```javascript
// 1. Set session timezone to UTC before queries
await db.run('SET timezone = \'UTC\'');

// 2. Use explicit UTC conversion in SQL
await db.run(`
  UPDATE native_user_subscriptions
  SET next_billing_date = ($1::timestamptz AT TIME ZONE 'UTC')::timestamp
  WHERE id = $2
`, [date.toISOString(), id]);

// 3. Calculate dates from current time, not old values
const newPeriodEnd = new Date(now);  // ✅ CORRECT
// NOT: new Date(subscription.current_period_end)  // ❌ WRONG (timezone issues)
newPeriodEnd.setUTCMinutes(newPeriodEnd.getUTCMinutes() + 1);
```

**Affected Files:**
- `server/services/subscriptionService.js` - Lines 95, 241, 314, 330-340

**How to Debug:**
```sql
-- Check subscription state with timezone info
SET timezone = 'UTC';
SELECT
  id, status,
  next_billing_date::text as stored_value,
  CURRENT_TIMESTAMP::text as now,
  (next_billing_date <= CURRENT_TIMESTAMP) as should_bill
FROM native_user_subscriptions
WHERE id = 5;
```

## Environment Setup

### Required Environment Variables

**server/.env** (Backend)
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...   # PostgreSQL connection string (production)
JWT_SECRET=<generate-with-openssl-rand-base64-32>  # REQUIRED in production

# OAuth Configuration (Google Sign-In)
# Get these from Google Cloud Console → APIs & Services → Credentials
# See GOOGLE_OAUTH_SETUP.md for detailed setup instructions
GOOGLE_CLIENT_ID_IOS=your-ios-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=your-android-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_ID_WEB=your-web-client-id.apps.googleusercontent.com

# OAuth Configuration (Apple Sign-In)
# Get these from Apple Developer Portal → Certificates, Identifiers & Profiles
APPLE_CLIENT_ID=com.rehearsal.app
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY=  # Contents of .p8 file or path to file

# AllPay Payment Configuration (Israeli Payment Provider)
# Get these from https://www.allpay.co.il → Settings → API Settings
ALLPAY_API_LOGIN=pp1016273  # Your AllPay API login
ALLPAY_API_KEY=E764DA37F6F96519B89A313DA80AEBBD  # Your AllPay API key
ALLPAY_WEBHOOK_SECRET=86859ED2BED01EDB0471C28DAD6B51F0  # For webhook signature verification
ALLPAY_TEST_MODE=true  # Set to false for production payments

# Cron Job Configuration (for Vercel Cron Jobs)
# Generate with: openssl rand -base64 32
CRON_SECRET=<generate-random-secret>  # REQUIRED for production recurring billing
```

**.env** (Frontend - Optional)
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001/api  # Override API URL if needed
```

### Database Initialization
```bash
# Development (SQLite)
cd rehearsal-calendar-native/server
npm run migrate:native

# Production (PostgreSQL)
npm run migrate:neon
```

## Testing

### Frontend Tests
```bash
cd rehearsal-calendar-native
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run type-check          # TypeScript validation
npm run lint                # ESLint
```

### Backend Tests
```bash
cd rehearsal-calendar-native/server
npm test                    # Run all tests
npm run test:coverage       # With coverage
```

## Documentation

Key documentation files:
- [rehearsal-calendar-native/docs/README.md](rehearsal-calendar-native/docs/README.md) - Documentation index
- [rehearsal-calendar-native/docs/project-info.md](rehearsal-calendar-native/docs/project-info.md) - Full project overview
- [rehearsal-calendar-native/docs/quick-reference.md](rehearsal-calendar-native/docs/quick-reference.md) - Quick reference for common errors
- [rehearsal-calendar-native/docs/api-documentation.md](rehearsal-calendar-native/docs/api-documentation.md) - Complete API reference
- [rehearsal-calendar-native/docs/api-standards.md](rehearsal-calendar-native/docs/api-standards.md) - API conventions
- [rehearsal-calendar-native/docs/recurring-billing.md](rehearsal-calendar-native/docs/recurring-billing.md) - **AllPay recurring billing guide** (complete implementation details, timezone fixes, testing, production checklist)
- [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) - Google OAuth setup guide (step-by-step)

## Tech Stack

**Frontend**: React Native 0.81.5, Expo SDK 54, TypeScript, React Navigation 7.x, i18next
**Backend**: Node.js 18+, Express.js 4.21.2, JWT authentication
**Database**: PostgreSQL (production), SQLite (development)
**Testing**: Jest, @testing-library/react-native
**Languages**: Russian, English (full i18n support)

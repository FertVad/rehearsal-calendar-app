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
│   ├── admin.js        # Admin dashboard API (stats, users, bug reports)
│   ├── admin/          # Admin page HTML generator (dashboardPage.js)
│   └── native/         # Native app endpoints (projects, rehearsals, availability, bug reports)
├── services/           # Business logic layer (rehearsals, notifications)
├── database/           # Database setup & migrations
├── middleware/         # Auth middleware, timezone conversion, admin auth
├── utils/              # Timezone utilities, HTML escaping, helpers
└── constants/          # Shared constants (availability types, etc.)
```

### Public Web Pages
Served by the Express server as static files, so that the landing page, the API
and `/invite/*` all share one origin. That is a requirement, not a preference:
`apple-app-site-association` must be hosted on the same domain the invite links
use, or Universal Links will not work.

```
server/public/
├── index.html           # Landing — all four locales in the markup
├── styles.css           # Landing design system (dark theme, glass morphism)
├── i18n.js              # Language toggle, reveals, and the phone scroll
├── privacy.html         # Privacy Policy — EN/RU/ES/DE
├── support.html         # Support — EN/RU/ES/DE
├── legal.css            # Shared styling for the two pages above
├── legal.js             # Their language toggle (4 locales, shared storage key)
└── assets/              # Phone frames and screen strips (WebP), logo, favicons
```
- **Stack**: Pure HTML/CSS/JS, no build tools, no third-party scripts
- **Routes**: `/` → landing, `/privacy`, `/support` (the `extensions: ['html']`
  option on `express.static` is what makes the extensionless paths work)
- **i18n**: every language ships in the markup and one is hidden, so the pages
  stay readable without JavaScript — all four on every page. Each language is
  written on its own terms rather than translated slot by slot, which is why
  there is no dictionary in `i18n.js`. The choice is stored under
  `rehearsly-lang`, shared with `legal.js`; `?lang=de` overrides it for a link.
- **Phone mock-ups**: a frame pins to the middle of the viewport (CSS `sticky`)
  while its screenshot scrolls inside, so a whole app screen can be read
  without leaving the section. `assets/` is generated from the raw simulator
  shots by `screens/build-assets.py`, which lifts the status bar, tab bar and
  the planner's own pinned header out of the images and stitches the frames of
  one screen into a single strip by matching row signatures. Reshoot a screen
  and rerun it.
- **To preview**: run the server and open `http://localhost:3001/`
- **Deployment gotcha**: `vercel.json` needs `includeFiles: "public/**"` —
  `express.static` resolves paths at runtime, so the bundler cannot infer the
  folder is needed and would otherwise omit it.

### Database
- **Development**: SQLite (`native_database.db`)
- **Production**: PostgreSQL (Neon.tech)
- **Tables**: All prefixed with `native_*` (native_users, native_projects, native_rehearsals, native_user_availability, native_bug_reports, etc.). Four `native_subscription_*`/`native_payment_*`/`native_allpay_*` tables survive from the removed payment code — nothing reads them.
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

### 5. Seen System (Rehearsal Responses)
Binary "I've seen this" toggle using eye icon. No 'maybe' status.

**Two different value sets — don't confuse them:**

```javascript
// ON THE WIRE: always 'yes' or 'no' — never null.
// POST /api/native/rehearsals/:id/respond
{ response: 'yes' }  // Mark as seen
{ response: 'no' }   // Mark as unseen

// IN FRONTEND STATE (RSVPStatus): 'yes' (seen) or null (unseen)
```

`useRSVP` translates between the two — `null` in UI state maps to `'no'` on the wire:
```typescript
const newStatus = currentStatus === 'yes' ? null : 'yes';   // UI state
const serverStatus = currentStatus === 'yes' ? 'no' : 'yes'; // wire value
```

The backend **upserts** the row (`ON CONFLICT ... DO UPDATE`); it never deletes.
Sending anything other than `'yes'`/`'no'` throws.

**Having a row at all is what puts you on the rehearsal.** `'no'` means invited
and not yet seen — not declined. So editing a rehearsal must keep existing
answers and add newcomers as `'no'`; wiping the rows and reinserting everyone as
`'yes'` marks the whole cast as having seen a rehearsal at the exact moment it
changed, and dropping a `'no'` row removes that person from the call.

**Order matters when updating.** `bookRehearsalSlots` reads the roster out of
`native_rehearsal_responses`, so participants must be settled *before* the
availability is rebuilt. The other way round books whoever was on the rehearsal
before the edit.

**`invited` is the people on that rehearsal**, not the size of the project.
Three places report this counter — the list, the participants screen, and the
response to tapping the eye — and they have to agree, or the number jumps on
the tap and snaps back on the next refresh.
See [rsvpService.js](rehearsal-calendar-native/server/services/rehearsals/rsvpService.js).

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

## Key Features & Implementation

### Smart Planner
**Location**: `src/features/smart-planner/`

Analyzes member availability and recommends optimal rehearsal times:
- Loads availability for all project members in a date range
- Categorizes slots: Perfect (100% free), Good (80%+), Possible (50%+), Difficult (<50%)
- Supports filtering by specific members
- Uses batch API endpoint for performance

### Calendar Sync
**Location**: `src/shared/services/calendar/`, `src/shared/hooks/useAutoCalendarSync.ts`

Bi-directional sync with iOS/Google Calendar:
- **Export**: Rehearsals → device calendar events (batch processing, 10 parallel)
- **Import**: Calendar events → user availability (chunks of 50)
- Mappings live on the server (`/native/calendar-sync/mappings`), with
  AsyncStorage as a local cache

**Auto Sync runs both ways.** Saving a rehearsal exports that one immediately,
but only on the device that saved it — so without the export half of the
automatic sync, being added to someone else's rehearsal put it on nobody's
calendar but the organiser's. The export runs on foreground alongside the
import, on its own ten-minute timer because each rehearsal costs a mapping
lookup; pull-to-refresh ignores that timer.

**Import skips what we exported.** Rehearsal events are excluded by their
mapping ids, otherwise a rehearsal would count as busy twice — once as itself
and once as an imported event.

**Deleting the event in the phone's calendar does not stick.** The next sync
sees the mapping has no event and recreates it: the rehearsal is the source of
truth, the calendar a mirror. The only ways out are deleting the rehearsal or
"remove all exported" on the sync screen.

**Only hours cross over, never what the events are.** Imported slots are titled
generically on purpose — see `IMPORTED_SLOT_TITLE` in `calendar/import.ts`. The
onboarding and the landing both promise this.

### Payments

There are none, on either side. The app never had a paid tier, and the AllPay
integration that used to back one — client, subscription service, checkout
page, webhook, `requireSubscription`, the recurring-billing cron and the
frontend screen — has been deleted rather than disabled.

Two App Store guidelines drove it. 3.1.1 forbids sending customers to any
checkout but Apple's, and a WebView onto an external payment page is exactly
that; 2.3.1 covers dormant features a server flag could switch on, which is
what a merely hidden subscription flow would have been.

If money is ever taken it goes through App Store in-app purchase, which shares
no code with what was removed — receipt verification on the server and App
Store Server Notifications for cancellations. See
[app-store-release.md](rehearsal-calendar-native/docs/app-store-release.md).
The deleted code is in git history, but do not restore it: the WebView checkout
is the part Apple rejects.

The four `native_subscription_*` / `native_payment_*` / `native_allpay_*`
tables still exist in the database. Nothing reads or writes them; they are left
in place because dropping them is irreversible and buys nothing.

### Rehearsal Reminders
**Location**: `server/services/notifications/reminderScheduler.js`, `server/routes/cron.js`

Push reminders for rehearsals starting soon. `checkUpcomingRehearsals()` finds
them and sends via Expo; `GET /api/cron/reminders` is what actually calls it.

**Nothing inside the deployment can drive it.** The in-process `node-cron`
schedule runs fine locally and never once on Vercel, because a function is not
resident between requests. A `crons` entry cannot replace it either: Hobby
allows one run per day, and an entry asking for more fails the whole deployment
before it builds. The trigger therefore lives outside — currently
[.github/workflows/rehearsal-reminders.yml](.github/workflows/rehearsal-reminders.yml),
every 15 minutes, needing a `CRON_SECRET` repository secret.

**The windows are deliberately wide** — 12–24h ahead for the day-before
reminder, 0–1h for the hour-before — because no free scheduler is punctual.
They used to be narrow bands (23–24h, 50–70min) that only worked under a
metronome: one missed run and a rehearsal crossed the band and was never
announced. Widening is free because each send is *claimed* in
`native_push_reminders` (unique on `rehearsal_id, reminder_type`) before the
push goes out, so overlapping schedulers cannot double-send, and a failed push
releases the claim so the next run retries.

Auth is fail-closed — without `CRON_SECRET` the endpoint answers 503 rather than
running unauthenticated.

### Admin Dashboard
**Location**: `server/routes/admin.js`, `server/routes/admin/dashboardPage.js`

Password-protected web admin panel at `/admin`. Uses JWT auth via `ADMIN_PASSWORD` env var.

**Features**:
- User stats (total, new this week/month, churn rates)
- Users table with pagination
- Transactions table with pagination
- Bug reports table with inline status management

**Auth**: `server/middleware/adminAuth.js` — bcrypt password login → JWT token (24h expiry)
- Set `ADMIN_PASSWORD_HASH` (bcrypt hash, recommended) or `ADMIN_PASSWORD` (plaintext, legacy)
- Generate hash: `node -e "import('bcrypt').then(b => b.default.hash('yourpassword', 10).then(console.log))"`
- JWT secret uses `ADMIN_JWT_SECRET` or falls back to `JWT_SECRET`

**API Endpoints**:
- `POST /admin/api/login` — authenticate with password
- `GET /admin/api/stats` — aggregate stats (users, subs, revenue, churn, usage)
- `GET /admin/api/users` — paginated user list
- `GET /admin/api/bug-reports` — paginated bug reports (sorted: new → in_progress → fixed)
- `PATCH /admin/api/bug-reports/:id/status` — update bug report status (new/in_progress/fixed)

### Beta Testing: Bug Reports
**Location**: `src/shared/components/BetaBanner.tsx`, `server/routes/native/bugReports.js`

Global "Test Flight" banner visible on all tab screens during beta testing.

**Frontend**:
- `BetaBanner` component mounted in `TabNavigator` (navigation/index.tsx)
- Shows rocket icon + "Тестовый полёт" / "Test Flight" with "Bug Report" button
- Opens modal with text input, submits to backend
- Automatically captures current screen name via `useNavigationState`

**Backend**:
- `POST /api/native/bug-reports` — create report (requireAuth, body: `{ message, screen }`)
- Table: `native_bug_reports` (id, user_id, message, screen, status, created_at)
- Status values: `new` (default), `in_progress`, `fixed`

**Admin view**: Bug reports appear in admin dashboard at `/admin` with clickable status buttons.

**Removing after beta**: Delete `<BetaBanner />` from `TabNavigator` in `src/navigation/index.tsx` and remove the import.

### Logging Convention
Use `logger` utility instead of `console.log` — automatically suppressed in production:

```typescript
// Frontend: src/shared/utils/logger.ts
import { logger } from '../../../shared/utils/logger';
logger.debug('Loading data:', result);  // hidden in production
logger.warn('Permission denied');       // always shown
logger.error('Request failed:', err);   // always shown

// Backend: server/utils/logger.js
import { logger } from '../utils/logger.js';
logger.debug(`[ServiceName] Step completed`);
```

❌ Never use `console.log` directly in production code — it leaks debug info and can expose sensitive data.

### Security Architecture
Key security measures in place (as of 2026-04-11):

- **Rate limiting**: 20 req/min on `/api/auth/*`, 5 attempts/15 min on `/admin/api/login`
- **Helmet**: Security headers (X-Frame-Options, HSTS, X-Content-Type-Options, etc.)
- **CORS**: Whitelisted origins only (via `BASE_URL` env). Requests without origin (mobile app, Vercel Cron) are allowed through.
- **Cron**: Fail-closed — returns 503 if `CRON_SECRET` not configured
- **Admin password**: bcrypt hash (`ADMIN_PASSWORD_HASH`) with plaintext fallback (`ADMIN_PASSWORD`)
- **Error responses**: Never expose `err.message` or stack traces to clients in production

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

### 8. PostgreSQL Timezone Comparisons in Cron Jobs
❌ **Problem**: A scheduled query finds 0 rows even though the timestamps are clearly in the past
✅ **Fix**: Pin the session timezone to UTC and convert explicitly

**Root Cause**: a `timestamp without time zone` column stores no offset, so PostgreSQL
reads it in the session's zone. A server running in Jerusalem (UTC+2) compares
UTC-stored values against local `CURRENT_TIMESTAMP` and silently misses a two-hour band.

```javascript
// 1. Set the session timezone before the query (guard with isPostgres — SQLite rejects it)
if (isPostgres) await db.run("SET timezone = 'UTC'");

// 2. Convert explicitly when writing
await db.run(`UPDATE t SET due_at = ($1::timestamptz AT TIME ZONE 'UTC')::timestamp WHERE id = $2`,
  [date.toISOString(), id]);

// 3. Derive new times from the current instant, not from the stored value
const next = new Date(now);          // ✅
next.setUTCMinutes(next.getUTCMinutes() + 15);
```

**Where it matters now**: `GET /api/cron/reminders` (Vercel Cron, every 15 min) —
it selects rehearsals due soon. An in-process `node-cron` schedule cannot replace
it: Vercel functions do not stay resident, so the schedule never fires.

## Environment Setup

### Required Environment Variables

**server/.env** (Backend)
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...   # PostgreSQL connection string (production)
JWT_SECRET=<generate-with-openssl-rand-base64-32>  # REQUIRED in production

# OAuth Configuration (Google Sign-In)
GOOGLE_CLIENT_ID_IOS=your-ios-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=your-android-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_ID_WEB=your-web-client-id.apps.googleusercontent.com

# OAuth Configuration (Apple Sign-In)
APPLE_CLIENT_ID=com.rehearsal.app
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY=  # Contents of .p8 file or path to file

# Admin Dashboard
ADMIN_PASSWORD_HASH=  # bcrypt hash (recommended). Generate: see Admin Dashboard section above
ADMIN_PASSWORD=       # plaintext fallback (legacy, avoid in production)
ADMIN_JWT_SECRET=     # optional, falls back to JWT_SECRET

# Cron Job (Vercel Cron Jobs)
# CRITICAL: endpoint returns 503 if not set (fail-closed)
CRON_SECRET=<generate-with-openssl-rand-base64-32>

# Server URL (invite links, universal links)
BASE_URL=https://your-app.vercel.app  # required in production
HOST=0.0.0.0  # required for physical device access
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

**The frontend suite has 3 known failures**, all in `TodayRehearsals.test.tsx`
and all describing an older version of the component — see
[known-issues.md](rehearsal-calendar-native/docs/known-issues.md). Three is the
number to watch: anything above it is new. The backend suite is green.

Route-level and service-level tests are the ones that catch things. Several
older suites drive SQL directly or assert against rows they wrote themselves,
which is why bugs in the layer above them — the order of two calls inside a
service, what a handler returns — stayed invisible for months. Prefer going
through the function under test.

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
- [rehearsal-calendar-native/docs/quick-reference.md](rehearsal-calendar-native/docs/quick-reference.md) - Quick reference for common errors
- [rehearsal-calendar-native/docs/known-issues.md](rehearsal-calendar-native/docs/known-issues.md) - Defects found and deliberately left for later
- [rehearsal-calendar-native/docs/api-documentation.md](rehearsal-calendar-native/docs/api-documentation.md) - Complete API reference
- [rehearsal-calendar-native/docs/api-standards.md](rehearsal-calendar-native/docs/api-standards.md) - API conventions
- [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) - Google OAuth setup guide (step-by-step)

## Tech Stack

**Frontend**: React Native 0.81.5, Expo SDK 54, TypeScript, React Navigation 7.x
**Backend**: Node.js 18+, Express.js 4.21.2, JWT authentication
**Database**: PostgreSQL (production), SQLite (development)
**Testing**: Jest, @testing-library/react-native
**Languages**: Russian, English (full i18n support)

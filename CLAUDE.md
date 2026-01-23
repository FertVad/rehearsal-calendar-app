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
│   └── native/         # Native app endpoints (projects, rehearsals, availability)
├── database/           # Database setup & migrations
├── middleware/         # Auth middleware, timezone conversion
├── utils/              # Timezone utilities, helpers
└── constants/          # Shared constants (availability types, etc.)
```

### Database
- **Development**: SQLite (`native_database.db`)
- **Production**: PostgreSQL (Neon.tech)
- **Tables**: All prefixed with `native_*` (native_users, native_projects, native_rehearsals, native_user_availability, etc.)
- **Schema**: [rehearsal-calendar-native/server/database/init-native-schema.sql](rehearsal-calendar-native/server/database/init-native-schema.sql)

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

### 3. API URL Configuration
The app auto-detects API URL based on environment:
- **iOS Simulator**: `http://localhost:3001/api`
- **Android Emulator**: `http://10.0.2.2:3001/api`
- **Physical Device**: Auto-detects from Expo debuggerHost
- **Override**: Set `EXPO_PUBLIC_API_URL` in `.env`

Server must listen on `0.0.0.0:3001` (not `127.0.0.1`) for physical device access.

### 4. Xcode Build Configuration
Ensure Xcode scheme uses **Debug** build configuration (not Release):
- File: `ios/rehearsalcalendarnative.xcodeproj/xcshareddata/xcschemes/rehearsalcalendarnative.xcscheme`
- Check: `LaunchAction` should have `buildConfiguration = "Debug"`
- Symptom if wrong: `__DEV__` returns false, app connects to production server

### 5. OAuth Implementation
When adding OAuth providers (Google Sign-In, Apple Sign-In):
- Check `native_auth_providers` table for account linking
- Use `server/utils/accountLinking.js` for merging accounts
- Handle both new users and existing user linking

## Environment Setup

### Required Environment Variables

**server/.env** (Backend)
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...   # PostgreSQL connection string (production)
JWT_SECRET=<generate-with-openssl-rand-base64-32>  # REQUIRED in production
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

## Tech Stack

**Frontend**: React Native 0.81.5, Expo SDK 54, TypeScript, React Navigation 7.x, i18next
**Backend**: Node.js 18+, Express.js 4.21.2, JWT authentication
**Database**: PostgreSQL (production), SQLite (development)
**Testing**: Jest, @testing-library/react-native
**Languages**: Russian, English (full i18n support)

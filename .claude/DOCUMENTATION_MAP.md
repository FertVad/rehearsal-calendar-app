# Documentation Map

Complete index of all documentation files in the Rehearsal Calendar Native App project.

---

## 📚 Main Documentation

### Project Overview
- **[../rehearsal-calendar-native/docs/project-info.md](../../rehearsal-calendar-native/docs/project-info.md)** - Complete project documentation
  - Technology stack, architecture, features
  - Installation guide, environment setup
  - Database overview, API endpoints
  - i18n, timezone handling, design system
  - Troubleshooting and known issues

### API Reference
- **[API_DOCUMENTATION.md](../../rehearsal-calendar-native/docs/api-documentation.md)** - REST API specification
  - Complete endpoint reference
  - Request/response examples
  - Data models and types
  - Error handling
  - Authentication flow

### Localization
- **[LOCALIZATION_GUIDE.md](../../rehearsal-calendar-native/docs/localization-guide.md)** - Internationalization guide
  - How to add new translations
  - Supported languages (ru/en)
  - Translation file structure
  - Dynamic content localization

### Migration Guides
- **[MIGRATION_TO_TIMESTAMPTZ.md](../rehearsal-calendar-native/MIGRATION_TO_TIMESTAMPTZ.md)** - Timezone migration guide
  - TIMESTAMPTZ architecture
  - Migration from DATE + TIME columns
  - ISO 8601 format handling
  - Timezone conversion patterns

---

## 🗄 Database & Server Documentation

### Database Schema
- **[.claude/DB_SCHEMA.md](./DB_SCHEMA.md)** - **⭐ Database source of truth**
  - All tables, columns, types, constraints
  - Indexes and performance notes
  - TIMESTAMPTZ and timezone handling
  - Migration map and history
  - AI safety rules for database operations
  - Schema change checklist

### Migrations
Located in `../rehearsal-calendar-native/server/migrations/`:

| # | File | Purpose |
|---|------|---------|
| 1 | `add-rehearsal-responses-table.sql` | RSVP/attendance tracking |
| 2 | `migrate-rehearsals-to-timestamptz.sql` | Add TIMESTAMPTZ columns to rehearsals |
| 3 | `migrate-availability-to-timestamptz.sql` | Add TIMESTAMPTZ columns to availability |
| 4 | `drop-old-rehearsal-columns.sql` | Remove old date/time columns from rehearsals |
| 5 | `drop-old-availability-columns.sql` | Remove old date/time columns from availability |
| 6 | `fix-date-column-types.sql` | Fix date column types (obsolete) |
| 7 | `add-rehearsal-title-description.sql` | Add title and description to rehearsals |
| 8 | `add-is-all-day-flag.sql` | Add all-day event support |
| 9 | `adapt-calendar-tables-for-expo.sql` | Adapt for expo-calendar device sync |

### Server Code
- **`../rehearsal-calendar-native/server/database/schema-native.sql`** - Initial SQLite schema (development reference)
- **`../rehearsal-calendar-native/server/utils/timezone.js`** - Timezone conversion utilities
- **`../rehearsal-calendar-native/server/constants/timezone.js`** - Centralized timezone constants
- **`../rehearsal-calendar-native/server/middleware/timezoneMiddleware.js`** - Timezone conversion middleware
- **`../rehearsal-calendar-native/server/middleware/jwtMiddleware.js`** - JWT authentication middleware

---

## 📱 Frontend Documentation

### Architecture
- **Feature-based structure**: `../rehearsal-calendar-native/src/features/`
  - `auth/` - Authentication (login, register, password reset)
  - `calendar/` - Calendar, rehearsals, RSVP
  - `projects/` - Project management, invites
  - `availability/` - User availability management
  - `profile/` - User profile, settings, calendar sync
  - `smart-planner/` - Smart rehearsal planner

### Key Components

#### Shared Components (`../rehearsal-calendar-native/src/shared/components/`)
- **`DateRangePicker.tsx`** - Date range picker with calendar UI
- **`LoadingSpinner.tsx`** - Loading indicator
- **`ErrorMessage.tsx`** - Error display component

#### Calendar Components (`../rehearsal-calendar-native/src/features/calendar/components/`)
- **`CalendarView.tsx`** - Main calendar grid
- **`TodayRehearsals.tsx`** - Today's rehearsals list with RSVP
- **`ActorSelector.tsx`** - Member selection with availability status

#### Availability Components (`../rehearsal-calendar-native/src/features/availability/components/`)
- **`CalendarMonth.tsx`** - Availability calendar grid
- **`TimeSlotPicker.tsx`** - Time slot selection UI
- **`ModeSelector.tsx`** - Availability mode selector (Smart/Custom/Import)

#### Smart Planner Components (`../rehearsal-calendar-native/src/features/smart-planner/components/`)
- **`DayCard.tsx`** - Day card with categorized slots
- **`SlotItem.tsx`** - Time slot card with availability status
- **`MemberFilter.tsx`** - Member filter with quick actions

### Hooks Documentation

#### Calendar Hooks (`../rehearsal-calendar-native/src/features/calendar/hooks/`)
- **`useRehearsals.ts`** - Rehearsal data fetching and management
- **`useRSVP.ts`** - RSVP response handling
- **`useCalendarSync.ts`** - Calendar synchronization
- **`useTimeRecommendations.ts`** - Smart time recommendations
- **`useAddRehearsalForm.ts`** - Rehearsal form state management
- **`useAddRehearsalSubmit.ts`** - Rehearsal creation/update logic

#### Availability Hooks (`../rehearsal-calendar-native/src/features/availability/hooks/`)
- **`useAvailability.ts`** - Availability data management
- **`useImportEvents.ts`** - Calendar event import
- **`useAvailabilityForm.ts`** - Availability form logic

#### Smart Planner Hooks (`../rehearsal-calendar-native/src/features/smart-planner/hooks/`)
- **`useSmartPlanner.ts`** - Smart planner logic and slot generation

### Utilities

#### Time & Date (`../rehearsal-calendar-native/src/shared/utils/`)
- **`time.ts`** - Time formatting and parsing
- **`dateTimeToISO.ts`** - ISO 8601 conversion
- **`conflictDetection.ts`** - Schedule conflict detection
- **`availability.ts`** - Availability merging and slot generation

#### Services (`../rehearsal-calendar-native/src/shared/services/`)
- **`api.ts`** - Axios API client configuration
- **`calendar.ts`** - expo-calendar integration
- **`calendarSync.ts`** - Calendar sync operations (import/export)

#### Storage (`../rehearsal-calendar-native/src/shared/utils/`)
- **`calendarStorage.ts`** - AsyncStorage helpers for calendar sync
- **`storage.ts`** - Generic AsyncStorage utilities

---

## 🌍 Internationalization

### Translation Files
Located in `../rehearsal-calendar-native/src/i18n/`:

- **`translations.ts`** - Main translations file
  - Type definitions (`Translations` interface)
  - Russian translations (`ru`)
  - English translations (`en`)
  - Dynamic functions for pluralization

- **`translations/`** - Modular translation files:
  - `common.ts` - Common UI strings
  - `auth.ts` - Authentication
  - `calendar.ts` - Calendar and rehearsals
  - `availability.ts` - Availability
  - `projects.ts` - Projects
  - `profile.ts` - Profile and settings

### Context
- **`../rehearsal-calendar-native/src/contexts/I18nContext.tsx`** - i18n context provider
  - Language state management
  - Language switching
  - AsyncStorage persistence

---

## 🎨 Design System

### Constants
Located in `../rehearsal-calendar-native/src/shared/constants/`:

- **`colors.ts`** - Color palette
  - Background colors (`Colors.bg.*`)
  - Glass morphism (`Colors.glass.*`)
  - Accent colors (`Colors.accent.*`)
  - Text colors (`Colors.text.*`)
  - Font sizes (`FontSize.*`)
  - Font weights (`FontWeight.*`)
  - Spacing scale (`Spacing.*`)
  - Border radius (`BorderRadius.*`)

### Styles
- Feature-specific styles in `../rehearsal-calendar-native/src/features/*/styles/`
- Shared component styles in `../rehearsal-calendar-native/src/shared/components/*/styles.ts`

---

## 🧪 Testing & Quality

### Testing Roadmap
- **[TESTING_ROADMAP.md](./TESTING_ROADMAP.md)** - **⭐ Comprehensive testing plan**
  - 8 sprints covering Frontend, Backend, and E2E
  - Current coverage status and gaps
  - Sprint-by-sprint breakdown with checklists
  - Best practices and test utilities
  - Progress tracking (0% → 80% target)

### Current Test Coverage

**Running Tests:**
```bash
npm test              # Run all tests (57 tests passing)
npm test -- --watch   # Watch mode
npm run check         # Full check (secrets + types + tests)
```

**Existing Tests:**
- ✅ **Timezone utilities** (18 tests) - `server/__tests__/timezone.test.js`
- ✅ **Availability validation** (36 tests) - `src/__tests__/availabilityValidation.test.ts`
- ✅ **Smoke tests** (3 tests) - `src/__tests__/smoke.test.ts`

**Test Configuration:**
- `jest.config.js` - Jest configuration with ts-jest
- Coverage collection enabled for `src/` and `server/`

### Type Checking
```bash
npx tsc --noEmit
```

### Linting
```bash
npm run lint         # Check code quality
npm run lint:fix     # Auto-fix issues
```

### Security Scanning
```bash
npm run check:secrets  # Scan for exposed secrets
```

---

## 🔒 Security Documentation

### Security Checklist
See [PROJECT_INFO.md - Security Checklist](../../rehearsal-calendar-native/docs/project-info.md#🔒-security-checklist-before-production) for:
- JWT secrets configuration
- XSS prevention
- CORS configuration
- Rate limiting
- Input validation
- Secure storage

### Database Safety Rules
See [DB_SCHEMA.md - AI Safety Rules](./DB_SCHEMA.md#ai-safety-rules-for-database-operations) for:
- Parameterized query requirements
- Table name consistency
- Timezone handling rules
- Foreign key cascade rules
- Migration safety checklist

---

## 📦 Deployment Documentation

### Backend Deployment
- Platform: Render.com
- Database: PostgreSQL (Neon.tech)
- Environment variables: See [PROJECT_INFO.md - Environment Variables](../../rehearsal-calendar-native/docs/project-info.md#environment-variables)

### Mobile App Deployment
- **iOS**: Xcode → Archive → Distribute
- **Android**: Not yet configured

### Configuration Files
- **`../rehearsal-calendar-native/server/.env`** - Server environment variables
- **`../rehearsal-calendar-native/.env`** - Client environment variables (EXPO_PUBLIC_API_URL)
- **`../rehearsal-calendar-native/app.json`** - Expo configuration
- **`../rehearsal-calendar-native/ios/rehearsalcalendarnative.xcodeproj/`** - iOS project files

---

## 📋 Version History

See [PROJECT_INFO.md - Recent Updates](../../rehearsal-calendar-native/docs/project-info.md#📋-recent-updates) for:
- Version 1.6.0 - Like System & Authentication Improvements (Dec 24, 2024)
- Version 1.5.0 - Calendar Sync & Performance Optimization (Dec 23, 2024)
- Version 1.4.0 - Full i18n Implementation (Dec 17, 2024)

---

## 🔧 Troubleshooting

### Common Issues
See [PROJECT_INFO.md - Troubleshooting](../../rehearsal-calendar-native/docs/project-info.md#🔧-troubleshooting) for:
- Connection timeout issues
- Xcode configuration problems
- API connectivity debugging
- Server configuration

---

## 📞 Quick Reference

| Task | Documentation |
|------|---------------|
| Setup new dev environment | [PROJECT_INFO.md - Getting Started](../../rehearsal-calendar-native/docs/project-info.md#🚀-getting-started) |
| Add new API endpoint | [API_DOCUMENTATION.md](../../rehearsal-calendar-native/docs/api-documentation.md) |
| Modify database schema | [DB_SCHEMA.md - Schema Change Checklist](./DB_SCHEMA.md#schema-change-checklist) |
| Add translations | [LOCALIZATION_GUIDE.md](../../rehearsal-calendar-native/docs/localization-guide.md) |
| Debug timezone issues | [MIGRATION_TO_TIMESTAMPTZ.md](../rehearsal-calendar-native/MIGRATION_TO_TIMESTAMPTZ.md) |
| Understand database | [DB_SCHEMA.md](./DB_SCHEMA.md) |
| Create migration | [DB_SCHEMA.md - Migration Safety Checklist](./DB_SCHEMA.md#migration-safety-checklist) |
| Write tests | [TESTING_ROADMAP.md](./TESTING_ROADMAP.md) |
| Run tests | `npm test` or see [TESTING_ROADMAP.md - Current Coverage](./TESTING_ROADMAP.md#current-coverage) |

---

**Last Updated:** 2025-12-27
**Maintained By:** AI + Development Team

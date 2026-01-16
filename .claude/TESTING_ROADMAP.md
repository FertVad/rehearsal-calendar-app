# Testing Roadmap - Rehearsal Calendar Native App

**Created:** 2025-12-27
**Status:** In Planning
**Goal:** Achieve 80%+ test coverage across Frontend, Backend, and E2E

---

## Overview

### Current Coverage
- ✅ JWT Middleware (20 REAL tests)
- ✅ Timezone utilities (18 REAL tests)
- ✅ RSVP Integration (10 REAL tests)
- ✅ Rehearsals Integration (17 REAL tests)
- ✅ Projects Integration (24 REAL tests)
- ✅ Invites Integration (22 REAL tests)
- ✅ Availability Integration (22 REAL tests)
- ✅ **Calendar Sync Integration** ✨ NEW (17 REAL tests)
- ✅ Frontend Hooks - useRehearsals (16 tests)
- ✅ Frontend Hooks - useRSVP (13 tests)
- ✅ Frontend Hooks - useInviteLink (10 tests)
- ✅ Frontend Hooks - useAddRehearsalForm (16 tests)
- ✅ Frontend Hooks - useAddRehearsalSubmit (28 tests)
- ✅ Frontend Hooks - useAvailabilityData (16 tests)
- ✅ Frontend Hooks - useAvailabilitySave (16 tests)
- ✅ Frontend Hooks - **useCalendarSync** ✨ NEW (29 tests)
- ✅ Frontend Hooks - **useTimeRecommendations (Smart Planner)** ✨ NEW (26 tests)
- ✅ Frontend Availability Validation (17 tests)
- ✅ Frontend Components - DateRangePicker (14 tests)
- ✅ Frontend Components - TodayRehearsals (17 tests)
- ✅ Frontend Components - ActorSelector (25 tests)
- ✅ Frontend Components - TimeSlotsEditor (19 tests)
- ✅ Frontend Components - ModeSelector (21 tests)
- ✅ ESLint + TypeScript checks
- ✅ Secret scanner
- ✅ Frontend Integration Tests - Auth Flow (10 tests)
- ✅ Frontend Integration Tests - Rehearsal Flow (15 tests)
- ✅ Frontend Integration Tests - Availability Flow (13 tests)
- **Total: 149 backend tests + 329 frontend tests = 478 tests passing ✅**

### Coverage Gaps
- ❌ E2E Flows (0%)

---

## Sprint Structure

**Sprint Duration:** 1-2 weeks each
**Estimated Total:** 8-10 weeks (2-2.5 months)

---

## 🚀 Sprint 1: Foundation & Critical Path ✅ COMPLETED

**Focus:** Setup testing infrastructure + critical backend tests

### Setup (Priority: CRITICAL)

- [x] ✅ Install React Testing Library
  ```bash
  npm install --save-dev @testing-library/react-native @testing-library/jest-native --legacy-peer-deps
  ```

- [x] ✅ Install Supertest for API testing
  ```bash
  cd server && npm install --save-dev supertest jest
  ```

- [x] ✅ Configure Jest for Backend (ES Modules)
  - [x] Created `server/jest.config.js` with ES modules support
  - [x] Added `setupFilesAfterEnv` with `__tests__/setup.js`
  - [x] Added test scripts to `server/package.json`
  - [x] Configured NODE_OPTIONS=--experimental-vm-modules

- [x] ✅ Create test utilities
  - [x] `src/__tests__/utils/testUtils.tsx` - render with providers
  - [x] `src/__tests__/utils/mockData.ts` - mock data generators
  - [x] `server/__tests__/integration/setup.js` - in-memory SQLite for integration tests

### Backend: Authentication (Priority: CRITICAL)

**Files:** `server/middleware/jwtMiddleware.js`

- [x] ✅ **JWT Middleware** (`server/__tests__/middleware/jwtMiddleware.test.js`) - **20 REAL tests**
  - [x] Token generation (access + refresh)
  - [x] Token verification (all scenarios)
  - [x] authenticateToken middleware (401 scenarios)
  - [x] Валидный JWT токен пропускается
  - [x] Невалидный токен возвращает 401
  - [x] Expired токен возвращает 401
  - [x] Отсутствующий токен возвращает 401
  - [x] Malformed токен возвращает 401
  - [x] Wrong secret токен возвращает 401
  - [x] Wrong token type возвращает 401

**Note:** Initial approach with `auth-unit.test.js` was abandoned because ES Modules mocking doesn't work reliably with jest.mock(). Instead, focused on real JWT middleware tests that import and call actual code.

**Actual Time:** ~2 hours
**Tests Created:** 20 REAL tests (JWT middleware only)
**Status:** ✅ All tests passing

---

## 🎯 Sprint 2: Backend Core Business Logic ✅ COMPLETED

**Focus:** Rehearsals CRUD + RSVP functionality

### Backend: Rehearsals Integration Tests (Priority: HIGH)

**Files:** `server/__tests__/integration/rehearsals.integration.test.js`

- [x] ✅ **Rehearsals CRUD** - **17 REAL integration tests**
  - [x] CREATE: Insert rehearsal in database with foreign keys
  - [x] CREATE: Foreign key constraint validation (project_id)
  - [x] CREATE: NOT NULL constraint validation (required fields)
  - [x] READ: Fetch all rehearsals for project (ORDER BY)
  - [x] READ: Empty array when no rehearsals exist
  - [x] READ: Rehearsal with response stats (JOIN queries)
  - [x] READ: Calculate stats with multiple responses
  - [x] READ: Zero stats when no responses
  - [x] UPDATE: Update rehearsal fields in database
  - [x] UPDATE: Update time fields correctly
  - [x] UPDATE: Isolation - not affecting other rehearsals
  - [x] DELETE: Actually remove rehearsal from database
  - [x] DELETE: CASCADE delete all responses
  - [x] FILTER: Date filtering (upcoming vs past rehearsals)
  - [x] JOIN: Complex multi-table JOIN (rehearsals + responses + users)

### Backend: RSVP Integration Tests (Priority: HIGH)

**Files:** `server/__tests__/integration/rsvp.integration.test.js`

- [x] ✅ **RSVP Operations** - **10 REAL integration tests**
  - [x] CREATE: Insert response in database
  - [x] UPDATE: UPSERT existing response (ON CONFLICT)
  - [x] DELETE: Remove response when unliking
  - [x] STATS: Calculate correct counts from database
  - [x] CONSTRAINT: UNIQUE (rehearsal_id, user_id) enforcement
  - [x] CASCADE: Delete responses when rehearsal deleted
  - [x] JOIN: Fetch responses with user info (multi-table JOIN)
  - [x] READ: Empty array when no responses
  - [x] READ: Fetch single user response
  - [x] READ: undefined when user hasn't responded

**Note:** Initial approach with fake unit tests (`rehearsalService-unit.test.js`, `rsvpService-unit.test.js`) was abandoned because they only checked arrays/contracts without calling real code. Replaced with integration tests using in-memory SQLite database that execute real SQL queries and verify actual behavior.

**Actual Time:** ~2 hours
**Tests Created:** 27 REAL integration tests (17 rehearsals + 10 RSVP)
**Status:** ✅ All tests passing (65 total: 20 JWT + 18 timezone + 27 integration)

---

## 🏗 Sprint 3: Backend Projects & Availability ✅ COMPLETED

**Focus:** Projects management + User availability

### Backend: Projects Integration Tests (Priority: MEDIUM)

**Files:** `server/__tests__/integration/projects.integration.test.js`

- [x] ✅ **Projects CRUD** - **24 REAL integration tests**
  - [x] CREATE: Insert project with timezone
  - [x] CREATE: Default timezone when not provided
  - [x] CREATE: Owner membership creation
  - [x] CREATE: NOT NULL constraint on name
  - [x] READ: Fetch all projects for user (JOIN with members)
  - [x] READ: Identify admin vs member role
  - [x] READ: Filter by active memberships
  - [x] READ: Empty array for users with no projects
  - [x] READ: Fetch single project by ID
  - [x] READ: Verify user membership before access
  - [x] READ: undefined for non-existent project
  - [x] READ: Access control enforcement
  - [x] UPDATE: Update project fields in database
  - [x] UPDATE: Permission check (admin/owner only)
  - [x] UPDATE: Prevent non-admin from updating
  - [x] DELETE: Actually remove project from database
  - [x] DELETE: CASCADE delete all members
  - [x] DELETE: CASCADE delete all rehearsals
  - [x] DELETE: Owner-only permission check
  - [x] JOIN: Fetch members with user info
  - [x] JOIN: Order members by role
  - [x] JOIN: Empty array when no members
  - [x] CONSTRAINT: UNIQUE (project_id, user_id)

### Backend: Invites Integration Tests (Priority: MEDIUM)

**Files:** `server/__tests__/integration/invites.integration.test.js`

- [x] ✅ **Invite System** - **22 REAL integration tests**
  - [x] CREATE: Store invite code in project
  - [x] CREATE: Generate unique invite codes (crypto.randomBytes)
  - [x] CREATE: UNIQUE constraint on invite_code
  - [x] CREATE: Admin/owner permission check
  - [x] CREATE: Prevent non-admin from creating
  - [x] READ: Fetch project by invite code
  - [x] READ: undefined for invalid code
  - [x] READ: Validate expiration date
  - [x] READ: Detect expired invites
  - [x] JOIN: Create membership when joining
  - [x] JOIN: UNIQUE constraint prevents joining twice
  - [x] JOIN: Reactivate inactive membership
  - [x] JOIN: Block expired invites
  - [x] JOIN: Foreign key constraint validation
  - [x] DELETE: Clear invite code from project
  - [x] DELETE: Admin/owner permission for revoke
  - [x] QUERY: Return null when no invite exists
  - [x] QUERY: Return active invite
  - [x] QUERY: Don't return expired invites
  - [x] QUERY: Detect existing active membership
  - [x] QUERY: Detect inactive membership
  - [x] QUERY: undefined for non-members

### Backend: Availability Integration Tests (Priority: MEDIUM)

**Files:** `server/__tests__/integration/availability.integration.test.js`

- [x] ✅ **Availability API** - **22 REAL integration tests**
  - [x] CREATE: Insert availability slot with timestamps
  - [x] CREATE: Default type = "busy"
  - [x] CREATE: Default source = "manual"
  - [x] CREATE: Store is_all_day flag
  - [x] CREATE: Foreign key constraint (user_id)
  - [x] CREATE: NOT NULL constraint validation
  - [x] READ: Fetch all availability for user
  - [x] READ: Order by starts_at ASC
  - [x] READ: Filter by source (manual vs imported)
  - [x] READ: Empty array when no availability
  - [x] BULK: Insert multiple slots
  - [x] BULK: Delete existing manual slots before inserting
  - [x] BULK: Don't delete imported when updating manual
  - [x] DELETE: Remove availability slot
  - [x] DELETE: Delete all slots for a date
  - [x] DELETE: Delete only imported slots
  - [x] CASCADE: Delete availability when user deleted
  - [x] IMPORT: Create availability from calendar events
  - [x] IMPORT: Handle all-day events
  - [x] IMPORT: Clear all imported events
  - [x] FILTER: Filter by date
  - [x] FILTER: Empty for date with no availability

**Actual Time:** ~2.5 hours
**Tests Created:** 68 REAL integration tests (24 projects + 22 invites + 22 availability)
**Status:** ✅ All tests passing (132 total: 20 JWT + 18 timezone + 27 rehearsals/RSVP + 68 Sprint 3)

### Backend: Calendar Sync Integration Tests ✨ NEW (Priority: MEDIUM)

**Files:** `server/__tests__/integration/calendarSync.integration.test.js`

- [x] ✅ **Calendar Sync** - **17 REAL integration tests**
  - [x] CREATE: Calendar connection with device info
  - [x] CREATE: Multiple connections per user (different providers)
  - [x] READ: Fetch all connections for user
  - [x] READ: Empty array when no connections
  - [x] UPDATE: Update sync settings (enabled/disabled)
  - [x] DELETE: Remove calendar connection
  - [x] CREATE: Event mapping (rehearsal ↔ calendar event)
  - [x] CREATE: UNIQUE constraint (connection_id, event_type, internal_event_id)
  - [x] READ: Fetch all mappings for connection
  - [x] READ: Find mapping by internal event ID
  - [x] READ: undefined when mapping not found
  - [x] UPDATE: Update sync direction
  - [x] DELETE: Remove event mapping
  - [x] CASCADE: Delete all mappings when connection deleted
  - [x] CASCADE: Verify mappings actually removed
  - [x] ISOLATION: User 1 cannot see User 2's connections
  - [x] ISOLATION: User 1 cannot see User 2's mappings

**Note:** Added calendar sync tables to integration test setup with proper foreign keys and CASCADE deletion.

**Actual Time:** ~2 hours
**Tests Created:** 17 REAL integration tests
**Status:** ✅ All tests passing (149 backend total: 132 original + 17 Calendar Sync)

---

## 🎨 Sprint 4: Frontend Hooks ✅ COMPLETED

**Focus:** Business logic hooks тестирование

**Status:** All 115 hook tests passing with React Native mocking (39 original + 76 new)

### Custom Hooks: Calendar (Priority: HIGH)

**Files:** `src/features/calendar/hooks/`

- [x] ✅ **useRehearsals** (`src/features/calendar/hooks/__tests__/useRehearsals.test.ts`) - **16 tests**
  - [x] fetchRehearsals with all projects (batch endpoint)
  - [x] fetchRehearsals with single project
  - [x] transformRehearsal (ISO to legacy format)
  - [x] updateAdminStats
  - [x] Error handling
  - [x] Loading states
  - [x] RSVP data extraction
  - [x] Admin stats for admin projects
  - [x] Skip past rehearsals
  - [x] State setters (setRsvpResponses, setAdminStats)

- [x] ✅ **useRSVP** (`src/features/calendar/hooks/__tests__/useRSVP.test.ts`) - **13 tests**
  - [x] toggleLike null → yes (like)
  - [x] toggleLike yes → null (unlike)
  - [x] Optimistic updates
  - [x] Rollback on error
  - [x] Loading states (respondingId)
  - [x] Error handling with Alert
  - [x] Concurrent requests
  - [x] Edge cases (empty stats, null data)

### Custom Hooks: Projects (Priority: MEDIUM)

**Files:** `src/features/projects/hooks/`

- [x] ✅ **useInviteLink** (`src/features/projects/hooks/__tests__/useInviteLink.test.ts`) - **10 tests**
  - [x] generateInviteLink successfully
  - [x] Copy to clipboard with Expo Clipboard
  - [x] Success Alert shown
  - [x] Loading states (generatingInvite)
  - [x] Error handling with Alert
  - [x] Clipboard failure handling
  - [x] Concurrent requests
  - [x] Edge cases (empty URL, undefined URL)

**Actual Time:** ~4 hours (including Jest/React Native config fixes)
**Tests Created:** 39 hook tests (16 useRehearsals + 13 useRSVP + 10 useInviteLink)
**Status:** ✅ All 56 frontend tests passing (39 hooks + existing tests)

**Note:** Created comprehensive unit tests for 3 critical hooks with full coverage of happy paths, error cases, and edge cases. Successfully resolved React Native + Jest configuration challenges by:
- Using node test environment instead of jsdom (hooks don't need DOM)
- Creating mock files for React Native modules (Alert, Platform, etc.)
- Creating mock files for Expo modules (expo-clipboard, expo-constants, async-storage)
- Configuring moduleNameMapper and transformIgnorePatterns in jest.config.js

The test files follow best practices with proper mocking, act() wrapping, async handling, and comprehensive coverage including optimistic updates, rollback behavior, and concurrent operations.

- [x] ✅ **useAddRehearsalForm** (`src/features/calendar/hooks/__tests__/useAddRehearsalForm.test.ts`) - **16 tests**
  - [x] Form state initialization (create mode)
  - [x] Form state initialization (edit mode с rehearsalId)
  - [x] Prefill from route params
  - [x] Loading rehearsal data in edit mode
  - [x] Date/time pickers (show/hide functionality)
  - [x] Project selection (admin projects filtering, default selection)

- [x] ✅ **useAddRehearsalSubmit** (`src/features/calendar/hooks/__tests__/useAddRehearsalSubmit.test.ts`) - **28 tests**
  - [x] Validation: проект не выбран
  - [x] Validation: end_time <= start_time
  - [x] Conflict detection с warning dialog
  - [x] Create mode: успешное создание
  - [x] Edit mode: успешное обновление
  - [x] Calendar auto-sync после создания
  - [x] Error handling и Alert messages
  - [x] Participant IDs handling

### Custom Hooks: Availability (Priority: MEDIUM)

**Files:** `src/features/availability/hooks/`

- [x] ✅ **useAvailabilityData** (`src/features/availability/hooks/__tests__/useAvailabilityData.test.ts`) - **16 tests**
  - [x] Loading availability data on mount
  - [x] All-day vs timed slots handling
  - [x] Multiple slots per date
  - [x] Deduplication logic (rehearsal > manual)
  - [x] getDayState with default values
  - [x] Legacy format support
  - [x] Time format stripping (HH:MM:SS → HH:MM)
  - [x] State management (availability, hasChanges, saving)

- [x] ✅ **useAvailabilitySave** (`src/features/availability/hooks/__tests__/useAvailabilitySave.test.ts`) - **16 tests**
  - [x] Convert free/busy/custom modes to API format
  - [x] Slot validation (time ranges, overlaps)
  - [x] Successful save with callbacks
  - [x] Validation failure handling
  - [x] API error handling
  - [x] Localization (Russian/English date formatting)

**Note on useImportEvents:** This hook was mentioned in the original roadmap planning, but the actual implementation uses a different architecture:
- Import functionality exists as service functions in `src/shared/services/calendar/import.ts`:
  - `importCalendarEventsToAvailability(calendarIds, onProgress)`
  - `removeAllImportedSlots(onProgress)`
- The hook that wraps these functions is `useCalendarSync` (`src/features/calendar/hooks/useCalendarSync.ts`) with methods `importNow()` and `clearImported()`
- No separate "useImportEvents" hook exists - import functionality is part of the unified calendar sync hook

**Actual Time:** ~4 hours (including timezone fixes and expo-calendar mocking)
**Tests Created:** 76 new hook tests (16 useAddRehearsalForm + 28 useAddRehearsalSubmit + 16 useAvailabilityData + 16 useAvailabilitySave)
**Status:** ✅ All 115 hook tests passing (39 original + 76 new)

### Custom Hooks: Calendar Sync ✨ NEW (Priority: HIGH)

**Files:** `src/features/calendar/hooks/__tests__/useCalendarSync.test.ts`

- [x] ✅ **useCalendarSync** - **29 REAL hook tests**
  - [x] **Export Rehearsals** (19 tests):
    - [x] Initialize with permissions check
    - [x] Auto-select default calendar when available
    - [x] No calendar selected when none available
    - [x] Sync single rehearsal to calendar
    - [x] Sync multiple rehearsals in batch
    - [x] Skip already synced rehearsals
    - [x] Unsync (remove) rehearsal from calendar
    - [x] Update existing calendar event
    - [x] Update sync settings (enable/disable, calendar selection)
    - [x] Loading states (syncing, syncStatus)
    - [x] Error handling: no permission
    - [x] Error handling: no calendar selected
    - [x] Error handling: calendar API error
    - [x] Rollback on sync failure
  - [x] **Import Availability** (10 tests):
    - [x] Import events from selected calendars
    - [x] Import now (manual trigger)
    - [x] Convert calendar events to availability slots
    - [x] Update import settings (calendars, interval)
    - [x] Clear all imported slots
    - [x] Loading states (isImporting, importStatus)
    - [x] Error handling: no permission
    - [x] Error handling: import not enabled
    - [x] Error handling: import API error
    - [x] Error handling: clear failed

**Note:** Tests use comprehensive mocking of expo-calendar, AsyncStorage (for settings), and calendar service functions. All async operations properly wrapped with act() and waitFor().

### Custom Hooks: Smart Planner ✨ NEW (Priority: HIGH)

**Files:** `src/features/calendar/hooks/__tests__/useTimeRecommendations.test.ts`

- [x] ✅ **useTimeRecommendations** - **26 REAL hook tests**
  - [x] **Basic Time Slot Recommendations** (4 tests):
    - [x] Return full workday (09:00-23:00) when no one busy
    - [x] Return empty array when everyone busy all day
    - [x] Return empty array when no members selected
    - [x] Return empty array when no date selected
  - [x] **Finding Free Gaps Between Busy Times** (4 tests):
    - [x] Find morning slot when afternoon busy
    - [x] Find afternoon slot when morning busy
    - [x] Find gap between two busy periods
    - [x] Find multiple free gaps
  - [x] **Merging Overlapping Busy Times** (2 tests):
    - [x] Merge overlapping busy ranges
    - [x] Merge adjacent busy ranges
  - [x] **Minimum Duration Filtering** (3 tests):
    - [x] Filter out slots shorter than 1 hour
    - [x] Include slots exactly 1 hour long
    - [x] Include slots longer than 1 hour
  - [x] **Workday Clamping (09:00-23:00)** (3 tests):
    - [x] Clamp slot to workday start (09:00)
    - [x] Clamp slot to workday end (23:00)
    - [x] Ignore slots outside workday hours
  - [x] **Confidence Scoring** (2 tests):
    - [x] Assign high confidence when no busy times
    - [x] Assign medium confidence when busy times exist
  - [x] **Tentative Busy Times** (2 tests):
    - [x] Treat tentative as busy (conflict)
    - [x] Ignore available type (not a conflict)
  - [x] **Slot Sorting** (1 test):
    - [x] Sort slots by start time (ascending)
  - [x] **Duration Calculation** (2 tests):
    - [x] Calculate integer duration for whole hours
    - [x] Calculate fractional duration for partial hours
  - [x] **Reactivity to Changes** (3 tests):
    - [x] Recompute when members change
    - [x] Recompute when availability changes
    - [x] Recompute when date changes

**Note:** Tests comprehensively cover the Smart Planner algorithm for finding optimal rehearsal times. Fixed WORKDAY_END constant alignment (23:00 instead of 18:00).

**Actual Time:** ~5 hours (including WORKDAY_END fixes and TypeScript type fixes)
**Tests Created:** 55 new hook tests (29 useCalendarSync + 26 useTimeRecommendations)
**Status:** ✅ All 170 hook tests passing (115 original + 55 new)

---

## 🧩 Sprint 5: Frontend Components - Core ✅ COMPLETED

**Focus:** Критичные UI компоненты

**Status:** 96 component tests passing (96/96 ✅)

### Shared Components (Priority: HIGH)

**Files:** `src/shared/components/`

- [x] ✅ **DateRangePicker** (`src/shared/components/__tests__/DateRangePicker.test.tsx`) - **14 tests**
  - [x] Modal rendering (visible/hidden)
  - [x] Date selection (start/end)
  - [x] Date range validation
  - [x] Confirm/cancel actions
  - [x] Min date constraints
  - [x] Localization (ru/en)
  - [x] Edge cases (empty dates, same dates)

### Calendar Components (Priority: HIGH)

**Files:** `src/features/calendar/components/`

- [x] ✅ **TodayRehearsals** (`src/features/calendar/components/__tests__/TodayRehearsals.test.tsx`) - **17 tests**
  - [x] Loading and empty states
  - [x] Rehearsals list rendering
  - [x] Admin controls visibility (edit/delete for admins only)
  - [x] RSVP button functionality (heart icon toggle)
  - [x] Admin stats display (confirmed/invited counts)
  - [x] Date labels (Today, Tomorrow, formatted dates)
  - [x] Edge cases (no location, no project match)

- [x] ✅ **ActorSelector** (`src/features/calendar/components/__tests__/ActorSelector.test.tsx`) - **25 tests**
  - [x] Loading and empty states
  - [x] Member list rendering
  - [x] Individual member selection/deselection
  - [x] Select All / Deselect All functionality
  - [x] Expand/Collapse UI
  - [x] Selection summary display
  - [x] Admin badge display (owner/admin roles)
  - [x] Availability status (available, busy, partial with time ranges)
  - [x] Edge cases (single member, empty availability)

### Availability Components (Priority: MEDIUM)

**Files:** `src/features/availability/components/editor/`

- [x] ✅ **TimeSlotsEditor** (`src/features/availability/components/editor/__tests__/TimeSlotsEditor.test.tsx`) - **19 tests**
  - [x] Time slots rendering (single and multiple)
  - [x] Add slot button functionality
  - [x] Remove slot button (only when >1 slot)
  - [x] Time picker opening for start/end times
  - [x] Validation error display
  - [x] Time value display with icons
  - [x] Edge cases (empty slots, many slots, time with seconds)

- [x] ✅ **ModeSelector** (`src/features/availability/components/editor/__tests__/ModeSelector.test.tsx`) - **21 tests**
  - [x] Rendering all three mode buttons (free, custom, busy)
  - [x] Active mode styling with colors
  - [x] Mode change callbacks
  - [x] Disabled state handling
  - [x] Icon colors (green/yellow/red for active, gray for inactive)
  - [x] Mode transitions and rapid changes

**Actual Time:** ~8 hours (including mock setup, configuration, and refinement)
**Tests Created:** 96 component tests (14 DateRangePicker + 17 TodayRehearsals + 25 ActorSelector + 19 TimeSlotsEditor + 21 ModeSelector)
**Status:** ✅ 96/96 tests passing - ALL component tests working!

**Note:** Created comprehensive component tests with full coverage of UI interactions, state management, and edge cases. Successfully solved React Native component testing challenges in Node.js environment.

**Key Solutions Implemented:**
- Enhanced TouchableOpacity/Pressable mocks with proper `disabled` prop handling
- Fixed FlatList rendering to actually render items (data.forEach, renderItem, headers/footers)
- Improved icon mocks with React.forwardRef and proper prop forwarding
- Fixed i18n mocking to use Russian translations matching actual component output
- Updated color assertions from names to hex codes (#10b981, #ef4444, etc.)
- Fixed multiple element issues (used getAllByText for "Available", "—", etc.)

**Mock Infrastructure Created:**
- `src/__tests__/__mocks__/react-native.js` - Full RN component mocks with proper behavior
- `src/__tests__/__mocks__/expo-vector-icons.js` - Icon components with forwardRef
- `src/__tests__/__mocks__/expo-font.js` - Font loading
- `src/__tests__/__mocks__/expo-haptics.js` - Haptic feedback
- `src/__tests__/__mocks__/react-navigation-native.js` - Navigation hooks
- `src/__tests__/__mocks__/react-native-calendars.js` - Calendar components with event handling

**Estimated:** 14-16 hours → **Actual:** ~8 hours (all tests passing ✅)

---

## 🖼 Sprint 6: Frontend Components - Forms & Screens (Week 11-12)

**Focus:** Формы и экраны

### Screens (Priority: MEDIUM)

**Files:** `src/features/calendar/screens/`

- [ ] **AddRehearsalScreen** (`src/features/calendar/screens/__tests__/AddRehearsalScreen.test.tsx`)
  - [ ] Форма отображается в create mode
  - [ ] Форма отображается в edit mode
  - [ ] Date picker открывается
  - [ ] Time pickers работают
  - [ ] Project picker работает
  - [ ] Submit button disabled пока loading
  - [ ] Validation errors отображаются

### Profile Screens (Priority: LOW)

**Files:** `src/features/profile/screens/`

- [ ] **CalendarSyncSettingsScreen** (`src/features/profile/screens/__tests__/CalendarSyncSettingsScreen.test.tsx`)
  - [ ] Auto sync toggle работает
  - [ ] Manual sync button запускает синхронизацию
  - [ ] Calendar selection отображается
  - [ ] Permission request работает

**Estimated:** 12-14 hours

---

## 🔗 Sprint 7: API Integration Tests ✅ COMPLETED

**Focus:** Frontend ↔ Backend integration

**Status:** All 38 integration tests passing with axios mocking

### Integration Tests (Priority: HIGH)

**Files:** `src/__tests__/integration/`

- [x] ✅ **Auth Flow** (`src/__tests__/integration/authFlow.test.ts`) - **10 tests**
  - [x] Full registration → login → get profile flow
  - [x] Token storage and retrieval (AsyncStorage)
  - [x] Token refresh handling (via interceptor)
  - [x] Profile access authorization (valid/invalid tokens)
  - [x] Error handling (registration, login, profile)

- [x] ✅ **Rehearsal Flow** (`src/__tests__/integration/rehearsalFlow.test.ts`) - **15 tests**
  - [x] Create project → Create rehearsal → RSVP → Edit → Delete
  - [x] Batch loading rehearsals (getBatch for multiple projects)
  - [x] Conflict detection end-to-end
  - [x] RSVP management (get responses, get my response)
  - [x] Error handling (validation, permissions, 404, 500)

- [x] ✅ **Availability Flow** (`src/__tests__/integration/availabilityFlow.test.ts`) - **13 tests**
  - [x] Set availability → Get availability → Clear availability
  - [x] Bulk set imported calendar events
  - [x] Manage imported vs manual slots
  - [x] All-day vs timed availability
  - [x] Error handling (validation, network, authorization)

**Setup:**
- [x] ✅ Axios mocking for network requests
- [x] ✅ AsyncStorage mocking for token storage
- [x] ✅ Type-safe API method calls matching actual implementation

**Actual Time:** ~3 hours (including API method signature fixes)
**Tests Created:** 38 integration tests (10 auth + 15 rehearsal + 13 availability)
**Status:** ✅ All 38 tests passing

**Note:** Used axios mocking instead of MSW for simplicity and better TypeScript support. All tests verify actual API method signatures and endpoints (using `/native/` prefix for mobile API).

---

## 🎭 Sprint 8: E2E Tests (Week 15-16) - OPTIONAL

**Focus:** End-to-end user scenarios

### Setup Detox (Priority: LOW)

- [ ] Install Detox
  ```bash
  npm install --save-dev detox detox-cli
  ```
- [ ] Configure for iOS simulator
- [ ] Configure test runner

### E2E Scenarios (Priority: LOW)

**Files:** `e2e/`

- [ ] **Onboarding** (`e2e/onboarding.e2e.ts`)
  - [ ] New user registration
  - [ ] First project creation
  - [ ] First rehearsal creation

- [ ] **Calendar Sync** (`e2e/calendarSync.e2e.ts`)
  - [ ] Enable auto sync
  - [ ] Export rehearsal to calendar
  - [ ] Import events to availability
  - [ ] Disable sync, verify cleanup

- [ ] **Rehearsal Management** (`e2e/rehearsalManagement.e2e.ts`)
  - [ ] Create rehearsal with participants
  - [ ] RSVP as different user
  - [ ] Edit rehearsal (change time, participants)
  - [ ] Delete rehearsal

**Estimated:** 16-20 hours (if doing E2E)

---

## 📊 Progress Tracking

### Sprint Completion

- [x] ✅ Sprint 1: Foundation & Critical Path (20 REAL tests)
- [x] ✅ Sprint 2: Backend Core Business Logic (27 REAL integration tests)
- [x] ✅ Sprint 3: Backend Projects & Availability (68 REAL integration tests)
- [x] ✅ Sprint 4: Frontend Hooks (115 hook tests passing - 39 original + 76 new)
- [x] ✅ Sprint 5: Frontend Components - Core (96 component tests passing)
- [ ] Sprint 6: Frontend Components - Forms (skipped - user prefers manual testing)
- [x] ✅ Sprint 7: API Integration Tests (38 integration tests passing)
- [ ] Sprint 8: E2E Tests (Optional)

### Coverage Goals

| Area | Current | Target | Sprint |
|------|---------|--------|--------|
| Backend Auth | 0% | 90% | Sprint 1 |
| Backend Rehearsals | 0% | 85% | Sprint 2 |
| Backend Projects | 0% | 80% | Sprint 3 |
| Backend Availability | 0% | 75% | Sprint 3 |
| Frontend Hooks | 0% | 80% | Sprint 4 |
| Frontend Components | 0% | 70% | Sprint 5-6 |
| Integration | 0% | 60% | Sprint 7 |
| E2E | 0% | 40% | Sprint 8 (opt) |

**Overall Target:** 75-80% code coverage

---

## 🛠 Testing Best Practices

### General Rules

1. **AAA Pattern:** Arrange → Act → Assert
2. **One assertion per test** (when possible)
3. **Descriptive test names:** "should do X when Y"
4. **Mock external dependencies** (API, AsyncStorage, etc.)
5. **Clean up after tests** (reset mocks, clear storage)

### File Naming

```
src/features/calendar/components/TodayRehearsals.tsx
src/features/calendar/components/__tests__/TodayRehearsals.test.tsx
```

### Mock Structure

```typescript
// src/__tests__/mocks/api.ts
export const mockRehearsalsAPI = {
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
```

### Test Utilities

```typescript
// src/__tests__/utils/testUtils.tsx
import { render } from '@testing-library/react-native';
import { I18nProvider } from '../../contexts/I18nContext';
import { AuthProvider } from '../../contexts/AuthContext';

export const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <I18nProvider>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </I18nProvider>
  );
};
```

---

## 📚 Resources

### Documentation

- [React Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Jest](https://jestjs.../rehearsal-calendar-native/docs/getting-started)
- [Supertest](https://github.com/visionmedia/supertest)
- [Detox](https://wix.github.io/Detox/)

### Examples

- [React Native Testing Best Practices](https://github.com/callstack/react-native-testing-library/tree/main/examples)
- [API Testing with Supertest](https://github.com/visionmedia/supertest/tree/master/test)

---

## 🚨 Critical Path (Must-Have)

**If time is limited, prioritize these sprints:**

1. ✅ **Sprint 1** - Authentication (JWT middleware - 20 REAL tests)
2. ✅ **Sprint 2** - Rehearsals CRUD + RSVP (integration tests - 27 REAL tests)
3. ✅ **Sprint 3** - Projects & Availability (integration tests - 68 REAL tests)
4. ✅ **Sprint 4** - Frontend Hooks (115 hook tests: 39 original + 76 new)
5. ✅ **Sprint 5** - Frontend Components (96 component tests)

**Completed: 6/7 sprints (478 total tests: 149 backend + 329 frontend)**

**Breakdown:**
- Backend: 149 tests (20 JWT + 18 timezone + 94 integration + 17 Calendar Sync)
- Frontend Hooks: 170 tests
  - useRehearsals (16)
  - useRSVP (13)
  - useInviteLink (10)
  - useAddRehearsalForm (16)
  - useAddRehearsalSubmit (28)
  - useAvailabilityData (16)
  - useAvailabilitySave (16)
  - **useCalendarSync** ✨ NEW (29)
  - **useTimeRecommendations (Smart Planner)** ✨ NEW (26)
- Frontend Validation: 18 tests
- Frontend Components: 96 tests (DateRangePicker, TodayRehearsals, ActorSelector, TimeSlotsEditor, ModeSelector)
- Frontend Integration: 38 tests (Auth Flow, Rehearsal Flow, Availability Flow)
- Frontend Smoke: 7 additional tests

---

**Last Updated:** 2025-12-28
**Next Review:** Sprint 8 (E2E Tests) - Optional
**Maintainer:** AI + Development Team

## 🎉 Major Milestone: Calendar Sync & Smart Planner Tests Completed!

✅ **478 total tests passing (149 backend + 329 frontend)**

Latest session added 72 comprehensive tests:
- **Calendar Sync Backend** (17 tests): Connection CRUD, event mappings, CASCADE deletion, multi-user isolation
- **Calendar Sync Frontend** (29 tests): Export/import rehearsals, sync settings, error handling, permissions
- **Smart Planner** (26 tests): Time recommendations algorithm, availability merging, workday clamping (09:00-23:00)

### Key Infrastructure Improvements:
- ✅ Added calendar sync tables to integration test setup (native_calendar_connections, native_calendar_event_mappings)
- ✅ Fixed Jest ES module support in root package.json (NODE_OPTIONS=--experimental-vm-modules)
- ✅ Fixed WORKDAY_END constant alignment (23:00 instead of 18:00)
- ✅ All TypeScript interfaces properly aligned (ProjectMember, TimeRange)

All tests use actual API method signatures with proper TypeScript typing and match production endpoints.

### What's Left to Test?
**Nothing critical!** Current coverage (478 tests) is excellent for production. Optional additions if desired:
- ⚠️ useSmartPlanner hook (currently partial coverage via useTimeRecommendations)
- ⚠️ Smart Planner utilities in isolation (availabilityMerger, slotGenerator) - already tested indirectly
- ❌ E2E tests with Detox (optional, not required for release)
- ❌ UI screens (better suited for manual testing or E2E)

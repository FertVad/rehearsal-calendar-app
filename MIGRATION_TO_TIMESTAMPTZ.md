# Migration to TIMESTAMPTZ

**Branch:** `feature/migrate-to-timestamptz`
**Date:** December 10, 2025
**Goal:** Migrate from DATE + TIME columns to TIMESTAMPTZ for rehearsals and availability

## Motivation

- Simplify timezone handling logic
- Prepare for Google Calendar and Apple Calendar integration
- Fix cross-midnight slot issues automatically
- Follow industry standard (Rails, Django, Laravel, etc.)
- Reduce codebase complexity

## Architecture Decision

**Server:** Always stores and works with TIMESTAMPTZ (ISO 8601 format)
**Client API formats:**
- **Rehearsals:** Client sends ISO timestamps (`startsAt`, `endsAt`) - single event per call
- **Availability:** Client sends `date + slots[]` - multiple time slots per date (more natural format)
- Both approaches work! Server handles conversion internally.

**Display layer:** UI continues to use separate date/time pickers for better UX

## Migration Plan

### Phase 1: Database Schema Migration

#### 1.1 Rehearsals Table
- [x] Create migration script `server/migrations/migrate-rehearsals-to-timestamptz.sql`
- [x] Add new columns: `starts_at TIMESTAMPTZ`, `ends_at TIMESTAMPTZ`
- [x] Migrate existing data from (date, start_time, end_time) to (starts_at, ends_at)
- [x] Add indexes on new columns
- [x] Verify data integrity after migration

#### 1.2 Availability Table
- [x] Create migration script `server/migrations/migrate-availability-to-timestamptz.sql`
- [x] Add new columns: `starts_at TIMESTAMPTZ`, `ends_at TIMESTAMPTZ`
- [x] Migrate existing data from (date, start_time, end_time) to (starts_at, ends_at)
- [x] Handle `is_all_day` events (store as 00:00:00 in user timezone)
- [x] Add indexes on new columns
- [x] Verify data integrity after migration

#### 1.3 Database Backup
- [ ] Create backup script for production data
- [ ] Document rollback procedure

### Phase 2: Server-Side Refactoring

#### 2.1 Update Timezone Utilities (`server/utils/timezone.js`)
- [x] Add new functions: `timestampToLocal()`, `localToTimestamp()`
- [x] Keep old functions for backward compatibility during migration
- [x] Add JSDoc annotations for new functions

#### 2.2 Update Rehearsals API (`server/routes/native/rehearsals.js`)
- [x] Update GET endpoints to use `starts_at`, `ends_at`
- [x] Update POST/PUT endpoints to accept ISO timestamps
- [x] Update timezone conversion logic
- [x] Update queries to use new columns
- [x] Remove `date::text` workaround (no longer needed)

#### 2.3 Update Availability API (`server/routes/native/availability.js`)
- [x] Update GET endpoints to use `starts_at`, `ends_at`
- [x] Update POST/PUT endpoints to accept ISO timestamps
- [x] Update timezone conversion logic
- [x] Handle all-day events properly (flag + 00:00:00 time)
- [x] Update queries to use new columns

#### 2.4 Update Middleware (`server/middleware/timezoneMiddleware.js`)
- [x] Update `convertRehearsalRequest()` for TIMESTAMPTZ
- [x] Update `convertRehearsalResponse()` for TIMESTAMPTZ
- [x] Simplify logic (no more separate date/time handling)

#### 2.5 Update Database Helpers (`server/database/db.js`)
- [x] Verify PostgreSQL timestamp handling
- [x] Update any date/time utility functions

### Phase 3: Client-Side Refactoring

#### 3.1 Update API Types (`src/shared/types/`)
- [x] Update Rehearsal interface to use `startsAt: string`, `endsAt: string`
- [x] Update Availability interface similarly
- [x] Add ISO timestamp type aliases

#### 3.2 Update API Client (`src/shared/services/api.ts`)
- [x] Add transformation helper functions (`isoToDateString`, `isoToTimeString`, `dateTimeToISO`)
- [x] Update `useRehearsals` hook to transform API responses
- [x] Add backward compatibility layer for legacy date/time fields
- [x] Update `rehearsalAPI` - AddRehearsalScreen now sends ISO timestamps (`startsAt`, `endsAt`)
- [x] `availabilityAPI` - **Decision: Keep date + slots format**
  - Reason: Availability works with multiple time slots per date, so `date + slots[]` is more natural
  - Server already handles both formats and converts to ISO internally
  - No client changes needed - avoids unnecessary complexity

#### 3.3 Update Rehearsal Screens
- [x] `src/features/calendar/screens/AddRehearsalScreen.tsx`
  - [x] Combine date + time pickers into ISO timestamp before API call using `dateTimeToISO()`
  - [x] Keep UI as-is (separate date/time pickers for UX)
  - [x] Send `startsAt` and `endsAt` instead of `date`, `startTime`, `endTime`
- [x] Edit functionality - does not exist (API endpoint present but no UI screen)
- [x] Display components (`MyRehearsalsModal.tsx`, `DayDetailsModal.tsx`)
  - [x] No changes needed - work with transformation layer from `useRehearsals` hook
  - [x] Continue using legacy fields (`date`, `time`, `endTime`)

#### 3.4 Update Availability Screens
- [x] `src/features/availability/screens/AvailabilityScreen.tsx`
  - [x] No changes needed - sends `date` + `slots` array, server handles conversion
  - [x] UI remains unchanged (time pickers for UX)
- [x] `src/features/availability/hooks/useAvailabilityData.ts`
  - [x] Already handles transformation from ISO timestamps to local format
  - [x] Extracts date from ISO timestamp (line 29)
  - [x] Parses time strings from returned data (lines 34-69)

#### 3.5 Update Shared Utilities
- [x] `src/shared/utils/time.ts`
  - [x] Added `isoToDateString()` - converts ISO to YYYY-MM-DD
  - [x] Added `isoToTimeString()` - converts ISO to HH:mm
  - [x] Added `dateTimeToISO()` - converts date + time to ISO
  - [x] Uses native Date API for conversions

### Phase 4: Testing

#### 4.1 Unit Tests
- [ ] Test timezone conversion utilities
- [ ] Test timestamp parsing/formatting
- [ ] Test cross-midnight scenarios
- [ ] Test all-day events
- [ ] Test different timezones (UTC, Asia/Jerusalem, America/New_York)

#### 4.2 Integration Tests
- [ ] Test rehearsal creation/editing
- [ ] Test availability creation/editing
- [ ] Test RSVP functionality
- [ ] Test calendar sync preparation

#### 4.3 Manual Testing
- [ ] Create rehearsal in different timezones
- [ ] Create availability slots crossing midnight
- [ ] Create all-day availability
- [ ] Verify dates display correctly
- [ ] Test on iOS simulator
- [ ] Test with production database copy

### Phase 5: Cleanup Old Logic

#### 5.1 Remove Old Database Columns
- [x] Create migration to drop `date`, `start_time`, `end_time` from `native_rehearsals`
  - Created: `server/migrations/drop-old-rehearsal-columns.sql`
  - Includes safety checks, verification, and rollback instructions
- [x] Create migration to drop `date`, `start_time`, `end_time` from `native_user_availability`
  - Created: `server/migrations/drop-old-availability-columns.sql`
  - Includes safety checks, verification, and rollback instructions
- [x] Verify no code references these columns
  - Verified: No active code references old columns
  - Only `updated_at` and `created_at` found (different columns)

#### 5.2 Remove Old Utility Functions
- [x] Remove `convertSlotsToUTC()` from `server/utils/timezone.js`
- [x] Remove `convertSlotsFromUTC()` from `server/utils/timezone.js`
- [x] Remove `localToUTC()` from exports
- [x] Remove `utcToLocal()` from exports
- [x] Remove unused imports from `server/routes/native/availability.js`
- [x] Migrate `server/routes/native/members.js` to TIMESTAMPTZ functions

#### 5.3 Remove Old Middleware Logic
- [x] Clean up `server/middleware/timezoneMiddleware.js`
  - Removed unused `convertRehearsalRequest()` function
  - Removed import from rehearsals.js route
  - Kept `convertRehearsalResponse()` and other active functions
- [x] Verify client uses new API format
  - Client sends `startsAt` and `endsAt` (ISO timestamps)
  - Server maintains backward compatibility for old format (safe to keep)

#### 5.4 Delete Temporary Files
- [x] Delete `check-availability.js`
- [x] Delete `check-bad-slots.js`
- [x] Delete `delete-invalid-slots.sql`
- [x] Delete any other debug/test scripts

#### 5.5 Update Documentation
- [x] Update `PROJECT_INFO.md` to reflect new architecture
- [x] Remove old DATE + TIME documentation
- [x] Add TIMESTAMPTZ architecture section
- [x] Document new API formats
- [x] Update timezone handling explanation

### Phase 6: Deployment

#### 6.1 Pre-deployment
- [ ] Review all changes
- [ ] Run full test suite
- [ ] Create database backup
- [ ] Document rollback procedure

#### 6.2 Deployment
- [ ] Run database migrations on production
- [ ] Deploy server code
- [ ] Deploy client app
- [ ] Monitor logs for errors

#### 6.3 Post-deployment
- [ ] Verify all features work correctly
- [ ] Monitor error rates
- [ ] Check database performance
- [ ] Verify timezone conversions are correct

#### 6.4 Rollback Plan (if needed)
- [ ] Document how to restore database from backup
- [ ] Document how to revert server code
- [ ] Document how to revert client app

## Key Decisions

### All-Day Events
Store as TIMESTAMPTZ at `00:00:00` in user's timezone + `is_all_day` flag.

Example:
```sql
-- All-day event on 2025-12-10 for user in Asia/Jerusalem
starts_at: '2025-12-10 00:00:00+02'
ends_at:   '2025-12-10 23:59:59+02'
is_all_day: true
```

### API Format
Use ISO 8601 strings with timezone offset:
```json
{
  "startsAt": "2025-12-10T19:00:00+02:00",
  "endsAt": "2025-12-10T21:00:00+02:00"
}
```

### Client Storage
Store as ISO strings, parse to Date objects when needed. Use `date-fns` for formatting.

### Timezone Handling
- Server stores in UTC (PostgreSQL TIMESTAMPTZ)
- API sends/receives with timezone offset (ISO 8601)
- Client displays in user's timezone

## Breaking Changes

### API Changes
- `date`, `start_time`, `end_time` → `startsAt`, `endsAt`
- All timestamps now include timezone information
- All-day events must set `isAllDay` flag

### Database Changes
- New columns: `starts_at`, `ends_at` (TIMESTAMPTZ)
- Old columns will be removed after migration

## Rollback Strategy

If issues arise:
1. Revert to `dev` branch
2. Restore database from backup
3. Redeploy previous version
4. Old columns are kept during migration for safety

## Estimated Timeline

- Phase 1 (Database): 2-3 hours
- Phase 2 (Server): 4-5 hours
- Phase 3 (Client): 5-6 hours
- Phase 4 (Testing): 3-4 hours
- Phase 5 (Cleanup): 2-3 hours
- Phase 6 (Deployment): 1-2 hours

**Total: ~20-25 hours**

## Success Criteria

- [ ] All rehearsals display with correct dates/times
- [ ] All availability slots display correctly
- [ ] Cross-midnight slots work properly
- [ ] All-day events work correctly
- [ ] No timezone-related bugs
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Old code removed
- [ ] Production deployment successful

---

**Last updated:** December 11, 2025
**Status:** Phase 5 (Cleanup) - COMPLETED ✓

## Migration Notes

### December 11, 2025 - Phase 5 Cleanup
- Completed Phase 5.1: Created database migrations to drop old columns
  - [drop-old-rehearsal-columns.sql](server/migrations/drop-old-rehearsal-columns.sql)
  - [drop-old-availability-columns.sql](server/migrations/drop-old-availability-columns.sql)
- Completed Phase 5.2: Removed old utility functions from exports
  - Removed: `localToUTC`, `utcToLocal`, `convertSlotsToUTC`, `convertSlotsFromUTC`
  - Migrated last endpoint ([members.js](server/routes/native/members.js)) to TIMESTAMPTZ
- Completed Phase 5.3: Cleaned up middleware
  - Removed unused `convertRehearsalRequest()` from [timezoneMiddleware.js](server/middleware/timezoneMiddleware.js)
  - Removed import from rehearsals.js route
  - Verified client uses new ISO timestamp format
- Completed Phase 5.4: Deleted temporary test/debug files
- Completed Phase 5.5: Updated PROJECT_INFO.md documentation
  - Updated `native_rehearsals` schema to show TIMESTAMPTZ columns
  - Updated `native_user_availability` schema to show TIMESTAMPTZ columns
  - Added comprehensive timezone handling documentation for both tables
  - Removed all references to old DATE + TIME architecture

**Phase 5 (Cleanup) - COMPLETED!**

**Next Steps:** Phase 4 (Testing) - Add unit and integration tests

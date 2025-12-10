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

## Migration Plan

### Phase 1: Database Schema Migration

#### 1.1 Rehearsals Table
- [ ] Create migration script `server/migrations/migrate-rehearsals-to-timestamptz.sql`
- [ ] Add new columns: `starts_at TIMESTAMPTZ`, `ends_at TIMESTAMPTZ`
- [ ] Migrate existing data from (date, start_time, end_time) to (starts_at, ends_at)
- [ ] Add indexes on new columns
- [ ] Verify data integrity after migration

#### 1.2 Availability Table
- [ ] Create migration script `server/migrations/migrate-availability-to-timestamptz.sql`
- [ ] Add new columns: `starts_at TIMESTAMPTZ`, `ends_at TIMESTAMPTZ`
- [ ] Migrate existing data from (date, start_time, end_time) to (starts_at, ends_at)
- [ ] Handle `is_all_day` events (store as 00:00:00 in user timezone)
- [ ] Add indexes on new columns
- [ ] Verify data integrity after migration

#### 1.3 Database Backup
- [ ] Create backup script for production data
- [ ] Document rollback procedure

### Phase 2: Server-Side Refactoring

#### 2.1 Update Timezone Utilities (`server/utils/timezone.js`)
- [ ] Add new functions: `timestampToLocal()`, `localToTimestamp()`
- [ ] Keep old functions for backward compatibility during migration
- [ ] Add JSDoc annotations for new functions

#### 2.2 Update Rehearsals API (`server/routes/native/rehearsals.js`)
- [ ] Update GET endpoints to use `starts_at`, `ends_at`
- [ ] Update POST/PUT endpoints to accept ISO timestamps
- [ ] Update timezone conversion logic
- [ ] Update queries to use new columns
- [ ] Remove `date::text` workaround (no longer needed)

#### 2.3 Update Availability API (`server/routes/native/availability.js`)
- [ ] Update GET endpoints to use `starts_at`, `ends_at`
- [ ] Update POST/PUT endpoints to accept ISO timestamps
- [ ] Update timezone conversion logic
- [ ] Handle all-day events properly (flag + 00:00:00 time)
- [ ] Update queries to use new columns

#### 2.4 Update Middleware (`server/middleware/timezoneMiddleware.js`)
- [ ] Update `convertRehearsalRequest()` for TIMESTAMPTZ
- [ ] Update `convertRehearsalResponse()` for TIMESTAMPTZ
- [ ] Simplify logic (no more separate date/time handling)

#### 2.5 Update Database Helpers (`server/database/db.js`)
- [ ] Verify PostgreSQL timestamp handling
- [ ] Update any date/time utility functions

### Phase 3: Client-Side Refactoring

#### 3.1 Update API Types (`src/shared/types/`)
- [ ] Update Rehearsal interface to use `startsAt: string`, `endsAt: string`
- [ ] Update Availability interface similarly
- [ ] Add ISO timestamp type aliases

#### 3.2 Update API Client (`src/shared/services/api.ts`)
- [ ] Update `rehearsalAPI` methods to send ISO timestamps
- [ ] Update `availabilityAPI` methods to send ISO timestamps
- [ ] Update request/response transformations

#### 3.3 Update Rehearsal Screens
- [ ] `src/features/rehearsals/screens/CreateRehearsalScreen.tsx`
  - [ ] Combine date + time pickers into ISO timestamp before API call
  - [ ] Keep UI as-is (separate date/time pickers for UX)
- [ ] `src/features/rehearsals/screens/EditRehearsalScreen.tsx`
  - [ ] Parse ISO timestamp into date + time for display
  - [ ] Combine back to ISO before API call
- [ ] `src/features/rehearsals/components/RehearsalCard.tsx`
  - [ ] Update to parse `startsAt`/`endsAt` timestamps
  - [ ] Display in user's timezone

#### 3.4 Update Availability Screens
- [ ] `src/features/availability/screens/AvailabilityScreen.tsx`
  - [ ] Update slot time handling to use ISO timestamps
  - [ ] Keep UI as-is (time pickers for UX)
- [ ] `src/features/availability/hooks/useAvailabilityData.ts`
  - [ ] Update data transformation logic
  - [ ] Parse timestamps from API
  - [ ] Convert to timestamps before save

#### 3.5 Update Shared Utilities
- [ ] `src/shared/utils/timezone.ts` (if exists)
  - [ ] Add helper functions for ISO timestamp handling
  - [ ] Add `parseISO()`, `formatISO()` helpers
  - [ ] Use `date-fns` or native Date API

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
- [ ] Create migration to drop `date`, `start_time`, `end_time` from `native_rehearsals`
- [ ] Create migration to drop `date`, `start_time`, `end_time` from `native_user_availability`
- [ ] Verify no code references these columns

#### 5.2 Remove Old Utility Functions
- [ ] Remove `convertSlotsToUTC()` from `server/utils/timezone.js`
- [ ] Remove `convertSlotsFromUTC()` from `server/utils/timezone.js`
- [ ] Remove `localToUTC()` (if replaced)
- [ ] Remove `utcToLocal()` (if replaced)

#### 5.3 Remove Old Middleware Logic
- [ ] Clean up `server/middleware/timezoneMiddleware.js`
- [ ] Remove deprecated conversion functions

#### 5.4 Delete Temporary Files
- [ ] Delete `check-availability.js`
- [ ] Delete `check-bad-slots.js`
- [ ] Delete `delete-invalid-slots.sql`
- [ ] Delete any other debug/test scripts

#### 5.5 Update Documentation
- [ ] Update `PROJECT_INFO.md` to reflect new architecture
- [ ] Remove old DATE + TIME documentation
- [ ] Add TIMESTAMPTZ architecture section
- [ ] Document new API formats
- [ ] Update timezone handling explanation

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

**Last updated:** December 10, 2025
**Status:** Planning

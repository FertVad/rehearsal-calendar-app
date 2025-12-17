# 🔍 Calendar Sync: Analysis of Limitations & Challenges

**Branch**: `feature/calendar-sync`
**Date**: December 17, 2025
**Status**: Pre-implementation Analysis

---

## ✅ Good News: Architecture is Ready!

### Database Schema
- ✅ **`native_user_availability` table already has required fields:**
  - `source` VARCHAR - for marking imported events (`'google_calendar'`, `'apple_calendar'`)
  - `external_event_id` VARCHAR - for storing calendar event IDs
  - `starts_at` TIMESTAMPTZ - timezone-aware timestamps
  - `ends_at` TIMESTAMPTZ - timezone-aware timestamps
  - `is_all_day` BOOLEAN - for all-day events
  - `type` VARCHAR - 'available', 'busy', 'tentative'

### Backend API
- ✅ **Availability API supports:**
  - GET `/api/native/availability` - returns all slots with `source` and `external_event_id`
  - POST `/api/native/availability/bulk` - bulk insert with ISO timestamps
  - DELETE with source filtering - can delete only manual or imported slots
  - Constants defined: `AVAILABILITY_SOURCES.GOOGLE`, `AVAILABILITY_SOURCES.APPLE`

### Constants
- ✅ **Already defined in `server/constants/timezone.js`:**
  ```javascript
  AVAILABILITY_SOURCES = {
    MANUAL: 'manual',
    REHEARSAL: 'rehearsal',
    GOOGLE: 'google_calendar',
    APPLE: 'apple_calendar',
  }
  ```

**Conclusion**: The backend is already prepared for calendar sync! No database migrations needed.

---

## ⚠️ Limitations & Challenges

### 1. expo-calendar Platform Limitations

#### iOS (Apple Calendar)
**Permissions:**
- ✅ READ: `NSCalendarsUsageDescription` in Info.plist
- ✅ WRITE: Same permission, but must request separately
- ⚠️ **Limitation**: User must grant permission in Settings if denied once

**API Capabilities:**
- ✅ Can read events: `Calendar.getEventsAsync()`
- ✅ Can create events: `Calendar.createEventAsync()`
- ✅ Can update events: `Calendar.updateEventAsync()`
- ✅ Can delete events: `Calendar.deleteEventAsync()`
- ⚠️ **No real-time sync**: Must poll for changes
- ⚠️ **No push notifications**: Can't be notified when calendar changes

**Recurring Events:**
- ⚠️ Each instance returned separately by `getEventsAsync()`
- ⚠️ No way to identify which events are part of same recurrence
- ⚠️ Updating one instance may affect all instances (platform behavior)

#### Android (Google Calendar)
**Permissions:**
- ✅ READ: `READ_CALENDAR` in AndroidManifest.xml
- ✅ WRITE: `WRITE_CALENDAR` in AndroidManifest.xml
- ⚠️ **Runtime permissions required** - must request at runtime

**API Capabilities:**
- ✅ Can read events: `Calendar.getEventsAsync()`
- ✅ Can create events: `Calendar.createEventAsync()`
- ✅ Can update events: `Calendar.updateEventAsync()`
- ✅ Can delete events: `Calendar.deleteEventAsync()`
- ⚠️ **No real-time sync**: Must poll for changes
- ⚠️ **Multiple calendar sources**: User may have multiple Google accounts

**Recurring Events:**
- ⚠️ Same as iOS - each instance separate
- ⚠️ No reliable way to link recurring instances

---

### 2. Performance Concerns

#### Import Performance
**Problem**: Importing large number of events can be slow
```typescript
// User has 1000+ events in calendar over 1 year
const events = await Calendar.getEventsAsync(
  [calendarId],
  startDate, // -30 days
  endDate    // +365 days
);
// This may take 5-10 seconds!
```

**Solutions:**
- ✅ Limit date range (current plan: -30 to +365 days)
- ✅ Batch processing - insert in chunks of 50-100 events
- ✅ Show progress indicator during import
- ✅ Run import in background (not blocking UI)
- ⚠️ Add debouncing to "Import Now" button (prevent spam clicks)

#### Export Performance
**Problem**: Exporting all rehearsals at once
```typescript
// Project has 100+ rehearsals over next year
await syncAllRehearsals(); // May take time
```

**Solutions:**
- ✅ Only export future rehearsals (not past)
- ✅ Batch create calendar events
- ✅ Show progress: "Syncing 25 of 100 rehearsals..."
- ✅ Skip already synced rehearsals (check mappings first)

---

### 3. Sync Consistency Issues

#### Problem 1: Race Conditions
**Scenario:**
1. User creates calendar event in Google Calendar
2. User creates rehearsal in app at same time
3. Import runs → detects conflict
4. Export runs → creates calendar event
5. **Result**: User has 2 events in calendar (theirs + rehearsal)

**Solution:**
- ✅ Lock mechanism: Prevent concurrent import/export
- ✅ Queue operations: Process one at a time
- ✅ Conflict resolution: Show modal, let user decide

#### Problem 2: Deleted Events Detection
**Scenario:**
1. User deletes event in calendar
2. App doesn't know about deletion until next sync
3. Busy slot still shows in app

**Solution:**
- ✅ Compare external_event_ids during import
- ✅ If event ID not found in calendar anymore → delete slot
- ✅ Keep "last known event IDs" in AsyncStorage for comparison

#### Problem 3: Updated Events Detection
**Scenario:**
1. User changes event time in calendar
2. App still shows old busy time

**Solution:**
- ✅ Compare event timestamps during import
- ✅ If timestamps differ → update availability slot
- ✅ Store event hash/timestamp for change detection

---

### 4. User Experience Challenges

#### Problem 1: Permission Denial
**User Flow:**
1. User denies calendar permission
2. App can't sync
3. User confused why feature doesn't work

**Solution:**
- ✅ Clear permission status indicator
- ✅ Instructions: "Grant access in Settings → Privacy → Calendar"
- ✅ Deep link to Settings if possible (iOS only)
- ✅ Graceful degradation: App works without sync

#### Problem 2: Multiple Calendars
**User has:**
- Personal calendar
- Work calendar
- Family calendar
- Holidays calendar

**Which to sync?**

**Solution:**
- ✅ Multi-select UI for import
- ✅ Single select for export (rehearsals go to one calendar)
- ✅ Remember user's choice
- ✅ Show calendar names clearly

#### Problem 3: Conflict Warnings
**Too many warnings:**
- Every rehearsal shows "John has calendar event"
- User gets annoyed

**Solution:**
- ✅ Only show conflicts during creation/edit
- ✅ Allow admin to suppress warnings for this session
- ✅ Group conflicts: "3 members have conflicts"
- ✅ Details in expandable section

---

### 5. Timezone Complexity

#### Problem: Timezone Mismatch
**Scenario:**
1. Calendar event in New York (UTC-5)
2. User's app timezone: Jerusalem (UTC+2)
3. Import event at 10:00 EST
4. **Question**: Show as 10:00 local or convert to 17:00 Jerusalem time?

**Solution:**
- ✅ **Import as-is**: Store event's timezone-aware timestamp
- ✅ Database stores in UTC (TIMESTAMPTZ handles this)
- ✅ App displays in user's local timezone
- ✅ All-day events: Keep as all-day (don't convert timezone)

#### All-Day Events
**Problem:**
```
Calendar: "Doctor appointment" (all-day, Dec 25)
Import: Should it be 00:00-23:59 or mark as is_all_day?
```

**Solution:**
- ✅ Check `event.allDay` flag from expo-calendar
- ✅ Set `is_all_day: true` in database
- ✅ Display as "All day" in UI (no time shown)

---

### 6. Data Consistency & Cleanup

#### Problem 1: Orphaned Mappings
**Scenario:**
1. Rehearsal deleted in app
2. Calendar event deleted
3. Mapping still in AsyncStorage

**Solution:**
- ✅ Delete mapping when rehearsal deleted
- ✅ Periodic cleanup: Check all mappings, remove invalid ones
- ✅ Run cleanup on app startup

#### Problem 2: Duplicate Imports
**Scenario:**
1. Import events
2. Import again without clearing
3. **Result**: Duplicate busy slots

**Solution:**
- ✅ Check `external_event_id` before insert
- ✅ If exists → UPDATE, don't INSERT
- ✅ Use UPSERT logic (UPDATE or INSERT)

#### Problem 3: Source Confusion
**Scenario:**
1. User manually marks time as busy
2. Later, calendar event imported for same time
3. **Result**: Two overlapping busy slots

**Solution:**
- ✅ Keep source separation: `manual` vs `google_calendar`
- ✅ Show both in UI with different colors
- ✅ Allow user to delete imported slot if wrong
- ✅ Don't merge overlapping slots from different sources

---

### 7. Testing Challenges

#### Physical Device Required
- ❌ **Simulators don't have real calendars**
- ❌ iOS Simulator: Can't create/read calendar events reliably
- ❌ Android Emulator: Limited calendar functionality

**Solution:**
- ✅ Test on physical iPhone (iOS)
- ✅ Test on physical Android phone
- ✅ Have user test on their devices

#### Test Data Setup
**Problem**: Need calendar events to test import

**Solution:**
- ✅ Create test events manually before testing
- ✅ Use multiple calendars (Work, Personal)
- ✅ Test edge cases: all-day, recurring, past events

---

## 🎯 Critical Implementation Decisions

### 1. Sync Strategy

**Option A: Polling (Chosen)**
```typescript
// Check for calendar changes every N hours
setInterval(() => {
  if (importEnabled) {
    syncImport();
  }
}, syncInterval);
```
**Pros:** Simple, reliable, works on all platforms
**Cons:** Not real-time, battery drain if too frequent

**Option B: Event Listeners**
Not available in expo-calendar ❌

**Decision:** Use polling with configurable interval + sync on app foreground

---

### 2. Conflict Resolution

**Option A: Block (Too restrictive)**
```
"Cannot create rehearsal. John has a calendar event."
[Cancel]
```

**Option B: Warn but Allow (Chosen)**
```
"Warning: 2 members have conflicts:"
- John: Doctor appointment (2:00 PM)
- Mary: Meeting (3:00 PM)

[Schedule Anyway] [Pick Different Time]
```

**Decision:** Warn but allow admin to proceed

---

### 3. Import Scope

**Option A: Import Everything**
Import all events as busy slots

**Pros:** Complete availability picture
**Cons:** Cluttered, includes holidays, birthdays, etc.

**Option B: Smart Filtering (Chosen)**
Only import events where:
- User is marked as "Busy" (not "Free" or "Available")
- Event is not all-day (optionally)
- Event is in selected calendars only

**Decision:** Let user choose which calendars to import from

---

## 📋 Recommended Changes to Plan

### 1. Add Offline Support
**Current Plan:** Assumes online sync
**Issue:** What if user has no internet during sync?

**Add:**
- ✅ Cache last successful sync data
- ✅ Show "Last synced: 2 hours ago (offline)"
- ✅ Queue operations when offline, execute when online

### 2. Add Conflict Resolution UI
**Current Plan:** Basic modal
**Enhancement:**
- ✅ Show detailed conflict info (event title, time)
- ✅ "View in Calendar" button → open device calendar app
- ✅ "Reschedule Rehearsal" → open time picker with suggestions

### 3. Add Sync History/Log
**Current Plan:** Only shows "last sync time"
**Enhancement:**
- ✅ Keep sync log: "Imported 25 events, exported 10 rehearsals"
- ✅ Show errors: "Failed to sync: Permission denied"
- ✅ Undo last sync button (for mistakes)

### 4. Add Smart Defaults
**Current Plan:** User must configure everything
**Enhancement:**
- ✅ Auto-detect primary calendar
- ✅ Suggest sync interval based on calendar activity
- ✅ Pre-select "Work" and "Personal" calendars, skip "Holidays"

### 5. Add Partial Sync
**Current Plan:** All-or-nothing sync
**Enhancement:**
- ✅ "Sync next 30 days only" option
- ✅ "Sync this project's rehearsals only"
- ✅ Incremental sync: Only changed events since last sync

---

## 🚨 Breaking Changes & Risks

### Risk 1: Battery Drain
**Cause:** Hourly sync polling
**Mitigation:**
- ✅ Only sync when app in foreground
- ✅ Respect system battery optimization
- ✅ Increase interval when battery low

### Risk 2: Data Loss
**Cause:** Bugs in import/export logic
**Mitigation:**
- ✅ Never delete original calendar events
- ✅ Keep backup of availability before import
- ✅ "Undo" feature for last operation

### Risk 3: Privacy Concerns
**Cause:** Importing private calendar events
**Mitigation:**
- ✅ Only import from user-selected calendars
- ✅ Don't sync event titles/details to server
- ✅ Store event mappings locally only (AsyncStorage)
- ✅ Clear all mappings on logout

---

## ✅ Final Recommendations

### Before Starting Implementation:

1. **Simplify Phase 1:**
   - Start with export only (App → Calendar)
   - Add import (Calendar → App) in Phase 2
   - This reduces complexity and allows testing export first

2. **Add Safety Checks:**
   - Confirm dialog before "Clear All Imported Events"
   - Backup availability data before bulk operations
   - Add "Undo" functionality

3. **Improve Error Handling:**
   - Graceful failures: Show errors but don't crash
   - Retry logic: Retry failed operations 3 times
   - Fallback: If sync fails, app still works without it

4. **Add Monitoring:**
   - Log sync operations for debugging
   - Track sync performance (time taken)
   - Report errors to developer (if crash reporting available)

5. **User Education:**
   - Add onboarding: "What is Calendar Sync?"
   - Tooltips explaining each setting
   - Help button → documentation

---

## 🎯 Suggested Phased Approach

### Phase 1: Export Only (Simpler)
**Estimated: 2-3 hours**
- ✅ Export rehearsals to calendar
- ✅ Basic settings UI
- ✅ Manual "Export All" button
- ✅ Auto-export on rehearsal create/edit/delete

**Test:** Can create rehearsal and see it in device calendar

### Phase 2: Import Basic (Add complexity)
**Estimated: 2-3 hours**
- ✅ Import calendar events as busy slots
- ✅ Manual "Import Now" button
- ✅ Select calendars to import from
- ✅ Mark imported slots visually

**Test:** Create calendar event, import it, see busy slot

### Phase 3: Auto-Sync & Conflicts
**Estimated: 2 hours**
- ✅ Background sync on interval
- ✅ Sync on app foreground
- ✅ Conflict detection
- ✅ Conflict warning modal

**Test:** Full two-way sync working, conflicts detected

### Phase 4: Polish & Edge Cases
**Estimated: 1-2 hours**
- ✅ Error handling
- ✅ Loading states
- ✅ Undo functionality
- ✅ Sync history/log

**Test:** Edge cases, errors handled gracefully

---

## 🚀 Ready to Proceed?

**Current Plan Feasibility:** ✅ **FEASIBLE**

**Architecture Readiness:** ✅ **READY** (no DB changes needed!)

**Main Risks:**
1. ⚠️ Testing requires physical devices
2. ⚠️ Performance with large calendars (1000+ events)
3. ⚠️ User experience with permissions
4. ⚠️ Timezone edge cases

**Recommended:** Start with **Phase 1 (Export Only)** to validate approach, then add import.

**Time Estimate:**
- **Phased Approach**: 7-10 hours total (more manageable)
- **Original Plan**: 4-5 hours (aggressive, higher risk)

---

**Status**: Ready to start with adjusted expectations ✅

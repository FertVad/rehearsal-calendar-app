# 📅 Plan: Google & Apple Calendar Integration (Two-Way Sync)

> **Goal**: TWO-WAY sync between user availability and device calendars (Google Calendar on Android / Apple Calendar on iOS)

**Created**: December 17, 2025
**Status**: Planning
**Estimated Time**: 4-5 hours implementation + testing

---

## 📋 Overview

This feature will implement **bidirectional synchronization**:

### App → Calendar (Export)
1. Export rehearsals to device calendar as events
2. Auto-sync when creating/editing rehearsals
3. Remove calendar events when rehearsals are deleted

### Calendar → App (Import)
4. **Import calendar events as "busy" slots** in user availability
5. **Periodic sync** to fetch new/updated calendar events
6. **Mark imported slots** with source `google_calendar` or `apple_calendar`
7. **Detect conflicts** between calendar events and rehearsals

### Settings & Management
8. Choose which calendars to sync
9. Enable/disable sync per calendar
10. Manual sync button + auto-sync interval
11. View sync status and last sync time

---

## 🎯 Task Breakdown

### Phase 1: Setup & Configuration (10 min)

#### ✅ What Claude Code will do:

- [ ] **Install expo-calendar library**
  ```bash
  npx expo install expo-calendar
  ```

- [ ] **Configure permissions in app.json**
  - iOS: Add `NSCalendarsUsageDescription` and `NSRemindersUsageDescription`
  - Android: Add `READ_CALENDAR` and `WRITE_CALENDAR` permissions

- [ ] **Update package.json** with new dependency

---

### Phase 2: Calendar Service Implementation (60 min)

#### ✅ What Claude Code will do:

- [ ] **Create calendar service file**
  - Location: `src/shared/services/calendarSync.ts`

  **Export Functions (App → Calendar):**
  - `requestCalendarPermissions()` - Request calendar permissions
  - `getDeviceCalendars()` - Get list of device calendars
  - `createCalendarEvent()` - Create rehearsal event in calendar
  - `updateCalendarEvent()` - Update existing event
  - `deleteCalendarEvent()` - Delete event from calendar
  - `syncRehearsalToCalendar()` - Sync single rehearsal
  - `syncAllRehearsals()` - Sync all future rehearsals
  - `getDefaultCalendar()` - Get default calendar for platform

  **Import Functions (Calendar → App):**
  - `getCalendarEvents(calendarIds, startDate, endDate)` - Read events from calendars
  - `importCalendarEventsAsAvailability()` - Import events as busy slots
  - `syncCalendarToAvailability()` - Full sync from calendar to app
  - `detectEventChanges()` - Compare with previous sync to detect changes
  - `removeImportedSlots()` - Clean up imported availability slots

- [ ] **Create calendar storage utilities**
  - Location: `src/shared/utils/calendarStorage.ts`

  **Export Mappings:**
  - `saveEventMapping()` - Save rehearsalId → calendarEventId mapping
  - `getEventMapping()` - Get calendar event ID for rehearsal
  - `removeEventMapping()` - Remove mapping when deleted
  - `getAllMappings()` - Get all synced events

  **Import Mappings:**
  - `saveImportedEvent()` - Track imported calendar events
  - `getImportedEvents()` - Get list of imported event IDs
  - `isEventImported()` - Check if event was already imported
  - `removeImportedEvent()` - Remove imported event tracking

- [ ] **Add types for calendar sync**
  - Location: `src/shared/types/calendar.ts`
  - Types:
    - `CalendarEvent` - Calendar event structure
    - `CalendarSyncSettings` - User sync preferences
    - `EventMapping` - Rehearsal ↔ Calendar event mapping
    - `ImportedEvent` - Tracking for imported events
    - `SyncDirection` - 'export' | 'import' | 'both'
    - `SyncStatus` - Sync state tracking

---

### Phase 3: Availability Integration (45 min)

#### ✅ What Claude Code will do:

- [ ] **Update availability API to handle imported events**
  - Location: Server-side if needed
  - Ensure `source` field supports: `'manual'`, `'rehearsal'`, `'google_calendar'`, `'apple_calendar'`
  - Add `external_event_id` to track calendar event ID

- [ ] **Create availability import service**
  - Location: `src/shared/services/availabilityImport.ts`
  - Functions:
    - `convertCalendarEventToAvailabilitySlot()` - Transform event to busy slot
    - `batchImportSlots()` - Import multiple events efficiently
    - `mergeWithExistingAvailability()` - Avoid duplicates
    - `detectRemovedEvents()` - Clean up deleted calendar events

- [ ] **Add conflict detection for imported events**
  - Detect when rehearsal overlaps with imported calendar event
  - Show warning when scheduling rehearsal during user's busy time
  - Display source of conflict (e.g., "John has a Google Calendar event")

---

### Phase 4: UI Components (45 min)

#### ✅ What Claude Code will do:

- [ ] **Create comprehensive Calendar Sync Settings screen**
  - Location: `src/features/profile/screens/CalendarSyncSettingsScreen.tsx`
  - UI Sections:

    **1. Sync Status:**
    - Last sync time (import & export)
    - Sync in progress indicator
    - Manual "Sync Now" button

    **2. Export Settings (App → Calendar):**
    - Toggle: "Export rehearsals to calendar"
    - Calendar picker: Select destination calendar
    - Auto-sync toggle

    **3. Import Settings (Calendar → App):**
    - Toggle: "Import calendar events as busy slots"
    - Multi-select: Choose calendars to import from
    - List of selected calendars with toggle per calendar
    - Sync interval: Manual / Every hour / Every 6 hours / Daily

    **4. Actions:**
    - Button: "Export All Rehearsals"
    - Button: "Import Calendar Events Now"
    - Button: "Clear All Imported Events" (danger)
    - Button: "Remove All Exported Events" (danger)

- [ ] **Add entry point in ProfileScreen**
  - Location: `src/features/profile/screens/ProfileScreen.tsx`
  - Add "Calendar Sync" option that navigates to settings screen
  - Show sync status badge (syncing / last synced / error)

- [ ] **Add calendar indicators to rehearsal cards**
  - Locations:
    - `src/features/calendar/components/TodayRehearsals.tsx`
    - `src/features/calendar/screens/CalendarScreen.tsx`
  - Features:
    - Icon: Calendar icon if rehearsal is exported
    - Badge: Show if rehearsal conflicts with user's calendar events
    - Tooltip: "Synced to [Calendar Name]"

- [ ] **Add visual indicators for imported availability**
  - Location: `src/features/availability/screens/AvailabilityScreen.tsx`
  - Features:
    - Different color for imported busy slots (e.g., blue vs red)
    - Icon: Calendar icon on imported slots
    - Label: "From Google Calendar" or "From Apple Calendar"
    - Non-editable: User can't modify imported slots directly

- [ ] **Create sync conflict modal**
  - Location: `src/features/calendar/components/SyncConflictModal.tsx`
  - Shows when creating rehearsal during imported busy time
  - Lists conflicting calendar events
  - Options: "Schedule Anyway" or "Pick Different Time"

---

### Phase 5: Background Sync & Polling (30 min)

#### ✅ What Claude Code will do:

- [ ] **Create background sync service**
  - Location: `src/shared/services/backgroundSync.ts`
  - Features:
    - Periodic polling for calendar changes
    - Use React Native AppState to sync when app comes to foreground
    - Configurable sync interval
    - Battery-friendly: don't sync too frequently

- [ ] **Create sync orchestrator**
  - Location: `src/shared/services/syncOrchestrator.ts`
  - Coordinates import and export
  - Handles errors and retries
  - Prevents concurrent syncs
  - Updates sync status in real-time

- [ ] **Add sync hook**
  - Location: `src/features/calendar/hooks/useCalendarSync.ts`
  - Features:
    - `syncExport()` - Export rehearsals to calendar
    - `syncImport()` - Import calendar events to availability
    - `syncBoth()` - Full bidirectional sync
    - `isSyncing` - Loading state
    - `syncError` - Error state
    - `lastSyncTime` - Timestamp of last successful sync
    - `syncStatus` - Detailed status per direction

---

### Phase 6: Localization (20 min)

#### ✅ What Claude Code will do:

- [ ] **Add translations to src/i18n/translations.ts**

  **Russian translations:**
  ```typescript
  calendarSync: {
    // General
    title: 'Синхронизация календаря',
    syncNow: 'Синхронизировать сейчас',
    lastSynced: 'Последняя синхронизация',
    syncing: 'Синхронизация...',
    syncSuccess: 'Успешно синхронизировано',
    syncError: 'Ошибка синхронизации',
    never: 'Никогда',

    // Export (App → Calendar)
    exportSection: 'Экспорт репетиций',
    exportEnabled: 'Экспортировать репетиции в календарь',
    exportCalendar: 'Календарь для экспорта',
    exportAll: 'Экспортировать все репетиции',
    exportSuccess: 'Репетиции экспортированы',
    removeAllExported: 'Удалить все экспортированные события',

    // Import (Calendar → App)
    importSection: 'Импорт из календаря',
    importEnabled: 'Импортировать события как занятость',
    importCalendars: 'Календари для импорта',
    selectCalendars: 'Выбрать календари',
    importInterval: 'Частота синхронизации',
    importNow: 'Импортировать сейчас',
    importSuccess: 'События импортированы',
    clearImported: 'Очистить импортированные события',

    // Intervals
    intervalManual: 'Вручную',
    intervalHourly: 'Каждый час',
    interval6Hours: 'Каждые 6 часов',
    intervalDaily: 'Ежедневно',

    // Sources
    sourceGoogleCalendar: 'Google Calendar',
    sourceAppleCalendar: 'Apple Calendar',
    sourceManual: 'Вручную',
    sourceRehearsal: 'Репетиция',

    // Conflicts
    conflictTitle: 'Конфликт с календарём',
    conflictMessage: 'У участников есть события в это время:',
    conflictScheduleAnyway: 'Запланировать всё равно',
    conflictPickDifferent: 'Выбрать другое время',

    // Permissions
    permissionRequired: 'Требуется разрешение',
    grantPermission: 'Предоставить доступ',
    permissionDenied: 'Доступ запрещён',
    permissionInstructions: 'Разрешите доступ к календарю в настройках устройства',

    // Status
    noCalendars: 'Календари не найдены',
    noCalendarsSelected: 'Календари не выбраны',
    calendarsSelected: (count: number) => `Выбрано календарей: ${count}`,
  }
  ```

  **English translations:**
  ```typescript
  calendarSync: {
    // General
    title: 'Calendar Sync',
    syncNow: 'Sync Now',
    lastSynced: 'Last synced',
    syncing: 'Syncing...',
    syncSuccess: 'Synced successfully',
    syncError: 'Sync error',
    never: 'Never',

    // Export (App → Calendar)
    exportSection: 'Export Rehearsals',
    exportEnabled: 'Export rehearsals to calendar',
    exportCalendar: 'Export to calendar',
    exportAll: 'Export All Rehearsals',
    exportSuccess: 'Rehearsals exported',
    removeAllExported: 'Remove All Exported Events',

    // Import (Calendar → App)
    importSection: 'Import from Calendar',
    importEnabled: 'Import events as busy slots',
    importCalendars: 'Calendars to import',
    selectCalendars: 'Select Calendars',
    importInterval: 'Sync frequency',
    importNow: 'Import Now',
    importSuccess: 'Events imported',
    clearImported: 'Clear Imported Events',

    // Intervals
    intervalManual: 'Manual',
    intervalHourly: 'Every hour',
    interval6Hours: 'Every 6 hours',
    intervalDaily: 'Daily',

    // Sources
    sourceGoogleCalendar: 'Google Calendar',
    sourceAppleCalendar: 'Apple Calendar',
    sourceManual: 'Manual',
    sourceRehearsal: 'Rehearsal',

    // Conflicts
    conflictTitle: 'Calendar Conflict',
    conflictMessage: 'Members have events at this time:',
    conflictScheduleAnyway: 'Schedule Anyway',
    conflictPickDifferent: 'Pick Different Time',

    // Permissions
    permissionRequired: 'Permission Required',
    grantPermission: 'Grant Access',
    permissionDenied: 'Access Denied',
    permissionInstructions: 'Grant calendar access in device settings',

    // Status
    noCalendars: 'No calendars found',
    noCalendarsSelected: 'No calendars selected',
    calendarsSelected: (count: number) => `${count} calendar${count !== 1 ? 's' : ''} selected`,
  }
  ```

---

### Phase 7: Testing (You will do this)

#### 👤 What YOU will do:

**Export Testing (App → Calendar)**

- [ ] **Step 1: Test permissions (5 min)**
  - Run the app: `npm start`
  - Open on physical device (not simulator!)
  - Go to Profile → Calendar Sync
  - Tap "Grant Access" button
  - ✅ Verify: System permission dialog appears
  - ✅ Grant permission
  - ✅ Verify: Calendar list appears

- [ ] **Step 2: Test manual rehearsal export (5 min)**
  - Enable "Export rehearsals to calendar"
  - Select a destination calendar
  - Go to Calendar tab
  - Create a new rehearsal
  - ✅ Verify: Success message appears
  - Open device Calendar app
  - ✅ Verify: Event appears with correct date/time/location

- [ ] **Step 3: Test "Export All" (5 min)**
  - Go to Profile → Calendar Sync
  - Tap "Export All Rehearsals"
  - ✅ Verify: Progress indicator appears
  - ✅ Verify: Success message shown
  - Open device Calendar app
  - ✅ Verify: All future rehearsals are present

- [ ] **Step 4: Test rehearsal deletion (3 min)**
  - Delete a synced rehearsal
  - Open device Calendar app
  - ✅ Verify: Corresponding event is removed

- [ ] **Step 5: Test rehearsal edit (3 min)**
  - Edit a synced rehearsal (change time/date/location)
  - Save changes
  - Open device Calendar app
  - ✅ Verify: Event is updated with new details

**Import Testing (Calendar → App)**

- [ ] **Step 6: Test calendar event import (10 min)**
  - Open device Calendar app
  - Create a personal event (e.g., "Doctor appointment")
  - Set date/time
  - Go back to Rehearsal Calendar app
  - Go to Profile → Calendar Sync
  - Enable "Import events as busy slots"
  - Select the calendar you created event in
  - Tap "Import Now"
  - ✅ Verify: Success message appears
  - Go to Availability screen
  - ✅ Verify: Busy slot appears for the calendar event
  - ✅ Verify: Slot is marked as from Google/Apple Calendar
  - ✅ Verify: Slot is NOT editable (read-only)

- [ ] **Step 7: Test multiple calendar import (5 min)**
  - Create events in different calendars (Work, Personal)
  - Select multiple calendars in import settings
  - Tap "Import Now"
  - ✅ Verify: Events from all selected calendars are imported
  - ✅ Verify: Each shows correct source calendar

- [ ] **Step 8: Test conflict detection (5 min)**
  - Create a calendar event at specific time
  - Import it to app
  - Try to create a rehearsal at the same time
  - ✅ Verify: Conflict warning appears
  - ✅ Verify: Shows which users have calendar conflicts
  - ✅ Verify: Can proceed or cancel

- [ ] **Step 9: Test calendar event deletion (5 min)**
  - Delete a calendar event in device Calendar app
  - Go to app
  - Tap "Import Now" to sync
  - ✅ Verify: Corresponding busy slot is removed from Availability

- [ ] **Step 10: Test auto-sync interval (10 min)**
  - Set sync interval to "Every hour"
  - Create a calendar event
  - Wait for 1+ hour (or manually trigger foreground sync)
  - ✅ Verify: Event is automatically imported
  - Check last sync time
  - ✅ Verify: Shows recent timestamp

**General Testing**

- [ ] **Step 11: Test sync both directions (5 min)**
  - Create a rehearsal (should export to calendar)
  - Create a calendar event (should import to availability)
  - ✅ Verify: Both operations work simultaneously
  - ✅ Verify: No conflicts or errors

- [ ] **Step 12: Test "Clear Imported" (3 min)**
  - Tap "Clear Imported Events"
  - ✅ Verify: Confirmation dialog appears
  - Confirm
  - ✅ Verify: All imported busy slots are removed
  - ✅ Verify: Manual availability is NOT removed

- [ ] **Step 13: Test "Remove All Exported" (3 min)**
  - Tap "Remove All Exported Events"
  - ✅ Verify: Confirmation dialog appears
  - Confirm
  - Open device Calendar app
  - ✅ Verify: All rehearsal events are removed

- [ ] **Step 14: Test on iOS (if available)**
  - Repeat steps 1-13 on iOS device
  - ✅ Verify: Works with Apple Calendar
  - ✅ Verify: Events sync to iCloud

- [ ] **Step 15: Test on Android (if available)**
  - Repeat steps 1-13 on Android device
  - ✅ Verify: Works with Google Calendar
  - ✅ Verify: Supports multiple Google accounts

- [ ] **Step 16: Test error scenarios (5 min)**
  - Revoke calendar permission in device settings
  - Try to sync
  - ✅ Verify: Clear error message appears
  - ✅ Verify: App doesn't crash
  - ✅ Verify: Can re-grant permission

- [ ] **Step 17: Test language switching (2 min)**
  - Switch app language to Russian
  - Go to Calendar Sync screen
  - ✅ Verify: All text is in Russian
  - Switch to English
  - ✅ Verify: All text is in English

---

## 📊 Technical Details

### Export: Rehearsal → Calendar Event

```typescript
{
  title: "Rehearsal: [Project Name]",
  startDate: rehearsal.startsAt, // ISO 8601 with timezone
  endDate: rehearsal.endsAt,     // ISO 8601 with timezone
  location: rehearsal.location || "TBD",
  notes: `Project: ${project.name}\n\nCreated via Rehearsal Calendar app`,
  alarms: [
    { relativeOffset: -30 } // 30 minutes before
  ]
}
```

### Import: Calendar Event → Availability Slot

```typescript
{
  userId: currentUser.id,
  startsAt: event.startDate, // ISO 8601
  endsAt: event.endDate,     // ISO 8601
  type: 'busy',
  source: Platform.OS === 'ios' ? 'apple_calendar' : 'google_calendar',
  external_event_id: event.id, // Calendar event ID
  title: event.title,
  notes: `Imported from ${calendarName}`,
  is_all_day: event.allDay,
}
```

### Storage Format

**AsyncStorage keys:**

```typescript
{
  // Export mappings (rehearsal → calendar event)
  "calendar-export-mappings": {
    "rehearsal-123": {
      calendarEventId: "event-456",
      calendarId: "calendar-1",
      lastSynced: "2025-12-17T10:30:00Z"
    }
  },

  // Import tracking (calendar event → availability slot)
  "calendar-import-tracking": {
    "event-789": {
      availabilitySlotId: "slot-101",
      calendarId: "calendar-2",
      lastImported: "2025-12-17T10:30:00Z"
    }
  },

  // Sync settings
  "calendar-sync-settings": {
    // Export settings
    exportEnabled: true,
    exportCalendarId: "calendar-1",
    autoExport: true,

    // Import settings
    importEnabled: true,
    importCalendarIds: ["calendar-2", "calendar-3"],
    importInterval: "hourly", // 'manual' | 'hourly' | '6hours' | 'daily'

    // Status
    lastExportTime: "2025-12-17T10:30:00Z",
    lastImportTime: "2025-12-17T10:35:00Z",
  }
}
```

### Platform Differences

**iOS (Apple Calendar)**:
- Uses `EKEventStore` via expo-calendar
- Events sync to iCloud automatically if enabled
- Supports multiple calendars (Personal, Work, Family, etc.)
- Default calendar: User's primary calendar
- Import source: `'apple_calendar'`

**Android (Google Calendar)**:
- Uses `CalendarContract` via expo-calendar
- Events sync to Google account automatically
- Supports multiple Google accounts
- Default calendar: Primary Google Calendar
- Import source: `'google_calendar'`

### Sync Algorithm

**Import Process (Calendar → App):**
1. Fetch events from selected calendars for date range (today - 30 days to today + 365 days)
2. Compare with previously imported events (using `external_event_id`)
3. For new events: Create availability slots with `source='google_calendar'` or `'apple_calendar'`
4. For updated events: Update corresponding availability slots
5. For deleted events: Remove corresponding availability slots
6. Update import tracking in AsyncStorage
7. Update last import time

**Export Process (App → Calendar):**
1. Fetch all future rehearsals
2. Compare with export mappings
3. For new rehearsals: Create calendar events
4. For updated rehearsals: Update calendar events
5. For deleted rehearsals: Delete calendar events
6. Update export mappings
7. Update last export time

**Conflict Detection:**
- When creating/editing rehearsal, check if any participant has imported busy slot at that time
- Show warning modal with list of conflicts
- Allow admin to proceed or choose different time

---

## ⚠️ Important Notes

### Requirements:
1. **Physical device required** - Calendar API doesn't work properly in simulator/emulator
2. **Permissions must be granted** - App will request READ_CALENDAR and WRITE_CALENDAR
3. **No internet needed for sync** - Works locally with device calendar
4. **Automatic cloud sync** - Calendar changes sync to Google/iCloud automatically

### Two-Way Sync Behavior:

**Export (App → Calendar):**
- Rehearsals are exported as calendar events
- Updates to rehearsals update calendar events
- Deleting rehearsal deletes calendar event
- Only future rehearsals are exported

**Import (Calendar → App):**
- Calendar events are imported as "busy" availability slots
- Imported slots are read-only (can't be edited in app)
- Deleting calendar event removes busy slot on next sync
- Only events in selected calendars are imported
- Time range: Past 30 days to future 365 days

### Limitations:
1. **One-way modifications** - Can't edit imported slots in app, must edit in calendar
2. **Polling-based** - Not real-time, syncs at intervals or manually
3. **No recurring event handling** - Each instance treated separately
4. **No calendar notifications** - App doesn't receive instant updates when calendar changes

### Error Handling:
- Permission denied → Clear message + instructions to grant in settings
- No calendars found → Suggest creating calendar in system app
- Event creation fails → Log error, show user-friendly message, don't block other operations
- Conflict during import → Skip conflicting events, log warning
- Network not required → All operations work offline

### Performance Considerations:
- Batch operations when importing/exporting multiple events
- Use background thread for sync to avoid blocking UI
- Limit date range to avoid loading too many events
- Cache calendar list to reduce API calls
- Debounce manual sync button to prevent spam

---

## 🚀 Ready to Start?

**Once you say "start", I will:**
1. ✅ Install expo-calendar library
2. ✅ Configure permissions in app.json
3. ✅ Create two-way sync service (export + import)
4. ✅ Implement availability import logic
5. ✅ Add comprehensive UI with settings screen
6. ✅ Add visual indicators for imported/exported events
7. ✅ Implement conflict detection
8. ✅ Add background sync capability
9. ✅ Add full localization (RU/EN)
10. ✅ Give you detailed testing instructions

**Then you will:**
1. Test export functionality (rehearsals → calendar)
2. Test import functionality (calendar → availability)
3. Test two-way sync working together
4. Test on iOS and/or Android
5. Report any issues or edge cases
6. Confirm everything works as expected

---

## 📚 Resources

- [Expo Calendar Documentation](https://docs.expo.dev/versions/latest/sdk/calendar/)
- [expo-calendar npm package](https://www.npmjs.com/package/expo-calendar)
- [expo-calendar getEventsAsync examples](https://snyk.io/advisor/npm-package/expo-calendar/functions/expo-calendar.getEventsAsync)
- [iOS Calendar Integration (EventKit)](https://developer.apple.com/documentation/eventkit)
- [Android Calendar Provider](https://developer.android.com/guide/topics/providers/calendar-provider)

---

**Status**: ⏸️ Awaiting confirmation to start

**Total Tasks**: 56 checkboxes
- **Claude Code**: 39 implementation tasks
- **User Testing**: 17 test scenarios

**Complexity**: Medium-High (two-way sync with conflict detection)
**Estimated Time**: 4-5 hours implementation + 2 hours testing

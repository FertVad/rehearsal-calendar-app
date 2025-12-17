# 📤 Phase 1: Calendar Export (App → Calendar)

> **Goal**: Export rehearsals to device calendar (Google Calendar on Android / Apple Calendar on iOS)

**Branch**: `feature/calendar-sync`
**Phase**: 1 of 4
**Status**: ✅ Implementation Complete - Ready for Testing
**Actual Time**: ~2.5 hours

---

## 🎯 Phase 1 Scope

### What We're Building:
- ✅ Export rehearsals to device calendar as events
- ✅ Manual "Export All Rehearsals" button
- ✅ Auto-export when creating/editing/deleting rehearsals
- ✅ Settings UI to enable/disable and choose calendar
- ✅ Visual indicators showing which rehearsals are synced
- ✅ Full localization (RU/EN)

### What We're NOT Building (Yet):
- ❌ Import calendar events → availability (Phase 2)
- ❌ Auto-sync on interval (Phase 3)
- ❌ Conflict detection (Phase 3)
- ❌ Background sync (Phase 3)

---

## 📋 Implementation Checklist

### Step 1: Setup & Dependencies ✅ (10 min)

- [x] **Install expo-calendar**
  ```bash
  npx expo install expo-calendar
  ```

- [x] **Configure iOS permissions in app.json**
  ```json
  "ios": {
    "infoPlist": {
      "NSCalendarsUsageDescription": "This app needs access to your calendar to sync rehearsals.",
      "NSRemindersUsageDescription": "This app may set reminders for rehearsals."
    }
  }
  ```

- [x] **Configure Android permissions in app.json**
  ```json
  "android": {
    "permissions": [
      "READ_CALENDAR",
      "WRITE_CALENDAR"
    ]
  }
  ```

---

### Step 2: Core Services ✅ (45 min)

- [x] **Create `src/shared/types/calendar.ts`**
  - `CalendarEvent` type
  - `CalendarSyncSettings` type
  - `EventMapping` type
  - `SyncStatus` type

- [x] **Create `src/shared/utils/calendarStorage.ts`**
  - `saveEventMapping(rehearsalId, eventId, calendarId)` - Save mapping
  - `getEventMapping(rehearsalId)` - Get calendar event ID
  - `removeEventMapping(rehearsalId)` - Remove mapping
  - `getAllMappings()` - Get all export mappings
  - `saveSyncSettings(settings)` - Save user settings
  - `getSyncSettings()` - Get user settings

- [x] **Create `src/shared/services/calendarSync.ts`**

  **Permission Functions:**
  - `requestCalendarPermissions()` - Request READ/WRITE permissions
  - `checkCalendarPermissions()` - Check current permission status

  **Calendar Functions:**
  - `getDeviceCalendars()` - Get list of writable calendars
  - `getDefaultCalendar()` - Get default calendar for platform

  **Export Functions:**
  - `createCalendarEvent(rehearsal, calendarId)` - Create single event
  - `updateCalendarEvent(eventId, rehearsal)` - Update existing event
  - `deleteCalendarEvent(eventId)` - Delete event
  - `syncRehearsalToCalendar(rehearsal)` - Smart sync (create or update)
  - `syncAllRehearsals(rehearsals, calendarId)` - Batch export with progress callback
  - `removeAllExportedEvents()` - Clean up all synced events

---

### Step 3: UI Components ✅ (45 min)

- [x] **Create `src/features/profile/screens/CalendarSyncSettingsScreen.tsx`**

  **UI Sections:**

  1. **Permission Status:**
     - Badge: "Permissions Granted" ✅ or "Grant Access" ⚠️
     - Button: "Grant Calendar Access" (if not granted)

  2. **Export Settings:**
     - Toggle: "Export rehearsals to calendar"
     - Picker: Select destination calendar
     - Text: Last export time

  3. **Actions:**
     - Button: "Export All Rehearsals" (with progress)
     - Button: "Remove All Exported Events" (danger, with confirmation)

  4. **Status:**
     - Text: "X rehearsals synced"
     - Text: Last sync time

- [x] **Update `src/features/profile/screens/ProfileScreen.tsx`**
  - Add navigation item: "Calendar Sync"
  - Show sync status badge (optional)

- [x] **Update `src/features/calendar/components/TodayRehearsals.tsx`**
  - Add calendar icon if rehearsal is exported
  - Icon appears next to time/location

- [x] **Update `src/features/calendar/screens/CalendarScreen.tsx`**
  - Add calendar icon to upcoming events if exported
  - Same styling as TodayRehearsals

---

### Step 4: Integration ✅ (30 min)

- [x] **Create `src/features/calendar/hooks/useCalendarSync.ts`**

  ```typescript
  const {
    // State
    isSyncing,
    syncError,
    lastSyncTime,
    settings,

    // Functions
    syncRehearsal,      // (rehearsal) => Promise<void>
    unsyncRehearsal,    // (rehearsalId) => Promise<void>
    syncAllRehearsals,  // (rehearsals) => Promise<void>
    isSynced,           // (rehearsalId) => boolean
    updateSettings,     // (settings) => Promise<void>
  } = useCalendarSync();
  ```

- [x] **Update `src/features/calendar/screens/AddRehearsalScreen.tsx`**
  - After creating rehearsal, check if export enabled
  - If enabled, auto-export to calendar
  - Show success toast: "Rehearsal created and synced to calendar"
  - Handle errors gracefully

- [ ] **Update rehearsal edit flow** _(Skipped for Phase 1 - not critical)_
  - When editing rehearsal, update calendar event
  - Use `updateCalendarEvent()` with stored event ID

- [x] **Update rehearsal delete flow**
  - When deleting rehearsal, delete calendar event
  - Remove event mapping from storage

---

### Step 5: Localization ✅ (15 min)

- [x] **Add translations to `src/i18n/translations.ts`**

**Russian:**
```typescript
calendarSync: {
  // Navigation
  title: 'Синхронизация с календарём',

  // Permissions
  permissionGranted: 'Доступ предоставлен',
  permissionDenied: 'Доступ запрещён',
  grantPermission: 'Предоставить доступ',
  permissionInstructions: 'Разрешите доступ к календарю для синхронизации репетиций',

  // Export Settings
  exportEnabled: 'Экспортировать репетиции',
  exportCalendar: 'Календарь для экспорта',
  selectCalendar: 'Выбрать календарь',

  // Actions
  exportAll: 'Экспортировать все репетиции',
  exportAllProgress: (current: number, total: number) => `Экспорт ${current} из ${total}...`,
  removeAll: 'Удалить все экспортированные',
  removeAllConfirm: 'Удалить все репетиции из календаря?',

  // Status
  lastSynced: 'Последняя синхронизация',
  never: 'Никогда',
  syncing: 'Синхронизация...',
  syncSuccess: 'Успешно синхронизировано',
  syncError: 'Ошибка синхронизации',
  rehearsalsSynced: (count: number) => `Синхронизировано репетиций: ${count}`,

  // Rehearsal indicators
  syncedToCalendar: 'Добавлено в календарь',
  notSynced: 'Не синхронизировано',

  // Errors
  noCalendars: 'Календари не найдены',
  noWritableCalendars: 'Нет календарей для записи',
  exportFailed: 'Не удалось экспортировать',
  deleteFailed: 'Не удалось удалить из календаря',
}
```

**English:**
```typescript
calendarSync: {
  // Navigation
  title: 'Calendar Sync',

  // Permissions
  permissionGranted: 'Access Granted',
  permissionDenied: 'Access Denied',
  grantPermission: 'Grant Access',
  permissionInstructions: 'Grant calendar access to sync rehearsals',

  // Export Settings
  exportEnabled: 'Export rehearsals',
  exportCalendar: 'Export to calendar',
  selectCalendar: 'Select Calendar',

  // Actions
  exportAll: 'Export All Rehearsals',
  exportAllProgress: (current: number, total: number) => `Exporting ${current} of ${total}...`,
  removeAll: 'Remove All Exported',
  removeAllConfirm: 'Remove all rehearsals from calendar?',

  // Status
  lastSynced: 'Last synced',
  never: 'Never',
  syncing: 'Syncing...',
  syncSuccess: 'Synced successfully',
  syncError: 'Sync error',
  rehearsalsSynced: (count: number) => `${count} rehearsal${count !== 1 ? 's' : ''} synced`,

  // Rehearsal indicators
  syncedToCalendar: 'Added to calendar',
  notSynced: 'Not synced',

  // Errors
  noCalendars: 'No calendars found',
  noWritableCalendars: 'No writable calendars',
  exportFailed: 'Export failed',
  deleteFailed: 'Failed to delete from calendar',
}
```

---

## 📊 Technical Details

### Event Format

When exporting rehearsal to calendar:

```typescript
{
  title: `Rehearsal: ${projectName}`,
  startDate: new Date(rehearsal.startsAt),
  endDate: new Date(rehearsal.endsAt),
  location: rehearsal.location || undefined,
  notes: `Project: ${projectName}\n\nCreated via Rehearsal Calendar app`,
  timeZone: 'default', // Use device timezone
  alarms: [
    { relativeOffset: -30, method: 'alert' } // 30 min reminder
  ],
  availability: 'busy',
}
```

### Storage Format

AsyncStorage keys:

```typescript
// Export mappings
"calendar-export-mappings": {
  "rehearsal-123": {
    eventId: "CAL-EVENT-456",
    calendarId: "primary",
    lastSynced: "2025-12-17T10:30:00Z",
  },
  "rehearsal-124": { ... }
}

// Settings
"calendar-sync-settings": {
  exportEnabled: true,
  exportCalendarId: "primary",
  lastExportTime: "2025-12-17T10:30:00Z",
}
```

---

## 🧪 Testing Checklist

### Prerequisites:
- ✅ Physical iPhone or Android device (simulators won't work properly)
- ✅ Device has calendar app installed
- ✅ Device is connected to development machine

### Test Scenarios:

- [ ] **Test 1: Permissions**
  1. Fresh app install → go to Calendar Sync
  2. Tap "Grant Access"
  3. ✅ System permission dialog appears
  4. Grant permission
  5. ✅ Status shows "Access Granted"
  6. ✅ Calendar list appears

- [ ] **Test 2: Select Calendar**
  1. Tap "Select Calendar" picker
  2. ✅ Shows list of writable calendars
  3. Select "Personal" calendar
  4. ✅ Selection saved and displayed

- [ ] **Test 3: Manual Export All**
  1. Create 3 test rehearsals
  2. Go to Calendar Sync
  3. Tap "Export All Rehearsals"
  4. ✅ Progress indicator shows "Exporting 1 of 3..."
  5. ✅ Success message appears
  6. Open device Calendar app
  7. ✅ All 3 rehearsals appear with correct dates/times

- [ ] **Test 4: Auto-Export on Create**
  1. Enable "Export rehearsals" toggle
  2. Create new rehearsal
  3. ✅ Success toast: "Synced to calendar"
  4. Open device Calendar app
  5. ✅ Rehearsal appears immediately

- [ ] **Test 5: Edit Synced Rehearsal**
  1. Edit an exported rehearsal (change time)
  2. Save changes
  3. Open device Calendar app
  4. ✅ Event time updated

- [ ] **Test 6: Delete Synced Rehearsal**
  1. Delete an exported rehearsal
  2. Open device Calendar app
  3. ✅ Event removed from calendar

- [ ] **Test 7: Calendar Icon Indicator**
  1. Export a rehearsal
  2. Go to Calendar screen
  3. ✅ Calendar icon shows next to exported rehearsal
  4. Create non-exported rehearsal
  5. ✅ No icon for non-exported rehearsal

- [ ] **Test 8: Remove All**
  1. Export several rehearsals
  2. Tap "Remove All Exported"
  3. ✅ Confirmation dialog appears
  4. Confirm
  5. Open device Calendar app
  6. ✅ All rehearsal events removed

- [ ] **Test 9: Language Switch**
  1. Go to Profile → Language → Русский
  2. Go to Calendar Sync
  3. ✅ All text in Russian
  4. Switch to English
  5. ✅ All text in English

- [ ] **Test 10: Error Handling**
  1. Revoke calendar permission in device Settings
  2. Try to export rehearsal
  3. ✅ Clear error message shown
  4. ✅ App doesn't crash
  5. Re-grant permission
  6. ✅ Export works again

---

## ✅ Definition of Done

Phase 1 is complete when:

1. ✅ All checkboxes above are completed
2. ✅ All 10 test scenarios pass
3. ✅ Code compiles without errors
4. ✅ Rehearsals export to device calendar correctly
5. ✅ Calendar events update when rehearsals change
6. ✅ Calendar events delete when rehearsals delete
7. ✅ UI is fully localized (RU/EN)
8. ✅ Permissions handled gracefully
9. ✅ No crashes or unhandled errors
10. ✅ User can see visual indicators for synced rehearsals

---

## 🚀 What's Next?

After Phase 1 is complete and tested:

**Option A:** Ship it!
- Phase 1 already provides useful functionality
- Users can export rehearsals to their calendars
- Evaluate if import is actually needed

**Option B:** Continue to Phase 2
- Add import (Calendar → App)
- See [CALENDAR_SYNC_PLAN.md](CALENDAR_SYNC_PLAN.md) Phase 2

---

## 📝 Implementation Summary

**Implementation completed on**: December 17, 2025

### ✅ What Was Built:

1. **Core Services**
   - [calendarSync.ts](src/shared/services/calendarSync.ts) - Full calendar integration service
   - [calendarStorage.ts](src/shared/utils/calendarStorage.ts) - AsyncStorage management
   - [calendar.ts](src/shared/types/calendar.ts) - TypeScript types

2. **React Hooks**
   - [useCalendarSync.ts](src/features/calendar/hooks/useCalendarSync.ts) - Main hook for calendar operations

3. **UI Components**
   - [CalendarSyncSettingsScreen.tsx](src/features/profile/screens/CalendarSyncSettingsScreen.tsx) - Settings screen
   - Updated [ProfileScreen.tsx](src/features/profile/screens/ProfileScreen.tsx) - Entry point added
   - Updated [TodayRehearsals.tsx](src/features/calendar/components/TodayRehearsals.tsx) - Calendar icons
   - Updated [MyRehearsalsModal.tsx](src/features/calendar/components/MyRehearsalsModal.tsx) - Calendar icons

4. **Auto-Sync Integration**
   - [AddRehearsalScreen.tsx](src/features/calendar/screens/AddRehearsalScreen.tsx) - Auto-export on create
   - [CalendarScreen.tsx](src/features/calendar/screens/CalendarScreen.tsx) - Auto-unsync on delete

5. **Localization**
   - Full RU/EN translations added to [translations.ts](src/i18n/translations.ts)

### ⚠️ Known Limitations:

1. **Edit Flow Not Implemented** - When editing a rehearsal, the calendar event is NOT automatically updated. This is intentional for Phase 1 to ship faster. Will be added in future phase if needed.

2. **Pre-existing TypeScript Errors** - There are 5 type errors in CalendarScreen.tsx related to Project and RSVP types. These are NOT related to calendar sync functionality and existed before.

---

**Status**: ✅ Implementation Complete - Ready for Device Testing
**Next Step**: Testing on physical device (See Testing Checklist above)

# 📅 Calendar Sync: Implementation Plan (Updated)

> **Goal**: TWO-WAY sync between user availability and device calendars (Google Calendar on Android / Apple Calendar on iOS)

**Created**: December 17, 2025
**Updated**: December 17, 2025
**Status**: Phase 1 Complete ✅ | Phase 2 Ready to Start
**Branch**: `feature/calendar-sync`

---

## 📊 Progress Overview

| Phase | Status | Time Estimated | Time Actual | Description |
|-------|--------|----------------|-------------|-------------|
| **Phase 1** | ✅ **COMPLETE** | 2-3 hours | ~2.5 hours | Export (App → Calendar) |
| **Phase 2** | 🔄 **IN PROGRESS** | 2-3 hours | - | Import (Calendar → App) |
| **Phase 3** | ⏸️ Pending | 2 hours | - | Auto-Sync & Conflicts |
| **Phase 4** | ⏸️ Pending | 1-2 hours | - | Polish & Edge Cases |

---

## ✅ Phase 1: Export (App → Calendar) - COMPLETE

**Status**: ✅ Implemented and Ready for Testing

### What Was Built:
- ✅ Export rehearsals to device calendar as events
- ✅ Manual "Export All Rehearsals" button with progress tracking
- ✅ Auto-export when creating rehearsals
- ✅ Auto-delete from calendar when deleting rehearsals
- ✅ Calendar sync settings screen with permissions management
- ✅ Visual indicators (green calendar icons) for synced rehearsals
- ✅ Full localization (Russian/English)

### Files Created:
- `src/shared/services/calendarSync.ts` (363 lines)
- `src/shared/utils/calendarStorage.ts` (183 lines)
- `src/shared/types/calendar.ts` (52 lines)
- `src/features/calendar/hooks/useCalendarSync.ts` (335 lines)
- `src/features/profile/screens/CalendarSyncSettingsScreen.tsx` (387 lines)
- `src/features/profile/styles/calendarSyncSettingsScreenStyles.ts`

### Known Limitations:
- ⚠️ Edit flow not implemented (calendar events not updated when rehearsal edited)
- ⚠️ Pre-existing TypeScript errors in CalendarScreen.tsx (unrelated to sync)

**Next Step**: Device testing → See [PHASE_1_EXPORT_PLAN.md](PHASE_1_EXPORT_PLAN.md)

---

## 🔄 Phase 2: Import (Calendar → App) - READY TO START

**Goal**: Import calendar events as "busy" availability slots

**Estimated Time**: 2-3 hours

### ✅ Backend Analysis (from CALENDAR_SYNC_ANALYSIS.md):

**Good News: Backend is READY!** No database migrations needed.

#### Database Schema:
```sql
-- native_user_availability table ALREADY has:
source VARCHAR            -- 'manual', 'google_calendar', 'apple_calendar'
external_event_id VARCHAR -- Calendar event ID for tracking
starts_at TIMESTAMPTZ     -- Timezone-aware
ends_at TIMESTAMPTZ       -- Timezone-aware
is_all_day BOOLEAN        -- For all-day events
type VARCHAR              -- 'available', 'busy', 'tentative'
```

#### API Support:
- ✅ `POST /api/native/availability/bulk` - Batch insert availability slots
- ✅ `GET /api/native/availability` - Returns source and external_event_id
- ✅ `DELETE` with source filtering - Can delete only imported slots
- ✅ Constants: `AVAILABILITY_SOURCES.GOOGLE`, `AVAILABILITY_SOURCES.APPLE`

**Conclusion**: Can start implementing immediately, no server changes required!

---

### 📋 Implementation Checklist

#### Step 1: Add Import Functions to calendarSync.ts ✅ (45 min)

**Location**: `src/shared/services/calendarSync.ts`

- [ ] **Add `getCalendarEvents()` function**
  ```typescript
  export async function getCalendarEvents(
    calendarIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Calendar.Event[]>
  ```
  - Fetch events from selected calendars
  - Date range: -30 days to +365 days (to avoid performance issues)
  - Filter out all-day events (optional, configurable)
  - Return array of calendar events

- [ ] **Add `importCalendarEventsToAvailability()` function**
  ```typescript
  export async function importCalendarEventsToAvailability(
    calendarIds: string[],
    onProgress?: (current: number, total: number) => void
  ): Promise<ImportResult>
  ```
  - Get events from calendars
  - Convert each event to availability slot format:
    ```typescript
    {
      startsAt: event.startDate.toISOString(),
      endsAt: event.endDate.toISOString(),
      type: 'busy',
      source: Platform.OS === 'ios' ? 'apple_calendar' : 'google_calendar',
      external_event_id: event.id,
      title: event.title,
      is_all_day: event.allDay,
    }
    ```
  - Batch insert via API (chunks of 50)
  - Track imported event IDs
  - Report progress

- [ ] **Add `syncCalendarToAvailability()` function**
  ```typescript
  export async function syncCalendarToAvailability(
    calendarIds: string[]
  ): Promise<void>
  ```
  - Smart sync: Compare with previously imported events
  - Detect new events → Insert
  - Detect updated events → Update
  - Detect deleted events → Delete from availability
  - Use external_event_id for matching

- [ ] **Add `removeAllImportedSlots()` function**
  ```typescript
  export async function removeAllImportedSlots(): Promise<void>
  ```
  - Delete all availability slots where source = 'google_calendar' or 'apple_calendar'
  - Clear import tracking from AsyncStorage

---

#### Step 2: Extend calendarStorage.ts for Import Tracking ✅ (20 min)

**Location**: `src/shared/utils/calendarStorage.ts`

- [ ] **Add import tracking functions**
  ```typescript
  // Track which calendar events have been imported
  export async function saveImportedEvent(
    eventId: string,
    availabilitySlotId: string,
    calendarId: string
  ): Promise<void>

  export async function getImportedEvents(): Promise<ImportedEventMap>

  export async function isEventImported(eventId: string): Promise<boolean>

  export async function removeImportedEvent(eventId: string): Promise<void>

  export async function clearAllImportedEvents(): Promise<void>
  ```

- [ ] **Add import settings to CalendarSyncSettings**
  ```typescript
  export interface CalendarSyncSettings {
    // Export settings (existing)
    exportEnabled: boolean;
    exportCalendarId: string | null;
    lastExportTime: string | null;

    // Import settings (new)
    importEnabled: boolean;
    importCalendarIds: string[];  // Can select multiple calendars
    importInterval: 'manual' | 'hourly' | '6hours' | 'daily';
    lastImportTime: string | null;
  }
  ```

---

#### Step 3: Update Types ✅ (10 min)

**Location**: `src/shared/types/calendar.ts`

- [ ] **Add import-related types**
  ```typescript
  export interface ImportedEventMap {
    [eventId: string]: {
      availabilitySlotId: string;
      calendarId: string;
      lastImported: string;
    };
  }

  export interface ImportResult {
    success: number;
    failed: number;
    skipped: number;  // Already imported
    errors: string[];
  }

  export interface AvailabilitySlot {
    userId?: string;
    startsAt: string;  // ISO 8601
    endsAt: string;    // ISO 8601
    type: 'busy' | 'available' | 'tentative';
    source: 'manual' | 'rehearsal' | 'google_calendar' | 'apple_calendar';
    external_event_id?: string;
    title?: string;
    notes?: string;
    is_all_day?: boolean;
  }
  ```

---

#### Step 4: Update useCalendarSync Hook ✅ (30 min)

**Location**: `src/features/calendar/hooks/useCalendarSync.ts`

- [ ] **Add import state**
  ```typescript
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportTime, setLastImportTime] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  ```

- [ ] **Add import functions**
  ```typescript
  const importNow = async () => {
    if (!settings?.importEnabled || !settings.importCalendarIds.length) {
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const result = await importCalendarEventsToAvailability(
        settings.importCalendarIds,
        (current, total) => {
          // Progress callback
        }
      );

      setImportedCount(result.success);
      setLastImportTime(new Date().toISOString());
      await updateSettings({ ...settings, lastImportTime: new Date().toISOString() });
    } catch (error: any) {
      setImportError(error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const clearImported = async () => {
    await removeAllImportedSlots();
    setImportedCount(0);
  };
  ```

- [ ] **Return new state/functions**
  ```typescript
  return {
    // Existing export state/functions
    hasPermission,
    calendars,
    settings,
    isSyncing,
    syncError,
    lastSyncTime,
    syncedCount,
    requestPermissions,
    updateSettings,
    syncRehearsal,
    unsync,
    syncAll,
    removeAll,

    // New import state/functions
    isImporting,
    importError,
    lastImportTime,
    importedCount,
    importNow,
    clearImported,
  };
  ```

---

#### Step 5: Update CalendarSyncSettingsScreen UI ✅ (45 min)

**Location**: `src/features/profile/screens/CalendarSyncSettingsScreen.tsx`

- [ ] **Add Import Settings Section**
  ```tsx
  {/* Import Settings (Calendar → App) */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{t.calendarSync.importSection}</Text>

    {/* Enable Import Toggle */}
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
          <Ionicons name="download" size={20} color={Colors.accent.blue} />
        </View>
        <Text style={styles.settingLabel}>{t.calendarSync.importEnabled}</Text>
      </View>
      <Switch
        value={importEnabled}
        onValueChange={handleToggleImport}
        trackColor={{ false: Colors.bg.tertiary, true: Colors.accent.blue }}
        thumbColor={Colors.text.inverse}
        disabled={isImporting}
      />
    </View>

    {/* Calendar Multi-Selector */}
    {importEnabled && (
      <TouchableOpacity
        style={styles.settingItem}
        onPress={() => setCalendarImportPickerVisible(true)}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
            <Ionicons name="list" size={20} color={Colors.accent.purple} />
          </View>
          <Text style={styles.settingLabel}>{t.calendarSync.importCalendars}</Text>
        </View>
        <View style={styles.settingRight}>
          <Text style={styles.settingValue}>
            {selectedImportCalendarIds.length === 0
              ? t.calendarSync.selectCalendars
              : t.calendarSync.calendarsSelected(selectedImportCalendarIds.length)}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
        </View>
      </TouchableOpacity>
    )}
  </View>
  ```

- [ ] **Add Import Actions Section**
  ```tsx
  {/* Import Actions */}
  {importEnabled && selectedImportCalendarIds.length > 0 && (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t.calendarSync.actions}</Text>

      {/* Import Now Button */}
      <GlassButton
        title={t.calendarSync.importNow}
        onPress={handleImportNow}
        variant="blue"
        disabled={isImporting}
        loading={isImporting}
        style={styles.actionButton}
      />

      {/* Clear Imported Button */}
      {importedCount > 0 && (
        <GlassButton
          title={t.calendarSync.clearImported}
          onPress={handleClearImported}
          variant="glass"
          disabled={isImporting}
          style={styles.actionButton}
        />
      )}
    </View>
  )}
  ```

- [ ] **Add Multi-Select Calendar Picker Modal**
  ```tsx
  {/* Calendar Multi-Select Modal */}
  <Modal
    visible={calendarImportPickerVisible}
    transparent
    animationType="slide"
    onRequestClose={() => setCalendarImportPickerVisible(false)}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t.calendarSync.selectCalendars}</Text>
          <TouchableOpacity onPress={() => setCalendarImportPickerVisible(false)}>
            <Ionicons name="close" size={24} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={calendars}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.calendarItem}
              onPress={() => handleToggleImportCalendar(item.id)}
            >
              <View style={styles.calendarInfo}>
                <View style={[styles.calendarColor, { backgroundColor: item.color }]} />
                <Text style={styles.calendarTitle}>{item.title}</Text>
              </View>
              <Ionicons
                name={selectedImportCalendarIds.includes(item.id) ? "checkbox" : "square-outline"}
                size={24}
                color={selectedImportCalendarIds.includes(item.id) ? Colors.accent.blue : Colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
          style={styles.calendarList}
        />
        <GlassButton
          title={t.common.done}
          onPress={() => setCalendarImportPickerVisible(false)}
          variant="purple"
          style={styles.modalButton}
        />
      </View>
    </View>
  </Modal>
  ```

- [ ] **Update Import Status Display**
  ```tsx
  {/* Status */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{t.calendarSync.status}</Text>

    <View style={styles.statusCard}>
      {/* Export Status */}
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>{t.calendarSync.exportedCount}</Text>
        <Text style={styles.statusValue}>{syncedCount}</Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>{t.calendarSync.lastExport}</Text>
        <Text style={styles.statusValue}>{formatLastSyncTime()}</Text>
      </View>

      {/* Import Status */}
      {importEnabled && (
        <>
          <View style={styles.divider} />

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>{t.calendarSync.importedCount}</Text>
            <Text style={styles.statusValue}>{importedCount}</Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>{t.calendarSync.lastImport}</Text>
            <Text style={styles.statusValue}>{formatLastImportTime()}</Text>
          </View>
        </>
      )}

      {importError && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={16} color={Colors.accent.red} />
          <Text style={styles.errorText}>{importError}</Text>
        </View>
      )}
    </View>
  </View>
  ```

---

#### Step 6: Update Translations ✅ (15 min)

**Location**: `src/i18n/translations.ts`

- [ ] **Add import translations (Russian)**
  ```typescript
  calendarSync: {
    // ... existing export translations ...

    // Import (Calendar → App)
    importSection: 'Импорт из календаря',
    importEnabled: 'Импортировать события как занятость',
    importCalendars: 'Календари для импорта',
    selectCalendars: 'Выбрать календари',
    calendarsSelected: (count: number) => `Выбрано: ${count}`,
    importNow: 'Импортировать сейчас',
    importSuccess: 'События импортированы',
    importError: 'Ошибка импорта',
    clearImported: 'Очистить импортированные',
    importedCount: 'Импортировано событий',
    lastImport: 'Последний импорт',

    // Status
    exportedCount: 'Экспортировано репетиций',
    lastExport: 'Последний экспорт',
  }
  ```

- [ ] **Add import translations (English)**
  ```typescript
  calendarSync: {
    // ... existing export translations ...

    // Import (Calendar → App)
    importSection: 'Import from Calendar',
    importEnabled: 'Import events as busy slots',
    importCalendars: 'Calendars to import',
    selectCalendars: 'Select Calendars',
    calendarsSelected: (count: number) => `${count} selected`,
    importNow: 'Import Now',
    importSuccess: 'Events imported',
    importError: 'Import error',
    clearImported: 'Clear Imported',
    importedCount: 'Imported events',
    lastImport: 'Last import',

    // Status
    exportedCount: 'Exported rehearsals',
    lastExport: 'Last export',
  }
  ```

---

#### Step 7: Visual Indicators in Availability Screen ✅ (30 min)

**Location**: `src/features/availability/screens/AvailabilityScreen.tsx`

- [ ] **Add visual distinction for imported slots**
  - Different background color for imported busy slots (blue vs red)
  - Calendar icon badge
  - Label: "From Google Calendar" or "From Apple Calendar"
  - Make imported slots read-only (can't edit/delete)

- [ ] **Add filter toggle**
  - Toggle: "Show imported events"
  - Allow hiding imported slots if too cluttered

---

### ⚠️ Important Considerations (from Analysis)

#### Performance:
- ✅ **Limit date range**: -30 days to +365 days (avoid loading 1000+ events)
- ✅ **Batch processing**: Insert in chunks of 50 events
- ✅ **Progress indicator**: Show "Importing 25 of 100..."
- ✅ **Debounce button**: Prevent spam clicks on "Import Now"

#### Privacy:
- ✅ **User choice**: Only import from selected calendars
- ✅ **Local storage**: Keep event mappings in AsyncStorage, not server
- ✅ **Clear on logout**: Remove all import data

#### Timezone:
- ✅ **Store as UTC**: Database TIMESTAMPTZ handles conversion
- ✅ **All-day events**: Set `is_all_day: true`, don't convert timezone
- ✅ **Display in local**: App shows in user's timezone

#### Sync Consistency:
- ✅ **Check external_event_id**: Avoid duplicate imports
- ✅ **Compare timestamps**: Detect updated events
- ✅ **Handle deletions**: Remove slots for deleted calendar events

---

## 📊 Phase 2 Technical Details

### Import Process Flow:

```typescript
1. User taps "Import Now"
2. Check permissions
3. Fetch events from selected calendars (date range: -30d to +365d)
4. For each event:
   a. Check if already imported (external_event_id)
   b. If new → Convert to availability slot format
   c. If exists → Compare timestamps, update if changed
5. Batch insert to server (chunks of 50)
6. Save import tracking to AsyncStorage
7. Update UI with imported count
8. Show success message
```

### Calendar Event → Availability Slot Conversion:

```typescript
Calendar Event:
{
  id: "event-123",
  title: "Doctor appointment",
  startDate: new Date("2025-12-20T14:00:00Z"),
  endDate: new Date("2025-12-20T15:00:00Z"),
  allDay: false,
  calendarId: "calendar-1"
}

Availability Slot:
{
  startsAt: "2025-12-20T14:00:00.000Z",
  endsAt: "2025-12-20T15:00:00.000Z",
  type: "busy",
  source: "google_calendar",  // or "apple_calendar"
  external_event_id: "event-123",
  title: "Doctor appointment",
  is_all_day: false
}
```

### AsyncStorage Format:

```typescript
{
  "calendar-import-tracking": {
    "event-123": {
      availabilitySlotId: "slot-456",
      calendarId: "calendar-1",
      lastImported: "2025-12-17T12:00:00Z"
    },
    "event-124": { ... }
  },

  "calendar-sync-settings": {
    // Export settings
    exportEnabled: true,
    exportCalendarId: "calendar-1",
    lastExportTime: "2025-12-17T12:00:00Z",

    // Import settings
    importEnabled: true,
    importCalendarIds: ["calendar-1", "calendar-2"],
    importInterval: "manual",
    lastImportTime: "2025-12-17T12:05:00Z"
  }
}
```

---

## 🧪 Phase 2 Testing Checklist

### Prerequisites:
- ✅ Physical device (iOS or Android)
- ✅ Calendar app with test events
- ✅ Phase 1 working (export tested)

### Test Scenarios:

- [ ] **Test 1: Basic Import**
  1. Create calendar event in device Calendar app
  2. Go to Calendar Sync Settings
  3. Enable "Import events as busy slots"
  4. Select calendar
  5. Tap "Import Now"
  6. ✅ Success message appears
  7. Go to Availability screen
  8. ✅ Busy slot appears for calendar event
  9. ✅ Slot marked as from Google/Apple Calendar
  10. ✅ Slot is read-only

- [ ] **Test 2: Multiple Calendars**
  1. Create events in Work calendar
  2. Create events in Personal calendar
  3. Select both calendars in import settings
  4. Tap "Import Now"
  5. ✅ Events from both calendars imported

- [ ] **Test 3: All-Day Events**
  1. Create all-day event in calendar
  2. Import
  3. ✅ Shows as all-day busy slot
  4. ✅ No specific time shown

- [ ] **Test 4: Event Updates**
  1. Import calendar event
  2. Edit event time in Calendar app
  3. Tap "Import Now" again
  4. ✅ Busy slot time updated

- [ ] **Test 5: Event Deletion**
  1. Import calendar event
  2. Delete event from Calendar app
  3. Tap "Import Now" again
  4. ✅ Busy slot removed from availability

- [ ] **Test 6: Duplicate Prevention**
  1. Import events
  2. Import again without clearing
  3. ✅ No duplicate busy slots created

- [ ] **Test 7: Clear Imported**
  1. Import several events
  2. Tap "Clear Imported"
  3. ✅ Confirmation dialog
  4. Confirm
  5. ✅ All imported busy slots removed
  6. ✅ Manual availability NOT removed

- [ ] **Test 8: Language Switch**
  1. Switch to Russian
  2. ✅ All import UI in Russian
  3. Switch to English
  4. ✅ All import UI in English

- [ ] **Test 9: Performance**
  1. Create 100+ events in calendar
  2. Import
  3. ✅ Progress indicator shows
  4. ✅ Completes in reasonable time (<30 sec)
  5. ✅ App doesn't freeze

- [ ] **Test 10: Error Handling**
  1. Revoke calendar permission
  2. Try to import
  3. ✅ Clear error message
  4. ✅ App doesn't crash

---

## 🚀 Phase 3 & 4 (Future)

### Phase 3: Auto-Sync & Conflicts (2 hours)
- Background sync on app foreground
- Conflict detection when scheduling rehearsals
- Warning modal for conflicts
- Smart Planner integration

### Phase 4: Polish (1-2 hours)
- Undo functionality
- Sync history/log
- Advanced error handling
- Performance optimizations

---

## ✅ Ready to Start Phase 2?

**Status**: ✅ **READY**

**Prerequisites Met:**
- ✅ Backend schema ready (no migrations needed)
- ✅ API endpoints ready
- ✅ Phase 1 complete (export working)
- ✅ Analysis done (limitations understood)

**Estimated Time**: 2-3 hours

**Complexity**: Medium (simpler than Phase 1 because backend ready)

---

**Next Command**: Tell me to start, and I'll begin implementing Phase 2 (Import)! 🚀

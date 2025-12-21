# Automatic Calendar Sync Implementation

## Overview

Implemented automatic calendar synchronization to eliminate the need for manual button presses. The system now intelligently syncs calendar data based on user settings without overloading the system.

## Features Implemented

### 1. **Auto-Sync on App Foreground**

When the app comes to foreground (user opens or returns to the app):
- Automatically exports rehearsals to calendar (if export enabled)
- Automatically imports calendar events to availability (if import enabled and enough time passed)
- Throttled to prevent duplicate syncs within 5 seconds

**Implementation**: [src/shared/hooks/useAutoCalendarSync.ts](src/shared/hooks/useAutoCalendarSync.ts)

### 2. **Configurable Import Frequency**

Users can choose how often calendar imports should occur:
- **Manual**: Only import when clicking the button (no automatic imports)
- **Hourly**: Auto-import every hour (when app is opened)
- **6 Hours**: Auto-import every 6 hours (when app is opened)
- **Daily**: Auto-import once per day (when app is opened)

**Key Point**: Automatic import only happens when:
1. Import is enabled
2. At least one calendar is selected
3. Enough time has passed since last import based on the selected interval
4. User opens/returns to the app

**UI**: [src/features/profile/screens/CalendarSyncSettingsScreen.tsx](src/features/profile/screens/CalendarSyncSettingsScreen.tsx) (lines 494-546)

### 3. **Automatic Export After Rehearsal Creation**

When a rehearsal is created:
- If export is enabled, the rehearsal is immediately synced to the device calendar
- No need to manually trigger export

**Implementation**: Already existed in [src/features/calendar/screens/AddRehearsalScreen.tsx](src/features/calendar/screens/AddRehearsalScreen.tsx) (lines 404-423)

### 4. **Auto-Refresh Availability UI**

The availability screen now automatically reloads data when:
- User navigates to the screen (using React Navigation's useFocusEffect)
- User pulls down to refresh (existing functionality)

This ensures that after automatic import runs in the background, the UI will show updated data as soon as the user views the availability screen.

**Implementation**: [src/features/availability/screens/AvailabilityScreen.tsx](src/features/availability/screens/AvailabilityScreen.tsx) (lines 75-80)

## How It Works

### Sync Flow Diagram

```
User Opens App
      ↓
useAutoCalendarSync hook listens to AppState
      ↓
App state changes from background → active
      ↓
performAutoSync() is triggered
      ↓
├─ Export enabled? → Yes → Export all rehearsals to calendar
│                  → No  → Skip
      ↓
└─ Import enabled? → Yes → Check interval setting
                          → Enough time passed? → Yes → Import calendar events
                                                → No  → Skip (too soon)
                  → No  → Skip
      ↓
User navigates to Availability screen
      ↓
useFocusEffect triggers loadAvailability()
      ↓
UI shows latest imported data
```

### Import Interval Logic

The system tracks `lastImportTime` in AsyncStorage and compares it against the selected interval:

| Setting | Interval | When to Import |
|---------|----------|----------------|
| Manual | N/A | Never (button only) |
| Hourly | 60 minutes | If last import was ≥60 min ago |
| 6 Hours | 360 minutes | If last import was ≥360 min ago |
| Daily | 1440 minutes | If last import was ≥1440 min ago |

**Example**: If user sets "Hourly" and last import was 45 minutes ago, the auto-sync will skip importing. If it was 65 minutes ago, it will import.

## Performance & System Load

### Throttling Mechanisms

1. **5-Second Throttle**: Prevents multiple sync attempts within 5 seconds
2. **Interval-Based Import**: Respects user's frequency setting (hourly/6hours/daily)
3. **On-Demand Trigger**: Syncs only when app comes to foreground, not continuously
4. **Smart Export**: Only exports if export is enabled
5. **Smart Import**: Only imports if import is enabled AND enough time has passed

### Battery Impact

- **Minimal**: No background processes or timers
- **Event-Driven**: Only triggers on app state changes
- **No Polling**: Doesn't continuously check for updates
- **OS-Managed**: Relies on AppState events managed by React Native

## User Benefits

### Before Automatic Sync
- ✗ Manual button press required for export
- ✗ Manual button press required for import
- ✗ Manual pull-to-refresh required to see updates
- ✗ Easy to forget to sync
- ✗ Out-of-sync calendar and app data

### After Automatic Sync
- ✓ Export happens automatically when creating rehearsals
- ✓ Import happens automatically based on user preference
- ✓ UI updates automatically when navigating to screens
- ✓ Always up-to-date without user action
- ✓ User control over sync frequency

## Configuration

### For Users

**Calendar Sync Settings Screen**:
1. Enable Export → Select calendar → Rehearsals auto-export on creation
2. Enable Import → Select calendars → Choose frequency (Manual/Hourly/6Hours/Daily)
3. Manual buttons still available for immediate sync

### For Developers

**Key Files**:
- `src/shared/hooks/useAutoCalendarSync.ts` - Auto-sync logic
- `src/App.tsx` - Hook integration at app level
- `src/features/profile/screens/CalendarSyncSettingsScreen.tsx` - UI for settings
- `src/features/availability/screens/AvailabilityScreen.tsx` - Auto-refresh on focus

**Settings Storage**:
- `AsyncStorage` key: `calendar-sync-settings`
- Schema: `CalendarSyncSettings` in `src/shared/types/calendar.ts`

## Testing

### Test Auto-Export
1. Enable export in Calendar Sync Settings
2. Create a new rehearsal
3. Check device calendar → Rehearsal should appear immediately

### Test Auto-Import
1. Enable import in Calendar Sync Settings
2. Select calendars
3. Choose import frequency (e.g., "Hourly")
4. Create an event in device calendar
5. Close and reopen the app (triggers foreground sync)
6. Navigate to Availability screen → Event should appear as busy time

### Test Import Intervals
1. Set import to "Hourly"
2. Trigger import (open app)
3. Immediately close and reopen app → Should skip (throttled)
4. Wait 61 minutes, then reopen app → Should import
5. Check logs for: `[AutoSync] Auto-importing calendar events`

## Logs

Auto-sync operations are logged with `[AutoSync]` prefix:

```
[AutoSync] App came to foreground
[AutoSync] Auto-exporting rehearsals to calendar
[AutoSync] Auto-export completed
[AutoSync] Auto-importing calendar events
[AutoSync] Auto-import completed: { success: 3, failed: 0, skipped: 2 }
[AutoSync] No sync needed at this time
[AutoSync] Throttled - too soon since last sync attempt
```

## Future Enhancements

Potential additions (not implemented):

1. **Background Fetch**: Use `expo-background-fetch` for true background syncs (iOS every 15+ min)
2. **Push Notifications**: Notify user when calendar changes are detected
3. **Sync on Calendar Change**: React to device calendar modifications in real-time
4. **Selective Sync**: Allow users to pick specific rehearsals/events to sync
5. **Conflict Resolution**: Smart handling when event times conflict

## Migration Notes

**Existing Users**: No migration needed. Default settings:
- `exportEnabled: false`
- `importEnabled: false`
- `importInterval: 'manual'`

Users can opt-in to automatic sync by enabling and configuring in settings.

## Troubleshooting

**Import not working automatically?**
- Check import is enabled in settings
- Verify calendars are selected
- Ensure import interval is not "Manual"
- Check last import time in settings screen
- Look for `[AutoSync]` logs when app opens

**Export not working automatically?**
- Check export is enabled in settings
- Verify a calendar is selected
- Check calendar permissions are granted
- Look for sync errors in rehearsal creation flow

**UI not updating?**
- Pull down to manually refresh
- Navigate away and back to the screen
- Check availability data is loading (look for loading spinner)

/**
 * Calendar Sync Service
 * Phase 1: Export rehearsals to device calendar
 */

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { DeviceCalendar, RehearsalWithProject } from '../types/calendar';
import {
  saveEventMapping,
  getEventMapping,
  removeEventMapping,
  updateLastExportTime,
} from '../utils/calendarStorage';

/**
 * ============================================================================
 * Permissions
 * ============================================================================
 */

/**
 * Request calendar permissions
 * Returns true if granted, false otherwise
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    console.log('[CalendarSync] Permission status:', status);
    return status === 'granted';
  } catch (error) {
    console.error('[CalendarSync] Failed to request permissions:', error);
    return false;
  }
}

/**
 * Check if calendar permissions are granted
 */
export async function checkCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[CalendarSync] Failed to check permissions:', error);
    return false;
  }
}

/**
 * ============================================================================
 * Calendar Management
 * ============================================================================
 */

/**
 * Get list of writable calendars on device
 */
export async function getDeviceCalendars(): Promise<DeviceCalendar[]> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      console.log('[CalendarSync] No calendar permission');
      return [];
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    // Filter to only writable calendars
    const writableCalendars = calendars.filter(cal => cal.allowsModifications);

    console.log(`[CalendarSync] Found ${writableCalendars.length} writable calendars`);
    return writableCalendars;
  } catch (error) {
    console.error('[CalendarSync] Failed to get calendars:', error);
    return [];
  }
}

/**
 * Get default calendar for platform
 * iOS: First writable calendar
 * Android: Primary calendar
 */
export async function getDefaultCalendar(): Promise<DeviceCalendar | null> {
  try {
    const calendars = await getDeviceCalendars();
    if (calendars.length === 0) return null;

    // Try to find primary calendar
    const primaryCalendar = calendars.find(cal => cal.isPrimary);
    if (primaryCalendar) return primaryCalendar;

    // Otherwise return first writable calendar
    return calendars[0];
  } catch (error) {
    console.error('[CalendarSync] Failed to get default calendar:', error);
    return null;
  }
}

/**
 * ============================================================================
 * Export Functions (App → Calendar)
 * ============================================================================
 */

/**
 * Create calendar event from rehearsal
 */
export async function createCalendarEvent(
  rehearsal: RehearsalWithProject,
  calendarId: string
): Promise<string | null> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    const eventDetails: Omit<Partial<Calendar.Event>, 'id' | 'organizer'> = {
      title: `Rehearsal: ${rehearsal.projectName}`,
      startDate: new Date(rehearsal.startsAt),
      endDate: new Date(rehearsal.endsAt),
      timeZone: 'default', // Use device timezone
      location: rehearsal.location || undefined,
      notes: `Project: ${rehearsal.projectName}\n\nCreated via Rehearsal Calendar app`,
      alarms: [
        {
          relativeOffset: -30, // 30 minutes before
          method: Calendar.AlarmMethod.ALERT,
        },
      ],
      availability: Calendar.Availability.BUSY,
    };

    console.log('[CalendarSync] Creating event:', eventDetails.title);
    const eventId = await Calendar.createEventAsync(calendarId, eventDetails);

    // Save mapping
    await saveEventMapping(rehearsal.id, eventId, calendarId);

    console.log(`[CalendarSync] Created event ${eventId} for rehearsal ${rehearsal.id}`);
    return eventId;
  } catch (error) {
    console.error('[CalendarSync] Failed to create event:', error);
    throw error;
  }
}

/**
 * Update existing calendar event
 */
export async function updateCalendarEvent(
  eventId: string,
  rehearsal: RehearsalWithProject
): Promise<void> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    const eventDetails: Partial<Calendar.Event> = {
      title: `Rehearsal: ${rehearsal.projectName}`,
      startDate: new Date(rehearsal.startsAt),
      endDate: new Date(rehearsal.endsAt),
      location: rehearsal.location || undefined,
      notes: `Project: ${rehearsal.projectName}\n\nCreated via Rehearsal Calendar app`,
    };

    console.log('[CalendarSync] Updating event:', eventId);
    await Calendar.updateEventAsync(eventId, eventDetails);

    console.log(`[CalendarSync] Updated event ${eventId}`);
  } catch (error) {
    console.error('[CalendarSync] Failed to update event:', error);
    throw error;
  }
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    console.log('[CalendarSync] Deleting event:', eventId);
    await Calendar.deleteEventAsync(eventId);

    console.log(`[CalendarSync] Deleted event ${eventId}`);
  } catch (error) {
    console.error('[CalendarSync] Failed to delete event:', error);
    throw error;
  }
}

/**
 * Smart sync: Create or update calendar event for rehearsal
 * If rehearsal is already synced, update the event
 * Otherwise, create new event
 */
export async function syncRehearsalToCalendar(
  rehearsal: RehearsalWithProject,
  calendarId: string
): Promise<void> {
  try {
    // Check if already synced
    const mapping = await getEventMapping(rehearsal.id);

    if (mapping) {
      // Update existing event
      console.log(`[CalendarSync] Rehearsal ${rehearsal.id} already synced, updating...`);
      await updateCalendarEvent(mapping.eventId, rehearsal);
      // Update lastSynced timestamp
      await saveEventMapping(rehearsal.id, mapping.eventId, mapping.calendarId);
    } else {
      // Create new event
      console.log(`[CalendarSync] Rehearsal ${rehearsal.id} not synced, creating...`);
      await createCalendarEvent(rehearsal, calendarId);
    }

    await updateLastExportTime();
  } catch (error) {
    console.error('[CalendarSync] Failed to sync rehearsal:', error);
    throw error;
  }
}

/**
 * Unsync rehearsal (remove from calendar)
 */
export async function unsyncRehearsal(rehearsalId: string): Promise<void> {
  try {
    const mapping = await getEventMapping(rehearsalId);
    if (!mapping) {
      console.log(`[CalendarSync] Rehearsal ${rehearsalId} not synced, nothing to do`);
      return;
    }

    // Delete calendar event
    await deleteCalendarEvent(mapping.eventId);

    // Remove mapping
    await removeEventMapping(rehearsalId);

    console.log(`[CalendarSync] Unsynced rehearsal ${rehearsalId}`);
  } catch (error) {
    console.error('[CalendarSync] Failed to unsync rehearsal:', error);
    throw error;
  }
}

/**
 * Export all rehearsals to calendar
 * Returns: { success: number, failed: number, errors: string[] }
 */
export interface BatchSyncResult {
  success: number;
  failed: number;
  errors: string[];
}

export async function syncAllRehearsals(
  rehearsals: RehearsalWithProject[],
  calendarId: string,
  onProgress?: (current: number, total: number) => void
): Promise<BatchSyncResult> {
  const result: BatchSyncResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  const total = rehearsals.length;

  for (let i = 0; i < rehearsals.length; i++) {
    const rehearsal = rehearsals[i];

    try {
      await syncRehearsalToCalendar(rehearsal, calendarId);
      result.success++;
    } catch (error: any) {
      result.failed++;
      result.errors.push(`${rehearsal.projectName}: ${error.message}`);
      console.error(`[CalendarSync] Failed to sync rehearsal ${rehearsal.id}:`, error);
    }

    // Report progress
    if (onProgress) {
      onProgress(i + 1, total);
    }

    // Small delay to avoid overwhelming the system
    if (i < rehearsals.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  await updateLastExportTime();

  console.log(`[CalendarSync] Batch sync complete: ${result.success} success, ${result.failed} failed`);
  return result;
}

/**
 * Remove all exported events from calendar
 */
export async function removeAllExportedEvents(
  onProgress?: (current: number, total: number) => void
): Promise<BatchSyncResult> {
  try {
    const { getAllMappings, clearAllMappings } = await import('../utils/calendarStorage');
    const mappings = await getAllMappings();
    const rehearsalIds = Object.keys(mappings);

    const result: BatchSyncResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    const total = rehearsalIds.length;

    for (let i = 0; i < rehearsalIds.length; i++) {
      const rehearsalId = rehearsalIds[i];
      const mapping = mappings[rehearsalId];

      try {
        await deleteCalendarEvent(mapping.eventId);
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push(`Event ${mapping.eventId}: ${error.message}`);
        console.error(`[CalendarSync] Failed to delete event ${mapping.eventId}:`, error);
      }

      // Report progress
      if (onProgress) {
        onProgress(i + 1, total);
      }

      // Small delay
      if (i < rehearsalIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Clear all mappings after deletion
    await clearAllMappings();

    console.log(`[CalendarSync] Remove all complete: ${result.success} success, ${result.failed} failed`);
    return result;
  } catch (error) {
    console.error('[CalendarSync] Failed to remove all events:', error);
    throw error;
  }
}

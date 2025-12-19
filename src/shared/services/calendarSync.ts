/**
 * Calendar Sync Service
 * Phase 1: Export rehearsals to device calendar
 * Phase 2: Import calendar events to availability
 */

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import {
  DeviceCalendar,
  RehearsalWithProject,
  ImportResult,
  AvailabilitySlot,
} from '../types/calendar';
import {
  saveEventMapping,
  getEventMapping,
  removeEventMapping,
  updateLastExportTime,
  saveImportedEvent,
  getImportedEvents,
  getImportedEvent,
  removeImportedEvent,
  clearAllImportedEvents,
  updateLastImportTime,
} from '../utils/calendarStorage';
import { availabilityAPI } from './api';

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

/**
 * ============================================================================
 * Import Functions (Calendar → App)
 * Phase 2: Import calendar events as availability slots
 * ============================================================================
 */

/**
 * Get calendar events from selected calendars
 * Date range: -30 days to +365 days (to avoid performance issues)
 */
export async function getCalendarEvents(
  calendarIds: string[],
  startDate: Date,
  endDate: Date
): Promise<Calendar.Event[]> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    let allEvents: Calendar.Event[] = [];

    for (const calendarId of calendarIds) {
      try {
        const events = await Calendar.getEventsAsync(
          [calendarId],
          startDate,
          endDate
        );
        allEvents = allEvents.concat(events);
        console.log(`[CalendarSync] Fetched ${events.length} events from calendar ${calendarId}`);
      } catch (error) {
        console.error(`[CalendarSync] Failed to fetch events from calendar ${calendarId}:`, error);
        // Continue with other calendars
      }
    }

    console.log(`[CalendarSync] Total events fetched: ${allEvents.length}`);
    return allEvents;
  } catch (error) {
    console.error('[CalendarSync] Failed to get calendar events:', error);
    throw error;
  }
}

/**
 * Import calendar events as availability slots
 * Returns: { success, failed, skipped, errors }
 */
export async function importCalendarEventsToAvailability(
  calendarIds: string[],
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Define date range: -30 days to +365 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 365);

    // Fetch all events from selected calendars
    const events = await getCalendarEvents(calendarIds, startDate, endDate);
    const total = events.length;

    if (total === 0) {
      console.log('[CalendarSync] No events to import');
      return result;
    }

    // Get previously imported events
    const importedEvents = await getImportedEvents();

    // Convert events to availability slots
    const slotsToImport: (AvailabilitySlot & { eventId: string; calendarId: string })[] = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Report progress
      if (onProgress) {
        onProgress(i + 1, total);
      }

      // Skip if already imported and not changed
      if (event.id in importedEvents) {
        console.log(`[CalendarSync] Skipping already imported event: ${event.id}`);
        result.skipped++;
        continue;
      }

      // Convert calendar event to availability slot
      try {
        const slot: AvailabilitySlot & { eventId: string; calendarId: string } = {
          startsAt: event.startDate.toISOString(),
          endsAt: event.endDate.toISOString(),
          type: 'busy',
          source: Platform.OS === 'ios' ? 'apple_calendar' : 'google_calendar',
          external_event_id: event.id,
          title: event.title || 'Calendar Event',
          is_all_day: event.allDay || false,
          eventId: event.id,
          calendarId: event.calendarId,
        };

        slotsToImport.push(slot);
      } catch (error: any) {
        console.error(`[CalendarSync] Failed to convert event ${event.id}:`, error);
        result.failed++;
        result.errors.push(`${event.title}: ${error.message}`);
      }
    }

    // Batch import slots (chunks of 50)
    const chunkSize = 50;
    for (let i = 0; i < slotsToImport.length; i += chunkSize) {
      const chunk = slotsToImport.slice(i, i + chunkSize);

      try {
        // Prepare entries for API
        const entries = chunk.map(slot => ({
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          type: slot.type,
          isAllDay: slot.is_all_day,
          // Additional fields that backend should support
          source: slot.source,
          external_event_id: slot.external_event_id,
          title: slot.title,
        }));

        // Call API to create availability slots
        const response = await availabilityAPI.bulkSet(entries as any);

        // Save import tracking for each event
        // Note: API should return created slot IDs, but if not available, use event ID
        for (const slot of chunk) {
          await saveImportedEvent(
            slot.eventId,
            slot.eventId, // Using event ID as slot ID for now
            slot.calendarId
          );
        }

        result.success += chunk.length;
        console.log(`[CalendarSync] Imported ${chunk.length} events (chunk ${Math.floor(i / chunkSize) + 1})`);
      } catch (error: any) {
        console.error(`[CalendarSync] Failed to import chunk:`, error);
        result.failed += chunk.length;
        result.errors.push(`Batch ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
      }

      // Small delay between batches
      if (i + chunkSize < slotsToImport.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Update last import time
    await updateLastImportTime();

    console.log(`[CalendarSync] Import complete: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`);
    return result;
  } catch (error: any) {
    console.error('[CalendarSync] Failed to import calendar events:', error);
    result.errors.push(error.message);
    throw error;
  }
}

/**
 * Remove all imported availability slots
 */
export async function removeAllImportedSlots(
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const importedEvents = await getImportedEvents();
    const eventIds = Object.keys(importedEvents);
    const total = eventIds.length;

    if (total === 0) {
      console.log('[CalendarSync] No imported events to remove');
      return result;
    }

    // Note: We would need an API endpoint to delete availability slots by source
    // For now, we'll just clear the tracking
    // TODO: Add API endpoint to delete availability slots where source = 'google_calendar' | 'apple_calendar'

    console.warn('[CalendarSync] removeAllImportedSlots: API endpoint not implemented yet');
    console.warn('[CalendarSync] Only clearing import tracking, slots remain in database');

    // Clear all import tracking
    await clearAllImportedEvents();

    result.success = total;
    console.log(`[CalendarSync] Cleared ${total} import tracking entries`);
    return result;
  } catch (error: any) {
    console.error('[CalendarSync] Failed to remove imported slots:', error);
    result.errors.push(error.message);
    throw error;
  }
}

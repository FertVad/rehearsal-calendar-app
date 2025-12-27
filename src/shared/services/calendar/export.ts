/**
 * Calendar Export Module
 * Handles exporting rehearsals to device calendar
 */

import * as Calendar from 'expo-calendar';
import { RehearsalWithProject, BatchSyncResult } from '../../types/calendar';
import { checkCalendarPermissions } from './permissions';
import {
  saveEventMapping,
  getEventMapping,
  removeEventMapping,
  getAllMappings,
  clearAllMappings,
} from '../../utils/calendarMappings';
import { updateLastExportTime } from '../../utils/calendarStorage';
import { logger } from '../../utils/logger';

/**
 * Check if event exists in calendar
 */
async function checkEventExists(eventId: string): Promise<boolean> {
  try {
    const event = await Calendar.getEventAsync(eventId);
    return event !== null && event !== undefined;
  } catch (error) {
    // Event doesn't exist or permission denied
    return false;
  }
}

/**
 * Find duplicate event in calendar by matching properties
 */
async function findDuplicateEvent(
  rehearsal: RehearsalWithProject,
  calendarId: string,
  startDate: Date,
  endDate: Date
): Promise<string | null> {
  try {
    // Search in a narrow time window (±1 day) for performance
    const searchStart = new Date(startDate);
    searchStart.setDate(searchStart.getDate() - 1);
    const searchEnd = new Date(endDate);
    searchEnd.setDate(searchEnd.getDate() + 1);

    const events = await Calendar.getEventsAsync([calendarId], searchStart, searchEnd);

    // Find event with matching properties
    const duplicateEvent = events.find(event => {
      const titleMatch = event.title === `Rehearsal: ${rehearsal.projectName}`;
      const startMatch = Math.abs(new Date(event.startDate).getTime() - startDate.getTime()) < 60000; // Within 1 minute
      const endMatch = Math.abs(new Date(event.endDate).getTime() - endDate.getTime()) < 60000;
      const locationMatch = event.location === (rehearsal.location || undefined);

      return titleMatch && startMatch && endMatch && locationMatch;
    });

    if (duplicateEvent) {
      logger.warn(`[CalendarSync] Found duplicate event: ${duplicateEvent.id}`);
      return duplicateEvent.id;
    }

    return null;
  } catch (error) {
    logger.error('[CalendarSync] Error searching for duplicates:', error);
    return null;
  }
}

/**
 * Create calendar event from rehearsal
 * Includes duplicate detection to prevent multiple events for same rehearsal
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

    const startDate = new Date(rehearsal.startsAt);
    const endDate = new Date(rehearsal.endsAt);

    // Check for duplicate events (prevents creating duplicates after AsyncStorage loss)
    const duplicateEventId = await findDuplicateEvent(rehearsal, calendarId, startDate, endDate);
    if (duplicateEventId) {
      logger.info(`[CalendarSync] Using existing event ${duplicateEventId} instead of creating duplicate`);
      // Save mapping to existing event
      await saveEventMapping(rehearsal.id, duplicateEventId, calendarId);
      return duplicateEventId;
    }

    const eventDetails: Omit<Partial<Calendar.Event>, 'id' | 'organizer'> = {
      title: `Rehearsal: ${rehearsal.projectName}`,
      startDate,
      endDate,
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

    logger.info('[CalendarSync] Creating event:', eventDetails.title);
    const eventId = await Calendar.createEventAsync(calendarId, eventDetails);

    // Save mapping to database + AsyncStorage
    await saveEventMapping(rehearsal.id, eventId, calendarId);

    logger.info(`[CalendarSync] Created event ${eventId} for rehearsal ${rehearsal.id}`);
    return eventId;
  } catch (error) {
    logger.error('[CalendarSync] Failed to create event:', error);
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

    logger.info('[CalendarSync] Updating event:', eventId);
    await Calendar.updateEventAsync(eventId, eventDetails);

    logger.info(`[CalendarSync] Updated event ${eventId}`);
  } catch (error) {
    logger.error('[CalendarSync] Failed to update event:', error);
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

    logger.info('[CalendarSync] Deleting event:', eventId);
    await Calendar.deleteEventAsync(eventId);

    logger.info(`[CalendarSync] Deleted event ${eventId}`);
  } catch (error) {
    logger.error('[CalendarSync] Failed to delete event:', error);
    throw error;
  }
}

/**
 * Smart sync: Create or update calendar event for rehearsal
 * If rehearsal is already synced, update the event
 * Otherwise, create new event
 * Includes recovery logic for deleted events
 */
export async function syncRehearsalToCalendar(
  rehearsal: RehearsalWithProject,
  calendarId: string
): Promise<void> {
  try {
    // Check if already synced
    const mapping = await getEventMapping(rehearsal.id);

    if (mapping) {
      // Check if event still exists in calendar
      const eventExists = await checkEventExists(mapping.eventId);

      if (eventExists) {
        // Update existing event
        logger.info(`[CalendarSync] Rehearsal ${rehearsal.id} already synced, updating...`);
        try {
          await updateCalendarEvent(mapping.eventId, rehearsal);
          // Update lastSynced timestamp
          await saveEventMapping(rehearsal.id, mapping.eventId, mapping.calendarId);
        } catch (error) {
          // Update failed, event might be deleted - recreate
          logger.warn(`[CalendarSync] Update failed for event ${mapping.eventId}, recreating...`);
          await removeEventMapping(rehearsal.id);
          await createCalendarEvent(rehearsal, calendarId);
        }
      } else {
        // Event was deleted from calendar - recreate and update mapping
        logger.warn(`[CalendarSync] Event ${mapping.eventId} no longer exists, recreating...`);
        await removeEventMapping(rehearsal.id);
        await createCalendarEvent(rehearsal, calendarId);
      }
    } else {
      // Create new event
      logger.info(`[CalendarSync] Rehearsal ${rehearsal.id} not synced, creating...`);
      await createCalendarEvent(rehearsal, calendarId);
    }

    await updateLastExportTime();
  } catch (error) {
    logger.error('[CalendarSync] Failed to sync rehearsal:', error);
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
      logger.info(`[CalendarSync] Rehearsal ${rehearsalId} not synced, nothing to do`);
      return;
    }

    // Delete calendar event
    await deleteCalendarEvent(mapping.eventId);

    // Remove mapping
    await removeEventMapping(rehearsalId);

    logger.info(`[CalendarSync] Unsynced rehearsal ${rehearsalId}`);
  } catch (error) {
    logger.error('[CalendarSync] Failed to unsync rehearsal:', error);
    throw error;
  }
}

/**
 * Export all rehearsals to calendar
 * Returns: { success: number, failed: number, errors: string[] }
 */
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
  const BATCH_SIZE = 10; // Process 10 rehearsals in parallel

  // Process in batches for better performance
  for (let i = 0; i < rehearsals.length; i += BATCH_SIZE) {
    const batch = rehearsals.slice(i, i + BATCH_SIZE);

    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map(rehearsal => syncRehearsalToCalendar(rehearsal, calendarId))
    );

    // Collect results
    results.forEach((res, idx) => {
      const rehearsal = batch[idx];
      if (res.status === 'fulfilled') {
        result.success++;
      } else {
        result.failed++;
        result.errors.push(`${rehearsal.projectName}: ${res.reason?.message || 'Unknown error'}`);
        logger.error(`[CalendarSync] Failed to sync rehearsal ${rehearsal.id}:`, res.reason);
      }
    });

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + batch.length, total), total);
    }
  }

  await updateLastExportTime();

  logger.info(`[CalendarSync] Batch sync complete: ${result.success} success, ${result.failed} failed`);
  return result;
}

/**
 * Remove all exported events from calendar
 * Uses database mappings as source of truth
 */
export async function removeAllExportedEvents(
  onProgress?: (current: number, total: number) => void
): Promise<BatchSyncResult> {
  try {
    // Get mappings from database (primary) or AsyncStorage (fallback)
    const mappings = await getAllMappings();
    const rehearsalIds = Object.keys(mappings);

    const result: BatchSyncResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    const total = rehearsalIds.length;
    const BATCH_SIZE = 10; // Delete 10 events in parallel

    logger.info(`[CalendarSync] Removing ${total} exported events...`);

    // Process in batches for better performance
    for (let i = 0; i < rehearsalIds.length; i += BATCH_SIZE) {
      const batchIds = rehearsalIds.slice(i, i + BATCH_SIZE);

      // Delete batch in parallel
      const results = await Promise.allSettled(
        batchIds.map(async rehearsalId => {
          const eventId = mappings[rehearsalId].eventId;
          // Try to delete event from calendar
          await deleteCalendarEvent(eventId);
          // Remove mapping from DB + AsyncStorage
          await removeEventMapping(rehearsalId);
        })
      );

      // Collect results
      results.forEach((res, idx) => {
        const rehearsalId = batchIds[idx];
        const mapping = mappings[rehearsalId];
        if (res.status === 'fulfilled') {
          result.success++;
        } else {
          result.failed++;
          result.errors.push(`Event ${mapping.eventId}: ${res.reason?.message || 'Unknown error'}`);
          logger.error(`[CalendarSync] Failed to delete event ${mapping.eventId}:`, res.reason);
        }
      });

      // Report progress
      if (onProgress) {
        onProgress(Math.min(i + batchIds.length, total), total);
      }
    }

    // Clear all remaining mappings (in case some deletions failed)
    await clearAllMappings();

    logger.info(`[CalendarSync] Remove all complete: ${result.success} success, ${result.failed} failed`);
    return result;
  } catch (error) {
    logger.error('[CalendarSync] Failed to remove all events:', error);
    throw error;
  }
}

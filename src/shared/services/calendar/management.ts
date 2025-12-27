/**
 * Calendar Management Module
 * Handles getting list of calendars and selecting default calendar
 */

import * as Calendar from 'expo-calendar';
import { DeviceCalendar } from '../../types/calendar';
import { checkCalendarPermissions } from './permissions';
import { logger } from '../../utils/logger';

/**
 * Get list of writable calendars on device
 */
export async function getDeviceCalendars(): Promise<DeviceCalendar[]> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      logger.info('[CalendarSync] No calendar permission');
      return [];
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    // Filter to only writable calendars
    const writableCalendars = calendars.filter(cal => cal.allowsModifications);

    logger.info(`[CalendarSync] Found ${writableCalendars.length} writable calendars`);
    return writableCalendars;
  } catch (error) {
    logger.error('[CalendarSync] Failed to get calendars:', error);
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
    logger.error('[CalendarSync] Failed to get default calendar:', error);
    return null;
  }
}

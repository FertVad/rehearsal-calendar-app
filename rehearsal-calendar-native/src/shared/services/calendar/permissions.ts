/**
 * Calendar Permissions Module
 * Handles requesting and checking calendar permissions
 */

import * as Calendar from 'expo-calendar';
import { logger } from '../../utils/logger';

/**
 * Request calendar permissions
 * Returns true if granted, false otherwise
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    logger.info('[CalendarSync] Permission status:', status);
    return status === 'granted';
  } catch (error) {
    logger.error('[CalendarSync] Failed to request permissions:', error);
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
    logger.error('[CalendarSync] Failed to check permissions:', error);
    return false;
  }
}

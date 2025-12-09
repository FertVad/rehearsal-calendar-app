/**
 * Timezone conversion middleware for rehearsal API
 * Provides helper functions to convert between UTC (database) and user timezones (client)
 */

import { localToUTC, utcToLocal } from '../utils/timezone.js';

/**
 * Convert rehearsal request from client timezone to UTC for database
 * @param {Object} rehearsalData - Rehearsal data from client
 * @param {string} rehearsalData.date - Date in YYYY-MM-DD format (local)
 * @param {string} rehearsalData.startTime - Time in HH:mm format (local)
 * @param {string} rehearsalData.endTime - Time in HH:mm format (local)
 * @param {string} rehearsalData.timezone - IANA timezone (e.g., 'Europe/Moscow')
 * @returns {{date: string, startTime: string, endTime: string, startUTC: {date: string, time: string}, endUTC: {date: string, time: string}}} - Original local times + UTC times for DB
 */
export function convertRehearsalRequest(rehearsalData) {
  const { date, startTime, endTime, timezone } = rehearsalData;

  // Convert local times to UTC
  const startUTC = localToUTC(date, startTime, timezone);
  const endUTC = localToUTC(date, endTime, timezone);

  return {
    // Keep original local times for logging/display
    date,
    startTime,
    endTime,
    // UTC times for database storage
    startUTC,
    endUTC,
  };
}

/**
 * Convert rehearsal response from UTC (database) to client timezone
 * @param {Object} rehearsal - Rehearsal data from database
 * @param {string} rehearsal.date - Date in YYYY-MM-DD format (UTC)
 * @param {string} rehearsal.start_time - Time in HH:mm format (UTC)
 * @param {string} rehearsal.end_time - Time in HH:mm format (UTC)
 * @param {string} timezone - IANA timezone for conversion
 * @returns {Object} - Rehearsal with local date/time fields added
 */
export function convertRehearsalResponse(rehearsal, timezone) {
  const { date, start_time, end_time } = rehearsal;

  // Convert UTC to local timezone
  const startLocal = utcToLocal(date, start_time, timezone);
  const endLocal = utcToLocal(date, end_time, timezone);

  return {
    ...rehearsal,
    // Add local time fields for client
    localDate: startLocal.date,
    localStartTime: startLocal.time,
    localEndTime: endLocal.time,
  };
}

/**
 * Convert array of rehearsals from UTC to client timezone
 * @param {Array<Object>} rehearsals - Array of rehearsal objects from database
 * @param {string} timezone - IANA timezone for conversion
 * @returns {Array<Object>} - Rehearsals with local time fields
 */
export function convertRehearsalsResponse(rehearsals, timezone) {
  return rehearsals.map(rehearsal => convertRehearsalResponse(rehearsal, timezone));
}

/**
 * Validate timezone string
 * @param {string} timezone - IANA timezone to validate
 * @returns {boolean} - True if valid timezone
 */
export function isValidTimezone(timezone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch (e) {
    return false;
  }
}

export default {
  convertRehearsalRequest,
  convertRehearsalResponse,
  convertRehearsalsResponse,
  isValidTimezone,
};

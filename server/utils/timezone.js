/**
 * Server-side timezone conversion utilities
 */

/**
 * @typedef {Object} DateTimeResult
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {string} time - Time in HH:mm format
 */

/**
 * @typedef {Object} AvailabilitySlot
 * @property {string} start - Start time in HH:mm format
 * @property {string} end - End time in HH:mm format
 * @property {boolean} [isAllDay] - Whether this is an all-day slot
 * @property {string} [title] - Optional title for the slot
 * @property {string} [notes] - Optional notes for the slot
 */

/**
 * @typedef {Object} DBAvailabilitySlot
 * @property {string} start_time - Start time in HH:mm format (UTC)
 * @property {string} end_time - End time in HH:mm format (UTC)
 * @property {boolean} is_all_day - Whether this is an all-day slot
 * @property {string} type - Slot type ('free', 'busy', 'tentative')
 * @property {string} [title] - Optional title for the slot
 * @property {string} [notes] - Optional notes for the slot
 */

// =============================================================================
// TIMESTAMPTZ UTILITIES
// =============================================================================

/**
 * Convert ISO 8601 timestamp to local date/time components in user's timezone
 * @param {string} isoTimestamp - ISO 8601 timestamp string (e.g., "2025-12-10T19:00:00+02:00")
 * @param {string} timezone - IANA timezone (e.g., 'Asia/Jerusalem')
 * @returns {DateTimeResult} - Date and time in local timezone
 *
 * @example
 * timestampToLocal("2025-12-10T19:00:00+02:00", "Asia/Jerusalem")
 * // Returns: { date: "2025-12-10", time: "19:00" }
 */
export function timestampToLocal(isoTimestamp, timezone) {
  const date = new Date(isoTimestamp);

  // Format in target timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const dateParts = {};
  for (const part of parts) {
    dateParts[part.type] = part.value;
  }

  // Fix hour=24 edge case (midnight can be formatted as 24:00 instead of 00:00)
  let hour = dateParts.hour;
  if (hour === '24') {
    hour = '00';
  }

  return {
    date: `${dateParts.year}-${dateParts.month}-${dateParts.day}`,
    time: `${hour}:${dateParts.minute}`,
  };
}

/**
 * Convert local date/time in user's timezone to ISO 8601 TIMESTAMPTZ string
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:mm format
 * @param {string} timezone - IANA timezone (e.g., 'Asia/Jerusalem')
 * @returns {string} - ISO 8601 timestamp in UTC (Z format)
 *
 * @example
 * localToTimestamp("2025-12-10", "19:00", "Asia/Jerusalem")
 * // Returns: "2025-12-10T17:00:00.000Z" (19:00 Jerusalem = 17:00 UTC)
 */
export function localToTimestamp(date, time, timezone) {
  // Parse date and time
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  // Create date string for the target timezone
  const dateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

  // Use Intl.DateTimeFormat to interpret this time in the target timezone
  // and convert to UTC
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Create a UTC date and adjust for timezone
  const testDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));

  // Format in target timezone to see what time it shows
  const formatted = formatter.format(testDate);
  const parts = formatted.match(/(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/);

  if (!parts) {
    throw new Error('Failed to parse formatted date');
  }

  const gotMonth = parseInt(parts[1]);
  const gotDay = parseInt(parts[2]);
  const gotYear = parseInt(parts[3]);
  const gotHour = parseInt(parts[4]);
  const gotMinute = parseInt(parts[5]);

  // Calculate the difference between what we want and what we got
  const wantedMs = Date.UTC(year, month - 1, day, hours, minutes);
  const gotMs = Date.UTC(gotYear, gotMonth - 1, gotDay, gotHour, gotMinute);
  const offsetMs = wantedMs - gotMs;

  // Apply offset to get correct UTC time
  const utcMs = testDate.getTime() + offsetMs;
  const correctDate = new Date(utcMs);

  // Return ISO string in UTC (Z format) - PostgreSQL handles this correctly
  return correctDate.toISOString();
}

/**
 * Convert TIMESTAMPTZ from database to ISO 8601 string
 * PostgreSQL TIMESTAMPTZ is returned as JS Date object by node-postgres
 * @param {Date} timestamp - Date object from PostgreSQL TIMESTAMPTZ column
 * @returns {string} - ISO 8601 timestamp string
 *
 * @example
 * timestampToISO(new Date("2025-12-10T17:00:00.000Z"))
 * // Returns: "2025-12-10T17:00:00.000Z"
 */
export function timestampToISO(timestamp) {
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return new Date(timestamp).toISOString();
}

/**
 * Convert availability slots with TIMESTAMPTZ to API response format
 * @param {Array} slots - Array of availability slots from database with starts_at/ends_at
 * @param {string} timezone - IANA timezone for the user
 * @returns {Array} - Slots formatted for API response
 *
 * @example
 * formatAvailabilitySlotsResponse([
 *   { starts_at: new Date(...), ends_at: new Date(...), is_all_day: false }
 * ], "Asia/Jerusalem")
 */
export function formatAvailabilitySlotsResponse(slots, timezone) {
  return slots.map(slot => {
    return {
      startsAt: timestampToISO(slot.starts_at),
      endsAt: timestampToISO(slot.ends_at),
      isAllDay: slot.is_all_day,
      type: slot.type,
      title: slot.title,
      notes: slot.notes,
    };
  });
}

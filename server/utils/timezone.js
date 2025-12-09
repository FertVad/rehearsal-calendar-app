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

/**
 * Convert local time in user's timezone to UTC
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:mm format
 * @param {string} timezone - IANA timezone (e.g., 'Europe/Moscow')
 * @returns {DateTimeResult} - Date and time in UTC
 */
export function localToUTC(date, time, timezone) {
  // Parse date and time
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  // Create a date/time string in ISO format for the target timezone
  const dateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

  // Create a formatter that will parse this as being in the target timezone
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

  // Parse the local time in the target timezone and get UTC timestamp
  // We create a date object and format it back in the target timezone to ensure correct parsing
  const parts = dateTimeStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  const localYear = parseInt(parts[1]);
  const localMonth = parseInt(parts[2]);
  const localDay = parseInt(parts[3]);
  const localHour = parseInt(parts[4]);
  const localMinute = parseInt(parts[5]);

  // Create a Date object that represents this time in the target timezone
  // We do this by creating the date in UTC and then adjusting for the timezone offset
  const testDate = new Date(Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute));

  // Get the formatter to tell us what this UTC time looks like in the target timezone
  const formatted = formatter.format(testDate);
  const formattedParts = formatted.match(/(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/);

  // Calculate the difference between what we want and what we got
  const gotMonth = parseInt(formattedParts[1]);
  const gotDay = parseInt(formattedParts[2]);
  const gotYear = parseInt(formattedParts[3]);
  const gotHour = parseInt(formattedParts[4]);
  const gotMinute = parseInt(formattedParts[5]);

  // Calculate offset in minutes
  const wantedMs = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute);
  const gotMs = Date.UTC(gotYear, gotMonth - 1, gotDay, gotHour, gotMinute);
  const offsetMs = wantedMs - gotMs;

  // Apply the offset to get the correct UTC time
  const utcMs = testDate.getTime() + offsetMs;
  const utcDate = new Date(utcMs);

  return {
    date: formatDate(utcDate),
    time: formatTime(utcDate),
  };
}

/**
 * Convert UTC time to user's local timezone
 * @param {string} date - Date in YYYY-MM-DD format (UTC)
 * @param {string} time - Time in HH:mm format (UTC)
 * @param {string} timezone - IANA timezone
 * @returns {DateTimeResult} - Date and time in local timezone
 */
export function utcToLocal(date, time, timezone) {
  // Parse UTC date and time
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  // Create UTC date
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));

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

  const parts = formatter.formatToParts(utcDate);
  const dateParts = {};
  for (const part of parts) {
    dateParts[part.type] = part.value;
  }

  return {
    date: `${dateParts.year}-${dateParts.month}-${dateParts.day}`,
    time: `${dateParts.hour}:${dateParts.minute}`,
  };
}

/**
 * Convert availability slots from user timezone to UTC
 * @param {string} date - Date in YYYY-MM-DD format (local timezone)
 * @param {AvailabilitySlot[]} slots - Array of availability slots in local timezone
 * @param {string} timezone - IANA timezone
 * @returns {Array<Object>} - Slots converted to UTC with DB fields
 */
export function convertSlotsToUTC(date, slots, timezone) {
  if (!timezone || timezone === 'UTC') {
    return slots.map(slot => ({
      ...slot,
      date,
      startTime: slot.start,
      endTime: slot.end,
    }));
  }

  return slots.map(slot => {
    // Special case: all-day slots should NOT be timezone converted
    // They represent the entire local day, regardless of timezone
    if (slot.isAllDay) {
      return {
        date,
        startTime: '00:00',
        endTime: '23:59',
        isAllDay: true,
        title: slot.title,
        notes: slot.notes,
      };
    }

    const startUTC = localToUTC(date, slot.start, timezone);
    const endUTC = localToUTC(date, slot.end, timezone);

    return {
      date: startUTC.date,
      startTime: startUTC.time,
      endTime: endUTC.time,
      endDate: endUTC.date !== startUTC.date ? endUTC.date : undefined,
      isAllDay: false,
      title: slot.title,
      notes: slot.notes,
    };
  });
}

/**
 * Convert availability slots from UTC to user timezone
 * @param {string} date - Date in YYYY-MM-DD format (local timezone reference)
 * @param {DBAvailabilitySlot[]} slots - Array of availability slots from database (UTC)
 * @param {string} timezone - IANA timezone
 * @returns {AvailabilitySlot[]} - Slots converted to local timezone
 */
export function convertSlotsFromUTC(date, slots, timezone) {
  if (!timezone || timezone === 'UTC') {
    return slots.map(slot => ({
      date,
      start: slot.start_time,
      end: slot.end_time,
      type: slot.type,
      title: slot.title,
      notes: slot.notes,
    }));
  }

  return slots.map(slot => {
    // Special case: all-day slots should NOT be timezone converted
    // They represent the entire local day, regardless of timezone
    if (slot.is_all_day) {
      return {
        start: '00:00',
        end: '23:59',
        type: slot.type,
        title: slot.title,
        notes: slot.notes,
      };
    }

    const startLocal = utcToLocal(date, slot.start_time, timezone);
    const endLocal = utcToLocal(date, slot.end_time, timezone);

    return {
      start: startLocal.time,
      end: endLocal.time,
      type: slot.type,
      title: slot.title,
      notes: slot.notes,
    };
  });
}

/**
 * Format Date object as YYYY-MM-DD string in UTC
 * @param {Date} date - Date object to format
 * @returns {string} - Formatted date string
 * @private
 */
function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format Date object as HH:mm string in UTC
 * @param {Date} date - Date object to format
 * @returns {string} - Formatted time string
 * @private
 */
function formatTime(date) {
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default {
  localToUTC,
  utcToLocal,
  convertSlotsToUTC,
  convertSlotsFromUTC,
};

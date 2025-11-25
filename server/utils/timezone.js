/**
 * Server-side timezone conversion utilities
 */

/**
 * Convert local time in user's timezone to UTC
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:mm format
 * @param {string} timezone - IANA timezone (e.g., 'Europe/Moscow')
 * @returns {{ date: string, time: string }} - Date and time in UTC
 */
export function localToUTC(date, time, timezone) {
  // Parse date and time
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  // Create date string that JS can parse with timezone
  const localDateStr = `${date}T${time}:00`;

  // Get UTC equivalent by using Intl
  const localDate = new Date(localDateStr);

  // Get timezone offset
  const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = tzDate.getTime() - utcDate.getTime();

  // Convert to UTC
  const utcTime = new Date(localDate.getTime() - offsetMs);

  return {
    date: formatDate(utcTime),
    time: formatTime(utcTime),
  };
}

/**
 * Convert UTC time to user's local timezone
 * @param {string} date - Date in YYYY-MM-DD format (UTC)
 * @param {string} time - Time in HH:mm format (UTC)
 * @param {string} timezone - IANA timezone
 * @returns {{ date: string, time: string }} - Date and time in local timezone
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
    const startUTC = localToUTC(date, slot.start, timezone);
    const endUTC = localToUTC(date, slot.end, timezone);

    return {
      date: startUTC.date,
      startTime: startUTC.time,
      endTime: endUTC.time,
      endDate: endUTC.date !== startUTC.date ? endUTC.date : undefined,
      title: slot.title,
      notes: slot.notes,
    };
  });
}

/**
 * Convert availability slots from UTC to user timezone
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
    const startLocal = utcToLocal(date, slot.start_time, timezone);
    const endLocal = utcToLocal(date, slot.end_time, timezone);

    return {
      date: startLocal.date,
      start: startLocal.time,
      end: endLocal.time,
      type: slot.type,
      title: slot.title,
      notes: slot.notes,
    };
  });
}

// Helper functions
function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

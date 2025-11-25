/**
 * Timezone conversion utilities
 * Uses Intl API for timezone-aware date/time handling
 */

/**
 * Get timezone offset in minutes for a specific timezone on a given date
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
  // Get UTC offset by comparing timestamps
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
}

/**
 * Convert a local time string (HH:mm) in a specific timezone to UTC
 * Returns { date: 'YYYY-MM-DD', time: 'HH:mm' } in UTC
 */
export function localTimeToUTC(
  localDate: string, // YYYY-MM-DD
  localTime: string, // HH:mm
  timezone: string
): { date: string; time: string } {
  // Parse the local date and time
  const [year, month, day] = localDate.split('-').map(Number);
  const [hours, minutes] = localTime.split(':').map(Number);

  // Create a date string that represents the local time
  // We use toLocaleString to get the UTC equivalent
  const localDateObj = new Date(year, month - 1, day, hours, minutes);

  // Get the offset for this timezone
  const offsetMinutes = getTimezoneOffset(timezone, localDateObj);

  // Subtract offset to get UTC
  const utcTime = new Date(localDateObj.getTime() - offsetMinutes * 60 * 1000);

  return {
    date: formatDate(utcTime),
    time: formatTime(utcTime),
  };
}

/**
 * Convert a UTC time to local time in a specific timezone
 * Returns { date: 'YYYY-MM-DD', time: 'HH:mm' } in local timezone
 */
export function utcToLocalTime(
  utcDate: string, // YYYY-MM-DD
  utcTime: string, // HH:mm
  timezone: string
): { date: string; time: string } {
  // Parse UTC date and time
  const [year, month, day] = utcDate.split('-').map(Number);
  const [hours, minutes] = utcTime.split(':').map(Number);

  // Create UTC date
  const utcDateObj = new Date(Date.UTC(year, month - 1, day, hours, minutes));

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

  const parts = formatter.formatToParts(utcDateObj);
  const dateParts: Record<string, string> = {};
  for (const part of parts) {
    dateParts[part.type] = part.value;
  }

  return {
    date: `${dateParts.year}-${dateParts.month}-${dateParts.day}`,
    time: `${dateParts.hour}:${dateParts.minute}`,
  };
}

/**
 * Convert availability slots from user timezone to UTC for storage
 */
export function convertAvailabilityToUTC(
  date: string, // YYYY-MM-DD in user timezone
  slots: Array<{ start: string; end: string }>,
  userTimezone: string
): Array<{ date: string; startTime: string; endTime: string }> {
  return slots.map(slot => {
    const startUTC = localTimeToUTC(date, slot.start, userTimezone);
    const endUTC = localTimeToUTC(date, slot.end, userTimezone);

    // Note: end time might be on the next day if it's after midnight in UTC
    return {
      date: startUTC.date, // Primary date is based on start time
      startTime: startUTC.time,
      endTime: endUTC.time,
      // If dates differ, we need to handle cross-day slots
      endDate: endUTC.date !== startUTC.date ? endUTC.date : undefined,
    };
  });
}

/**
 * Convert availability slots from UTC to user timezone for display
 */
export function convertAvailabilityFromUTC(
  date: string, // YYYY-MM-DD in UTC
  slots: Array<{ startTime: string; endTime: string }>,
  userTimezone: string
): Array<{ date: string; start: string; end: string }> {
  return slots.map(slot => {
    const startLocal = utcToLocalTime(date, slot.startTime, userTimezone);
    const endLocal = utcToLocalTime(date, slot.endTime, userTimezone);

    return {
      date: startLocal.date,
      start: startLocal.time,
      end: endLocal.time,
    };
  });
}

/**
 * Format Date to YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format Date to HH:mm string
 */
function formatTime(date: Date): string {
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get current date in a specific timezone as YYYY-MM-DD
 */
export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Get current time in a specific timezone as HH:mm
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(now);
}

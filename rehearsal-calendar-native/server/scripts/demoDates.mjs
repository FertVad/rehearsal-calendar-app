// Dates for the demo seed. A timed slot is an instant, built from the seeding
// machine's clock. A whole day is a calendar date and is stored the way the app
// stores one: UTC midnight to 23:59:59.999Z of that date. Local midnight is an
// instant instead, and in UTC+3 it reads back as the previous day.

/** A date N days from today at a given local hour, returned as UTC ISO. */
export function at(dayOffset, hour, minute = 0, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** The whole local day N days from today, as an all-day availability row. */
export function allDay(dayOffset, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startsAt: `${date}T00:00:00.000Z`, endsAt: `${date}T23:59:59.999Z`, isAllDay: true };
}

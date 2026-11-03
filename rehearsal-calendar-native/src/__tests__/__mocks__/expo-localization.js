/**
 * Mock for expo-localization
 *
 * Its native module is not in Jest. A phone on the 24-hour clock unless a
 * test says otherwise: getCalendars.mockReturnValue([{ uses24hourClock: false }]).
 * A change while a screen is open, as the phone's listener would bring it:
 * __changeCalendars([{ uses24hourClock: false }]) inside act().
 */

const { useEffect, useMemo, useReducer } = require('react');

const listeners = new Set();

export const getCalendars = jest.fn(() => [
  { calendar: 'gregory', timeZone: 'America/New_York', uses24hourClock: true, firstWeekday: 2 },
]);

export const getLocales = jest.fn(() => [{ languageTag: 'en-US', languageCode: 'en' }]);

// As in the package: read again only when the calendar listener fires.
export function useCalendars() {
  const [key, invalidate] = useReducer((k) => k + 1, 0);
  const calendars = useMemo(() => getCalendars(), [key]);
  useEffect(() => {
    listeners.add(invalidate);
    return () => listeners.delete(invalidate);
  }, []);
  return calendars;
}

export function __changeCalendars(calendars) {
  getCalendars.mockReturnValue(calendars);
  listeners.forEach((fire) => fire());
}

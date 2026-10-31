/**
 * Mock for expo-localization
 *
 * Its native module is not in Jest. A phone on the 24-hour clock unless a
 * test says otherwise: getCalendars.mockReturnValue([{ uses24hourClock: false }]).
 */

export const getCalendars = jest.fn(() => [
  { calendar: 'gregory', timeZone: 'America/New_York', uses24hourClock: true, firstWeekday: 2 },
]);

export const getLocales = jest.fn(() => [{ languageTag: 'en-US', languageCode: 'en' }]);

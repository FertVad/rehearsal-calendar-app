/**
 * Mock for expo-calendar
 */

export const getCalendarsAsync = jest.fn();
export const getEventsAsync = jest.fn();
// Reading one event by id — used by the export to ask whether the event it
// recorded is still there.
export const getEventAsync = jest.fn();
export const createEventAsync = jest.fn();
export const updateEventAsync = jest.fn();
export const deleteEventAsync = jest.fn();
export const requestCalendarPermissionsAsync = jest.fn();
export const getCalendarPermissionsAsync = jest.fn();

export const EntityTypes = {
  EVENT: 'event',
  REMINDER: 'reminder',
};

export const CalendarAccessLevel = {
  CONTRIBUTOR: 'contributor',
  EDITOR: 'editor',
  FREEBUSY: 'freebusy',
  OVERRIDE: 'override',
  OWNER: 'owner',
  READ: 'read',
  RESPOND: 'respond',
  ROOT: 'root',
  NONE: 'none',
};

export default {
  getCalendarsAsync,
  getEventsAsync,
  createEventAsync,
  updateEventAsync,
  deleteEventAsync,
  requestCalendarPermissionsAsync,
  getCalendarPermissionsAsync,
  EntityTypes,
  CalendarAccessLevel,
};

// Enum constants the export path reads when building an event. Absent until now,
// which is one reason nothing in this service had a test: the module threw on
// AlarmMethod.ALERT before any assertion could run.
export const AlarmMethod = { ALERT: 'alert', EMAIL: 'email', SOUND: 'sound' };
export const Availability = { BUSY: 'busy', FREE: 'free', TENTATIVE: 'tentative' };

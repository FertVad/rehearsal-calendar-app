/**
 * Mock for expo-calendar
 */

export const getCalendarsAsync = jest.fn();
export const getEventsAsync = jest.fn();
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

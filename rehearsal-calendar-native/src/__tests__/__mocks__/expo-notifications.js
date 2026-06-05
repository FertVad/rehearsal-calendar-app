/**
 * Mock for expo-notifications
 *
 * The real module is ESM and pulls in expo internals that Jest's CJS
 * loader can't parse. Tests don't exercise notification delivery, so
 * stub the surface our code touches.
 */

export const setNotificationHandler = jest.fn();
export const getPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
export const requestPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
export const getExpoPushTokenAsync = jest.fn(() => Promise.resolve({ data: 'mock-token' }));
export const addNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
export const addNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
export const removeNotificationSubscription = jest.fn();
export const setNotificationChannelAsync = jest.fn(() => Promise.resolve());
export const scheduleNotificationAsync = jest.fn(() => Promise.resolve());
export const cancelScheduledNotificationAsync = jest.fn(() => Promise.resolve());
export const cancelAllScheduledNotificationsAsync = jest.fn(() => Promise.resolve());

export const AndroidImportance = {
  MIN: 1,
  LOW: 2,
  DEFAULT: 3,
  HIGH: 4,
  MAX: 5,
};

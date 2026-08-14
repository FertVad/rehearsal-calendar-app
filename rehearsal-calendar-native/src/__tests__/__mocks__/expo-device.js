/**
 * Mock for expo-device
 *
 * Same situation as expo-notifications — the real module is ESM and
 * cannot be parsed by Jest's CJS loader.
 */

export const isDevice = true;
export const brand = 'mock-brand';
export const modelName = 'mock-model';
export const osName = 'iOS';
export const osVersion = '17.0';
export const platformApiLevel = null;
export const totalMemory = null;

export const DeviceType = {
  UNKNOWN: 0,
  PHONE: 1,
  TABLET: 2,
  DESKTOP: 3,
  TV: 4,
};

export const getDeviceTypeAsync = jest.fn(() => Promise.resolve(DeviceType.PHONE));

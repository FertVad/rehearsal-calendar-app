/**
 * AsyncStorage Mock for Jest
 */

const storage = {};

module.exports = {
  // Without this the TypeScript interop wraps the whole export as `default`,
  // so `AsyncStorage.setItem` resolves to undefined and any module touching
  // storage throws on import. That is why every test of the calendar service
  // had to declare its own inline mock — and why, for a long time, none did.
  __esModule: true,
  default: {
    getItem: jest.fn((key) => Promise.resolve(storage[key] || null)),
    setItem: jest.fn((key, value) => {
      storage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key) => {
      delete storage[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(storage).forEach((key) => delete storage[key]);
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(storage))),
    multiGet: jest.fn((keys) =>
      Promise.resolve(keys.map((key) => [key, storage[key] || null]))
    ),
    multiSet: jest.fn((keyValuePairs) => {
      keyValuePairs.forEach(([key, value]) => {
        storage[key] = value;
      });
      return Promise.resolve();
    }),
    multiRemove: jest.fn((keys) => {
      keys.forEach((key) => delete storage[key]);
      return Promise.resolve();
    }),
  },
};

/**
 * expo-store-review Mock for Jest: iOS's rating request, available, asking
 * nothing of anyone (T-410).
 */
module.exports = {
  __esModule: true,
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  requestReview: jest.fn(() => Promise.resolve()),
  hasAction: jest.fn(() => Promise.resolve(true)),
  storeUrl: jest.fn(() => null),
};

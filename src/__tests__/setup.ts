/**
 * Jest Setup for React Native Tests
 *
 * This file runs before each test file and sets up the testing environment
 */

// Silence console errors in tests unless explicitly testing error handling
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Ignore React Native warnings about missing native modules
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ') || args[0].includes('Native module'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Set up global test timeout
jest.setTimeout(10000);

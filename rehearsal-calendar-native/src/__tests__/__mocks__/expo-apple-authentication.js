/**
 * Mock for expo-apple-authentication
 *
 * The real module is ESM and cannot be parsed by Jest's CJS loader. Every
 * AuthProvider reaches it since an account deletion asks Apple to confirm
 * (T-279). Not available by default, as on a device without Apple sign-in;
 * a test that needs Apple mocks it itself.
 */

export const AppleAuthenticationScope = { FULL_NAME: 0, EMAIL: 1 };

export const isAvailableAsync = jest.fn(() => Promise.resolve(false));
export const signInAsync = jest.fn(() => Promise.reject(Object.assign(new Error('Apple sign-in is not available in tests'), { code: 'ERR_REQUEST_UNKNOWN' })));

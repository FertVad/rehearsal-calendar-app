/**
 * The Apple confirmation asked for as an account is deleted (T-279): it asks
 * Apple for nothing about the person and hands back only the authorization
 * code; closing the sheet is an answer, not a failure.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import { confirmAppleForDeletion } from '../appleAuth';

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const signInAsync = AppleAuthentication.signInAsync as jest.Mock;

beforeEach(() => signInAsync.mockReset());

it('asks for no scopes and returns the authorization code', async () => {
  signInAsync.mockResolvedValue({ authorizationCode: 'the-code', identityToken: 'id', fullName: null });
  await expect(confirmAppleForDeletion()).resolves.toBe('the-code');
  expect(signInAsync).toHaveBeenCalledWith({ requestedScopes: [] });
});

it('returns null when the person closes the sheet', async () => {
  signInAsync.mockRejectedValue(Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }));
  await expect(confirmAppleForDeletion()).resolves.toBeNull();
});

it('returns null when Apple gives no code', async () => {
  signInAsync.mockResolvedValue({ authorizationCode: null });
  await expect(confirmAppleForDeletion()).resolves.toBeNull();
});

it('passes on any other failure', async () => {
  signInAsync.mockRejectedValue(new Error('Apple failed'));
  await expect(confirmAppleForDeletion()).rejects.toThrow('Apple failed');
});

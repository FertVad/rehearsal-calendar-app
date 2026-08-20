/**
 * Apple Sign-In Authentication Service
 *
 * Wraps expo-apple-authentication and normalises its result into the shape
 * the backend's POST /auth/apple expects.
 *
 * Apple only returns the user's name on the *very first* authorization for a
 * given Apple ID + app pair. On every later sign-in `fullName` comes back with
 * null fields, which is why the backend treats the name as optional and falls
 * back to a placeholder.
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

export interface AppleSignInResult {
  identityToken: string;
  /** Present only on first sign-in; null fields afterwards. */
  user: { givenName: string | null; familyName: string | null } | null;
}

/** Thrown when the user dismisses the Apple sheet — not a real failure. */
export const APPLE_CANCELED = 'ERR_REQUEST_CANCELED';

/**
 * Whether Sign in with Apple can be offered on this device.
 * iOS 13+ only; always false on Android and on the web.
 */
export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (error) {
    logger.warn('[AppleAuth] Availability check failed:', error);
    return false;
  }
}

/**
 * Present the native Apple sign-in sheet.
 *
 * @returns the identity token plus the name, or null if the user cancelled.
 * @throws if Apple returns an error other than cancellation, or withholds the token.
 */
export async function signInWithApple(): Promise<AppleSignInResult | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token');
    }

    return {
      identityToken: credential.identityToken,
      user: credential.fullName
        ? {
            givenName: credential.fullName.givenName ?? null,
            familyName: credential.fullName.familyName ?? null,
          }
        : null,
    };
  } catch (error: any) {
    // Dismissing the sheet is a normal outcome, not an error worth surfacing.
    if (error?.code === APPLE_CANCELED) {
      logger.debug('[AppleAuth] Sign-in cancelled by user');
      return null;
    }
    logger.error('[AppleAuth] Sign-in failed:', error);
    throw error;
  }
}

/**
 * OAuth Token Verification Utilities
 *
 * This module provides functions to verify OAuth ID tokens from Google and Apple.
 * All verification happens server-side to prevent token forgery.
 */

import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';

/**
 * Verify Google ID token and extract user information
 *
 * @param {string} idToken - The ID token from Google Sign-In
 * @returns {Promise<Object>} User information extracted from token
 * @throws {Error} If token is invalid or verification fails
 */
export async function verifyGoogleToken(idToken) {
  try {
    const client = new OAuth2Client();

    // Verify the ID token against our client IDs
    const ticket = await client.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_CLIENT_ID_IOS,
        process.env.GOOGLE_CLIENT_ID_ANDROID,
        process.env.GOOGLE_CLIENT_ID_WEB,
      ].filter(Boolean), // Remove undefined values
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid token payload');
    }

    // Extract user information from token
    return {
      providerUserId: payload.sub,                // Google user ID (unique)
      email: payload.email,
      emailVerified: payload.email_verified || false,
      firstName: payload.given_name || 'User',
      lastName: payload.family_name || '',
      avatarUrl: payload.picture || null,
      locale: payload.locale || null,
    };
  } catch (error) {
    console.error('[OAuth] Google token verification failed:', error.message);
    throw new Error('Failed to verify Google token: ' + error.message);
  }
}

/**
 * Verify Apple ID token and extract user information
 *
 * @param {string} idToken - The ID token from Apple Sign-In
 * @returns {Promise<Object>} User information extracted from token
 * @throws {Error} If token is invalid or verification fails
 */
export async function verifyAppleToken(idToken) {
  try {
    // Verify the Apple ID token
    const appleIdTokenClaims = await appleSignin.verifyIdToken(idToken, {
      audience: process.env.APPLE_CLIENT_ID,
      ignoreExpiration: false, // Enforce token expiration
    });

    if (!appleIdTokenClaims) {
      throw new Error('Invalid Apple token claims');
    }

    // Extract user information from token
    // Note: Apple doesn't provide name in the token, only on first sign-in
    // Name must be provided separately by the client
    return {
      providerUserId: appleIdTokenClaims.sub,     // Apple user ID (unique)
      email: appleIdTokenClaims.email || null,
      emailVerified: appleIdTokenClaims.email_verified === 'true' || appleIdTokenClaims.email_verified === true,
      // Name and avatar not provided in token - must come from client on first sign-in
    };
  } catch (error) {
    console.error('[OAuth] Apple token verification failed:', error.message);
    throw new Error('Failed to verify Apple token: ' + error.message);
  }
}

/**
 * Validate that required OAuth environment variables are set
 *
 * @param {string} provider - 'google' or 'apple'
 * @throws {Error} If required env vars are missing
 */
export function validateOAuthConfig(provider) {
  if (provider === 'google') {
    if (!process.env.GOOGLE_CLIENT_ID_WEB) {
      throw new Error('GOOGLE_CLIENT_ID_WEB is not configured');
    }
    // iOS and Android client IDs are optional (might only support web)
    if (!process.env.GOOGLE_CLIENT_ID_IOS && !process.env.GOOGLE_CLIENT_ID_ANDROID) {
      console.warn('[OAuth] Warning: No mobile Google client IDs configured');
    }
  } else if (provider === 'apple') {
    if (!process.env.APPLE_CLIENT_ID) {
      throw new Error('APPLE_CLIENT_ID is not configured');
    }
  }
}

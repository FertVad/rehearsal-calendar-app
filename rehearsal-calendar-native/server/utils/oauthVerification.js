/**
 * OAuth Token Verification Utilities
 *
 * This module provides functions to verify OAuth ID tokens from Google and Apple.
 * All verification happens server-side to prevent token forgery.
 */

import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { acceptedGoogleAudiences } from '../constants/googleClients.js';

/**
 * The `aud` a token claims, read without verifying anything — for the log line
 * when verification fails, and for nothing else.
 *
 * google-auth-library throws "Wrong recipient, payload audience !=
 * requiredAudience" without naming either side, which turns a one-line
 * configuration mistake into a guessing game. Never use this for a decision.
 */
function claimedAudience(idToken) {
  try {
    const [, body] = String(idToken).split('.');
    return JSON.parse(Buffer.from(body, 'base64url').toString()).aud;
  } catch {
    return '(unreadable)';
  }
}

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

    // Fail closed. Handing verifyIdToken an undefined audience is not a laxer
    // check, it is no check: google-auth-library guards the whole comparison
    // with `if (typeof requiredAudience !== 'undefined')`. Signature and issuer
    // alone say the token is a genuine Google token — not that it was issued
    // for us. A Google `sub` is the same value for the same person across every
    // OAuth client, so a token minted for any other app in the world would
    // match our stored provider row and log an attacker in as that user.
    const clientIds = acceptedGoogleAudiences();
    if (clientIds.length === 0) {
      throw new Error('No Google client ids configured; refusing to verify without an audience');
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientIds,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid token payload');
    }

    // Verify issuer manually for security
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      throw new Error('Invalid token issuer: ' + payload.iss);
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
    // Name both sides. The library's own message says only that they differ.
    if (/audience/i.test(error.message)) {
      console.error(
        '[OAuth] Google token rejected: token audience is',
        claimedAudience(idToken),
        '- we accept',
        acceptedGoogleAudiences()
      );
    } else {
      console.error('[OAuth] Google token verification failed:', error.message);
    }
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


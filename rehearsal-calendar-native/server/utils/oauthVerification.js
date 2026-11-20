/**
 * OAuth Token Verification Utilities
 *
 * This module provides functions to verify OAuth ID tokens from Google and Apple.
 * All verification happens server-side to prevent token forgery.
 */

import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { acceptedGoogleAudiences } from '../constants/googleClients.js';
import { readAppleAuthConfig, AppleAuthUnavailableError, AppleTokenVerificationError } from '../config/appleAuth.js';

/**
 * A Google token we refused. Its message is one of our own words, never the
 * library's: google-auth-library builds most of its rejections from the token
 * itself ("Token used too late, …: {payload}", "Invalid token signature: <jwt>"),
 * which would put the person's email, name, photo link and language in the log
 * — the route logs what it catches. The privacy policy says the photo and
 * language are not kept (T-269, review round 2).
 */
class GoogleTokenVerificationError extends Error {
  constructor(reason) {
    super(`Invalid Google token: ${reason}`);
    this.name = 'GoogleTokenVerificationError';
    this.code = 'GOOGLE_TOKEN_INVALID';
    this.reason = reason;
  }
}

/**
 * The claims a token states, read without verifying anything — only for the
 * log line when verification fails, and only the fields that are not about the
 * person (audience, times). Never use this for a decision.
 */
function claimedTerms(idToken) {
  try {
    const [, body] = String(idToken).split('.');
    const { aud, exp, iat } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return { aud, exp: Number(exp), iat: Number(iat) };
  } catch {
    return null;
  }
}

/**
 * Why the library refused, worked out from the token's own terms rather than
 * from the library's message (which carries the payload). Mirrors the order
 * of its checks closely enough for a log line; a forged token can claim
 * anything, so this is diagnosis, not a verdict.
 */
function rejectionReason(idToken, accepted) {
  const terms = claimedTerms(idToken);
  if (!terms) return 'malformed';
  const now = Date.now() / 1000;
  const skew = OAuth2Client.CLOCK_SKEW_SECS_ ?? 300;
  if (Number.isFinite(terms.exp) && now > terms.exp + skew) return 'expired';
  if (Number.isFinite(terms.iat) && now < terms.iat - skew) return 'not yet valid';
  if (!accepted.includes(terms.aud)) return 'audience';
  return 'rejected';
}

/**
 * Verify Google ID token and extract user information
 *
 * @param {string} idToken - The ID token from Google Sign-In
 * @returns {Promise<Object>} User information extracted from token
 * @throws {Error} If token is invalid or verification fails
 */
export async function verifyGoogleToken(idToken) {
  // Fail closed. Handing verifyIdToken an undefined audience is not a laxer
  // check, it is no check: google-auth-library guards the whole comparison
  // with `if (typeof requiredAudience !== 'undefined')`. Signature and issuer
  // alone say the token is a genuine Google token — not that it was issued
  // for us. A Google `sub` is the same value for the same person across every
  // OAuth client, so a token minted for any other app in the world would
  // match our stored provider row and log an attacker in as that user.
  const clientIds = acceptedGoogleAudiences();
  if (clientIds.length === 0) {
    console.error('[OAuth] Google token rejected: no Google client ids configured');
    throw new GoogleTokenVerificationError('no audience configured');
  }

  let payload;
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken, audience: clientIds });
    payload = ticket.getPayload();
  } catch {
    // The library's message is not logged or passed on: it carries the token.
    // The reason comes from the token's audience and times; for the audience,
    // both sides are named — client ids, not anyone's data — because the
    // library says only that they differ.
    const reason = rejectionReason(idToken, clientIds);
    if (reason === 'audience') {
      console.error(
        '[OAuth] Google token rejected: audience - token audience is',
        claimedTerms(idToken)?.aud,
        '- we accept',
        clientIds
      );
    } else {
      console.error(`[OAuth] Google token rejected: ${reason}`);
    }
    throw new GoogleTokenVerificationError(reason);
  }

  if (!payload) {
    console.error('[OAuth] Google token rejected: no payload');
    throw new GoogleTokenVerificationError('no payload');
  }

  // Verify issuer manually for security. The issuer is Google's, not the
  // person's, but the error stays in our own words like the others.
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
    console.error('[OAuth] Google token rejected: issuer');
    throw new GoogleTokenVerificationError('issuer');
  }

  // Extract user information from token
  return {
    providerUserId: payload.sub,                // Google user ID (unique)
    email: payload.email,
    emailVerified: payload.email_verified || false,
    firstName: payload.given_name || 'User',
    lastName: payload.family_name || '',
    // payload.picture is not taken: the app draws initials (T-273).
    locale: payload.locale || null,
  };
}

/**
 * Verify Apple ID token and extract user information
 *
 * @param {string} idToken - The ID token from Apple Sign-In
 * @returns {Promise<Object>} User information extracted from token
 * @throws {Error} If token is invalid or verification fails
 */
export async function verifyAppleToken(idToken) {
  const config = readAppleAuthConfig();
  // An absent audience disables jsonwebtoken's audience check. Refuse before
  // entering the verifier (including its JWKS transport) or account linking.
  if (!config.enabled) throw new AppleAuthUnavailableError();

  try {
    // Verify the Apple ID token
    const appleIdTokenClaims = await appleSignin.verifyIdToken(idToken, {
      audience: config.audiences,
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
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
  } catch {
    // Driver/library messages may contain token claims or configured audience
    // values. Keep both diagnostics and the application error independent of
    // those details, while retaining a typed rejection for the HTTP boundary.
    console.error('[OAuth] Apple token verification failed');
    throw new AppleTokenVerificationError();
  }
}

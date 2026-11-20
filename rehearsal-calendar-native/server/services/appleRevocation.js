/**
 * Revoking Sign in with Apple when an account is deleted (T-279).
 *
 * App Review 5.1.1(v): an app that offers Sign in with Apple revokes the
 * person's tokens through Apple's REST API when they delete their account.
 * The server keeps no Apple token — sign-in sends only the identity token — so
 * there is nothing stored to revoke. Instead the app asks Apple for a fresh
 * confirmation as the person deletes the account and sends its one-time
 * authorization code with DELETE /me. Here that code is exchanged for a token
 * (/auth/token) and the token is revoked at once (/auth/revoke), which ends the
 * link between the Apple ID and Rehearsly. Nothing from Apple is kept.
 *
 * It is an attempt and never a condition: the account goes whatever happens
 * here. revokeAppleSignIn never throws; it answers what happened in words that
 * hold no code, no token and nothing Apple said about the person, so the route
 * can log it as it is.
 */
import { createPrivateKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { readAppleAuthConfig } from '../config/appleAuth.js';

const APPLE = 'https://appleid.apple.com';
// Each request to Apple; the deletion response waits for both at worst.
const APPLE_TIMEOUT_MS = 4000;
// The client secret only has to outlive the two requests it signs.
const CLIENT_SECRET_TTL_SECONDS = 300;
const KEY_VARIABLES = ['APPLE_TEAM_ID', 'APPLE_SIGNIN_KEY_ID', 'APPLE_SIGNIN_PRIVATE_KEY'];

/**
 * The key Apple gave for Sign in with Apple, and what it signs for. Disabled,
 * with the variable names to blame, when any part is missing or unusable;
 * never the values.
 */
export function readAppleRevocationConfig(environment = process.env) {
  const client = readAppleAuthConfig(environment);
  const missing = KEY_VARIABLES.filter((name) => typeof environment[name] !== 'string' || !environment[name].trim());
  if (!client.enabled) missing.unshift('APPLE_CLIENT_ID');
  if (missing.length) return { enabled: false, reason: `not set: ${missing.join(', ')}` };

  let privateKey;
  try {
    // Pasted into a single-line variable, the .p8 may carry its line breaks as "\n".
    privateKey = createPrivateKey(environment.APPLE_SIGNIN_PRIVATE_KEY.trim().replace(/\\n/g, '\n'));
  } catch {
    return { enabled: false, reason: 'APPLE_SIGNIN_PRIVATE_KEY is not a private key' };
  }
  if (privateKey.asymmetricKeyType !== 'ec') {
    return { enabled: false, reason: 'APPLE_SIGNIN_PRIVATE_KEY is not an EC key' };
  }
  return {
    enabled: true,
    clientId: client.audiences[0],
    teamId: environment.APPLE_TEAM_ID.trim(),
    keyId: environment.APPLE_SIGNIN_KEY_ID.trim(),
    privateKey,
  };
}

/** The client_secret Apple asks for: a short ES256 JWT signed with our key. */
function clientSecret(config) {
  return jwt.sign({}, config.privateKey, {
    algorithm: 'ES256',
    keyid: config.keyId,
    issuer: config.teamId,
    subject: config.clientId,
    audience: APPLE,
    expiresIn: CLIENT_SECRET_TTL_SECONDS,
  });
}

/** Apple's own error code (`invalid_grant`), never anything longer. */
async function appleErrorCode(response) {
  try {
    const { error } = await response.json();
    return typeof error === 'string' && /^[a-z_]{1,40}$/.test(error) ? ` ${error}` : '';
  } catch {
    return '';
  }
}

/** Whose Apple ID the token Apple issued is for, from the id_token it came with. */
function subjectOf(idToken) {
  try {
    const [, body] = String(idToken).split('.');
    const { sub } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

function post(fetchImpl, path, fields) {
  return fetchImpl(`${APPLE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(APPLE_TIMEOUT_MS),
  });
}

/**
 * Revoke the deleted account's Apple sign-in.
 *
 * @param {object} options
 * @param {string} options.appleUserId - the `sub` the account was linked to.
 * @param {unknown} options.code - the authorization code the app sent, if any.
 * @returns {Promise<{ revoked: boolean, reason?: string }>} never rejects.
 */
export async function revokeAppleSignIn({ appleUserId, code, config = readAppleRevocationConfig(), fetchImpl = globalThis.fetch }) {
  if (!config.enabled) return { revoked: false, reason: `revocation is off (${config.reason})` };
  // An app from before T-279, or a person who closed Apple's sheet.
  if (typeof code !== 'string' || !code.trim() || code.length > 4096) {
    return { revoked: false, reason: 'the app sent no authorization code' };
  }

  try {
    const secret = clientSecret(config);
    const exchanged = await post(fetchImpl, '/auth/token', {
      client_id: config.clientId,
      client_secret: secret,
      code: code.trim(),
      grant_type: 'authorization_code',
    });
    if (!exchanged.ok) {
      return { revoked: false, reason: `Apple refused the code: HTTP ${exchanged.status}${await appleErrorCode(exchanged)}` };
    }
    const tokens = await exchanged.json().catch(() => null);
    if (!tokens || typeof tokens !== 'object') return { revoked: false, reason: 'Apple answered the code with no tokens' };

    // The code is for whichever Apple ID confirmed on the device. If that is
    // not the one this account was linked to, revoking would cut someone
    // else's sign-in — possibly another Rehearsly account's.
    if (subjectOf(tokens.id_token) !== appleUserId) {
      return { revoked: false, reason: 'the Apple ID that confirmed is not the one linked to the account' };
    }

    // The refresh token stands for the whole authorization; revoking it ends
    // the link. Apple always issues one for a code, but an access token is
    // revoked if that is all there is.
    const [token, hint] = typeof tokens.refresh_token === 'string'
      ? [tokens.refresh_token, 'refresh_token']
      : [tokens.access_token, 'access_token'];
    if (typeof token !== 'string' || !token) return { revoked: false, reason: 'Apple returned no token to revoke' };

    const revoked = await post(fetchImpl, '/auth/revoke', {
      client_id: config.clientId,
      client_secret: secret,
      token,
      token_type_hint: hint,
    });
    if (!revoked.ok) {
      return { revoked: false, reason: `Apple refused the revocation: HTTP ${revoked.status}${await appleErrorCode(revoked)}` };
    }
    return { revoked: true };
  } catch (error) {
    // The error itself is not passed on: whatever it says, it is not ours.
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return { revoked: false, reason: timedOut ? 'Apple did not answer in time' : 'Apple could not be reached' };
  }
}

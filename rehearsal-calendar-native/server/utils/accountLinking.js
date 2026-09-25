/**
 * Account Linking Utilities
 *
 * Google/Apple sign-in, linking by a proven address, and the sign-in methods
 * an account actually has.
 */

import db from '../database/db.js';
import { logger } from './logger.js';
import { normalizeEmail } from './accountInput.js';
import { SESSION_USER_COLUMNS } from './userSerializer.js';
import { identityOf, isVerified, markVerified } from '../services/email/identity.js';
import { voidCodes } from '../services/email/codes.js';

/**
 * Why a Google/Apple sign-in gets no session. Thrown inside the transaction,
 * so nothing it began is kept.
 */
export class ProviderSignInRefused extends Error {
  constructor(status, body) {
    super(body.error);
    this.name = 'ProviderSignInRefused';
    this.status = status;
    this.body = body;
  }
}

// The account moved under us — a link removed, an address changed, a row
// deleted — between the unlocked read and the lock. The attempt starts over.
class SignInMoved extends Error {}

const ATTEMPTS = 3;

/**
 * Sign in with Google or Apple (R3: A01, review R3-01).
 *
 * The provider's word is proof of an address only when it says the address is
 * verified, and only for that exact address. Proof for an account whose
 * address nobody proved yet — a pending registration, or an account from
 * before R3 — settles who owns it: a password on it was never proven to be
 * the owner's, so it is removed with every session and live code, and the
 * address becomes verified by the provider. That holds for a provider linked
 * long ago as well, or a takeover from before R3 — the attacker's password
 * beside the owner's Google — would survive the fix. A verified account is
 * only linked; nothing is taken from it.
 *
 * Without proof there is no linking and no new account: an unproven address
 * must not claim a mailbox. An already linked provider still signs in, unless
 * the account is pending — a pending account gets no session by any path.
 *
 * Everything happens under the user row lock, and the session row — the token
 * version with it — is read before COMMIT, so a later revocation reaches the
 * tokens signed from it.
 *
 * @returns {Promise<{ user: Object, isNewUser: boolean, linked: boolean, passwordRevoked: boolean }>}
 * @throws {ProviderSignInRefused}
 */
export async function signInWithProvider({
  provider, providerUserId, email, emailVerified, firstName, lastName, avatarUrl,
}) {
  const address = normalizeEmail(email) || null;
  const claim = {
    provider,
    providerUserId,
    address,
    // Only a verified address proves anything; a missing one proves nothing.
    proof: emailVerified === true && address ? address : null,
    // Apple in particular hands back names with padding. Trimmed here for the
    // same reason as on the register and profile routes: stored with a trailing
    // space, a first name reappears joined to a surname by two.
    firstName: typeof firstName === 'string' ? firstName.trim() : firstName,
    lastName: typeof lastName === 'string' ? lastName.trim() || null : lastName,
    avatarUrl,
  };
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction((tx) => providerSignIn(tx, claim, new Date()));
    } catch (error) {
      // Two first sign-ins of one person, or one racing a registration of the
      // same address, meet a unique key; the next attempt finds the winner.
      const retry = error instanceof SignInMoved || error?.code === '23505';
      if (!retry || attempt >= ATTEMPTS) throw error;
    }
  }
}

async function providerSignIn(tx, claim, now) {
  const { provider, providerUserId, address, proof } = claim;
  const lockUser = (id) => tx.get('SELECT id, email, password_hash FROM native_users WHERE id = $1 FOR UPDATE', [id]);
  let user;
  let isNewUser = false;
  let linked = false;

  const link = await tx.get(
    'SELECT user_id FROM native_auth_providers WHERE provider_type = $1 AND provider_user_id = $2',
    [provider, providerUserId]
  );
  if (link) {
    user = await lockUser(link.user_id);
    // Unlinking takes the same lock first, so under it the link is settled.
    const still = user && await tx.get(
      'SELECT user_id FROM native_auth_providers WHERE provider_type = $1 AND provider_user_id = $2 AND user_id = $3',
      [provider, providerUserId, user.id]
    );
    if (!still) throw new SignInMoved();
    await tx.run(
      'UPDATE native_auth_providers SET last_used_at = $1::timestamptz WHERE provider_type = $2 AND provider_user_id = $3',
      [now.toISOString(), provider, providerUserId]
    );
  } else {
    if (!address) {
      throw new ProviderSignInRefused(400, { error: `${providerName(provider)} did not share an email address`,
        code: 'PROVIDER_EMAIL_REQUIRED' });
    }
    if (!proof) {
      throw new ProviderSignInRefused(400, { error: `Email not verified by ${providerName(provider)}`,
        code: 'PROVIDER_EMAIL_UNVERIFIED' });
    }
    const holder = await tx.get('SELECT id FROM native_users WHERE email = $1', [proof]);
    if (holder) {
      user = await lockUser(holder.id);
      if (!user || user.email !== proof) throw new SignInMoved();
      logger.info(`[AccountLinking] Linking ${provider} to existing user ${user.id}`);
      await insertProvider(tx, user.id, claim, now);
      if (claim.avatarUrl) {
        await tx.run(
          'UPDATE native_users SET avatar_url = $1, updated_at = $2::timestamptz WHERE id = $3 AND avatar_url IS NULL',
          [claim.avatarUrl, now.toISOString(), user.id]
        );
      }
      linked = true;
    } else {
      const created = await tx.run(
        `INSERT INTO native_users (email, password_hash, first_name, last_name, avatar_url, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5::timestamptz, $5::timestamptz)`,
        [proof, claim.firstName || 'User', claim.lastName || null, claim.avatarUrl || null, now.toISOString()]
      );
      user = await lockUser(created.lastInsertId);
      await insertProvider(tx, user.id, claim, now);
      logger.info(`[AccountLinking] Created user ${user.id} via ${provider}`);
      isNewUser = true;
    }
  }

  // What the proof settles about this account's address.
  let passwordRevoked = false;
  const identity = await identityOf(tx, user.id);
  if (proof && proof === user.email && !isVerified(identity, user.email)) {
    if (user.password_hash) {
      await tx.run(
        'UPDATE native_users SET password_hash = NULL, token_version = token_version + 1, updated_at = $2::timestamptz WHERE id = $1',
        [user.id, now.toISOString()]
      );
      await tx.run("DELETE FROM native_auth_providers WHERE user_id = $1 AND provider_type = 'email'", [user.id]);
      await voidCodes(tx, { userId: user.id, now });
      logger.warn(`[AccountLinking] ${provider} proved the address of user ${user.id}; its unproven password is revoked`);
      passwordRevoked = true;
    }
    await markVerified(tx, { userId: user.id, email: user.email, by: provider, now });
  } else if (identity?.status === 'pending') {
    throw new ProviderSignInRefused(403, { error: 'Confirm your email address first', code: 'EMAIL_NOT_VERIFIED' });
  }

  await tx.run('UPDATE native_users SET last_login_at = $1::timestamptz WHERE id = $2', [now.toISOString(), user.id]);
  return {
    user: await tx.get(`SELECT ${SESSION_USER_COLUMNS} FROM native_users WHERE id = $1`, [user.id]),
    isNewUser,
    linked,
    passwordRevoked,
  };
}

function providerName(provider) {
  return provider === 'apple' ? 'Apple' : 'Google';
}

async function insertProvider(tx, userId, claim, now) {
  await tx.run(
    `INSERT INTO native_auth_providers (user_id, provider_type, provider_user_id, provider_email,
       created_at, updated_at, last_used_at)
     VALUES ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz, $5::timestamptz)`,
    [userId, claim.provider, claim.providerUserId, claim.address, now.toISOString()]
  );
}

/**
 * The ways this person can actually sign in, each once.
 *
 * A password is a column on the user, not a provider row: register never
 * wrote the row and the one backfill that did ran once, so the rows cannot
 * say whether a password exists (A04). Google and Apple are rows. Two rows of
 * one type are still one way in.
 *
 * @param {Object} conn - db or a transaction handle
 * @param {number} userId - User ID
 * @returns {Promise<Array|null>} methods, or null when the user does not exist
 */
async function signInMethods(conn, userId) {
  const user = await conn.get('SELECT password_hash FROM native_users WHERE id = $1', [userId]);
  if (!user) return null;
  const rows = await conn.all(
    `SELECT provider_type, provider_email, created_at, last_used_at
     FROM native_auth_providers WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  const methods = [];
  if (user.password_hash) {
    const row = rows.find((r) => r.provider_type === 'email');
    methods.push({
      provider_type: 'email',
      provider_email: row?.provider_email ?? null,
      created_at: row?.created_at ?? null,
      last_used_at: row?.last_used_at ?? null,
    });
  }
  for (const type of ['google', 'apple']) {
    const row = rows.find((r) => r.provider_type === type);
    if (row) methods.push(row);
  }
  return methods;
}

/**
 * Get all auth providers linked to a user account
 *
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of auth provider objects
 */
export async function getUserAuthProviders(userId) {
  return (await signInMethods(db, userId)) ?? [];
}

/**
 * Record the password as a sign-in method when it is not already listed.
 * Callers hold the user row lock, so two of these cannot both insert.
 *
 * @param {Object} tx - Transaction handle
 * @param {number} userId - User ID
 */
export async function recordPasswordMethod(tx, userId) {
  await tx.run(
    `INSERT INTO native_auth_providers (user_id, provider_type, provider_email, created_at, updated_at, last_used_at)
     SELECT u.id, 'email', u.email, NOW(), NOW(), NULL FROM native_users u
     WHERE u.id = $1 AND NOT EXISTS (
       SELECT 1 FROM native_auth_providers p WHERE p.user_id = $1 AND p.provider_type = 'email')`,
    [userId]
  );
}

/**
 * Unlink an auth provider from a user account
 *
 * @param {number} userId - User ID
 * @param {string} providerType - Provider to unlink ('google', 'apple', 'email')
 * @returns {Promise<boolean>} True if unlinked successfully
 * @throws {Error} If trying to unlink the last auth method
 */
export async function unlinkAuthProvider(userId, providerType) {
  await db.transaction(async (tx) => {
    // Two unlinks at once used to each count two methods and each delete one,
    // leaving none (A04). The row lock makes the second wait for the first to
    // commit, then count again.
    const locked = await tx.get('SELECT id FROM native_users WHERE id = $1 FOR UPDATE', [userId]);
    const methods = locked ? await signInMethods(tx, userId) : null;
    if (!methods?.some((method) => method.provider_type === providerType)) {
      throw new Error('Auth provider not found');
    }
    if (methods.length <= 1) {
      throw new Error('Cannot unlink the last authentication method');
    }

    await tx.run(
      'DELETE FROM native_auth_providers WHERE user_id = $1 AND provider_type = $2',
      [userId, providerType]
    );

    // POST /auth/login authenticates against native_users.password_hash and
    // never consults the provider rows, so removing the password method means
    // clearing the credential itself.
    if (providerType === 'email') {
      await tx.run(
        'UPDATE native_users SET password_hash = NULL, updated_at = NOW() WHERE id = $1',
        [userId]
      );
    }
  });

  logger.info(`[AccountLinking] Unlinked ${providerType} provider from user ${userId}`);
  return true;
}

/**
 * Account Linking Utilities
 *
 * This module handles the logic for linking OAuth providers to user accounts.
 * Supports automatic account linking based on email addresses.
 */

import db from '../database/db.js';
import { logger } from './logger.js';

/**
 * Find or create a user account for OAuth login
 *
 * This function implements the following logic:
 * 1. Check if this OAuth provider is already linked → return existing user
 * 2. Check if email matches an existing user → link OAuth to that account
 * 3. Otherwise → create a new user account with this OAuth provider
 *
 * @param {Object} params - OAuth user parameters
 * @param {string} params.provider - Provider type: 'google', 'apple', 'email'
 * @param {string} params.providerUserId - Unique user ID from OAuth provider
 * @param {string} params.email - User's email address
 * @param {boolean} params.emailVerified - Whether email is verified by provider
 * @param {string} params.firstName - User's first name
 * @param {string} params.lastName - User's last name (optional)
 * @param {string} params.avatarUrl - Profile avatar URL (optional)
 * @returns {Promise<Object>} { userId, isNewUser, linked }
 */
export async function findOrCreateOAuthUser({
  provider,
  providerUserId,
  email,
  emailVerified,
  firstName,
  lastName,
  avatarUrl,
}) {
  const now = new Date().toISOString();

  // Apple in particular hands back names with padding. Trimmed here for the
  // same reason as on the register and profile routes: stored with a trailing
  // space, a first name reappears joined to a surname by two.
  firstName = typeof firstName === 'string' ? firstName.trim() : firstName;
  lastName = typeof lastName === 'string' ? lastName.trim() || null : lastName;

  // ============================================================================
  // Step 1: Check if this OAuth provider is already linked
  // ============================================================================
  const existingProvider = await db.get(
    'SELECT user_id FROM native_auth_providers WHERE provider_type = $1 AND provider_user_id = $2',
    [provider, providerUserId]
  );

  if (existingProvider) {
    // OAuth provider already linked - just update last_used_at
    await db.run(
      'UPDATE native_auth_providers SET last_used_at = $1 WHERE provider_type = $2 AND provider_user_id = $3',
      [now, provider, providerUserId]
    );

    logger.info(`[AccountLinking] OAuth provider ${provider} already linked to user ${existingProvider.user_id}`);

    return {
      userId: existingProvider.user_id,
      isNewUser: false,
      linked: false, // Not newly linked, already existed
    };
  }

  // ============================================================================
  // Step 2: Check if email matches an existing user (automatic linking)
  // ============================================================================
  // Only link if the OAuth provider verified the email
  if (email && emailVerified) {
    const existingUser = await db.get(
      'SELECT id FROM native_users WHERE email = $1',
      [email]
    );

    if (existingUser) {
      // Email matches an existing account → link OAuth provider to it
      logger.info(`[AccountLinking] Linking ${provider} account to existing user ${existingUser.id} via email ${email}`);

      // Create auth provider entry
      await db.run(
        `INSERT INTO native_auth_providers (
          user_id, provider_type, provider_user_id, provider_email,
          created_at, updated_at, last_used_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [existingUser.id, provider, providerUserId, email, now, now, now]
      );

      // Update user's avatar if they don't have one and OAuth provides one
      if (avatarUrl) {
        const user = await db.get('SELECT avatar_url FROM native_users WHERE id = $1', [existingUser.id]);
        if (!user.avatar_url) {
          await db.run(
            'UPDATE native_users SET avatar_url = $1, updated_at = $2 WHERE id = $3',
            [avatarUrl, now, existingUser.id]
          );
          logger.info(`[AccountLinking] Updated avatar for user ${existingUser.id} from ${provider}`);
        }
      }

      return {
        userId: existingUser.id,
        isNewUser: false,
        linked: true, // Newly linked to existing account
      };
    }
  } else if (email && !emailVerified) {
    logger.warn(`[AccountLinking] OAuth email ${email} not verified by ${provider}, skipping auto-linking`);
  }

  // ============================================================================
  // Step 3: Create a new user account
  // ============================================================================
  logger.info(`[AccountLinking] Creating new user via ${provider} OAuth (email: ${email || 'none'})`);

  // Insert new user (password_hash is NULL for OAuth-only users)
  const result = await db.run(
    `INSERT INTO native_users (
      email, password_hash, first_name, last_name, avatar_url,
      created_at, updated_at, last_login_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      email || null,
      null, // No password for OAuth-only users
      firstName || 'User',
      lastName || null,
      avatarUrl || null,
      now,
      now,
      now,
    ]
  );

  const userId = result.lastInsertId;

  // Create auth provider entry
  await db.run(
    `INSERT INTO native_auth_providers (
      user_id, provider_type, provider_user_id, provider_email,
      created_at, updated_at, last_used_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, provider, providerUserId, email || null, now, now, now]
  );

  logger.info(`[AccountLinking] Created new user ${userId} via ${provider} OAuth`);

  return {
    userId,
    isNewUser: true,
    linked: false, // New user, not linked to existing
  };
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

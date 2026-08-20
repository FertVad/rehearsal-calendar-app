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
 * Get all auth providers linked to a user account
 *
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of auth provider objects
 */
export async function getUserAuthProviders(userId) {
  const providers = await db.all(
    `SELECT
      provider_type,
      provider_email,
      created_at,
      last_used_at
     FROM native_auth_providers
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );

  return providers;
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
  // Check how many auth methods the user has
  const providers = await db.all(
    'SELECT provider_type FROM native_auth_providers WHERE user_id = $1',
    [userId]
  );

  if (providers.length <= 1) {
    throw new Error('Cannot unlink the last authentication method');
  }

  // Delete the provider
  const result = await db.run(
    'DELETE FROM native_auth_providers WHERE user_id = $1 AND provider_type = $2',
    [userId, providerType]
  );

  if (result.changes === 0) {
    throw new Error('Auth provider not found');
  }

  // POST /auth/login authenticates against native_users.password_hash and never
  // consults this table, so dropping the row alone would leave password sign-in
  // working while telling the user it had been unlinked. Clear the credential
  // itself to make the removal real.
  if (providerType === 'email') {
    await db.run(
      'UPDATE native_users SET password_hash = NULL, updated_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  logger.info(`[AccountLinking] Unlinked ${providerType} provider from user ${userId}`);

  return true;
}


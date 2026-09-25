import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger } from '../utils/logger.js';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../database/db.js';
import { generateTokens, verifyToken, requireAuth } from '../middleware/jwtMiddleware.js';
import { serializeUser } from '../utils/userSerializer.js';
import { verifyGoogleToken, verifyAppleToken } from '../utils/oauthVerification.js';
import { AppleAuthUnavailableError, AppleTokenVerificationError } from '../config/appleAuth.js';
import { signInWithProvider, ProviderSignInRefused, getUserAuthProviders, unlinkAuthProvider, recordPasswordMethod } from '../utils/accountLinking.js';
import { InputError, inputErrorBody, registrationInput, profileUpdates, checkPassword, normalizeEmail } from '../utils/accountInput.js';
import { emailTransport } from '../services/email/transport.js';
import { issueCode, deliverCode } from '../services/email/codes.js';
import { identityOf, markPending } from '../services/email/identity.js';
import { notifyProjectDeleted } from '../services/notifications/pushNotificationService.js';

const router = Router();

// Register new user.
//
// A registration proves nothing about the address, so it creates a pending
// account and sends a code; the session comes from POST /verify-email with the
// code and the same password (A01). Without that, whoever registered someone
// else's address first shared the account once its owner signed in with
// Google or Apple.
router.post('/register', asyncHandler(async (req, res) => {
  try {
    // An app from before R3 cannot enter a code. It gets a message it shows as
    // is, instead of "Registration failed" over an account it had created.
    if (req.body?.verification !== 'code') {
      return res.status(400).json({ error: 'Update Rehearsly to create an account', code: 'CLIENT_UPGRADE_REQUIRED' });
    }
    let input;
    try {
      input = registrationInput(req.body);
    } catch (error) {
      if (error instanceof InputError) return res.status(400).json(inputErrorBody(error));
      throw error;
    }
    const { email, password, firstName, lastName, timezone, locale } = input;

    // No way to send the code: refuse before creating an account nobody can confirm.
    const transport = emailTransport();
    if (!transport.available) {
      return res.status(503).json({ error: 'Email is not available right now', code: 'EMAIL_UNAVAILABLE' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    let created;
    try {
      // The user, their password method (A04), the pending address and the
      // code commit together, or none of them do.
      created = await db.transaction(async (tx) => {
        if (await tx.get('SELECT id FROM native_users WHERE email = $1', [email])) return null;
        const result = await tx.run(
          `INSERT INTO native_users (email, password_hash, first_name, last_name, timezone, locale)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [email, passwordHash, firstName, lastName, timezone, locale]
        );
        const userId = result.lastInsertId;
        await recordPasswordMethod(tx, userId);
        await markPending(tx, { userId, email, now });
        return issueCode(tx, { userId, purpose: 'verify', email, now });
      });
    } catch (error) {
      // Two registrations of one address at once: the loser meets the unique key.
      if (error?.code !== '23505') throw error;
      created = null;
    }
    if (!created) {
      return res.status(409).json({ error: 'An account with this email already exists', code: 'EMAIL_TAKEN' });
    }

    const delivery = await deliverCode({ db, transport, codeId: created.id, to: email, code: created.code,
      purpose: 'verify', locale });
    res.status(201).json({ status: 'verification_required', email, delivery });
  } catch (err) {
    console.error('[Auth] Registration error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
}));

// Login
router.post('/login', asyncHandler(async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user
    const user = await db.get(
      `SELECT id, email, password_hash, first_name, last_name, timezone, locale,
              notifications_enabled, email_notifications, week_start_day,
              onboarding_completed, token_version
       FROM native_users WHERE email = $1`,
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // OAuth-only accounts have no password_hash, and bcrypt.compare throws on a
    // null hash — which surfaced as a 500 and made those accounts distinguishable
    // from unregistered addresses. Answer exactly as for a wrong password.
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // A registration whose code was never entered gets no session. Said only
    // after the right password, so it tells a stranger nothing.
    if ((await identityOf(db, user.id))?.status === 'pending') {
      return res.status(403).json({ error: 'Confirm your email address first', code: 'EMAIL_NOT_VERIFIED', email: user.email });
    }

    // Update last login
    await db.run('UPDATE native_users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Generate tokens with user's current token version
    const { accessToken, refreshToken } = generateTokens(user.id, user.token_version);

    res.json({
      user: serializeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
}));

// Google and Apple sign-in. Linking, the rule for an unproven password and
// the session row are decided in one locked transaction (accountLinking.js);
// the tokens are signed after it commits.
function providerSession(res, signedIn) {
  const { accessToken, refreshToken } = generateTokens(signedIn.user.id, signedIn.user.token_version);
  res.json({
    user: serializeUser(signedIn.user),
    accessToken,
    refreshToken,
    isNewUser: signedIn.isNewUser,
    linked: signedIn.linked, // Indicates if account was linked to existing user
    // The password on this account was never proven to be the owner's and is
    // gone, with every other session: the app says so and offers a reset.
    passwordRevoked: signedIn.passwordRevoked,
  });
}

// Google OAuth Login/Register
router.post('/google', asyncHandler(async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Verify token with Google
    const googleUser = await verifyGoogleToken(idToken);

    if (!googleUser.emailVerified) {
      return res.status(400).json({ error: 'Email not verified by Google', code: 'PROVIDER_EMAIL_UNVERIFIED' });
    }

    providerSession(res, await signInWithProvider({
      provider: 'google',
      providerUserId: googleUser.providerUserId,
      email: googleUser.email,
      emailVerified: googleUser.emailVerified,
      firstName: googleUser.firstName,
      lastName: googleUser.lastName,
      avatarUrl: googleUser.avatarUrl,
    }));
  } catch (err) {
    if (err instanceof ProviderSignInRefused) return res.status(err.status).json(err.body);
    console.error('[Auth] Google OAuth error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
}));

// Apple Sign-In Login/Register
router.post('/apple', asyncHandler(async (req, res) => {
  try {
    const { idToken, user } = req.body || {}; // Apple sends user data only on first sign-in

    if (typeof idToken !== 'string' || !idToken.trim()) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Verify token with Apple
    const appleUser = await verifyAppleToken(idToken);

    // Apple provides name only on first sign-in, extract from request if available
    const firstName = user?.givenName || user?.name?.givenName || user?.firstName || 'User';
    const lastName = user?.familyName || user?.name?.familyName || user?.lastName || '';

    providerSession(res, await signInWithProvider({
      provider: 'apple',
      providerUserId: appleUser.providerUserId,
      email: appleUser.email,
      emailVerified: appleUser.emailVerified,
      firstName,
      lastName,
      avatarUrl: null, // Apple doesn't provide avatars
    }));
  } catch (err) {
    if (err instanceof AppleAuthUnavailableError) {
      return res.status(503).json({ error: 'Apple sign-in is unavailable' });
    }
    if (err instanceof AppleTokenVerificationError) {
      return res.status(401).json({ error: 'Apple authentication failed' });
    }
    if (err instanceof ProviderSignInRefused) return res.status(err.status).json(err.body);
    console.error('[Auth] Apple OAuth error:', err);
    res.status(500).json({ error: 'Apple authentication failed' });
  }
}));

// Refresh access token
router.post('/refresh', asyncHandler(async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const decoded = verifyToken(refreshToken, 'refresh');
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Verify token version is still current (revocation check)
    const versionRow = await db.get('SELECT token_version FROM native_users WHERE id = $1', [decoded.userId]);
    if (!versionRow) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    const dbVersion = versionRow.token_version ?? 1;
    const tokenVer = decoded.tv ?? 1;
    if (tokenVer < dbVersion) {
      return res.status(401).json({ error: 'Session revoked' });
    }
    // A pending account is never issued tokens; if one appears, it is not renewed.
    if ((await identityOf(db, decoded.userId))?.status === 'pending') {
      return res.status(403).json({ error: 'Confirm your email address first', code: 'EMAIL_NOT_VERIFIED' });
    }

    // Generate new tokens with current version
    const tokens = generateTokens(decoded.userId, dbVersion);

    res.json(tokens);
  } catch (err) {
    console.error('[Auth] Refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
}));

// Get current user info
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  try {
    const user = await db.get(
      `SELECT id, email, first_name, last_name, phone, avatar_url, timezone, locale,
              notifications_enabled, email_notifications, week_start_day,
              onboarding_completed, created_at
       FROM native_users WHERE id = $1`,
      [req.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: serializeUser(user)
    });
  } catch (err) {
    console.error('[Auth] Get me error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
}));

// Update current user info.
//
// Profile fields are checked by accountInput.js. Two fields need more than a
// column write: a password change must prove the current password when there
// is one, and an email change needs the address confirmed — so a different
// email is refused here instead of being dropped while the app reports it
// saved (HP01). The app sends the unchanged address with every save, which is
// fine.
router.put('/me', requireAuth, asyncHandler(async (req, res) => {
  try {
    let updates;
    try {
      updates = profileUpdates(req.body);
      if (req.body.password !== undefined) checkPassword(req.body.password);
    } catch (error) {
      if (error instanceof InputError) return res.status(400).json(inputErrorBody(error));
      throw error;
    }
    const passwordChange = req.body.password !== undefined;

    const current = await db.get('SELECT email FROM native_users WHERE id = $1', [req.userId]);
    if (!current) return res.status(404).json({ error: 'User not found' });

    if (req.body.email !== undefined && (typeof req.body.email !== 'string'
        || req.body.email.trim().toLowerCase() !== String(current.email).trim().toLowerCase())) {
      return res.status(400).json({ error: 'Changing the email address needs confirmation of the new address',
        code: 'EMAIL_CHANGE_REQUIRES_VERIFICATION', field: 'email' });
    }

    if (updates.length === 0 && !passwordChange) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // The password is checked and replaced under the user row lock, with its
    // sign-in method recorded in the same transaction.
    const saved = await db.transaction(async (tx) => {
      const locked = await tx.get('SELECT password_hash FROM native_users WHERE id = $1 FOR UPDATE', [req.userId]);
      if (passwordChange) {
        // A stolen session must not be enough to replace the password and keep
        // the account. An account without one (OAuth only) may set its first.
        if (locked.password_hash) {
          const proof = req.body.currentPassword;
          if (typeof proof !== 'string' || !(await bcrypt.compare(proof, locked.password_hash))) return { refused: true };
        }
        updates.push(['password_hash', await bcrypt.hash(req.body.password, 10)]);
      }

      const assignments = updates.map(([column], index) => `${column} = $${index + 1}`);
      // Password change revokes all existing sessions
      if (passwordChange) assignments.push('token_version = token_version + 1');
      assignments.push('updated_at = NOW()');
      await tx.run(
        `UPDATE native_users SET ${assignments.join(', ')} WHERE id = $${updates.length + 1}`,
        [...updates.map(([, value]) => value), req.userId]
      );
      if (passwordChange) await recordPasswordMethod(tx, req.userId);
      // Read under the lock, so a new session carries the version this change
      // set, not one a later revocation set after COMMIT (R3-06).
      return { user: await tx.get(
        `SELECT id, email, first_name, last_name, phone, avatar_url, timezone, locale,
                notifications_enabled, email_notifications, week_start_day,
                onboarding_completed, token_version
         FROM native_users WHERE id = $1`,
        [req.userId]
      ) };
    });
    if (saved.refused) {
      return res.status(403).json({ error: 'Current password is incorrect', code: 'CURRENT_PASSWORD_INVALID',
        field: 'currentPassword' });
    }
    const { user } = saved;

    // If password changed, issue fresh tokens so this device stays logged in
    const response = { user: serializeUser(user) };
    if (passwordChange) {
      const tokens = generateTokens(user.id, user.token_version);
      response.accessToken = tokens.accessToken;
      response.refreshToken = tokens.refreshToken;
    }

    res.json(response);
  } catch (err) {
    console.error('[Auth] Update me error:', err);
    res.status(500).json({ error: 'Failed to update user info' });
  }
}));

// Logout — revoke all sessions for this user
router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  try {
    await db.run(
      'UPDATE native_users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1',
      [req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    res.status(500).json({ error: 'Failed to logout' });
  }
}));

// Delete account with cascade cleanup
router.delete('/me', requireAuth, asyncHandler(async (req, res) => {
  try {
    const userId = req.userId;

    // One connection, through db.transaction: a bare BEGIN over the pool leaves
    // the transaction open on a connection handed back for anyone to use, and
    // the ROLLBACK below would then discard a bystander's write instead of this
    // request's. Everything inside uses `tx`.
    const orphanedProjects = await db.transaction(async (tx) => {
      // The projects that go with the account.
      //
      // Everything this person owns, whoever else administers it, and nobody
      // inherits. That is a decision rather than a technical necessity: the
      // rule used to spare a project that had a second administrator, which
      // left it with no owner at all — and nothing ever sets one again, so it
      // could never be deleted or handed on. Making the project go is what
      // stops that state existing.
      //
      // Plus any project where this person is the last active administrator,
      // which covers the ownerless ones already out there.
      const orphaned = await tx.all(
        `SELECT p.id, p.name
         FROM native_projects p
         INNER JOIN native_project_members pm ON p.id = pm.project_id
         WHERE pm.user_id = $1
           AND pm.status = 'active'
           AND (
             pm.role = 'owner'
             OR (
               pm.role = 'admin'
               AND (
                 SELECT COUNT(*)
                 FROM native_project_members pm2
                 WHERE pm2.project_id = p.id
                   AND pm2.role IN ('owner', 'admin')
                   AND pm2.status = 'active'
               ) = 1
             )
           )`,
        [userId]
      );

      logger.debug(`[Auth] User ${userId} deletion: ${orphaned.length} projects will be deleted (no other admins)`);

      // Delete orphaned projects (CASCADE will handle rehearsals, members, etc.)
      for (const project of orphaned) {
        // Who is losing this project. Read before the delete takes the rows,
        // and kept for the notification that goes out after the commit — these
        // people are about to find a project missing with nothing to explain it.
        const members = await tx.all(
          `SELECT user_id FROM native_project_members
           WHERE project_id = $1 AND status = 'active' AND user_id != $2`,
          [project.id, userId]
        );
        project.memberIds = members.map((m) => m.user_id);

        // The busy hours this project's rehearsals put on their calendars. The
        // cascade cannot reach them — the link is source='rehearsal' plus an
        // external_event_id holding the id as text, not a foreign key — and
        // afterwards no endpoint can, since the project they name is gone. Left
        // alone they would keep these people looking unavailable in every other
        // project's planner, for rehearsals nobody can point at any more.
        await tx.run(
          `DELETE FROM native_user_availability
           WHERE source = 'rehearsal'
           AND external_event_id IN (SELECT CAST(id AS TEXT) FROM native_rehearsals WHERE project_id = $1)`,
          [project.id]
        );

        await tx.run('DELETE FROM native_projects WHERE id = $1', [project.id]);
        logger.debug(`[Auth] Deleted orphaned project: ${project.name} (id: ${project.id})`);
      }

      // Delete user (CASCADE will handle remaining memberships, availability, calendar connections, etc.)
      await tx.run('DELETE FROM native_users WHERE id = $1', [userId]);

      return orphaned;
    });

    // Outside the transaction, and each one on its own: the account is already
    // gone, so a push that fails must not read as a deletion that failed.
    for (const project of orphanedProjects) {
      if (!project.memberIds?.length) continue;
      try {
        await notifyProjectDeleted(project.name, project.memberIds);
      } catch (notifErr) {
        logger.error(`[Auth] Project-deleted notification failed for ${project.name}:`, notifErr);
      }
    }

    res.json({
      message: 'Account deleted successfully',
      deletedProjects: orphanedProjects.length
    });
  } catch (err) {
    console.error('[Auth] Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
}));

// Get linked auth providers for current user
router.get('/me/providers', requireAuth, asyncHandler(async (req, res) => {
  try {
    const providers = await getUserAuthProviders(req.userId);

    // Don't expose sensitive provider_user_id, just show type and email
    const sanitizedProviders = providers.map(p => ({
      providerType: p.provider_type,
      providerEmail: p.provider_email,
      createdAt: p.created_at,
      lastUsedAt: p.last_used_at,
    }));

    res.json({ providers: sanitizedProviders });
  } catch (err) {
    console.error('[Auth] Get providers error:', err);
    res.status(500).json({ error: 'Failed to get auth providers' });
  }
}));

// Unlink auth provider (only if user has another auth method)
router.delete('/me/providers/:provider', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { provider } = req.params;

    // Validate provider type
    if (!['email', 'google', 'apple'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider type' });
    }

    await unlinkAuthProvider(req.userId, provider);

    res.json({
      message: `${provider} provider unlinked successfully`,
    });
  } catch (err) {
    console.error('[Auth] Unlink provider error:', err);

    if (err.message === 'Cannot unlink the last authentication method') {
      return res.status(400).json({ error: err.message });
    }

    if (err.message === 'Auth provider not found') {
      return res.status(404).json({ error: err.message });
    }

    res.status(500).json({ error: 'Failed to unlink provider' });
  }
}));

export default router;

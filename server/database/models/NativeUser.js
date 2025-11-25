import db, { isPostgres } from '../db.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Helper for datetime - works with both SQLite and PostgreSQL
const now = () => isPostgres ? 'NOW()' : "datetime('now')";

/**
 * Native User model for email/password and Telegram authentication
 */

/**
 * Create a new native user with email/password
 */
export async function create({ email, password, firstName, lastName, phone }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const row = await db.get(
    `INSERT INTO native_users (email, password_hash, first_name, last_name, phone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ${now()}, ${now()})
     RETURNING *`,
    [email, passwordHash, firstName, lastName || null, phone || null]
  );

  return row;
}

/**
 * Create a new native user with Telegram
 */
export async function createWithTelegram({ telegramId, firstName, lastName, username, photoUrl }) {
  const row = await db.get(
    `INSERT INTO native_users (telegram_id, first_name, last_name, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ${now()}, ${now()})
     RETURNING *`,
    [telegramId, firstName, lastName || null, photoUrl || null]
  );

  return row;
}

/**
 * Find user by email
 */
export async function findByEmail(email) {
  return await db.get(
    'SELECT * FROM native_users WHERE email = ?',
    [email]
  );
}

/**
 * Find user by ID
 */
export async function findById(id) {
  return await db.get(
    'SELECT * FROM native_users WHERE id = ?',
    [id]
  );
}

/**
 * Find user by Telegram ID
 */
export async function findByTelegramId(telegramId) {
  return await db.get(
    'SELECT * FROM native_users WHERE telegram_id = ?',
    [telegramId]
  );
}

/**
 * Verify password
 */
export async function verifyPassword(plainPassword, passwordHash) {
  return await bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Update user
 */
export async function update(id, fields) {
  const updates = [];
  const values = [];

  if (fields.firstName !== undefined) {
    updates.push('first_name = ?');
    values.push(fields.firstName);
  }

  if (fields.lastName !== undefined) {
    updates.push('last_name = ?');
    values.push(fields.lastName);
  }

  if (fields.email !== undefined) {
    updates.push('email = ?');
    values.push(fields.email);
  }

  if (fields.phone !== undefined) {
    updates.push('phone = ?');
    values.push(fields.phone);
  }

  if (fields.password) {
    const passwordHash = await bcrypt.hash(fields.password, SALT_ROUNDS);
    updates.push('password_hash = ?');
    values.push(passwordHash);
  }

  if (fields.avatarUrl !== undefined) {
    updates.push('avatar_url = ?');
    values.push(fields.avatarUrl);
  }

  if (fields.timezone !== undefined) {
    updates.push('timezone = ?');
    values.push(fields.timezone);
  }

  if (fields.locale !== undefined) {
    updates.push('locale = ?');
    values.push(fields.locale);
  }

  if (fields.notificationsEnabled !== undefined) {
    updates.push('notifications_enabled = ?');
    values.push(fields.notificationsEnabled);
  }

  if (fields.emailNotifications !== undefined) {
    updates.push('email_notifications = ?');
    values.push(fields.emailNotifications);
  }

  if (fields.pushToken !== undefined) {
    updates.push('push_token = ?');
    values.push(fields.pushToken);
  }

  if (updates.length === 0) {
    return await findById(id);
  }

  updates.push(`updated_at = ${now()}`);
  values.push(id);

  await db.run(
    `UPDATE native_users SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  return await findById(id);
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(id) {
  await db.run(
    `UPDATE native_users SET last_login_at = ${now()} WHERE id = ?`,
    [id]
  );
}

/**
 * Delete user
 */
export async function deleteUser(id) {
  await db.run('DELETE FROM native_users WHERE id = ?', [id]);
}

/**
 * Get user projects
 */
export async function getUserProjects(userId) {
  return await db.all(
    `SELECT p.*, pm.role, pm.character_name
     FROM native_projects p
     JOIN native_project_members pm ON p.id = pm.project_id
     WHERE pm.user_id = ?
     ORDER BY p.created_at DESC`,
    [userId]
  );
}

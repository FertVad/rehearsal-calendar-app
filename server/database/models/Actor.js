import db from '../db.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function create(data) {
  const sql =
    'INSERT INTO actors (telegram_id, name, project_id, is_admin) VALUES (?, ?, ?, ?)';
  const params = [
    data.telegram_id,
    data.name,
    data.project_id,
    data.is_admin,
  ];
  try {
    const result = await db.run(sql, params);
    return findById(result.lastInsertId);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

/**
 * Create account with email/password (for native app)
 * Uses 'accounts' table in Neon schema
 */
export async function createWithEmail({ email, password, name }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const sql = 'INSERT INTO accounts (email, password_hash, name, created_at) VALUES ($1, $2, $3, NOW())';
  const params = [email, passwordHash, name];

  try {
    const result = await db.run(sql, params);
    const id = result.lastInsertId;
    return findAccountById(id);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

/**
 * Find account by id (for native app auth)
 */
export async function findAccountById(id) {
  const sql = 'SELECT * FROM accounts WHERE id = $1';
  const params = [id];
  try {
    return await db.get(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function findById(id) {
  const sql = 'SELECT * FROM actors WHERE id = ?';
  const params = [id];
  try {
    return await db.get(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function findByTelegramId(telegramId, projectId) {
  const sql =
    'SELECT * FROM actors WHERE telegram_id = ? AND project_id = ?';
  const params = [telegramId, projectId];
  try {
    return await db.get(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function upsertByTelegramId({ projectId, telegramId, patch }) {
  const existing = await findByTelegramId(telegramId, projectId);
  if (existing) {
    await update(existing.id, patch);
    return findById(existing.id);
  }
  const name = patch.name || String(telegramId);
  return create({
    telegram_id: telegramId,
    name,
    project_id: projectId,
    is_admin: patch.is_admin ?? false,
  });
}

export async function findAll() {
  const sql = 'SELECT * FROM actors';
  const params = [];
  try {
    return await db.all(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function update(id, data) {
  // Handle password hashing if password is being updated
  let passwordHash = undefined;
  if (data.password) {
    passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  }

  const sql = `UPDATE actors SET
      telegram_id = COALESCE(?, telegram_id),
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      password_hash = COALESCE(?, password_hash),
      project_id = COALESCE(?, project_id),
      is_admin = COALESCE(?, is_admin)
     WHERE id = ?`;
  const params = [
    data.telegram_id,
    data.name,
    data.email,
    passwordHash,
    data.project_id,
    data.is_admin,
    id,
  ];
  try {
    await db.run(sql, params);
    return findById(id);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function remove(id) {
  const sql = 'DELETE FROM actors WHERE id = ?';
  const params = [id];
  try {
    await db.run(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

/**
 * Find account by email (for native app login)
 * Uses 'accounts' table in Neon schema
 */
export async function findByEmail(email) {
  const sql = 'SELECT * FROM accounts WHERE email = $1';
  const params = [email];
  try {
    return await db.get(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

/**
 * Verify password (for native app login)
 */
export async function verifyPassword(plainPassword, passwordHash) {
  return await bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Update password
 */
export async function updatePassword(id, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const sql = 'UPDATE actors SET password_hash = ? WHERE id = ?';
  const params = [passwordHash, id];
  try {
    await db.run(sql, params);
    return findById(id);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

/**
 * Link telegram account to existing actor
 */
export async function linkTelegram(id, telegramId) {
  const sql = 'UPDATE actors SET telegram_id = ? WHERE id = ?';
  const params = [telegramId, id];
  try {
    await db.run(sql, params);
    return findById(id);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

/**
 * Find actor by telegram_id only (for native app)
 */
export async function findByTelegramIdOnly(telegramId) {
  const sql = 'SELECT * FROM actors WHERE telegram_id = ?';
  const params = [telegramId];
  try {
    return await db.get(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

/**
 * Create actor with telegram (for native app telegram login)
 */
export async function createWithTelegram({ telegramId, name, firstName, lastName, username, photoUrl }) {
  const fullName = name || `${firstName || ''} ${lastName || ''}`.trim() || username || 'User';
  const sql = 'INSERT INTO actors (telegram_id, name) VALUES (?, ?)';
  const params = [telegramId, fullName];

  try {
    const result = await db.run(sql, params);
    return findById(result.lastInsertId);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

import db from '../db.js';

export async function create(data) {
  const sql = 'INSERT INTO projects (chat_id, name) VALUES (?, ?)';
  const params = [data.chat_id, data.name];
  try {
    const result = await db.run(sql, params);
    return findById(result.lastInsertId);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function findById(id) {
  const sql = 'SELECT * FROM projects WHERE id = ?';
  const params = [id];
  try {
    return await db.get(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function findByChatId(chatId) {
  const sql = 'SELECT * FROM projects WHERE chat_id = ?';
  const params = [chatId];
  try {
    return await db.get(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function findAll() {
  const sql = 'SELECT * FROM projects';
  const params = [];
  try {
    return await db.all(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function update(id, data) {
  const sql =
    'UPDATE projects SET chat_id = COALESCE(?, chat_id), name = COALESCE(?, name) WHERE id = ?';
  const params = [data.chat_id, data.name, id];
  try {
    await db.run(sql, params);
    return findById(id);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function remove(id) {
  const sql = 'DELETE FROM projects WHERE id = ?';
  const params = [id];
  try {
    await db.run(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

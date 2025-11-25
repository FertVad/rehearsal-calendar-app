import db from '../db.js';

export async function create(data) {
  const sql =
    'INSERT INTO rehearsals (project_id, scene, date, time, duration, actors, actor_name_snapshot, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const params = [
    data.project_id,
    data.scene,
    data.date,
    data.time,
    data.duration,
    data.actors,
    data.actor_name_snapshot,
    data.notes,
  ];
  try {
    const result = await db.run(sql, params);
    return findById(result.lastInsertId);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function findById(id) {
  const sql = 'SELECT * FROM rehearsals WHERE id = ?';
  const params = [id];
  try {
    return await db.get(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function findAll() {
  const sql = 'SELECT * FROM rehearsals';
  const params = [];
  try {
    return await db.all(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

export async function update(id, data) {
  const sql = `UPDATE rehearsals SET
      project_id = COALESCE(?, project_id),
      scene = COALESCE(?, scene),
      date = COALESCE(?, date),
      time = COALESCE(?, time),
      duration = COALESCE(?, duration),
      actors = COALESCE(?, actors),
      actor_name_snapshot = COALESCE(?, actor_name_snapshot),
      notes = COALESCE(?, notes)
     WHERE id = ?`;
  const params = [
    data.project_id,
    data.scene,
    data.date,
    data.time,
    data.duration,
    data.actors,
    data.actor_name_snapshot,
    data.notes,
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
  const sql = 'DELETE FROM rehearsals WHERE id = ?';
  const params = [id];
  try {
    await db.run(sql, params);
  } catch (err) {
    console.error('Database error executing SQL:', sql, 'Params:', params, 'Error:', err);
    throw err;
  }
}

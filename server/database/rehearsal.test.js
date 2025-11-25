import test from 'node:test';
import assert from 'node:assert/strict';

import fs from 'fs';
import path from 'path';
import db, { initDatabase } from './db.js';
import * as Rehearsal from './models/Rehearsal.js';

await initDatabase();

// Ensure schema is present
const schema = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'schema.sql'), 'utf8');
for (const stmt of schema.split(';').map(s => s.trim()).filter(Boolean)) {
  await db.run(stmt);
}

test('updates rehearsal record', async () => {
  const created = await Rehearsal.create({
    project_id: null,
    scene: 'Initial',
    date: '2024-01-01',
    time: '10:00',
    duration: '1',
    actors: JSON.stringify(['A']),
    actor_name_snapshot: JSON.stringify([{ id: 'A', name: 'Actor A' }]),
    notes: 'note',
  });

  const updated = await Rehearsal.update(created.id, {
    scene: 'Updated',
    notes: 'changed',
  });

  assert.equal(updated.scene, 'Updated');
  assert.equal(updated.notes, 'changed');

  await Rehearsal.remove(created.id);
});

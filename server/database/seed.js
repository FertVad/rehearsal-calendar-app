import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Seed project
    const projectRes = await client.query(
      'INSERT INTO projects (chat_id, name) VALUES ($1, $2) RETURNING id',
      ['snow_queen_chat', 'Снежная королева'],
    );
    const projectId = projectRes.rows[0].id;

    // Seed actors
    const actorNames = ['Миша', 'Вадим', 'Илья', 'Саша', 'Настя', 'Вера', 'Таня', 'Костя', 'Оля', 'Гена'];
    const actors = [];
    for (const [idx, name] of actorNames.entries()) {
      const res = await client.query(
        'INSERT INTO actors (telegram_id, name, project_id) VALUES ($1, $2, $3) RETURNING id',
        [String(1000 + idx), name, projectId],
      );
      actors.push({ id: res.rows[0].id, name });
    }

    // Seed availability for 28 days starting 2025-07-13
    const startDate = new Date('2025-07-13');
    const partialRanges = [
      { start: '11:00', end: '17:00' },
      { start: '14:00', end: '18:00' },
      { start: '10:00', end: '14:00' },
    ];
    for (let i = 0; i < 28; i++) {
      const y = startDate.getFullYear();
      const m = String(startDate.getMonth() + 1).padStart(2, '0');
      const d = String(startDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      for (const actor of actors) {
        const r = Math.random();
        let ranges = [];
        if (r < 0.2) {
          ranges = [{ start: '00:00', end: '23:59' }];
        } else if (r < 0.5) {
          ranges = [partialRanges[Math.floor(Math.random() * partialRanges.length)]];
        }
        await client.query(
          'INSERT INTO availability (actor_id, date, time_ranges) VALUES ($1, $2, $3)',
          [actor.id, dateStr, JSON.stringify(ranges)],
        );
      }
      startDate.setDate(startDate.getDate() + 1);
    }

    // Seed rehearsals
    const actorIds = actors.map(a => String(a.id));
    await client.query(
      'INSERT INTO rehearsals (project_id, scene, date, time, duration, actors, actor_name_snapshot, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        projectId,
        'Акт 1, Сцена 1',
        '2025-07-20',
        '10:00',
        '2h',
        JSON.stringify(actorIds.slice(0, 5)),
        JSON.stringify(actorNames.slice(0, 5)),
        'Первая встреча',
      ],
    );
    await client.query(
      'INSERT INTO rehearsals (project_id, scene, date, time, duration, actors, actor_name_snapshot, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        projectId,
        'Акт 1, Сцена 2',
        '2025-07-25',
        '11:00',
        '2h',
        JSON.stringify(actorIds.slice(5)),
        JSON.stringify(actorNames.slice(5)),
        'Продолжение',
      ],
    );

    await client.query('COMMIT');
    console.log('Database seeded');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding database', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();


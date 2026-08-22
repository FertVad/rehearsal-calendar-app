/**
 * Seeds the demo account used for App Store screenshots and for Apple's
 * reviewer login.
 *
 * Naming is deliberately international and Latin-script: the same rows are
 * photographed in four languages, and a Cyrillic project title would look
 * wrong in the Spanish and German shots. The mix of a play, an awards show, a
 * ballet and a shoot is there to show the app is about productions in general,
 * not only theatre.
 *
 * Idempotent: re-running wipes the demo users and their data first, so the
 * screenshots can be re-cut without piling up duplicates. Nothing outside the
 * demo accounts is touched.
 */
import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';

const { initDatabase } = await import('../database/db.js');
const db = await initDatabase();

const DEMO_EMAIL = 'demo@rehearsly.me';
const DEMO_PASSWORD = 'RehearslyDemo2026';

/** Everyone here is disposable; the domain keeps them easy to find and purge. */
const CAST = [
  { email: 'maria@demo.rehearsly.me', first: 'Maria', last: 'Kovács' },
  { email: 'daniel@demo.rehearsly.me', first: 'Daniel', last: 'Okafor' },
  { email: 'sofia@demo.rehearsly.me', first: 'Sofía', last: 'Reyes' },
  { email: 'lukas@demo.rehearsly.me', first: 'Lukas', last: 'Brandt' },
  { email: 'yuki@demo.rehearsly.me', first: 'Yuki', last: 'Tanaka' },
  { email: 'amara@demo.rehearsly.me', first: 'Amara', last: 'Diallo' },
  { email: 'elena@demo.rehearsly.me', first: 'Elena', last: 'Rossi' },
  { email: 'tomas@demo.rehearsly.me', first: 'Tomás', last: 'Silva' },
  { email: 'nina@demo.rehearsly.me', first: 'Nina', last: 'Larsen' },
  { email: 'omar@demo.rehearsly.me', first: 'Omar', last: 'Haddad' },
];

const iso = (d) => d.toISOString();

/** A date N days from today at a given local hour, returned as UTC ISO. */
function at(dayOffset, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return iso(d);
}

async function wipeDemo() {
  const rows = await db.all(
    `SELECT id FROM native_users WHERE email = $1 OR email LIKE '%@demo.rehearsly.me'`,
    [DEMO_EMAIL]
  );
  if (rows.length === 0) return 0;

  const ids = rows.map((r) => r.id);
  const list = ids.join(',');

  const projects = await db.all(
    `SELECT DISTINCT project_id FROM native_project_members WHERE user_id IN (${list}) AND role = 'owner'`
  );
  const projectIds = projects.map((p) => p.project_id);

  if (projectIds.length) {
    const pl = projectIds.join(',');
    await db.run(
      `DELETE FROM native_rehearsal_responses WHERE rehearsal_id IN (SELECT id FROM native_rehearsals WHERE project_id IN (${pl}))`
    );
    await db.run(`DELETE FROM native_rehearsals WHERE project_id IN (${pl})`);
    await db.run(`DELETE FROM native_project_members WHERE project_id IN (${pl})`);
    await db.run(`DELETE FROM native_projects WHERE id IN (${pl})`);
  }

  await db.run(`DELETE FROM native_user_availability WHERE user_id IN (${list})`);
  await db.run(`DELETE FROM native_project_members WHERE user_id IN (${list})`);

  // The users themselves survive. Deleting them would hand the demo account a
  // fresh id on every run, which invalidates the session already signed in on
  // the simulator and forces a re-login mid-shoot.
  return ids.length;
}

async function createUser({ email, first, last, password = null, timezone = 'Europe/Berlin' }) {
  const existing = await db.get('SELECT id FROM native_users WHERE email = $1', [email]);
  if (existing) {
    await db.run(
      `UPDATE native_users SET first_name = $1, last_name = $2, timezone = $3, updated_at = NOW() WHERE id = $4`,
      [first, last, timezone, existing.id]
    );
    return existing.id;
  }

  const hash = password ? await bcrypt.hash(password, 10) : null;
  const res = await db.run(
    `INSERT INTO native_users (email, password_hash, first_name, last_name, timezone, locale, week_start_day, onboarding_completed, last_login_at)
     VALUES ($1, $2, $3, $4, $5, 'en', 'monday', TRUE, NOW())`,
    [email, hash, first, last, timezone]
  );
  const id = res.lastInsertId;
  await db.run(
    `INSERT INTO native_auth_providers (user_id, provider_type, provider_email, created_at, updated_at, last_used_at)
     VALUES ($1, 'email', $2, NOW(), NOW(), NOW())`,
    [id, email]
  );
  return id;
}

async function createProject({ name, description, ownerId, memberIds, timezone = 'Europe/Berlin' }) {
  const res = await db.run(
    `INSERT INTO native_projects (name, description, timezone) VALUES ($1, $2, $3)`,
    [name, description, timezone]
  );
  const projectId = res.lastInsertId;

  await db.run(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'owner', 'active', NOW(), NOW())`,
    [projectId, ownerId]
  );
  for (const uid of memberIds) {
    await db.run(
      `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
       VALUES ($1, $2, 'member', 'active', NOW(), NOW())`,
      [projectId, uid]
    );
  }
  return projectId;
}

async function createRehearsal({ projectId, title, description, startsAt, endsAt, location, createdBy, attendees }) {
  const res = await db.run(
    `INSERT INTO native_rehearsals (project_id, title, description, starts_at, ends_at, location, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [projectId, title, description, startsAt, endsAt, location, createdBy]
  );
  const rehearsalId = res.lastInsertId;

  // A call sheet is only interesting when the answers differ, so some people
  // have confirmed and some have not responded at all.
  for (const { userId, response } of attendees) {
    if (!response) continue;
    await db.run(
      `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES ($1, $2, $3)`,
      [rehearsalId, userId, response]
    );
  }
  return rehearsalId;
}

async function addBusy({ userId, startsAt, endsAt, source = 'manual', isAllDay = false }) {
  await db.run(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, is_all_day, source, external_event_id)
     VALUES ($1, $2, $3, 'busy', $4, $5, $6, $7)`,
    [
      userId,
      startsAt,
      endsAt,
      source === 'manual' ? null : 'Calendar Event',
      isAllDay,
      source,
      source === 'manual' ? null : `demo-${userId}-${startsAt}`,
    ]
  );
}

// ---------------------------------------------------------------------------

const wiped = await wipeDemo();
if (wiped) console.log(`Убрано прежних демо-пользователей: ${wiped}`);

const demoId = await createUser({
  email: DEMO_EMAIL,
  first: 'Alex',
  last: 'Moreau',
  password: DEMO_PASSWORD,
});

const cast = {};
for (const c of CAST) cast[c.first] = await createUser(c);
const ids = Object.values(cast);

// --- Projects: a play, an awards show, a ballet, a commercial shoot ---------

const hamlet = await createProject({
  name: 'Hamlet',
  description: 'Main stage production — premiere in November',
  ownerId: demoId,
  memberIds: [cast.Maria, cast.Daniel, cast.Sofía, cast.Lukas, cast.Elena, cast.Tomás, cast.Nina],
});

const grammy = await createProject({
  name: 'Grammy Awards 2027',
  description: 'Live broadcast — camera blocking and dress rehearsals',
  ownerId: demoId,
  memberIds: [cast.Daniel, cast.Yuki, cast.Amara, cast.Maria, cast.Omar, cast.Nina],
  timezone: 'America/Los_Angeles',
});

const swanLake = await createProject({
  name: 'Swan Lake',
  description: 'Touring ballet — corps de ballet calls',
  ownerId: demoId,
  memberIds: [cast.Sofía, cast.Yuki, cast.Amara, cast.Elena, cast.Nina],
});

const filmShoot = await createProject({
  name: 'Nocturne — Music Video',
  description: 'Two-day shoot, rooftop and studio',
  ownerId: demoId,
  memberIds: [cast.Lukas, cast.Amara, cast.Daniel, cast.Omar],
});

// --- Rehearsals -------------------------------------------------------------

// Being invited means having a response row at all: 'yes' is confirmed,
// 'no' is invited-but-not-yet-confirmed. Omitting the row would leave the
// person off the call sheet entirely, which is not what we want to show.
const invite = (memberIds, confirmedCount) =>
  memberIds.map((userId, i) => ({
    userId,
    response: i < confirmedCount ? 'yes' : 'no',
  }));

await createRehearsal({
  projectId: hamlet,
  title: 'Act II — run-through',
  description: 'Full act, no stops. Bring scripts.',
  startsAt: at(0, 18, 0),
  endsAt: at(0, 21, 0),
  location: 'Main Stage',
  createdBy: demoId,
  attendees: invite([demoId, cast.Maria, cast.Daniel, cast.Sofía, cast.Lukas, cast.Elena, cast.Tomás, cast.Nina], 5),
});

await createRehearsal({
  projectId: hamlet,
  title: 'Fight choreography',
  description: 'Laertes duel — safety walkthrough first',
  startsAt: at(1, 14, 0),
  endsAt: at(1, 17, 0),
  location: 'Rehearsal Room 2',
  createdBy: demoId,
  attendees: invite([demoId, cast.Daniel, cast.Lukas, cast.Tomás], 4),
});

await createRehearsal({
  projectId: hamlet,
  title: 'Costume fitting',
  startsAt: at(3, 11, 0),
  endsAt: at(3, 13, 0),
  location: 'Wardrobe',
  createdBy: demoId,
  attendees: invite([demoId, cast.Maria, cast.Sofía, cast.Elena, cast.Nina], 2),
});

await createRehearsal({
  projectId: grammy,
  title: 'Camera blocking',
  description: 'Positions for the opening number',
  startsAt: at(2, 10, 0),
  endsAt: at(2, 14, 0),
  location: 'Crypto.com Arena — Floor',
  createdBy: demoId,
  attendees: invite([demoId, cast.Daniel, cast.Yuki, cast.Amara, cast.Maria, cast.Omar, cast.Nina], 4),
});

await createRehearsal({
  projectId: grammy,
  title: 'Dress rehearsal',
  description: 'Full show, broadcast timing',
  startsAt: at(4, 16, 0),
  endsAt: at(4, 22, 0),
  location: 'Crypto.com Arena',
  createdBy: demoId,
  attendees: invite([demoId, cast.Daniel, cast.Yuki, cast.Amara, cast.Maria, cast.Omar, cast.Nina], 7),
});

await createRehearsal({
  projectId: swanLake,
  title: 'Corps de ballet — Act I',
  startsAt: at(1, 10, 0),
  endsAt: at(1, 13, 0),
  location: 'Studio A',
  createdBy: demoId,
  attendees: invite([demoId, cast.Sofía, cast.Yuki, cast.Amara, cast.Elena, cast.Nina], 3),
});

await createRehearsal({
  projectId: filmShoot,
  title: 'Rooftop setup',
  description: 'Golden hour — call 30 min before',
  startsAt: at(5, 17, 0),
  endsAt: at(5, 21, 0),
  location: 'Kreuzberg rooftop',
  createdBy: demoId,
  attendees: invite([demoId, cast.Lukas, cast.Amara, cast.Daniel, cast.Omar], 3),
});

// --- Availability -----------------------------------------------------------
// Spread deliberately uneven so Smart Planner has something to grade: some
// slots suit everyone, some suit nobody. A couple of entries come in as
// 'apple_calendar' to show what an imported busy block looks like.

await addBusy({ userId: cast.Maria, startsAt: at(2, 9, 0), endsAt: at(2, 13, 0) });
await addBusy({ userId: cast.Maria, startsAt: at(6, 0, 0), endsAt: at(6, 23, 59), isAllDay: true, source: 'apple_calendar' });
await addBusy({ userId: cast.Daniel, startsAt: at(2, 12, 0), endsAt: at(2, 18, 0), source: 'apple_calendar' });
await addBusy({ userId: cast.Daniel, startsAt: at(3, 9, 0), endsAt: at(3, 12, 0) });
await addBusy({ userId: cast.Sofía, startsAt: at(2, 15, 0), endsAt: at(2, 20, 0) });
await addBusy({ userId: cast.Lukas, startsAt: at(3, 14, 0), endsAt: at(3, 19, 0), source: 'google_calendar' });
await addBusy({ userId: cast.Yuki, startsAt: at(2, 8, 0), endsAt: at(2, 11, 0) });
await addBusy({ userId: cast.Yuki, startsAt: at(4, 0, 0), endsAt: at(4, 23, 59), isAllDay: true });
await addBusy({ userId: cast.Amara, startsAt: at(3, 16, 0), endsAt: at(3, 20, 0) });
await addBusy({ userId: demoId, startsAt: at(2, 19, 0), endsAt: at(2, 22, 0), source: 'apple_calendar' });

console.log('');
console.log('Демо-аккаунт готов');
console.log('  email:    ', DEMO_EMAIL);
console.log('  пароль:   ', DEMO_PASSWORD);
console.log('  проектов: 4 (Hamlet, Grammy Awards 2027, Swan Lake, Nocturne)');
console.log('  репетиций: 7, участников:', CAST.length + 1);
process.exit(0);

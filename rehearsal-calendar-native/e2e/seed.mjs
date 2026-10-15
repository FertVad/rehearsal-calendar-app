/**
 * The people and plans the e2e flows start from — on the runner's disposable
 * database and nowhere else (run.mjs owns the connection and refuses any other).
 *
 * Accounts are inserted directly, with their addresses already confirmed:
 * registering through the API needs a code sent by email. Everything after
 * that goes through the local server's API, so the seed runs the same code the
 * app does — the owner's membership, invites, rosters and the busy slots a
 * rehearsal books are made the way they are made for real.
 *
 * Times are local to the machine, which is also the simulator's zone, so a
 * rehearsal seeded for 18:00 tomorrow reads 18:00 tomorrow on screen.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import inviteFormat from'../shared/contracts/inviteCode.json' with { type: 'json' };

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server');
const bcrypt = createRequire(path.join(SERVER, 'package.json'))('bcrypt');

/** Synthetic, for the disposable database only. */
export const PASSWORD = 'e2e-local-only';

export const PEOPLE = {
  director: { email: 'director@e2e.test', firstName: 'Anna', lastName: 'Director', onboarded: true },
  hamlet: { email: 'hamlet@e2e.test', firstName: 'Hamlet', lastName: 'Dane', onboarded: true },
  ophelia: { email: 'ophelia@e2e.test', firstName: 'Ophelia', lastName: 'Bright', onboarded: true },
  horatio: { email: 'horatio@e2e.test', firstName: 'Horatio', lastName: 'Friend', onboarded: true },
  // The planner's project switch (07): two projects of their own, under a
  // director of their own, so no other flow's rehearsals weigh on their slots.
  stage: { email: 'stage@e2e.test', firstName: 'Olga', lastName: 'Stage', onboarded: true },
  masha: { email: 'masha@e2e.test', firstName: 'Masha', lastName: 'Prozorova', onboarded: true },
  irina: { email: 'irina@e2e.test', firstName: 'Irina', lastName: 'Prozorova', onboarded: true },
  smirnov: { email: 'smirnov@e2e.test', firstName: 'Grigory', lastName: 'Smirnov', onboarded: true },
  // An invite link opened before sign-in (08) and during onboarding (09): a
  // project of their own, and two people not yet in it.
  orsino: { email: 'orsino@e2e.test', firstName: 'Duke', lastName: 'Orsino', onboarded: true },
  viola: { email: 'viola@e2e.test', firstName: 'Viola', lastName: 'Messina', onboarded: true },
  sebastian: { email: 'sebastian@e2e.test', firstName: 'Sebastian', lastName: 'Messina', onboarded: false },
  // The availability editor (10): marks of his own, in no project, so nothing
  // another flow books lands on his days.
  treplev: { email: 'treplev@e2e.test', firstName: 'Konstantin', lastName: 'Treplev', onboarded: true },
  // A forgotten password (11) and a new sign-in address (12): accounts of
  // their own, since each flow leaves its account signing in differently.
  lear: { email: 'lear@e2e.test', firstName: 'King', lastName: 'Lear', onboarded: true },
  kent: { email: 'kent@e2e.test', firstName: 'Earl', lastName: 'Kent', onboarded: true },
  // A create whose answer is lost (13): in no project, so the projects they
  // see are the ones that flow makes.
  macduff: { email: 'macduff@e2e.test', firstName: 'Lord', lastName: 'Macduff', onboarded: true },
  // One account after another on the same running app (14): a project they
  // share, and one of Lopakhin's own that he runs.
  ranevskaya: { email: 'ranevskaya@e2e.test', firstName: 'Lyubov', lastName: 'Ranevskaya', onboarded: true },
  lopakhin: { email: 'lopakhin@e2e.test', firstName: 'Yermolai', lastName: 'Lopakhin', onboarded: true },
  // Has not been through onboarding yet.
  newcomer: { email: 'newcomer@e2e.test', firstName: 'Nina', lastName: 'Newcomer', onboarded: false },
};

const pad = (n) => String(n).padStart(2, '0');

/** A local day `offset` days from today, as YYYY-MM-DD. */
export function localDate(offset) {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** That day at a local time, written with its own offset, as the app sends it. */
export function localInstant(offset, hours, minutes = 0) {
  const [y, m, d] = localDate(offset).split('-').map(Number);
  const at = new Date(y, m - 1, d, hours, minutes);
  const zone = -at.getTimezoneOffset();
  const sign = zone >= 0 ? '+' : '-';
  return `${localDate(offset)}T${pad(hours)}:${pad(minutes)}:00${sign}${pad(Math.floor(Math.abs(zone) / 60))}:${pad(Math.abs(zone) % 60)}`;
}

async function call(apiUrl, method, route, { token, body } = {}) {
  const response = await fetch(apiUrl + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${route} answered ${response.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/**
 * Seeds the disposable database through `client` and the local server at
 * `apiUrl`. Returns what the flows need to know about it.
 */
export async function seed({ client, apiUrl, timezone }) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const ids = {};
  for (const [key, person] of Object.entries(PEOPLE)) {
    const { rows } = await client.query(
      `INSERT INTO native_users (email, password_hash, first_name, last_name, timezone, locale, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, 'en', $6) RETURNING id`,
      [person.email, hash, person.firstName, person.lastName, timezone, person.onboarded]);
    ids[key] = rows[0].id;
    await client.query(
      `INSERT INTO native_email_identities (user_id, email, status, verified_at, verified_by)
       VALUES ($1, $2, 'verified', NOW(), 'code')`,
      [ids[key], person.email]);
  }

  const token = {};
  for (const [key, person] of Object.entries(PEOPLE)) {
    token[key] = (await call(apiUrl, 'POST', '/auth/login', { body: { email: person.email, password: PASSWORD } })).accessToken;
  }

  const project = async (name, description, cast, owner = 'director') => {
    const { project: created } = await call(apiUrl, 'POST', '/native/projects',
      { token: token[owner], body: { name, description, timezone } });
    const { inviteCode } = await call(apiUrl, 'POST', `/native/projects/${created.id}/invite`, { token: token[owner], body: {} });
    for (const key of cast) await call(apiUrl, 'POST', `/native/invite/${inviteCode}/join`, { token: token[key], body: {} });
    return { id: created.id, inviteCode };
  };
  const { id: hamletId } = await project('Hamlet', 'Spring production', ['hamlet', 'ophelia', 'horatio']);
  const { id: seagullId } = await project('The Seagull', 'Studio reading', ['ophelia']);
  // Three people, then two with nobody in common but their director (07).
  const { id: sistersId } = await project('Three Sisters', 'Chekhov evening', ['masha', 'irina'], 'stage');
  const { id: bearId } = await project('The Bear', 'Chekhov evening', ['smirnov'], 'stage');
  // Nobody joins: Viola and Sebastian are asked in by link (08, 09). The code
  // is the server's own — eight characters, capitals among them — not one the
  // app's old lowercase-hex reading would take.
  const twelfth = await project('Twelfth Night', 'Illyria in winter', [], 'orsino');
  if (!new RegExp(`^[${inviteFormat.alphabet}]{${inviteFormat.length}}$`).test(twelfth.inviteCode)) {
    throw new Error(`The server issued ${twelfth.inviteCode}, not a short invite code`);
  }
  // Ranevskaya runs the orchard and Lopakhin is in it; he runs a project of his own.
  const { id: orchardId } = await project('The Cherry Orchard', 'Act IV', ['lopakhin'], 'ranevskaya');
  await project('Lopakhin Holdings', 'Summer cottages', [], 'lopakhin');

  const rehearsal = async (projectId, title, day, from, to, cast, by = 'director') => {
    const { rehearsal: created } = await call(apiUrl, 'POST', `/native/projects/${projectId}/rehearsals`, {
      token: token[by],
      body: {
        title,
        startsAt: localInstant(day, from),
        endsAt: localInstant(day, to),
        location: 'Main hall',
        participant_ids: cast.map((key) => String(ids[key])),
      },
    });
    return created.id;
  };
  const rehearsals = {
    actOne: await rehearsal(hamletId, 'Act I run-through', 1, 18, 21, ['director', 'hamlet', 'ophelia', 'horatio']),
    ophelia: await rehearsal(hamletId, 'Ophelia scenes', 3, 11, 13, ['director', 'ophelia']),
    dress: await rehearsal(hamletId, 'Full dress', 8, 19, 22, ['director', 'hamlet', 'ophelia', 'horatio']),
    reading: await rehearsal(seagullId, 'Table read', 2, 15, 17, ['director', 'ophelia']),
    orchard: await rehearsal(orchardId, 'Orchard walk', 1, 12, 14, ['ranevskaya', 'lopakhin'], 'ranevskaya'),
  };

  // Some of the cast are busy, so the planner has something to weigh.
  const busy = (day, from, to) => ({ date: localDate(day), entries: [{ startsAt: localInstant(day, from), endsAt: localInstant(day, to), type: 'busy' }] });
  await call(apiUrl, 'PUT', '/native/availability/days', { token: token.hamlet, body: { days: [busy(2, 9, 17), busy(4, 18, 22)] } });
  await call(apiUrl, 'PUT', '/native/availability/days', { token: token.horatio, body: { days: [busy(4, 10, 14)] } });
  // Only The Bear has him: its slots tomorrow name him, Three Sisters' never do.
  await call(apiUrl, 'PUT', '/native/availability/days', { token: token.smirnov, body: { days: [busy(1, 10, 14)] } });

  // The editor (10) marks the first of these; the last is busy all day, and
  // the flow changes it behind the screen's back while the editor is open.
  const days = { before: localDate(2), mark: localDate(3), after: localDate(4), other: localDate(6) };
  await call(apiUrl, 'PUT', '/native/availability/days', {
    token: token.treplev,
    body: { days: [{ date: days.other, entries: [{ startsAt: `${days.other}T00:00:00.000Z`, endsAt: `${days.other}T23:59:59.999Z`, type: 'busy', isAllDay: true }] }] },
  });

  // A create whose answer never arrives (13). The first project named
  // Dunsinane takes 13 seconds to insert — longer than the app's 10-second
  // request timeout — so the app gives up and shows an error while the server
  // goes on to commit it, its answer going to a closed connection. Only the
  // first: what the app sends after that is answered at once. On this
  // database alone; the schema the app runs on has no such trigger.
  await client.query(`CREATE SEQUENCE e2e_lost_answer;
    CREATE FUNCTION e2e_lose_answer() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.name = 'Dunsinane' AND nextval('e2e_lost_answer') = 1 THEN PERFORM pg_sleep(13); END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER e2e_lose_answer BEFORE INSERT ON native_projects
      FOR EACH ROW EXECUTE FUNCTION e2e_lose_answer()`);

  return {
    password: PASSWORD,
    people: Object.fromEntries(Object.entries(PEOPLE).map(([key, person]) => [key, { id: ids[key], email: person.email }])),
    projects: { hamlet: hamletId, seagull: seagullId, sisters: sistersId, bear: bearId, twelfth: twelfth.id },
    invites: { twelfth: twelfth.inviteCode },
    days,
    rehearsals,
  };
}

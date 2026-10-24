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
 * Times are local to the machine, and everyone's profile is in its zone, so a
 * rehearsal seeded for 18:00 tomorrow reads 18:00 tomorrow on screen. The
 * simulator is somewhere else on purpose (run.mjs, SIMULATOR_ZONE): the app
 * shows the profile's zone, never the device's (cause fix 14). One account is
 * in a zone of its own whatever the machine's (CHOSEN_ZONE, flow 23).
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
  // The rest of cause fix 12, one flow each, so none sees what another does.
  // Gaev runs the projects the others are told about (17, 18, 16).
  gaev: { email: 'gaev@e2e.test', firstName: 'Leonid', lastName: 'Gaev', onboarded: true },
  // Signed out from another device while the app is open (15).
  firs: { email: 'firs@e2e.test', firstName: 'Firs', lastName: 'Servant', onboarded: true },
  // One after the other on a running app (16): Yasha has a notification
  // unread, Dunyasha none, and her account speaks Russian.
  yasha: { email: 'yasha@e2e.test', firstName: 'Yasha', lastName: 'Valet', onboarded: true },
  dunyasha: { email: 'dunyasha@e2e.test', firstName: 'Dunyasha', lastName: 'Maid', onboarded: true, locale: 'ru' },
  // A filter answered late (17), an inbox answered late (18).
  trofimov: { email: 'trofimov@e2e.test', firstName: 'Petya', lastName: 'Trofimov', onboarded: true },
  anya: { email: 'anya@e2e.test', firstName: 'Anya', lastName: 'Ranevskaya', onboarded: true },
  // Deletes the project the form opened on (19).
  pishchik: { email: 'pishchik@e2e.test', firstName: 'Boris', lastName: 'Pishchik', onboarded: true },
  // Saves while the day's availability is still on its way (20).
  charlotta: { email: 'charlotta@e2e.test', firstName: 'Charlotta', lastName: 'Ivanovna', onboarded: true },
  // Deletes a notification while the inbox reloads (21): two of her own.
  varya: { email: 'varya@e2e.test', firstName: 'Varya', lastName: 'Housekeeper', onboarded: true },
  // One after the other while the first one's "mark all read" is on its way
  // (22): one notification unread for Yepikhodov, two for Dasha.
  yepikhodov: { email: 'yepikhodov@e2e.test', firstName: 'Semyon', lastName: 'Yepikhodov', onboarded: true },
  dasha: { email: 'dasha@e2e.test', firstName: 'Dasha', lastName: 'Cook', onboarded: true },
  // One zone, the profile's (23): Tel Aviv chosen, the phone elsewhere, and he
  // changes it in the profile. Rehearsals only he is on, so no other flow's move.
  chebutykin: { email: 'chebutykin@e2e.test', firstName: 'Ivan', lastName: 'Chebutykin', onboarded: true },
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

/** The calendar date in `zone` `offset` days from today, as YYYY-MM-DD. */
export function zoneDate(zone, offset) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

/** How far `zone`'s clock is ahead of UTC at `instant` (ms since the epoch), in ms. */
function zoneOffset(zone, instant) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant).map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant;
}

/** That day at a time on `zone`'s clock, as an ISO instant. */
export function zoneInstant(zone, offset, hours, minutes = 0) {
  const wall = Date.parse(`${zoneDate(zone, offset)}T${pad(hours)}:${pad(minutes)}:00Z`);
  return new Date(wall - zoneOffset(zone, wall - zoneOffset(zone, wall))).toISOString();
}

/**
 * Chebutykin's zone (23): Tel Aviv, set here rather than taken from the
 * machine, so his flow reads the same wherever it runs.
 */
export const CHOSEN_ZONE = 'Asia/Jerusalem';

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
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [person.email, hash, person.firstName, person.lastName, timezone, person.locale ?? 'en', person.onboarded]);
    ids[key] = rows[0].id;
    await client.query(
      `INSERT INTO native_email_identities (user_id, email, status, verified_at, verified_by)
       VALUES ($1, $2, 'verified', NOW(), 'code')`,
      [ids[key], person.email]);
  }

  // Signed in only when the seed acts as them: the server takes twenty
  // sign-ins a minute from one address, and most people need none here.
  const tokens = {};
  const token = async (key) => {
    tokens[key] ??= (await call(apiUrl, 'POST', '/auth/login', { body: { email: PEOPLE[key].email, password: PASSWORD } })).accessToken;
    return tokens[key];
  };

  const project = async (name, description, cast, owner = 'director', zone = timezone) => {
    const { project: created } = await call(apiUrl, 'POST', '/native/projects',
      { token: await token(owner), body: { name, description, timezone: zone } });
    const { inviteCode } = await call(apiUrl, 'POST', `/native/projects/${created.id}/invite`, { token: await token(owner), body: {} });
    for (const key of cast) await call(apiUrl, 'POST', `/native/invite/${inviteCode}/join`, { token: await token(key), body: {} });
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
  const { id: billiardsId } = await project('Gaev Billiards', 'Off the cushion', ['yasha', 'anya'], 'gaev');
  const { id: studentId } = await project('Eternal Student', 'Lectures', ['trofimov'], 'gaev');
  const { id: debatesId } = await project('Garden Debates', 'Evenings', ['trofimov'], 'gaev');
  const { id: pantryId } = await project('Firs Pantry', 'The silver', [], 'firs');
  const { id: keysId } = await project('Estate Keys', 'The housekeeping', ['varya'], 'gaev');
  // Yepikhodov and Dasha (22) are put in it as the join does, without signing
  // in: the seed has spent the twenty sign-ins it gets.
  const { id: kitchenId } = await project('Estate Kitchen', 'The servants', [], 'gaev');
  for (const key of ['yepikhodov', 'dasha']) {
    await client.query(
      `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
       VALUES ($1, $2, 'member', 'active', NOW(), NOW())`,
      [kitchenId, ids[key]]);
  }
  // Made in this order: the Estate is the newer, so the form opens on it.
  await project('Pishchik Mill', 'Flour', [], 'pishchik');
  await project('Pishchik Estate', 'Mortgaged', [], 'pishchik');
  await project('Charlotta Tricks', 'Card tricks', [], 'charlotta');
  // Gaev's, and Chebutykin in it as the join puts him (23): the sign-ins are spent.
  // His profile, and the project, in the zone he chose.
  await client.query('UPDATE native_users SET timezone = $1 WHERE id = $2', [CHOSEN_ZONE, ids.chebutykin]);
  const { id: roundsId } = await project('Doctor Rounds', 'The Prozorov house', [], 'gaev', CHOSEN_ZONE);
  await client.query(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'member', 'active', NOW(), NOW())`,
    [roundsId, ids.chebutykin]);

  // `from` and `to` are hours, or [hours, minutes], on the machine's clock or `zone`'s.
  const at = (day, time, zone) => {
    const [hours, minutes = 0] = Array.isArray(time) ? time : [time];
    return zone ? zoneInstant(zone, day, hours, minutes) : localInstant(day, hours, minutes);
  };
  const rehearsal = async (projectId, title, day, from, to, cast, by = 'director', zone) => {
    const { rehearsal: created } = await call(apiUrl, 'POST', `/native/projects/${projectId}/rehearsals`, {
      token: await token(by),
      body: {
        title,
        startsAt: at(day, from, zone),
        endsAt: at(day, to, zone),
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
    // Each tells the people on it, and nobody else.
    billiards: await rehearsal(billiardsId, 'Billiards practice', 2, 18, 20, ['gaev', 'yasha'], 'gaev'),
    cue: await rehearsal(billiardsId, 'Cue lesson', 3, 18, 20, ['gaev', 'anya'], 'gaev'),
    drill: await rehearsal(billiardsId, 'Cue drill', 4, 18, 20, ['gaev', 'anya'], 'gaev'),
    lecture: await rehearsal(studentId, 'Lecture on progress', 2, 10, 12, ['gaev', 'trofimov'], 'gaev'),
    debate: await rehearsal(debatesId, 'Garden debate', 2, 14, 16, ['gaev', 'trofimov'], 'gaev'),
    silver: await rehearsal(pantryId, 'Silver polishing', 1, 9, 11, ['firs'], 'firs'),
    ledger: await rehearsal(keysId, 'Ledger check', 3, 9, 11, ['gaev', 'varya'], 'gaev'),
    handover: await rehearsal(keysId, 'Keys handover', 4, 9, 11, ['gaev', 'varya'], 'gaev'),
    guitar: await rehearsal(kitchenId, 'Guitar song', 2, 20, 21, ['gaev', 'yepikhodov'], 'gaev'),
    supper: await rehearsal(kitchenId, 'Supper service', 3, 19, 20, ['gaev', 'dasha'], 'gaev'),
    linen: await rehearsal(kitchenId, 'Linen count', 4, 12, 13, ['gaev', 'dasha'], 'gaev'),
    // Both in the small hours in Tel Aviv, where the simulator (run.mjs) is
    // still on the day before: dated by the device, today's would be yesterday's.
    midnight: await rehearsal(roundsId, 'Midnight call', 0, [0, 30], 1, ['chebutykin'], 'gaev', CHOSEN_ZONE),
    watch: await rehearsal(roundsId, 'Night watch', 1, 2, 3, ['chebutykin'], 'gaev', CHOSEN_ZONE),
  };

  // What the flow reads after moving the profile to Tokyo: the same instant on
  // Tokyo's clock, six or seven hours on from Tel Aviv with summer time.
  const tokyo = (instant) => new Intl.DateTimeFormat('en-GB',
    { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant));
  const times = { watch_tokyo: tokyo(zoneInstant(CHOSEN_ZONE, 1, 2)) };

  // The planner's week in Tel Aviv, as its header names it in English:
  // "16-22 Oct", or "28 Oct - 3 Nov" across a month.
  const plannerDay = (offset) => {
    const day = new Date(`${zoneDate(CHOSEN_ZONE, offset)}T00:00:00Z`);
    return { day: day.getUTCDate(), month: day.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) };
  };
  const [first, last] = [plannerDay(0), plannerDay(6)];
  const labels = {
    week_chosen: first.month === last.month
      ? `${first.day}-${last.day} ${first.month}`
      : `${first.day} ${first.month} - ${last.day} ${last.month}`,
  };

  // Some of the cast are busy, so the planner has something to weigh.
  const busy = (day, from, to) => ({ date: localDate(day), entries: [{ startsAt: localInstant(day, from), endsAt: localInstant(day, to), type: 'busy' }] });
  await call(apiUrl, 'PUT', '/native/availability/days', { token: await token('hamlet'), body: { days: [busy(2, 9, 17), busy(4, 18, 22)] } });
  await call(apiUrl, 'PUT', '/native/availability/days', { token: await token('horatio'), body: { days: [busy(4, 10, 14)] } });
  // Only The Bear has him: its slots tomorrow name him, Three Sisters' never do.
  await call(apiUrl, 'PUT', '/native/availability/days', { token: await token('smirnov'), body: { days: [busy(1, 10, 14)] } });

  // The editor (10) marks the first of these; the last is busy all day, and
  // the flow changes it behind the screen's back while the editor is open.
  const days = { before: localDate(2), mark: localDate(3), after: localDate(4), other: localDate(6) };
  await call(apiUrl, 'PUT', '/native/availability/days', {
    token: await token('treplev'),
    body: { days: [{ date: days.other, entries: [{ startsAt: `${days.other}T00:00:00.000Z`, endsAt: `${days.other}T23:59:59.999Z`, type: 'busy', isAllDay: true }] }] },
  });
  // The day the editor's error names, in English: "October 27, 2026".
  labels.mark_day = new Date(`${days.mark}T00:00:00Z`).toLocaleDateString('en-US',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

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
    times,
    labels,
    rehearsals,
  };
}

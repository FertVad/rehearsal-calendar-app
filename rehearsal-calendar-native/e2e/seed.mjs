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
  // Launched by the same invite, signs in and turns it down (43): never joins,
  // so Viola's and Sebastian's flows find the project as they expect.
  antonio: { email: 'antonio@e2e.test', firstName: 'Antonio', lastName: 'Captain', onboarded: true },
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
  // What runs past midnight: a rehearsal from 23:00 yesterday to 01:00 today
  // (24), and a busy slot of her own from 23:00 to 01:00 later on (25).
  zarechnaya: { email: 'zarechnaya@e2e.test', firstName: 'Nina', lastName: 'Zarechnaya', onboarded: true },
  // A busy slot from 23:00 to 01:00 and one of the next morning, 00:00 to
  // 01:00, entered on its own; he adds an hour to the morning (27).
  trigorin: { email: 'trigorin@e2e.test', firstName: 'Boris', lastName: 'Trigorin', onboarded: true },
  // A three-day trip from his calendar, and its middle day marked free by
  // hand (28).
  dorn: { email: 'dorn@e2e.test', firstName: 'Yevgeny', lastName: 'Dorn', onboarded: true },
  // A busy slot from 23:00 to 01:00, and an event from his calendar at the
  // morning's same hours, 00:00 to 01:00 (29).
  shamrayev: { email: 'shamrayev@e2e.test', firstName: 'Ilya', lastName: 'Shamrayev', onboarded: true },
  // Makes a rehearsal from 23:00 to 01:00 in the form (26), alone in a project
  // of her own.
  arkadina: { email: 'arkadina@e2e.test', firstName: 'Irina', lastName: 'Arkadina', onboarded: true },
  // Syncs with the phone's calendar while the import's answer does not come
  // (30): one rehearsal of his own, so the export has something to write, and
  // nobody else's days take his imported events.
  medvedenko: { email: 'medvedenko@e2e.test', firstName: 'Semyon', lastName: 'Medvedenko', onboarded: true },
  // Sixty notifications, more than a page: the newest fifty read, the ten
  // before them not (33).
  anfisa: { email: 'anfisa@e2e.test', firstName: 'Anfisa', lastName: 'Nurse', onboarded: true },
  // Two unread, an inbox that does not load and a "read" that does not land (34).
  ferapont: { email: 'ferapont@e2e.test', firstName: 'Ferapont', lastName: 'Watchman', onboarded: true },
  // Marks all read before his inbox has come (35).
  kulygin: { email: 'kulygin@e2e.test', firstName: 'Fyodor', lastName: 'Kulygin', onboarded: true },
  // Opens one on a slow connection, then marks all read on a good one (36).
  tuzenbach: { email: 'tuzenbach@e2e.test', firstName: 'Nikolai', lastName: 'Tuzenbach', onboarded: true },
  // Marks all read and signs out before it reaches the server (37).
  solyony: { email: 'solyony@e2e.test', firstName: 'Vasily', lastName: 'Solyony', onboarded: true },
  // One turns notifications on, and her phone's answer comes only once he has
  // signed in after her (38): both with notifications off.
  natasha: { email: 'natasha@e2e.test', firstName: 'Natasha', lastName: 'Ivanovna', onboarded: true, notifications: false },
  andrei: { email: 'andrei@e2e.test', firstName: 'Andrei', lastName: 'Prozorov', onboarded: true, notifications: false },
  // Cause fix 22, one flow each: a past rehearsal on his project's page (39);
  // an admin who marks her own rehearsal seen in its details (40); a day picked
  // in the strip, then "Today" (41).
  sorin: { email: 'sorin@e2e.test', firstName: 'Pyotr', lastName: 'Sorin', onboarded: true },
  polina: { email: 'polina@e2e.test', firstName: 'Polina', lastName: 'Andreyevna', onboarded: true },
  yakov: { email: 'yakov@e2e.test', firstName: 'Yakov', lastName: 'Workman', onboarded: true },
  // An admin of her project who is not on its rehearsal, opening it by link
  // before her projects have come (42).
  // Not Charlotta, whose form (20) opens on her newest project.
  olga: { email: 'olga@e2e.test', firstName: 'Olga', lastName: 'Prozorova', onboarded: true },
  // Changes her language to Russian in the profile and back (44).
  vershinina: { email: 'vershinina@e2e.test', firstName: 'Masha', lastName: 'Vershinina', onboarded: true },
  // Sonya marks herself busy tomorrow, and Voynitsky, who runs their project,
  // sees it in his planner (45). Nobody else in it, so nothing another flow
  // books lands on their days.
  voynitsky: { email: 'voynitsky@e2e.test', firstName: 'Ivan', lastName: 'Voynitsky', onboarded: true },
  sonya: { email: 'sonya@e2e.test', firstName: 'Sonya', lastName: 'Serebryakova', onboarded: true },
  // Creates a project and swipes it away (46): in no project, so the one card
  // on his list is the one he made.
  banquo: { email: 'banquo@e2e.test', firstName: 'Banquo', lastName: 'Lochaber', onboarded: true },
  // Runs a company of thirteen, which the participants sheet searches, and a
  // project of two (48). The twelve others are ISLANDERS, who never sign in.
  prospero: { email: 'prospero@e2e.test', firstName: 'Prospero', lastName: 'Milan', onboarded: true },
  // Runs a project the islanders are in, and is told somebody joined it (61):
  // a tap on "New member" opens it on its members. Told its rehearsal was
  // changed and answered, with when it is (62).
  duncan: { email: 'duncan@e2e.test', firstName: 'King', lastName: 'Duncan', onboarded: true },
  // An admin of his project who swipes one of its rehearsals away and opens
  // the form from another's details, and an actor on both who has no swipe
  // (51). A project of their own: a deleted rehearsal is gone for every flow.
  claudius: { email: 'claudius@e2e.test', firstName: 'Claudius', lastName: 'King', onboarded: true },
  gertrude: { email: 'gertrude@e2e.test', firstName: 'Gertrude', lastName: 'Queen', onboarded: true },
  // An admin of her project who opens its rehearsal at 10:07 in the form and
  // saves it untouched, and steps a new one's start by five minutes (54).
  // Alone on it, so no other flow's times move.
  cordelia: { email: 'cordelia@e2e.test', firstName: 'Cordelia', lastName: 'Lear', onboarded: true },
  // Open the form's month in Spanish and in German, each in a project of her
  // own (56): languages none of the others speak.
  bernarda: { email: 'bernarda@e2e.test', firstName: 'Bernarda', lastName: 'Alba', onboarded: true, locale: 'es' },
  courage: { email: 'courage@e2e.test', firstName: 'Anna', lastName: 'Fierling', onboarded: true, locale: 'de' },
  // A day at the strip's edge, "Today" and a day of the month (57): on no
  // other project, so his strip is only his.
  telegin: { email: 'telegin@e2e.test', firstName: 'Ilya', lastName: 'Telegin', onboarded: true },
  // Neither has been through onboarding yet. One goes through it to the end
  // (09-onboarding), after which it is never shown to her again; the other
  // connects a calendar in it and comes back to the step (32), and needs it
  // still there whichever of the two runs first.
  newcomer: { email: 'newcomer@e2e.test', firstName: 'Nina', lastName: 'Newcomer', onboarded: false },
  perdita: { email: 'perdita@e2e.test', firstName: 'Perdita', lastName: 'Shepherd', onboarded: false },
  // New here too, and her account speaks Russian: onboarding in Russian, her
  // name in Cyrillic, the longest greeting of the four languages (60).
  nina: { email: 'nina@e2e.test', firstName: 'Нина', lastName: 'Новикова', onboarded: false, locale: 'ru' },
  // Looks over his profile: the last button, the language sheet's bottom, a
  // zone found by search and chosen (61). An account of his own, since the
  // zone he picks stays.
  puck: { email: 'puck@e2e.test', firstName: 'Robin', lastName: 'Goodfellow', onboarded: true },
  // An admin of two projects who opens "New rehearsal" on the older one's page,
  // and an actor in it, who has no such button (63). Nothing is saved.
  leonato: { email: 'leonato@e2e.test', firstName: 'Leonato', lastName: 'Governor', onboarded: true },
  hero: { email: 'hero@e2e.test', firstName: 'Hero', lastName: 'Messina', onboarded: true },
  // Busy all day on MARK_DAY, changes it and collapses the editor (64). In no
  // project, so nothing another flow books lands on her days.
  yelena: { email: 'yelena@e2e.test', firstName: 'Yelena', lastName: 'Serebryakova', onboarded: true },
  // The same day, busy all day, and the editor pulled down by its handle:
  // she saves it free (68); he changes nothing (67), or nothing he keeps (69).
  mariya: { email: 'mariya@e2e.test', firstName: 'Mariya', lastName: 'Voynitskaya', onboarded: true },
  astrov: { email: 'astrov@e2e.test', firstName: 'Mikhail', lastName: 'Astrov', onboarded: true },
  // Reads the dates in Russian (65): the calendar's month, a rehearsal three
  // days on in the upcoming ones, the availability's next month, the
  // planner's tomorrow. Admin of a project of her own, Gaev in it.
  marina: { email: 'marina@e2e.test', firstName: 'Marina', lastName: 'Nanny', onboarded: true, locale: 'ru' },
  // Looks for blue across the calendar, a rehearsal, her project and profile
  // (71): an admin of Athens Wood, Gaev its owner, and on its one rehearsal.
  // Her avatar is green: avatars keep their colours, blue among them.
  titania: { email: 'titania@e2e.test', firstName: 'Titania', lastName: 'Queen', onboarded: true },
  // One's own row first in a rehearsal's participants (72): on "Moated
  // grange", by name Angelo, Mariana, Vincentio — Mariana an actor in the
  // middle, Vincentio, its project's admin, last.
  angelo: { email: 'angelo@e2e.test', firstName: 'Angelo', lastName: 'Deputy', onboarded: true },
  mariana: { email: 'mariana@e2e.test', firstName: 'Mariana', lastName: 'Grange', onboarded: true },
  vincentio: { email: 'vincentio@e2e.test', firstName: 'Vincentio', lastName: 'Duke', onboarded: true },
  // Malvolio marks "Letter scene" seen, unmarks and marks it again, and again
  // once it has moved; Olivia, who runs their house, is told once and once
  // more (73, T-034). Nobody else in it, so no other flow's notices mix in.
  olivia: { email: 'olivia@e2e.test', firstName: 'Olivia', lastName: 'Countess', onboarded: true },
  malvolio: { email: 'malvolio@e2e.test', firstName: 'Malvolio', lastName: 'Steward', onboarded: true },
  // The calendar's rows (74, T-036): two projects she runs, three rehearsals
  // tomorrow and one the day after, and nobody else in them.
  juliet: { email: 'juliet@e2e.test', firstName: 'Juliet', lastName: 'Capulet', onboarded: true },
  // An actor whom Gaev makes an admin of their project while the app is open
  // (T-229): Benvolio is told by a push (75), Mercutio by nothing, and sees it
  // on coming back to the app (76). Each in no other project, so the planner's
  // projects are that one or none.
  benvolio: { email: 'benvolio@e2e.test', firstName: 'Benvolio', lastName: 'Montague', onboarded: true },
  mercutio: { email: 'mercutio@e2e.test', firstName: 'Mercutio', lastName: 'Escalus', onboarded: true },
  // An admin of two of Capulet's projects with the rehearsal form open while the
  // projects are read again behind it, and the role on one taken (77, T-229).
  tybalt: { email: 'tybalt@e2e.test', firstName: 'Tybalt', lastName: 'Capulet', onboarded: true },
  // Their owner, on no rehearsal and with no busy time: the form's cast is
  // free at any hour, so Create makes the rehearsal at once (77, T-236). With
  // Gaev, on two rehearsals today at 12:00, a run between 08:00 and 11:59
  // met "Schedule Conflict" instead.
  capulet: { email: 'capulet@e2e.test', firstName: 'Lord', lastName: 'Capulet', onboarded: true },
  // Rosalind puts Orlando on "Wrestling match", already scheduled with her
  // alone on it; he finds it in his inbox and opens it from there (79, T-233).
  // Nobody else in their project, so no other flow's notices mix in.
  rosalind: { email: 'rosalind@e2e.test', firstName: 'Rosalind', lastName: 'Duke', onboarded: true },
  orlando: { email: 'orlando@e2e.test', firstName: 'Orlando', lastName: 'Boys', onboarded: true },
  // Shares an invite link to his project while the network is gone, his
  // account in Russian (80, T-228). A project of his own: no invite is made.
  // Sends a bug report with the network gone (81): nothing reaches the server.
  khlestakov: { email: 'khlestakov@e2e.test', firstName: 'Ivan', lastName: 'Khlestakov', onboarded: true, locale: 'ru' },
  // Beatrice runs a project of three with no rehearsal yet, so its usual
  // length is three hours. Tomorrow Benedick is busy 09:00-13:00 and Claudio
  // 14:00-17:00: everyone is free 13:00-14:00 and from 17:00 (83, T-238).
  beatrice: { email: 'beatrice@e2e.test', firstName: 'Beatrice', lastName: 'Messina', onboarded: true },
  benedick: { email: 'benedick@e2e.test', firstName: 'Benedick', lastName: 'Padua', onboarded: true },
  claudio: { email: 'claudio@e2e.test', firstName: 'Claudio', lastName: 'Florence', onboarded: true },
};

/** Prospero's company (48), with him thirteen: one more than the sheet lists without a search. */
const ISLANDERS = [
  ['Ariel', 'Spirit'], ['Caliban', 'Island'], ['Miranda', 'Milan'], ['Ferdinand', 'Naples'],
  ['Alonso', 'Naples'], ['Gonzalo', 'Counsellor'], ['Adrian', 'Lord'], ['Francisco', 'Lord'],
  ['Trinculo', 'Jester'], ['Stephano', 'Butler'], ['Iris', 'Rainbow'], ['Juno', 'Queen'],
];

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
 * Another day of this week, as the calendar's strip shows it — from Monday,
 * everyone's default: tomorrow, or yesterday on a Sunday (41).
 */
export function otherDayThisWeek() {
  return new Date().getDay() === 0 ? -1 : 1;
}

/** Twelve days on, or twelve back when that is next month: in this month's grid (57). */
export function farDayThisMonth() {
  const day = new Date();
  const month = day.getMonth();
  day.setDate(day.getDate() + 12);
  return day.getMonth() === month ? 12 : -12;
}

/** This month's first Saturday and the Sunday after it, both in this month (41). */
export function firstWeekendOfMonth() {
  const day = new Date();
  day.setDate(1);
  while (day.getDay() !== 6) day.setDate(day.getDate() + 1);
  const saturday = new Date(day);
  day.setDate(day.getDate() + 1);
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { saturday: ymd(saturday), sunday: ymd(day) };
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
      `INSERT INTO native_users (email, password_hash, first_name, last_name, timezone, locale, onboarding_completed, notifications_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [person.email, hash, person.firstName, person.lastName, timezone, person.locale ?? 'en', person.onboarded,
        person.notifications ?? true]);
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
  // A second invitation opened over Twelfth Night's, the screen still up (08).
  const arden = await project('As You Like It', 'The forest of Arden', [], 'orsino');
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
  // Zarechnaya (24) too, for the same reason.
  const { id: nightId } = await project('Night Train', 'To Yelets', [], 'gaev');
  await client.query(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'member', 'active', NOW(), NOW())`,
    [nightId, ids.zarechnaya]);
  // Medvedenko (30) too, the same way.
  const { id: schoolId } = await project('Village School', 'Lessons', [], 'gaev');
  await client.query(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'member', 'active', NOW(), NOW())`,
    [schoolId, ids.medvedenko]);
  // Arkadina's (26), made as the server makes a project: the sign-ins are spent.
  const { rows: [lake] } = await client.query(
    `INSERT INTO native_projects (name, description, timezone, created_at, updated_at)
     VALUES ('Lake Theatre', 'By the lake', $1, NOW(), NOW()) RETURNING id`, [timezone]);
  await client.query(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'owner', 'active', NOW(), NOW())`,
    [lake.id, ids.arkadina]);
  // Voynitsky's, with Sonya in it (45), the same way.
  const { rows: [estate] } = await client.query(
    `INSERT INTO native_projects (name, description, timezone, created_at, updated_at)
     VALUES ('Uncle Vanya', 'The estate', $1, NOW(), NOW()) RETURNING id`, [timezone]);
  await client.query(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'owner', 'active', NOW(), NOW()), ($1, $3, 'member', 'active', NOW(), NOW())`,
    [estate.id, ids.voynitsky, ids.sonya]);
  // Bernarda's and Mutter's (56), one each, the same way.
  for (const [name, key] of [['La casa de Bernarda Alba', 'bernarda'], ['Mutter Courage', 'courage']]) {
    const { rows: [own] } = await client.query(
      `INSERT INTO native_projects (name, description, timezone, created_at, updated_at)
       VALUES ($1, 'Her own', $2, NOW(), NOW()) RETURNING id`, [name, timezone]);
    await client.query(
      `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
       VALUES ($1, $2, 'owner', 'active', NOW(), NOW())`,
      [own.id, ids[key]]);
  }
  // Prospero's (48), the same way: The Tempest with all twelve islanders, and
  // his cell with Ariel alone.
  const islanders = [];
  for (const [firstName, lastName] of ISLANDERS) {
    const { rows: [islander] } = await client.query(
      `INSERT INTO native_users (email, password_hash, first_name, last_name, timezone, locale, onboarding_completed, notifications_enabled)
       VALUES ($1, $2, $3, $4, $5, 'en', TRUE, FALSE) RETURNING id`,
      [`${firstName.toLowerCase()}@e2e.test`, hash, firstName, lastName, timezone]);
    islanders.push(islander.id);
  }
  const prosperoProject = async (name, description, members) => {
    const { rows: [made] } = await client.query(
      `INSERT INTO native_projects (name, description, timezone, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`, [name, description, timezone]);
    await client.query(
      `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
       VALUES ($1, $2, 'owner', 'active', NOW(), NOW())`,
      [made.id, ids.prospero]);
    for (const member of members) {
      await client.query(
        `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
         VALUES ($1, $2, 'member', 'active', NOW(), NOW())`,
        [made.id, member]);
    }
  };
  await prosperoProject('The Tempest', 'The island', islanders);
  await prosperoProject('Prospero Cell', 'The books', [islanders[0]]);
  // Duncan's (61), the same way, the islanders in it: a page longer than the
  // screen, so opening it on its members scrolls.
  const { rows: [castle] } = await client.query(
    `INSERT INTO native_projects (name, description, timezone, created_at, updated_at)
     VALUES ('Forres Castle', 'The great hall', $1, NOW(), NOW()) RETURNING id`, [timezone]);
  await client.query(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'owner', 'active', NOW(), NOW())`,
    [castle.id, ids.duncan]);
  for (const member of islanders) {
    await client.query(
      `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
       VALUES ($1, $2, 'member', 'active', NOW(), NOW())`,
      [castle.id, member]);
  }
  // And his own short one, him alone in it: left open when "New member" of
  // the castle is tapped (61, review of T-023). The older, so the castle
  // stays the project his app opens on.
  const { rows: [dunsinane] } = await client.query(
    `INSERT INTO native_projects (name, description, timezone, created_at, updated_at)
     VALUES ('Dunsinane', 'The hill', $1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day') RETURNING id`, [timezone]);
  await client.query(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'owner', 'active', NOW(), NOW())`,
    [dunsinane.id, ids.duncan]);
  // Its rehearsal, two days on at 19:00, that he is told was changed and was
  // answered (62). Put in as the project was: no sign-in, and nobody told.
  await client.query(
    `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, location, created_by, created_at, updated_at)
     VALUES ($1, 'Banquet', $2::timestamptz, $3::timestamptz, 'The great hall', $4, NOW(), NOW())`,
    [castle.id, localInstant(2, 19), localInstant(2, 22), ids.duncan]);
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

  // Cause fix 22 (39–42): Gaev's projects, each person put in as the join
  // does — the sign-ins are spent. Polina and Olga are admins of theirs,
  // so their details show the count.
  const joined = async (name, description, key, role = 'member') => {
    const { id } = await project(name, description, [], 'gaev');
    await client.query(
      `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
       VALUES ($1, $2, $3, 'active', NOW(), NOW())`,
      [id, ids[key], role]);
    return id;
  };
  const sorinEstateId = await joined('Sorin Estate', 'By the lake', 'sorin');
  const accountsId = await joined('Estate Accounts', 'The ledgers', 'polina', 'admin');
  const lighthouseId = await joined('Lighthouse', 'The night shift', 'yakov');
  const ballId = await joined('Estate Ball', 'The ballroom', 'olga', 'admin');
  // Claudius its admin, Gertrude in it (51).
  const courtId = await joined('Elsinore Court', 'The throne room', 'claudius', 'admin');
  await client.query(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'member', 'active', NOW(), NOW())`,
    [courtId, ids.gertrude]);
  // Cordelia its admin (54).
  const learId = await joined('Lear Court', 'The heath', 'cordelia', 'admin');
  const dachaId = await joined('Dacha Evenings', 'The terrace', 'telegin');
  // Leonato's two, Hero in the first (63). Made in this order: the Orchard is
  // the newer, the one the form opens on when no project is given it.
  const watchId = await joined('Messina Watch', 'The night watch', 'leonato', 'admin');
  await client.query(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'member', 'active', NOW(), NOW())`,
    [watchId, ids.hero]);
  await joined('Leonato Orchard', 'The arbour', 'leonato', 'admin');
  // Marina its admin (65).
  const nurseryId = await joined('Nursery Tea', 'The samovar', 'marina', 'admin');
  // Khlestakov its admin (80).
  await joined('Town Inspection', 'The inn', 'khlestakov', 'admin');
  // Titania its admin (71).
  const woodId = await joined('Athens Wood', 'The fairy bower', 'titania', 'admin');
  // Vincentio its admin, Angelo and Mariana in it (72).
  const viennaId = await joined('Vienna', 'The moated grange', 'vincentio', 'admin');
  for (const key of ['angelo', 'mariana']) {
    await client.query(
      `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
       VALUES ($1, $2, 'member', 'active', NOW(), NOW())`,
      [viennaId, ids[key]]);
  }
  // Actors in them, made admins while the flow runs (75, 76).
  await joined('Verona Square', 'The public place', 'benvolio');
  await joined('Verona Masque', 'The Capulet feast', 'mercutio');
  // Capulet's, Tybalt an admin of both; the Ball made last, the role taken
  // from it (77). Not Gaev's: he is busy today, and the form's default time
  // would meet him at some hours of the day (T-236). Inserted as Frederick
  // Court is below: the sign-ins are spent.
  for (const [name, description] of [['Feud Street', 'The duel'], ['Feud Ball', 'The masked dance']]) {
    const { rows: [feud] } = await client.query(
      `INSERT INTO native_projects (name, description, timezone, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`, [name, description, timezone]);
    await client.query(
      `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
       VALUES ($1, $2, 'owner', 'active', NOW(), NOW()), ($1, $3, 'admin', 'active', NOW(), NOW())`,
      [feud.id, ids.capulet, ids.tybalt]);
  }
  // Beatrice's, with Benedick and Claudio in it, and nobody else: nobody's
  // rehearsals or busy time but theirs below (83, T-238). Inserted, as the
  // Feud's are: the sign-ins are spent.
  {
    const { rows: [ado] } = await client.query(
      `INSERT INTO native_projects (name, description, timezone, created_at, updated_at)
       VALUES ('Much Ado', 'The garden', $1, NOW(), NOW()) RETURNING id`, [timezone]);
    await client.query(
      `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
       VALUES ($1, $2, 'owner', 'active', NOW(), NOW()), ($1, $3, 'member', 'active', NOW(), NOW()),
              ($1, $4, 'member', 'active', NOW(), NOW())`,
      [ado.id, ids.beatrice, ids.benedick, ids.claudio]);
  }

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
    lesson: await rehearsal(schoolId, 'Lesson plan', 2, 16, 17, ['gaev', 'medvedenko'], 'gaev'),
    midnight: await rehearsal(roundsId, 'Midnight call', 0, [0, 30], 1, ['chebutykin'], 'gaev', CHOSEN_ZONE),
    watch: await rehearsal(roundsId, 'Night watch', 1, 2, 3, ['chebutykin'], 'gaev', CHOSEN_ZONE),
    // Three Sisters' only one, an hour and a half three days ago: the length a
    // new one there is given (07, T-012). The Bear has none, so three hours.
    sisters: await rehearsal(sistersId, 'Read-through', -3, 18, [19, 30], ['stage', 'masha', 'irina'], 'stage'),
    // Three days ago: on his project's page, under the past ones (39).
    monologue: await rehearsal(sorinEstateId, 'Old monologue', -3, 12, 13, ['gaev', 'sorin'], 'gaev'),
    // Hers and Gaev's, neither seen: "0/2" until she marks it (40).
    review: await rehearsal(accountsId, 'Accounts review', 2, 12, 13, ['gaev', 'polina'], 'gaev'),
    // Today, and the other day of this week he picks in the strip (41).
    lamp: await rehearsal(lighthouseId, 'Lamp trimming', 0, 12, 13, ['gaev', 'yakov'], 'gaev'),
    boat: await rehearsal(lighthouseId, 'Boat repair', otherDayThisWeek(), 12, 13, ['gaev', 'yakov'], 'gaev'),
    // Gaev's alone: Olga, its project's admin, is not on it — "0/1" (42).
    ball: await rehearsal(ballId, 'Ball rehearsal', 2, 12, 13, ['gaev'], 'gaev'),
    // Claudius deletes the first by its swipe, Gaev and Gertrude told of it:
    // "Participants (2)". He opens the form from the second's details (51).
    court: await rehearsal(courtId, 'Court scene', 2, 15, 17, ['gaev', 'claudius', 'gertrude'], 'gaev'),
    play: await rehearsal(courtId, 'Play within', 3, 15, 17, ['gaev', 'claudius', 'gertrude'], 'gaev'),
    // Claudius deletes the first from its details on the project's page,
    // Gertrude told of it, and edits the second from its details twice (52).
    // Made by Gaev, signed in already: the seed's twenty sign-ins are spent.
    ghost: await rehearsal(courtId, 'Ghost watch', 2, 19, 20, ['claudius', 'gertrude'], 'gaev'),
    mousetrap: await rehearsal(courtId, 'The Mousetrap', 3, 19, 20, ['claudius', 'gertrude'], 'gaev'),
    // Off the form's five-minute step, as a rehearsal made before it (54).
    storm: await rehearsal(learId, 'Storm scene', 1, [10, 7], 12, ['cordelia'], 'gaev'),
    // Today, three days on at the strip's edge, and a day of the month (57).
    terrace: await rehearsal(dachaId, 'Tea on the terrace', 0, 12, 13, ['gaev', 'telegin'], 'gaev'),
    guitar_tuning: await rehearsal(dachaId, 'Guitar tuning', 3, 12, 13, ['gaev', 'telegin'], 'gaev'),
    planting: await rehearsal(dachaId, 'Tree planting', farDayThisMonth(), 12, 13, ['gaev', 'telegin'], 'gaev'),
    // Three days on: in her upcoming ones, named by its date (65).
    samovar: await rehearsal(nurseryId, 'Samovar', 3, 12, 13, ['gaev', 'marina'], 'gaev'),
    // Tomorrow, in her upcoming ones; she marks it seen (71).
    moonlit: await rehearsal(woodId, 'Moonlit dance', 1, 12, 13, ['gaev', 'titania'], 'gaev'),
    // Tomorrow, the three of Vienna on it, Gaev not: each reads their own row first (72).
    grange: await rehearsal(viennaId, 'Moated grange', 1, 15, 16, ['angelo', 'mariana', 'vincentio'], 'gaev'),
    // 23:00 yesterday to 01:00 today, so it is on today too (24).
    night: (await call(apiUrl, 'POST', `/native/projects/${nightId}/rehearsals`, {
      token: await token('gaev'),
      body: {
        title: 'Night run',
        startsAt: localInstant(-1, 23),
        endsAt: localInstant(0, 1),
        location: 'Station',
        participant_ids: [String(ids.zarechnaya)],
      },
    })).rehearsal.id,
  };

  // Olivia's house (73), made as the server makes a project and a rehearsal:
  // the sign-ins are spent. Tomorrow 12:00 to 13:00, Malvolio on it, not yet seen.
  const { rows: [house] } = await client.query(
    `INSERT INTO native_projects (name, description, timezone, created_at, updated_at)
     VALUES ('Illyria House', 'The garden', $1, NOW(), NOW()) RETURNING id`, [timezone]);
  await client.query(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'owner', 'active', NOW(), NOW()), ($1, $3, 'member', 'active', NOW(), NOW())`,
    [house.id, ids.olivia, ids.malvolio]);
  const { rows: [letter] } = await client.query(
    `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, location, created_by, created_at, updated_at)
     VALUES ($1, 'Letter scene', $2::timestamptz, $3::timestamptz, 'The box hedge', $4, NOW(), NOW()) RETURNING id`,
    [house.id, localInstant(1, 12), localInstant(1, 13), ids.olivia]);
  await client.query(
    `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at)
     VALUES ($1, $2, 'no', NOW(), NOW())`,
    [letter.id, ids.malvolio]);
  rehearsals.letter = String(letter.id);

  // Rosalind's court (79), the same way: tomorrow 16:00 to 17:00, she alone
  // on it, Orlando in the project but not on it until the flow puts him there.
  const { rows: [frederick] } = await client.query(
    `INSERT INTO native_projects (name, description, timezone, created_at, updated_at)
     VALUES ('Frederick Court', 'The usurper''s lawn', $1, NOW(), NOW()) RETURNING id`, [timezone]);
  await client.query(
    `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, 'owner', 'active', NOW(), NOW()), ($1, $3, 'member', 'active', NOW(), NOW())`,
    [frederick.id, ids.rosalind, ids.orlando]);
  const { rows: [wrestling] } = await client.query(
    `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, location, created_by, created_at, updated_at)
     VALUES ($1, 'Wrestling match', $2::timestamptz, $3::timestamptz, 'The lawn', $4, NOW(), NOW()) RETURNING id`,
    [frederick.id, localInstant(1, 16), localInstant(1, 17), ids.rosalind]);
  await client.query(
    `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at)
     VALUES ($1, $2, 'no', NOW(), NOW())`,
    [wrestling.id, ids.rosalind]);
  rehearsals.wrestling = String(wrestling.id);

  // Juliet's two (74), made as the server makes them: the sign-ins are spent.
  // Tomorrow a titled one with a place, one with no place, one with no title;
  // the day after, one whose title is longer than its row. She is on each.
  const verona = {};
  for (const name of ['Verona Square', 'Capulet House']) {
    const { rows: [made] } = await client.query(
      `INSERT INTO native_projects (name, description, timezone, created_at, updated_at)
       VALUES ($1, 'Fair Verona', $2, NOW(), NOW()) RETURNING id`, [name, timezone]);
    await client.query(
      `INSERT INTO native_project_members (project_id, user_id, role, status, invited_at, joined_at)
       VALUES ($1, $2, 'owner', 'active', NOW(), NOW())`,
      [made.id, ids.juliet]);
    verona[name] = made.id;
  }
  for (const [name, title, day, from, to, location] of [
    ['Capulet House', 'Masked ball', 1, 10, 11, 'Great chamber'],
    ['Verona Square', 'Street brawl', 1, 14, 15, null],
    ['Verona Square', null, 1, 17, 18, 'Friar cell'],
    ['Capulet House', 'Balcony scene in the orchard under the window at night', 2, 12, 13, 'Orchard'],
  ]) {
    const { rows: [made] } = await client.query(
      `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at, location, created_by, created_at, updated_at)
       VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5, $6, NOW(), NOW()) RETURNING id`,
      [verona[name], title, localInstant(day, from), localInstant(day, to), location, ids.juliet]);
    await client.query(
      `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at)
       VALUES ($1, $2, 'no', NOW(), NOW())`,
      [made.id, ids.juliet]);
  }

  // What the flow reads after moving the profile to Tokyo: the same instant on
  // Tokyo's clock, six or seven hours on from Tel Aviv with summer time — as
  // the en_US simulator, on the 12-hour clock, shows it: "9:00 AM". A pattern
  // for the flow: the space before AM/PM is ICU's narrow one, matched by "."
  // (T-017).
  const tokyo = (instant) => new Intl.DateTimeFormat('en-US',
    { timeZone: 'Asia/Tokyo', hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(instant)).replace(/\s/g, '.');
  const times = { watch_tokyo: tokyo(zoneInstant(CHOSEN_ZONE, 1, 2)) };

  // The planner's week in Tel Aviv, as its header names it in English, an
  // interval of dates (T-017): "Oct 16 – Oct 22", "Oct 28 – Nov 3".
  const plannerDay = (offset) => new Date(`${zoneDate(CHOSEN_ZONE, offset)}T00:00:00Z`)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const labels = {
    week_chosen: `${plannerDay(0)} – ${plannerDay(6)}`,
    // New York's offset today, as the timezone picker names it: "UTC-4" in
    // its summer, "UTC-5" in its winter (23). Node's Intl has the offset.
    new_york_offset: new Intl.DateTimeFormat('en', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find((part) => part.type === 'timeZoneName').value.replace('GMT', 'UTC'),
  };

  // Some of the cast are busy, so the planner has something to weigh.
  const busy = (day, from, to) => ({ date: localDate(day), entries: [{ startsAt: localInstant(day, from), endsAt: localInstant(day, to), type: 'busy' }] });
  await call(apiUrl, 'PUT', '/native/availability/days', { token: await token('hamlet'), body: { days: [busy(2, 9, 17), busy(4, 18, 22)] } });
  await call(apiUrl, 'PUT', '/native/availability/days', { token: await token('horatio'), body: { days: [busy(4, 10, 14)] } });
  // Only The Bear has him: its slots tomorrow name him, Three Sisters' never do.
  await call(apiUrl, 'PUT', '/native/availability/days', { token: await token('smirnov'), body: { days: [busy(1, 10, 14)] } });

  // The editor (10) marks the first of these; the last is busy all day, and
  // the flow changes it behind the screen's back while the editor is open.
  const days = {
    before: localDate(2), mark: localDate(3), after: localDate(4), other: localDate(6),
    // A day two months on, whose week is far below this month's title: the
    // editor saved there stays there (10, T-021).
    later: localDate(60),
    // Zarechnaya's slot (25), and Trigorin's (27): from 23:00 on the first to
    // 01:00 on the second.
    evening: localDate(5), morning: localDate(6),
    // The middle of Dorn's trip (28), marked free by hand.
    trip: localDate(4),
    // Yakov's day in the strip, and today (41).
    picked: localDate(otherDayThisWeek()), today: localDate(0),
    // The phone's today, in run.mjs's SIMULATOR_ZONE: not called today (41).
    phone_today: zoneDate('Pacific/Honolulu', 0),
    // The day Sonya marks busy, and the one after it, which stays free (45).
    tomorrow: localDate(1), after_tomorrow: localDate(2),
    // A day gone, in the form's calendar (55).
    yesterday: localDate(-1),
    // Telegin's day at the strip's edge, and his day of the month (57).
    edge: localDate(3), far: localDate(farDayThisMonth()),
    // A weekend in this month's period picker, which begins its weeks on
    // Monday, everyone's default: Sunday beside Saturday, not under it (41).
    ...firstWeekendOfMonth(),
  };
  await call(apiUrl, 'PUT', '/native/availability/days', {
    token: await token('treplev'),
    body: { days: [{ date: days.other, entries: [{ startsAt: `${days.other}T00:00:00.000Z`, endsAt: `${days.other}T23:59:59.999Z`, type: 'busy', isAllDay: true }] }] },
  });
  // The form's date as it names yesterday and tomorrow: "Saturday, October 31, 2026" (55).
  for (const key of ['yesterday', 'tomorrow']) {
    labels[key] = new Date(`${days[key]}T00:00:00Z`).toLocaleDateString('en-US',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  // A row's date column for tomorrow and the day after, in English: "Thu"
  // over "29" (74, T-036).
  for (const key of ['tomorrow', 'after_tomorrow']) {
    const day = new Date(`${days[key]}T00:00:00Z`);
    labels[`${key}_weekday`] = day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    labels[`${key}_number`] = String(day.getUTCDate());
  }
  // The day the editor's error names, in English: "October 27, 2026".
  labels.mark_day = new Date(`${days.mark}T00:00:00Z`).toLocaleDateString('en-US',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  // This month's title in the editor, in English: "November 2026" (10).
  labels.this_month = new Date(`${days.today}T00:00:00Z`).toLocaleDateString('en-US',
    { month: 'long', year: 'numeric', timeZone: 'UTC' });

  // Zarechnaya's own slot past midnight (25), the row PUT /availability/days
  // writes for it — written here, since the sign-ins are spent.
  await client.query(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source)
     VALUES ($1, $2::timestamptz, $3::timestamptz, 'busy', FALSE, 'manual')`,
    [ids.zarechnaya, localInstant(5, 23), localInstant(6, 1)]);
  // Trigorin's two (27): the same night, and the morning's hour of his own.
  await client.query(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source)
     VALUES ($1, $2::timestamptz, $3::timestamptz, 'busy', FALSE, 'manual'),
            ($1, $4::timestamptz, $3::timestamptz, 'busy', FALSE, 'manual')`,
    [ids.trigorin, localInstant(5, 23), localInstant(6, 1), localInstant(6, 0)]);
  // Dorn's (28): a whole-day trip over three days, as the phone's calendar
  // imports it, and the middle day free all day, as a save of that day writes it.
  await client.query(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source, external_event_id)
     VALUES ($1, $2::timestamptz, $3::timestamptz, 'busy', TRUE, 'google_calendar', 'e2e-trip'),
            ($1, $4::timestamptz, $5::timestamptz, 'available', TRUE, 'manual', NULL)`,
    [ids.dorn, `${localDate(3)}T00:00:00.000Z`, `${localDate(5)}T23:59:59.999Z`,
      `${days.trip}T00:00:00.000Z`, `${days.trip}T23:59:59.999Z`]);
  // Shamrayev's (29): the same night as Trigorin's, and an event from his
  // calendar at the hours the night ends in the morning.
  await client.query(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source, external_event_id)
     VALUES ($1, $2::timestamptz, $3::timestamptz, 'busy', FALSE, 'manual', NULL),
            ($1, $4::timestamptz, $3::timestamptz, 'busy', FALSE, 'google_calendar', 'e2e-early-train')`,
    [ids.shamrayev, localInstant(5, 23), localInstant(6, 1), localInstant(6, 0)]);
  // Benedick's and Claudio's tomorrow (83): an hour free between them.
  await client.query(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source)
     VALUES ($1, $2::timestamptz, $3::timestamptz, 'busy', FALSE, 'manual'),
            ($4, $5::timestamptz, $6::timestamptz, 'busy', FALSE, 'manual')`,
    [ids.benedick, localInstant(1, 9), localInstant(1, 13), ids.claudio, localInstant(1, 14), localInstant(1, 17)]);
  // Yelena's (64), Mariya's and Astrov's (67-69): MARK_DAY busy all day, as a
  // save of that day writes it.
  for (const key of ['yelena', 'mariya', 'astrov']) {
    await client.query(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, is_all_day, source)
       VALUES ($1, $2::timestamptz, $3::timestamptz, 'busy', TRUE, 'manual')`,
      [ids[key], `${days.mark}T00:00:00.000Z`, `${days.mark}T23:59:59.999Z`]);
  }

  // Inboxes written as the server records a notification, a minute apart and
  // to the millisecond as it writes them: sign-ins are spent, and sixty
  // rehearsals for one would weigh on everyone's calendars (33, 34).
  const notify = async (key, notices) => {
    const now = Date.now();
    for (const [n, { title, read }] of notices.entries()) {
      const at = new Date(now - (notices.length - n) * 60_000).toISOString();
      await client.query(
        `INSERT INTO native_notifications (user_id, type, title, body, data, sent_at, created_at, read_at)
         VALUES ($1, 'rehearsal_updated', $2, 'The Prozorov house', '{}', $3, $3, $4)`,
        [ids[key], title, at, read ? at : null]);
    }
  };
  // Oldest first: the Samovar is the oldest of all, past the first page.
  await notify('anfisa', Array.from({ length: 60 }, (_, n) => ({
    title: n === 0 ? 'Samovar polished' : `House notice ${n + 1}`,
    read: n >= 10,
  })));
  await notify('ferapont', [
    { title: 'Papers from the council', read: false },
    { title: 'Bread delivery', read: false },
  ]);
  await notify('kulygin', [{ title: 'Gymnasium council', read: false }]);
  await notify('tuzenbach', [
    { title: 'Brickworks shift', read: false },
    { title: 'Name-day toast', read: false },
  ]);
  await notify('solyony', [{ title: 'Duel at noon', read: false }]);

  return {
    password: PASSWORD,
    people: Object.fromEntries(Object.entries(PEOPLE).map(([key, person]) => [key, { id: ids[key], email: person.email }])),
    projects: { hamlet: hamletId, seagull: seagullId, sisters: sistersId, bear: bearId, twelfth: twelfth.id },
    // And Twelfth Night's typed in lowercase, as the field typed it (08, T-025).
    invites: { twelfth: twelfth.inviteCode, arden: arden.inviteCode, twelfth_lowercase: twelfth.inviteCode.toLowerCase() },
    days,
    times,
    labels,
    rehearsals,
  };
}

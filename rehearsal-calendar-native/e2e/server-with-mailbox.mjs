/**
 * The local server for e2e, with a mailbox the flows can read.
 *
 * The server's own code, unchanged: server.js is imported, not copied, and
 * listens as `node server.js` would. The run gives it
 * EMAIL_TRANSPORT=capture-for-tests, so a code the server mails is kept in this
 * process (capturedEmails) and nothing leaves the machine — there is no
 * provider key in its environment to use. A flow cannot read a process's
 * memory, so this one also answers on MAIL_HOST:MAIL_PORT:
 *
 *   GET /code?to=<address>   the code in the latest message to that address,
 *                            as { code }; 404 while there is none
 *
 * and writes each message to e2e/out/mail, to read after a run.
 *
 * It also holds answers back, for a flow that shows what a late answer does
 * (flows 16-18, 20) — what a slow network does to one request and not to the
 * next:
 *
 *   GET /hold?method=<M>&path=<regex>   for the next minute, the answer to every
 *                                       request of that method whose path
 *                                       matches waits
 *   GET /release                        sends every answer held, holds no more
 *
 * The request itself is handled at once; only its answer waits, so it says
 * what was true when it was asked. With `&before=1` the request waits instead,
 * and is handled on release: a change still on its way to the server, so what
 * is read meanwhile says what was true before it (flow 21). None waits past
 * HOLD_LIMIT_MS: iOS may give up on a request after ten seconds of silence, and
 * a held answer must still arrive. A longer wait (`&ms=`, a minute at most) is
 * for a request released later by the flow; a flow that wants the request to
 * fail as on no network drops it (`&drop=1`, below).
 *
 * With `&open=1` the request waits as with `before`, but its connection stays
 * open until release, however long the flow takes (OPEN_LIMIT_MS at most): the
 * answer starts at once — status 200 and JSON — and a space follows every
 * OPEN_BEAT_MS. The app's ten seconds are the time a request may go without
 * hearing anything (iOS counts them from the last byte), so the change is
 * still on its way when the next person has signed in (flow 22). On release
 * the request goes to the server and its body ends the answer; the status was
 * already sent, so this is for a change whose outcome the flow does not read,
 * or for a read the server answers 200: it is asked without If-None-Match, so
 * a read gets its body, never a 304 (flow 17, T-206).
 *
 * With `&drop=1` the request is not handled and its connection is closed at
 * once: the network gone, and the app's request fails then and there (flow 30).
 * A long `&ms=` fails it only if iOS gives up on the silence, and that is not
 * certain: in a night run (T-220) an import with a ten-second timeout heard
 * nothing for 40 s, then got its 200 when the hold lapsed, and the flow saw a
 * sync that succeeded. A flow whose point is what the app does after a failed
 * request, not how long it waits, fails it with `drop`. With `&before=1` too,
 * the request waits as with `before` and its connection is closed on release
 * (or when its `&ms=` lapses), not handed to the server: a request that fails
 * late, after something else has changed, when the flow says (flow 36).
 *
 * With `&lose=1` the request is handled at once and its answer is lost: when
 * the server has answered, the connection is closed with nothing sent. A change
 * the server made whose answer never reached the app (flow 13); unlike `drop`,
 * the request reaches the server.
 *
 * With `&dead=1` the network changes under the app: the request's connection
 * and every other connection the app has open go silent — whatever arrives on
 * them is read and never answered, and they are not closed, as a connection
 * the phone left on its old network looks from the app (T-240, the owner's
 * iPhone going from LTE to 5G). A new connection is answered as usual. Each
 * request on a silent one, and each later request on the same path, is logged
 * with its connection's number, so the log shows which connection a retry
 * took. A silent connection is closed after HOLD_WINDOW_MS, if the app has not
 * given up on it first.
 *
 * With `&once=1` only the next matching request is held, and the ones after it
 * go through: a read on a slow connection and the change after it on a good
 * one (flow 36). A request held `before` says how the server answered it on
 * release, so a flow's log shows a refusal for what it was (flow 37).
 *
 * It writes notifications as the server records them, to show an inbox that
 * grew while it was open (flow 33):
 *
 *   GET /notify?to=<address>&count=<n>&title=<t>   n notifications for that
 *                                                  account, oldest first,
 *                                                  titled "<t> 1" to "<t> n"
 *   GET /notify?to=<address>&type=member_joined&project=<name>&member=<who>
 *                                                  "New member" about that
 *                                                  project, sent as the join
 *                                                  sends it (flow 61)
 *   GET /notify?to=<address>&type=rehearsal_updated&rehearsal=<title>&change=<key>
 *   GET /notify?to=<address>&type=member_response&rehearsal=<title>&member=<who>
 *                                                  that rehearsal changed, or
 *                                                  answered, sent as an edit
 *                                                  and a "yes" send it (flow 62)
 *   GET /notify?to=<address>&type=rehearsal_created&rehearsal=<title>
 *   GET /notify?to=<address>&type=added_to_rehearsal&rehearsal=<title>
 *                                                  a new rehearsal, or one
 *                                                  they were put on, in their
 *                                                  language (flow 86)
 *
 * It measures an icon on a screenshot a flow took, which Maestro cannot: a
 * button that is only an icon is one element, the size of its target (ink.mjs):
 *
 *   GET /ink?shot=<name>&colour=<#rrggbb>&left=&right=&top=&bottom=[&tolerance=]
 *                                    { box: { width, height } } in points, of
 *                                    that colour within those fractions of the
 *                                    newest <name>.png in e2e/out/artifacts;
 *                                    within 40 a channel, or `tolerance`
 *   GET /ellipses?shot=<name>&left=&right=&top=&bottom=
 *                                    { ellipses: [{ left, top }] } in points,
 *                                    each "…" drawn there in place of text
 *                                    that did not fit (flow 59, T-241)
 *
 * It reads back what the server stored from an account's bug reports, to show
 * a report sent from the app arrived (flow 47):
 *
 *   GET /bug-reports?from=<address>   { reports: [{ message, screen }] }, oldest
 *                                     first
 *
 * It puts text on the simulator's pasteboard, as copying it in another app
 * would, for a flow that pastes with iOS's own paste control (flow 08):
 *
 *   GET /pasteboard?device=<udid>&text=<t>   `xcrun simctl pbcopy` on that
 *                                            simulator
 *
 * It delivers a push to the app on the simulator, which receives none from
 * Expo — as the server's own would arrive (flow 75, T-229):
 *
 *   GET /push?device=<udid>&app=<bundle>&type=role_changed&project=<name>&role=<r>
 *                                            `xcrun simctl push` of what
 *                                            notifyRoleChanged sends
 *
 * And it keeps count of the taps the flows had to take again:
 *
 *   GET /tap-again?tap=<what>&see=<what>   e2e/subflows/tap-and-see.yaml did not
 *                                          see the result of a tap and tapped
 *                                          once more; a line in
 *                                          e2e/out/taps-again.log, which run.mjs
 *                                          prints after the flows (T-207)
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturedEmails } from '../server/services/email/transport.js';
import db from '../server/database/db.js';
import { recordNotifications } from '../server/services/notifications/notificationStore.js';
import {
  notifyAddedToRehearsal, notifyMemberJoined, notifyMemberResponse, notifyRehearsalCreated, notifyRehearsalUpdated,
} from '../server/services/notifications/pushNotificationService.js';
import app from '../server/server.js';
import { ellipses, inkBox } from './ink.mjs';

const MAIL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'mail');
const ARTIFACTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'artifacts');
const TAPS_AGAIN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'taps-again.log');

assert.equal(process.env.EMAIL_TRANSPORT, 'capture-for-tests', 'The e2e server keeps its mail in memory, never sends it');
assert.equal(process.env.MAIL_HOST, '127.0.0.1', 'The mailbox answers on 127.0.0.1 only');

fs.rmSync(MAIL, { recursive: true, force: true });
fs.mkdirSync(MAIL, { recursive: true });
fs.rmSync(TAPS_AGAIN, { force: true });
const keep = capturedEmails.push.bind(capturedEmails);
capturedEmails.push = (...messages) => {
  for (const [index, message] of messages.entries()) {
    const name = `${String(capturedEmails.length + index + 1).padStart(3, '0')}-${message.to}.txt`;
    fs.writeFileSync(path.join(MAIL, name), `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
  }
  return keep(...messages);
};

const HOLD_LIMIT_MS = 9000;
// A flow that fails between its hold and its release must not slow the flows
// after it: a hold lapses on its own.
const HOLD_WINDOW_MS = 60000;
const OPEN_LIMIT_MS = 180000;
const OPEN_BEAT_MS = 2000;
let holds = [];
const held = new Set();

// The server itself, on a port of its own, for a request held open: its answer
// has begun on the app's connection, so the server answers it here instead.
const inner = http.createServer(app).listen(0, '127.0.0.1');

// Keeps the app's connection open, and on release hands the request to the
// server and ends the answer with what the server said.
function holdOpen(request, response, hold) {
  const { pathname } = new URL(request.url, 'http://api');
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.write(' ');
  const beat = setInterval(() => response.write(' '), OPEN_BEAT_MS);
  let done = false;
  const stop = () => {
    done = true;
    clearInterval(beat);
    clearTimeout(limit);
    held.delete(onRelease);
  };
  const onRelease = () => {
    if (done) return;
    stop();
    // Asked without its conditions: the 200 is already sent, so a read must get
    // its body back, not a 304 with none to the copy the app has cached — the
    // app then read an empty answer, not the late one (T-206).
    const { 'if-none-match': _etag, 'if-modified-since': _since, ...headers } = request.headers;
    const forward = http.request({ host: '127.0.0.1', port: inner.address().port, method: request.method, path: request.url, headers }, (answer) => {
      const body = [];
      answer.on('data', (chunk) => body.push(chunk));
      answer.on('end', () => {
        console.log(`[e2e] released ${request.method} ${pathname}: the server answered ${answer.statusCode}`);
        response.end(Buffer.concat(body));
      });
    });
    forward.on('error', (error) => response.destroy(error));
    request.pipe(forward);
  };
  const limit = setTimeout(onRelease, hold.limitMs);
  held.add(onRelease);
  // The app gone (the next flow relaunches it): the change goes nowhere.
  response.on('close', () => {
    if (!done) stop();
  });
  console.log(`[e2e] holding the request ${request.method} ${pathname}, its connection open`);
}

// Hands the request to the server and, when its answer is ready, closes the
// connection instead of sending it: the server did the work, the app never
// hears of it. Nothing of the answer reaches the socket — Node sends the
// headers with the first body bytes, and both go here.
// What the server made for a lost answer, by its Idempotency-Key, so the log
// says what a request sent again with that key was answered.
const lostKeys = new Map();

// The id an answer names: its object's (`{ project: { id } }`) or its own.
function idIn(chunk) {
  try {
    const body = JSON.parse(String(chunk));
    return Object.values(body).find((value) => value && value.id !== undefined)?.id ?? body.id;
  } catch {
    return undefined;
  }
}

function loseAnswer(request, response, handle) {
  const { pathname } = new URL(request.url, 'http://api');
  const key = request.headers['idempotency-key'];
  response.write = () => true;
  response.end = (chunk) => {
    const id = idIn(chunk);
    if (key) lostKeys.set(key, id);
    console.log(`[e2e] lost the answer to ${request.method} ${pathname} (key ${key || 'none'}): the server answered ${response.statusCode} with id ${id}, its connection closed, no answer`);
    request.socket.destroy();
    return response;
  };
  console.log(`[e2e] handling the request ${request.method} ${pathname} (key ${key || 'none'}), to lose its answer`);
  handle();
}

// A request sent again with the key of a lost answer: what the server said.
function logAgain(request, response) {
  const key = request.headers['idempotency-key'];
  if (!key || !lostKeys.has(key)) return;
  const { pathname } = new URL(request.url, 'http://api');
  const end = response.end.bind(response);
  response.end = (chunk, ...rest) => {
    console.log(`[e2e] ${request.method} ${pathname} again with the key of a lost answer (${key}): the server answered ${response.statusCode} with id ${idIn(chunk)}, the lost one had id ${lostKeys.get(key)}`);
    return end(chunk, ...rest);
  };
}

// The app's connections, numbered as they come, and those the network left
// behind (`&dead=1`): read, never answered, never closed by us before
// HOLD_WINDOW_MS.
const connections = new Set();
const silent = new WeakSet();
let connectionCount = 0;
// The paths a `dead` hold named, for HOLD_WINDOW_MS: their requests are logged
// with the connection each came on.
let watched = [];

function trackConnection(socket) {
  socket.e2eNumber = ++connectionCount;
  connections.add(socket);
  socket.on('close', () => connections.delete(socket));
}

function goSilent() {
  for (const socket of connections) {
    if (silent.has(socket)) continue;
    silent.add(socket);
    // Node closes an idle connection after its keep-alive time; one the
    // network left behind is not closed, it is just never heard from again.
    socket.setTimeout(0);
    setTimeout(() => socket.destroy(), HOLD_WINDOW_MS).unref();
  }
}

// True when the request came on a silent connection: it is read and dropped
// on the floor, with no answer.
function swallowed(request) {
  const { pathname } = new URL(request.url, 'http://api');
  watched = watched.filter((watch) => watch.until > Date.now());
  const number = request.socket.e2eNumber;
  if (silent.has(request.socket)) {
    console.log(`[e2e] ${request.method} ${pathname} on connection #${number}, which the network left behind: no answer`);
    request.resume();
    return true;
  }
  if (watched.some((watch) => watch.method === request.method && watch.path.test(pathname))) {
    console.log(`[e2e] ${request.method} ${pathname} on connection #${number}, a live one`);
  }
  return false;
}

// Hands the request to `handle` — at once, or on release when its hold says
// the request waits.
function holdAnswer(request, response, handle) {
  const { pathname } = new URL(request.url, 'http://api');
  holds = holds.filter((hold) => hold.until > Date.now());
  const hold = holds.find((candidate) => candidate.method === request.method && candidate.path.test(pathname));
  if (!hold) return handle();
  if (hold.once) holds = holds.filter((candidate) => candidate !== hold);
  if (hold.dead) {
    goSilent();
    watched.push({ method: hold.method, path: hold.path, until: Date.now() + HOLD_WINDOW_MS });
    console.log(`[e2e] the network changed: ${request.method} ${pathname} on connection #${request.socket.e2eNumber} and ${connections.size - 1} other connection(s) went silent`);
    request.resume();
    return;
  }
  const drop = () => {
    console.log(`[e2e] dropped the request ${request.method} ${pathname}: its connection closed, no answer`);
    request.socket.destroy();
  };
  if (hold.drop && !hold.before) return drop();
  if (hold.lose) return loseAnswer(request, response, handle);
  if (hold.open) return holdOpen(request, response, hold);
  let released = false;
  const release = (then) => () => {
    if (released) return;
    released = true;
    held.delete(onRelease);
    clearTimeout(limit);
    then();
  };
  let onRelease;
  let limit;
  if (hold.before && hold.drop) {
    onRelease = release(drop);
    limit = setTimeout(onRelease, hold.limitMs);
    held.add(onRelease);
    console.log(`[e2e] holding the request ${request.method} ${pathname}, to drop it on release`);
    return;
  }
  if (hold.before) {
    response.on('finish', () => {
      console.log(`[e2e] released ${request.method} ${pathname}: the server answered ${response.statusCode}`);
    });
    onRelease = release(handle);
    limit = setTimeout(onRelease, hold.limitMs);
    held.add(onRelease);
    console.log(`[e2e] holding the request ${request.method} ${pathname}`);
    return;
  }
  const end = response.end.bind(response);
  let pending = null;
  onRelease = release(() => {
    if (pending) end(...pending);
  });
  limit = setTimeout(onRelease, hold.limitMs);
  held.add(onRelease);
  response.end = (...args) => {
    if (released) return end(...args);
    pending = args;
    return response;
  };
  console.log(`[e2e] holding the answer to ${request.method} ${pathname}`);
  handle();
}

// The server's CSP says upgrade-insecure-requests: in production, on https, it
// changes nothing; here, on plain http, Safari fetched legal.js and the styles
// from https://127.0.0.1:3001, which is not there, so a public page had no
// script — no language but English, its buttons dead (T-038, flow 70). Only
// that directive is taken out of the answers this local server gives.
function withoutUpgrade(response) {
  const setHeader = response.setHeader.bind(response);
  response.setHeader = (name, value) => setHeader(name, String(name).toLowerCase() === 'content-security-policy'
    ? String(value).replace(/;?\s*upgrade-insecure-requests\b/, '')
    : value);
}

// As app.listen would, with the hold in front.
http.createServer((request, response) => {
  if (swallowed(request)) return;
  withoutUpgrade(response);
  logAgain(request, response);
  holdAnswer(request, response, () => app(request, response));
}).on('connection', trackConnection).listen(Number(process.env.PORT), process.env.HOST, () => {
  console.log('[e2e] server listening');
});

http.createServer((request, response) => {
  const url = new URL(request.url, 'http://mailbox');
  const answer = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  if (request.method === 'GET' && url.pathname === '/hold') {
    const method = (url.searchParams.get('method') || 'GET').toUpperCase();
    const open = url.searchParams.get('open') === '1';
    const limitMs = open ? OPEN_LIMIT_MS : Math.min(Number(url.searchParams.get('ms')) || HOLD_LIMIT_MS, HOLD_WINDOW_MS);
    const before = url.searchParams.get('before') === '1';
    const once = url.searchParams.get('once') === '1';
    const drop = url.searchParams.get('drop') === '1';
    const lose = url.searchParams.get('lose') === '1';
    const dead = url.searchParams.get('dead') === '1';
    holds.push({ method, path: new RegExp(url.searchParams.get('path') || '^$'), limitMs, before, open, once, drop, lose, dead, until: Date.now() + HOLD_WINDOW_MS });
    return answer(200, { holding: holds.length });
  }
  if (request.method === 'GET' && url.pathname === '/notify' && url.searchParams.get('type') === 'member_joined') {
    const to = (url.searchParams.get('to') || '').trim().toLowerCase();
    const projectName = url.searchParams.get('project') || '';
    const member = url.searchParams.get('member') || 'Somebody';
    (async () => {
      const user = await db.get('SELECT id FROM native_users WHERE email = $1', [to]);
      if (!user) return answer(404, { error: `no account ${to}` });
      const project = await db.get('SELECT id, name FROM native_projects WHERE name = $1', [projectName]);
      if (!project) return answer(404, { error: `no project ${projectName}` });
      // As the join tells them (inviteRedemption.js), the server's own words and data.
      await notifyMemberJoined(project.name, member, [user.id], project.id);
      console.log(`[e2e] told ${to} that ${member} joined ${project.name}`);
      return answer(200, { recorded: 1 });
    })().catch((error) => answer(500, { error: String(error) }));
    return;
  }
  const about = url.searchParams.get('type');
  if (request.method === 'GET' && url.pathname === '/notify'
    && ['rehearsal_updated', 'member_response', 'rehearsal_created', 'added_to_rehearsal'].includes(about)) {
    const to = (url.searchParams.get('to') || '').trim().toLowerCase();
    const title = url.searchParams.get('rehearsal') || '';
    (async () => {
      const user = await db.get('SELECT id FROM native_users WHERE email = $1', [to]);
      if (!user) return answer(404, { error: `no account ${to}` });
      const rehearsal = await db.get('SELECT * FROM native_rehearsals WHERE title = $1', [title]);
      if (!rehearsal) return answer(404, { error: `no rehearsal ${title}` });
      const project = await db.get('SELECT name FROM native_projects WHERE id = $1', [rehearsal.project_id]);
      // As an edit, a "yes", a new rehearsal and a cast that grew tell them
      // (routes/native/rehearsals.js), the server's own words, on the reader's
      // clock and in the reader's language.
      if (about === 'rehearsal_updated') {
        await notifyRehearsalUpdated(rehearsal, project.name, [{ user_id: user.id }], [url.searchParams.get('change') || 'location']);
      } else if (about === 'rehearsal_created') {
        await notifyRehearsalCreated(rehearsal, project.name, [{ user_id: user.id }]);
      } else if (about === 'added_to_rehearsal') {
        await notifyAddedToRehearsal(rehearsal, project.name, [{ user_id: user.id }]);
      } else {
        await notifyMemberResponse(rehearsal, project.name, url.searchParams.get('member') || 'Somebody', [user.id]);
      }
      console.log(`[e2e] told ${to} of ${about} on ${title}`);
      return answer(200, { recorded: 1 });
    })().catch((error) => answer(500, { error: String(error) }));
    return;
  }
  if (request.method === 'GET' && (url.pathname === '/ink' || url.pathname === '/ellipses')) {
    // The newest screenshot of that name the flows took (e2e/out/artifacts).
    const name = path.basename(url.searchParams.get('shot') || '') + '.png';
    const shots = fs.readdirSync(ARTIFACTS, { recursive: true })
      .filter((file) => path.basename(file) === name)
      .map((file) => path.join(ARTIFACTS, file))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (!shots.length) return answer(404, { error: `no screenshot ${name}` });
    const region = Object.fromEntries(['left', 'right', 'top', 'bottom'].map((side) => [side, Number(url.searchParams.get(side))]));
    if (url.pathname === '/ellipses') return answer(200, { ellipses: ellipses(shots[0], { region }) });
    const tolerance = url.searchParams.has('tolerance') ? Number(url.searchParams.get('tolerance')) : undefined;
    return answer(200, { box: inkBox(shots[0], { colour: url.searchParams.get('colour') || '', region, tolerance }) });
  }
  if (request.method === 'GET' && url.pathname === '/notify') {
    const to = (url.searchParams.get('to') || '').trim().toLowerCase();
    const count = Number(url.searchParams.get('count'));
    const title = url.searchParams.get('title') || 'Notice';
    if (!Number.isInteger(count) || count < 1 || count > 200) return answer(400, { error: 'count is 1 to 200' });
    (async () => {
      const user = await db.get('SELECT id FROM native_users WHERE email = $1', [to]);
      if (!user) return answer(404, { error: `no account ${to}` });
      for (let n = 1; n <= count; n++) {
        await recordNotifications([user.id], { title: `${title} ${n}`, body: 'The Prozorov house', data: { type: 'rehearsal_updated' } });
      }
      console.log(`[e2e] recorded ${count} notifications for ${to}`);
      return answer(200, { recorded: count });
    })().catch((error) => answer(500, { error: String(error) }));
    return;
  }
  if (request.method === 'GET' && url.pathname === '/bug-reports') {
    const from = (url.searchParams.get('from') || '').trim().toLowerCase();
    db.all(
      `SELECT r.message, r.screen FROM native_bug_reports r
       JOIN native_users u ON u.id = r.user_id WHERE u.email = $1 ORDER BY r.id`,
      [from]
    ).then((reports) => answer(200, { reports }), (error) => answer(500, { error: String(error) }));
    return;
  }
  if (request.method === 'GET' && url.pathname === '/release') {
    const answers = [...held];
    holds = [];
    answers.forEach((release) => release());
    return answer(200, { released: answers.length });
  }
  if (request.method === 'GET' && url.pathname === '/pasteboard') {
    const device = url.searchParams.get('device') || '';
    if (!/^[0-9A-F-]{36}$/i.test(device)) return answer(400, { error: `no simulator ${device}` });
    const child = execFile('xcrun', ['simctl', 'pbcopy', device], { timeout: 30000 }, (error) => {
      if (error) return answer(500, { error: String(error) });
      console.log(`[e2e] put ${JSON.stringify(url.searchParams.get('text'))} on the pasteboard`);
      return answer(200, { copied: true });
    });
    child.stdin.end(url.searchParams.get('text') || '');
    return;
  }
  if (request.method === 'GET' && url.pathname === '/push') {
    const device = url.searchParams.get('device') || '';
    if (!/^[0-9A-F-]{36}$/i.test(device)) return answer(400, { error: `no simulator ${device}` });
    const app = url.searchParams.get('app') || '';
    if (!/^[\w.-]+$/.test(app)) return answer(400, { error: `no app ${app}` });
    const type = url.searchParams.get('type');
    const projectName = url.searchParams.get('project') || '';
    // The data notifyRoleChanged sends (pushNotificationService.js), where
    // Expo's servers put it for iOS: under "body", which expo-notifications
    // reads as a remote notification's data.
    const data = type === 'role_changed'
      ? { type, projectName, newRole: url.searchParams.get('role') || 'admin' }
      : null;
    if (!data) return answer(400, { error: `no push of type ${type}` });
    const payload = {
      aps: { alert: { title: 'Role changed', body: `${projectName}: ${data.newRole}` }, sound: 'default' },
      body: data,
    };
    const child = execFile('xcrun', ['simctl', 'push', device, app, '-'], { timeout: 30000 }, (error) => {
      if (error) return answer(500, { error: String(error) });
      console.log(`[e2e] pushed ${type} about ${projectName} to the simulator`);
      return answer(200, { pushed: true });
    });
    child.stdin.end(JSON.stringify(payload));
    return;
  }
  if (request.method === 'GET' && url.pathname === '/tap-again') {
    const line = `${new Date().toISOString()}  tapped "${url.searchParams.get('tap')}" again: no "${url.searchParams.get('see')}" after the first tap`;
    console.log(`[e2e] ${line}`);
    fs.appendFileSync(TAPS_AGAIN, `${line}\n`);
    return answer(200, { logged: true });
  }
  if (request.method !== 'GET' || url.pathname !== '/code') return answer(404, { error: 'not here' });
  const to = (url.searchParams.get('to') || '').trim().toLowerCase();
  const latest = capturedEmails.findLast((message) => message.to.toLowerCase() === to);
  const code = latest?.subject.match(/\b\d{6}\b/)?.[0];
  if (!code) return answer(404, { error: `no code for ${to}` });
  return answer(200, { code });
}).listen(Number(process.env.MAIL_PORT), process.env.MAIL_HOST, () => {
  console.log(`[e2e] mailbox on ${process.env.MAIL_HOST}:${process.env.MAIL_PORT}`);
});

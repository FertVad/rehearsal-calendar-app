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
 * HOLD_LIMIT_MS: the app gives up on a request after ten seconds, and a held
 * answer must still arrive. A flow that wants the request to fail as on no
 * network names a longer wait (`&ms=`, a minute at most).
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
 *
 * It measures an icon on a screenshot a flow took, which Maestro cannot: a
 * button that is only an icon is one element, the size of its target (ink.mjs):
 *
 *   GET /ink?shot=<name>&colour=<#rrggbb>&left=&right=&top=&bottom=
 *                                    { box: { width, height } } in points, of
 *                                    that colour within those fractions of the
 *                                    newest <name>.png in e2e/out/artifacts
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
import { notifyMemberJoined, notifyMemberResponse, notifyRehearsalUpdated } from '../server/services/notifications/pushNotificationService.js';
import app from '../server/server.js';
import { inkBox } from './ink.mjs';

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

// Hands the request to `handle` — at once, or on release when its hold says
// the request waits.
function holdAnswer(request, response, handle) {
  const { pathname } = new URL(request.url, 'http://api');
  holds = holds.filter((hold) => hold.until > Date.now());
  const hold = holds.find((candidate) => candidate.method === request.method && candidate.path.test(pathname));
  if (!hold) return handle();
  if (hold.once) holds = holds.filter((candidate) => candidate !== hold);
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

// As app.listen would, with the hold in front.
http.createServer((request, response) => {
  holdAnswer(request, response, () => app(request, response));
}).listen(Number(process.env.PORT), process.env.HOST, () => {
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
    holds.push({ method, path: new RegExp(url.searchParams.get('path') || '^$'), limitMs, before, open, once, until: Date.now() + HOLD_WINDOW_MS });
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
  if (request.method === 'GET' && url.pathname === '/notify' && (about === 'rehearsal_updated' || about === 'member_response')) {
    const to = (url.searchParams.get('to') || '').trim().toLowerCase();
    const title = url.searchParams.get('rehearsal') || '';
    (async () => {
      const user = await db.get('SELECT id FROM native_users WHERE email = $1', [to]);
      if (!user) return answer(404, { error: `no account ${to}` });
      const rehearsal = await db.get('SELECT * FROM native_rehearsals WHERE title = $1', [title]);
      if (!rehearsal) return answer(404, { error: `no rehearsal ${title}` });
      const project = await db.get('SELECT name FROM native_projects WHERE id = $1', [rehearsal.project_id]);
      // As an edit and a "yes" tell them (routes/native/rehearsals.js), the
      // server's own words, on the reader's clock.
      if (about === 'rehearsal_updated') {
        await notifyRehearsalUpdated(rehearsal, project.name, [{ user_id: user.id }], [url.searchParams.get('change') || 'location']);
      } else {
        await notifyMemberResponse(rehearsal, project.name, url.searchParams.get('member') || 'Somebody', [user.id]);
      }
      console.log(`[e2e] told ${to} of ${about} on ${title}`);
      return answer(200, { recorded: 1 });
    })().catch((error) => answer(500, { error: String(error) }));
    return;
  }
  if (request.method === 'GET' && url.pathname === '/ink') {
    // The newest screenshot of that name the flows took (e2e/out/artifacts).
    const name = path.basename(url.searchParams.get('shot') || '') + '.png';
    const shots = fs.readdirSync(ARTIFACTS, { recursive: true })
      .filter((file) => path.basename(file) === name)
      .map((file) => path.join(ARTIFACTS, file))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (!shots.length) return answer(404, { error: `no screenshot ${name}` });
    const region = Object.fromEntries(['left', 'right', 'top', 'bottom'].map((side) => [side, Number(url.searchParams.get(side))]));
    return answer(200, { box: inkBox(shots[0], { colour: url.searchParams.get('colour') || '', region }) });
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

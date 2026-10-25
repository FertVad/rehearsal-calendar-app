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
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturedEmails } from '../server/services/email/transport.js';
import app from '../server/server.js';

const MAIL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'mail');

assert.equal(process.env.EMAIL_TRANSPORT, 'capture-for-tests', 'The e2e server keeps its mail in memory, never sends it');
assert.equal(process.env.MAIL_HOST, '127.0.0.1', 'The mailbox answers on 127.0.0.1 only');

fs.rmSync(MAIL, { recursive: true, force: true });
fs.mkdirSync(MAIL, { recursive: true });
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
    holds.push({ method, path: new RegExp(url.searchParams.get('path') || '^$'), limitMs, before, open, until: Date.now() + HOLD_WINDOW_MS });
    return answer(200, { holding: holds.length });
  }
  if (request.method === 'GET' && url.pathname === '/release') {
    const answers = [...held];
    holds = [];
    answers.forEach((release) => release());
    return answer(200, { released: answers.length });
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

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

app.listen(Number(process.env.PORT), process.env.HOST, () => {
  console.log('[e2e] server listening');
});

http.createServer((request, response) => {
  const url = new URL(request.url, 'http://mailbox');
  const answer = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  if (request.method !== 'GET' || url.pathname !== '/code') return answer(404, { error: 'not here' });
  const to = (url.searchParams.get('to') || '').trim().toLowerCase();
  const latest = capturedEmails.findLast((message) => message.to.toLowerCase() === to);
  const code = latest?.subject.match(/\b\d{6}\b/)?.[0];
  if (!code) return answer(404, { error: `no code for ${to}` });
  return answer(200, { code });
}).listen(Number(process.env.MAIL_PORT), process.env.MAIL_HOST, () => {
  console.log(`[e2e] mailbox on ${process.env.MAIL_HOST}:${process.env.MAIL_PORT}`);
});

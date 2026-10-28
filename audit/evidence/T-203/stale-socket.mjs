// Does a supertest request ever get an answer from something other than its
// own app?
//
// Each request(app) starts a server on [::]:0, sends to 127.0.0.1:P and closes
// the server afterwards. Each round here is a distinct app answering with its
// own number, as each test file's app has its own secret and database; any
// other answer is printed with its port, and the port is probed afterwards.
// (Written to test pooled keep-alive sockets reaching an earlier app. What it
// found instead was a foreign process on 127.0.0.1 — investigation.md.)
//
// "loopback" sends the same requests through the wrapper the tests now get.
//
// node audit/evidence/T-203/stale-socket.mjs [requests] [supertest|loopback]
import { createRequire } from 'node:module';
import http from 'node:http';

const require = createRequire(new URL('../../../rehearsal-calendar-native/server/package.json', import.meta.url));
const mode = process.argv[3] ?? 'supertest';
const request = mode === 'loopback'
  ? (await import('../../../rehearsal-calendar-native/server/__tests__/loopbackSupertest.js')).default
  : require('supertest');

// Is someone holding 127.0.0.1:port right now?
const probe = (port) => new Promise((resolve) => {
  const s = http.createServer();
  s.once('error', (err) => resolve(`held by another socket (${err.code})`));
  s.listen(port, '127.0.0.1', () => s.close(() => resolve('free')));
});

const rounds = Number(process.argv[2] ?? 20000);
let crossed = 0;
let failed = 0;
const examples = [];
const t0 = Date.now();
for (let i = 0; i < rounds; i++) {
  const app = (_req, res) => res.end(String(i));
  try {
    const res = await request(app).get('/');
    if (res.text !== String(i)) {
      crossed++;
      const port = Number(new URL(res.request.url).port);
      if (examples.length < 5) {
        examples.push(`request ${i} to 127.0.0.1:${port} was answered "${res.text.slice(0, 80)}" ` +
          `(status ${res.status}, headers ${JSON.stringify(res.headers)}); ` +
          `127.0.0.1:${port} now: ${await probe(port)}`);
      }
    }
  } catch (err) {
    failed++;
    if (examples.length < 5) examples.push(`request ${i} failed: ${err.code || err.message}`);
  }
}
console.log(`node ${process.version}, ${mode}, globalAgent keepAlive=${http.globalAgent.keepAlive}`);
console.log(`${rounds} requests in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${crossed} answered by an earlier app, ${failed} failed`);
for (const e of examples) console.log(`  ${e}`);

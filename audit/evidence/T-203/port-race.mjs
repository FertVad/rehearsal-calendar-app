// Two processes, as two Jest workers: does a supertest-style request ever
// reach the other one's server?
//
//  - "ours" does what supertest does per request: listen(0) on [::], GET
//    http://127.0.0.1:P/, close — and checks the answer came from itself.
//  - "theirs" opens and closes servers on 127.0.0.1:0 as adminHttp,
//    errorHttp, adminStoredContent and the browser tests do.
//
// node audit/evidence/T-203/port-race.mjs [seconds] [theirs-processes]
import http from 'node:http';
import { fork } from 'node:child_process';

const listen = (server, ...args) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(...args, () => resolve(server.address().port));
});
const close = (server) => new Promise((resolve) => server.close(() => resolve()));
const get = (port) => new Promise((resolve, reject) => {
  const req = http.get({ host: '127.0.0.1', port, path: '/', agent: false }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve(body));
  });
  req.on('error', reject);
});

const role = process.argv[2];
if (role === 'theirs') {
  const stopAt = Date.now() + Number(process.argv[3]) * 1000;
  while (Date.now() < stopAt) {
    const batch = [];
    for (let i = 0; i < 20; i++) {
      const s = http.createServer((_q, r) => r.end(`theirs:${process.pid}`));
      await listen(s, 0, '127.0.0.1');
      batch.push(s);
    }
    await new Promise((r) => setTimeout(r, 5));
    await Promise.all(batch.map(close));
  }
  process.exit(0);
}

const seconds = Number(process.argv[2] ?? 60);
const others = Number(process.argv[3] ?? 2);
const children = Array.from({ length: others }, () =>
  fork(new URL(import.meta.url).pathname, ['theirs', String(seconds)]));

const stopAt = Date.now() + seconds * 1000;
let requests = 0;
let crossed = 0;
let failed = 0;
const examples = [];
while (Date.now() < stopAt) {
  const s = http.createServer((_q, r) => r.end('ours'));
  const port = await listen(s, 0);
  try {
    const body = await get(port);
    requests++;
    if (body !== 'ours') {
      crossed++;
      if (examples.length < 5) examples.push(`port ${port} answered "${body}"`);
    }
  } catch (err) {
    failed++;
  }
  await close(s);
}
await Promise.all(children.map((c) => new Promise((r) => (c.exitCode !== null ? r() : c.once('exit', r)))));
console.log(`${requests} requests in ${seconds}s against ${others} other processes: ${crossed} reached another process, ${failed} failed to connect`);
for (const e of examples) console.log(`  ${e}`);

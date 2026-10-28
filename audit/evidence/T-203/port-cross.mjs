// Can a request supertest sends to its own server reach another process?
//
// supertest starts an app with listen(0) — the IPv6 wildcard, [::]:P — and
// then sends to http://127.0.0.1:P. On macOS a second socket may still bind
// 127.0.0.1:P: a more specific address does not conflict with the wildcard,
// and the kernel then delivers 127.0.0.1:P to the specific one. Several
// backend tests listen on exactly 127.0.0.1:0 in other Jest workers.
//
// Part 1 binds the same port explicitly and shows where the request lands.
// Part 2 lets both sides pick ports as the tests do and counts collisions.
//
// node audit/evidence/T-203/port-cross.mjs [rounds]
import http from 'node:http';

const listen = (server, ...args) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(...args, () => resolve(server.address().port));
});
const close = (server) => new Promise((resolve) => server.close(() => resolve()));
const who = (name) => http.createServer((_req, res) => res.end(name));
const get = (port) => new Promise((resolve, reject) => {
  http.get(`http://127.0.0.1:${port}/`, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve(body));
  }).on('error', reject);
});

// Part 1
const ours = who('ours (supertest-style, listen(0))');
const port = await listen(ours, 0);
console.log(`ours bound ${JSON.stringify(ours.address())}`);
const theirs = who('THEIRS (another worker, 127.0.0.1)');
try {
  await listen(theirs, port, '127.0.0.1');
  console.log(`theirs bound ${JSON.stringify(theirs.address())} as well`);
  console.log(`GET http://127.0.0.1:${port}/ (what supertest sends) -> ${await get(port)}`);
  await close(theirs);
} catch (err) {
  console.log(`theirs could not bind 127.0.0.1:${port}: ${err.code}`);
}
await close(ours);

// Part 2: ephemeral ports on both sides, as the tests pick them. Hold many
// supertest-style servers at once, then ask for 127.0.0.1:0 as often and count
// how many of those land on a port a wildcard server already holds.
const rounds = Number(process.argv[2] ?? 2000);
const wildcard = [];
const wildcardPorts = new Set();
for (let i = 0; i < rounds; i++) {
  const s = who('w');
  wildcardPorts.add(await listen(s, 0));
  wildcard.push(s);
}
const loopback = [];
let collisions = 0;
for (let i = 0; i < rounds; i++) {
  const s = who('l');
  if (wildcardPorts.has(await listen(s, 0, '127.0.0.1'))) collisions++;
  loopback.push(s);
}
await Promise.all([...wildcard, ...loopback].map(close));
console.log(`ephemeral: ${collisions} of ${rounds} 127.0.0.1:0 binds got a port a [::]:0 server was holding`);

// Part 3: the other order. A loopback server is already up (another worker's
// adminHttp, errorHttp, invite page…) when supertest asks for [::]:0.
const first = [];
const firstPorts = new Set();
for (let i = 0; i < rounds; i++) {
  const s = who('l');
  firstPorts.add(await listen(s, 0, '127.0.0.1'));
  first.push(s);
}
const then = [];
let shadowed = 0;
let example;
for (let i = 0; i < rounds; i++) {
  const s = who('ours');
  const p = await listen(s, 0);
  if (firstPorts.has(p)) {
    shadowed++;
    example ??= `${p}: GET http://127.0.0.1:${p}/ from "ours" -> ${await get(p)}`;
  }
  then.push(s);
}
await Promise.all([...first, ...then].map(close));
console.log(`ephemeral: ${shadowed} of ${rounds} [::]:0 binds got a port a 127.0.0.1 server was holding`);
if (example) console.log(`  e.g. port ${example}`);

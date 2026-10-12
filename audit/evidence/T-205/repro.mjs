// T-205 red before / green after, under the same conditions for both.
//
// A stand-in for Metro on a cold build: it accepts the bundle request and sends
// no headers for HOLD_SECONDS, then answers 200 with a body — what Metro does
// when `--clear` makes it build ~1250 modules on a loaded machine.
//
// Against it, at the same time:
//   old — the exact expression run.mjs used before 902d4a6 (902d4a6^, line 384):
//         await (await fetch(url)).text()
//   new — getText from rehearsal-calendar-native/e2e/http.mjs (902d4a6 and later)
//         with the deadline run.mjs passes (30 min).
//
// Usage: node audit/evidence/T-205/repro.mjs [HOLD_SECONDS=310]
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { getText } = await import(pathToFileURL(path.join(root, 'rehearsal-calendar-native/e2e/http.mjs')));

const holdMs = Number(process.argv[2] ?? 310) * 1000;
const server = http.createServer((request, response) => {
  setTimeout(() => { response.writeHead(200); response.end('bundle'); }, holdMs);
});
server.requestTimeout = 0; // the server side must not be what gives up
server.headersTimeout = 0;
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false`;
console.log(`node ${process.version}; the bundle answers after ${holdMs / 1000} s`);

const started = Date.now();
const seconds = () => ((Date.now() - started) / 1000).toFixed(1);
const report = (name) => [
  (body) => console.log(`${name}: OK after ${seconds()} s, body "${body}"`),
  (error) => console.log(`${name}: FAILED after ${seconds()} s: ${error.message}` +
    (error.cause ? ` — cause ${error.cause.code}: ${error.cause.message}` : '')),
];

const old = (async () => await (await fetch(url)).text())().then(...report('old (fetch, before 902d4a6)'));
const fixed = getText(url, { deadlineMs: 30 * 60 * 1000 }).then(...report('new (getText, 902d4a6+)'));
await Promise.all([old, fixed]);
server.close();

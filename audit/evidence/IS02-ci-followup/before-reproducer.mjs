import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';

const sourcePath = '/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server/__tests__/browser/adminDashboard.browser.test.mjs';
const source = readFileSync(sourcePath, 'utf8');
const hook = source.match(/^  t\.after\(\(\) => new Promise\(\(resolve, reject\) => server\.close\(err => err \? reject\(err\) : resolve\(\)\)\)\);$/m)?.[0];
assert.ok(hook, 'Expected the original server-first cleanup hook');
assert.ok(source.indexOf(hook) < source.indexOf('t.after(() => context.close())'));
const server = http.createServer((_req, res) => res.end('owned fixture'));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const connection = new Promise(resolve => server.once('connection', resolve));
const client = net.createConnection({ host: '127.0.0.1', port: server.address().port });
await new Promise(resolve => client.once('connect', resolve));
const ownedSocket = await connection;
const hooks = [];
// Execute the unchanged hook captured above against the actual owned server.
new Function('t', 'server', hook)({ after: callback => hooks.push(callback) }, server);
let contextReached = false;
hooks.push(async () => { contextReached = true; });
const teardown = (async () => { for (const close of hooks) await close(); })();
let timer;
try {
  const settled = await Promise.race([
    teardown.then(() => true),
    new Promise(resolve => { timer = setTimeout(() => resolve(false), 250); }),
  ]);
  console.log(JSON.stringify({ node: process.version,
    originalSourceSha256: createHash('sha256').update(source).digest('hex'),
    originalHookExecuted: true, actualOwnedPreconnect: true, contextReached,
    cleanupSettledWithin250ms: settled }));
  assert.equal(settled, true, 'Original cleanup must finish even with an idle preconnect');
} catch (error) {
  console.log(JSON.stringify({ desiredRegression: 'FAIL', errorCode: error.code, expectedActualExit: 1 }));
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  ownedSocket.destroy();
  client.destroy();
  await teardown;
  assert.equal(server.listening, false);
  console.log('Cleanup: owned loopback server and preconnect released');
}

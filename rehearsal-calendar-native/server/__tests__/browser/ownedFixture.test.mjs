import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import { closeOwnedBrowserFixture, trackOwnedHttpServer } from './ownedFixture.mjs';

async function listening(t) {
  const server = http.createServer((_req, res) => res.end('owned fixture'));
  const owned = trackOwnedHttpServer(server);
  t.after(() => owned.close());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, owned };
}

test('context cleanup precedes server closure and releases an actual idle preconnect', { timeout: 5000 }, async t => {
  const { server, owned } = await listening(t);
  const connected = once(server, 'connection');
  const socket = net.createConnection({ host: '127.0.0.1', port: server.address().port });
  t.after(() => socket.destroy());
  await once(socket, 'connect');
  await connected;
  assert.equal(owned.socketCount, 1);
  let contextClosed = false;
  const context = { async close() {
    assert.equal(server.listening, true, 'Context must close before HTTP admission stops');
    contextClosed = true;
  } };
  const disconnected = once(socket, 'close');
  await closeOwnedBrowserFixture({ context, owned, timeoutMs: 1000 });
  await disconnected;
  assert.equal(contextClosed, true);
  assert.equal(server.listening, false);
  assert.equal(owned.socketCount, 0);
  assert.equal(socket.destroyed, true);
});

test('context cleanup failure still closes the owned server and fails the test boundary', { timeout: 5000 }, async t => {
  const { server, owned } = await listening(t);
  const failure = new Error('Synthetic context cleanup failure');
  await assert.rejects(closeOwnedBrowserFixture({ context: { close: async () => { throw failure; } }, owned }), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [failure]);
    return true;
  });
  assert.equal(server.listening, false);
});

test('a stalled context cleanup has a deadline and still closes the owned server', { timeout: 5000 }, async t => {
  const { server, owned } = await listening(t);
  await assert.rejects(closeOwnedBrowserFixture({
    context: { close: () => new Promise(() => {}) }, owned, timeoutMs: 50,
  }), error => error instanceof AggregateError && /cleanup deadline/.test(error.errors[0].message));
  assert.equal(server.listening, false);
});

// getText waits as long as it is told, whatever Node's fetch would have.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getText } from '../http.mjs';

const server = http.createServer((request, response) => {
  const delay = Number(new URL(request.url, 'http://x').searchParams.get('delay'));
  const status = Number(new URL(request.url, 'http://x').searchParams.get('status') || 200);
  setTimeout(() => { response.writeHead(status); response.end('bundle'); }, delay);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
after(() => server.close());

test('a slow answer is waited for within the deadline', async () => {
  assert.equal(await getText(`${base}?delay=300`, { deadlineMs: 5000 }), 'bundle');
});

test('past the deadline it fails and says how long it waited', async () => {
  await assert.rejects(getText(`${base}?delay=3000`, { deadlineMs: 200 }), (error) => error.code === 'DEADLINE' && /no complete answer within 0 min/.test(error.message));
});

test('an error status is an error, with what was said', async () => {
  await assert.rejects(getText(`${base}?status=500`, { deadlineMs: 5000 }), (error) => error.code !== 'DEADLINE' && /answered 500: bundle/.test(error.message));
});

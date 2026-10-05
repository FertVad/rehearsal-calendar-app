/**
 * The Expo transport — every way an answer can go wrong ends as a rejected
 * promise the caller can catch (R8-01, R8-04).
 *
 * The transport reads the answer in a response event handler. Only the JSON
 * parse was guarded there, so an answer that parsed into an unexpected shape
 * — `null`, or `errors` that is not a list — threw outside the promise and
 * took the whole server process down instead of failing one send (R8-04).
 * A local server stands in for Expo; nothing leaves the machine.
 */
import http from 'node:http';
import { expoTransport } from '../../services/notifications/pushNotificationService.js';

let server;
let answer;
const sockets = new Set();

beforeAll(async () => {
  server = http.createServer((request, response) => {
    request.resume();
    request.on('end', () => answer(response));
  });
  server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => server.close(resolve));
});

const transport = () => expoTransport({ baseUrl: `http://127.0.0.1:${server.address().port}`, timeoutMs: 300 });
const reply = (status, body, type = 'application/json') => (response) => {
  response.writeHead(status, { 'Content-Type': type });
  response.end(body);
};
const send = () => transport().sendPushNotificationsAsync([{ to: 'ExponentPushToken[a]' }]);
const receipts = () => transport().getPushNotificationReceiptsAsync(['ticket-a']);

describe('Answers Expo gives', () => {
  it('a ticket per message', async () => {
    answer = reply(200, JSON.stringify({ data: [{ status: 'ok', id: 't-1' }] }));

    await expect(send()).resolves.toEqual([{ status: 'ok', id: 't-1' }]);
  });

  it('receipts by ticket', async () => {
    answer = reply(200, JSON.stringify({ data: { 'ticket-a': { status: 'ok' } } }));

    await expect(receipts()).resolves.toEqual({ 'ticket-a': { status: 'ok' } });
  });
});

describe('Answers that fail the request, and nothing else', () => {
  it.each([
    ['an error list', 422, JSON.stringify({ errors: [{ code: 'VALIDATION_ERROR', message: 'bad' }] }), /422: bad/],
    ['an HTML page', 503, '<html>busy</html>', /without JSON/],
    ['a 200 that is not JSON', 200, 'ok', /without JSON/],
    ['the wrong number of tickets', 200, JSON.stringify({ data: [] }), /0 tickets for 1 messages/],
    // R8-04: these parsed, and then threw outside the promise.
    ['a 200 of null', 200, 'null', /not an answer/],
    ['a 503 whose errors are not a list', 503, JSON.stringify({ errors: 'temporarily unavailable' }), /not an answer/],
    ['a 200 that is a list', 200, '[]', /not an answer/],
  ])('a send answered with %s is a rejection', async (_label, status, body, reason) => {
    answer = reply(status, body);

    await expect(send()).rejects.toThrow(reason);
  });

  it('a receipts request answered with null is a rejection (R8-04)', async () => {
    answer = reply(200, 'null');

    await expect(receipts()).rejects.toThrow(/not an answer/);
  });

  it('an answer that never comes is a rejection at the deadline', async () => {
    answer = () => { /* silent */ };

    await expect(send()).rejects.toThrow(/did not answer within 300 ms/);
  });

  it('an answer that stops half-way is a rejection at the deadline', async () => {
    answer = (response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write('{"data": [');
    };

    await expect(receipts()).rejects.toThrow(/did not answer within 300 ms/);
  });
});

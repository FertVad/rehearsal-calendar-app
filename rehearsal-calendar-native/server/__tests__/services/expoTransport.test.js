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

// T-260: tests about the shape of an answer keep the transport's own deadline
// (EXPO_TIMEOUT_MS, past Jest's test timeout), so a slow machine cannot turn
// a shape test into a deadline test. Only the deadline tests take a short one.
const transport = (options = {}) => expoTransport({ baseUrl: `http://127.0.0.1:${server.address().port}`, ...options });
const SHORT_DEADLINE_MS = 300;
const deadlined = () => transport({ timeoutMs: SHORT_DEADLINE_MS });
const reply = (status, body, type = 'application/json') => (response) => {
  response.writeHead(status, { 'Content-Type': type });
  response.end(body);
};
const stall = (ms) => { const until = Date.now() + ms; while (Date.now() < until) { /* the event loop is busy */ } };
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

  it.each([['{}', '{}'], ['data null', '{"data": null}']])('a receipts request answered with %s is a rejection, not "no receipts yet"', async (_label, body) => {
    answer = reply(200, body);

    await expect(receipts()).rejects.toThrow(/not an answer/);
  });

  // T-260: on a loaded machine (Jest workers, swap) the event loop can stall
  // past a short deadline before the local server's answer is read. Stalled
  // here on purpose: the answer is still judged by what it says.
  it.each([
    ['a send answered with null', () => send(), 'null'],
    ['a receipts request answered with data null', () => receipts(), '{"data": null}'],
  ])('%s is a rejection for its shape even when the machine stalls', async (_label, request, body) => {
    answer = reply(200, body);

    const pending = request();
    stall(400);

    await expect(pending).rejects.toThrow(/not an answer/);
  });

  it('a receipts request answered with null is a rejection (R8-04)', async () => {
    answer = reply(200, 'null');

    await expect(receipts()).rejects.toThrow(/not an answer/);
  });

  it('an answer that never comes is a rejection at the deadline', async () => {
    answer = () => { /* silent */ };

    await expect(deadlined().sendPushNotificationsAsync([{ to: 'ExponentPushToken[a]' }])).rejects.toThrow(/did not answer within 300 ms/);
  });

  it('an answer that stops half-way is a rejection at the deadline', async () => {
    answer = (response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write('{"data": [');
    };

    await expect(deadlined().getPushNotificationReceiptsAsync(['ticket-a'])).rejects.toThrow(/did not answer within 300 ms/);
  });
});

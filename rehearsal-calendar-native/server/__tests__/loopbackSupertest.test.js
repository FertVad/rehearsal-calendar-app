/**
 * The server supertest starts listens on the address supertest sends to.
 *
 * supertest's own listen(0) took the IPv6 wildcard and sent to 127.0.0.1, so
 * a process holding the same port on 127.0.0.1 got the request instead: a
 * valid token answered 401 by another copy of the server (loopbackSupertest.js;
 * the takeover itself is reproduced in audit/evidence/T-203). On 127.0.0.1
 * the kernel hands out no port someone holds there.
 */
import request from 'supertest';

describe('supertest in these tests', () => {
  it('starts the app on 127.0.0.1, where it sends the request', async () => {
    const app = (req, res) => res.end(JSON.stringify(req.socket.server.address()));

    const res = await request(app).get('/');

    expect(JSON.parse(res.text)).toMatchObject({ address: '127.0.0.1', family: 'IPv4' });
  });

  it('starts an app passed as a server there too', async () => {
    const { createServer } = await import('node:http');
    const server = createServer((req, res) => res.end(JSON.stringify(req.socket.server.address())));

    const res = await request(server).get('/');

    expect(JSON.parse(res.text)).toMatchObject({ address: '127.0.0.1', family: 'IPv4' });
  });
});

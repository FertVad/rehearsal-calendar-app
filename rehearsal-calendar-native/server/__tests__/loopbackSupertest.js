/**
 * supertest, with the app listening where supertest sends.
 *
 * supertest starts the app with listen(0), which binds the IPv6 wildcard
 * [::], and then sends to 127.0.0.1. On macOS the kernel may hand that
 * wildcard a port another process already holds on 127.0.0.1, and the more
 * specific socket wins: the request goes to that process. When it is another
 * copy of this server — another worktree's checks, a probe — a valid token
 * comes back 401, because the secret and the database are not ours. That is
 * what failed on 2026-10-10 in authorization.test.js and on 2026-10-11 in
 * membersAvailabilityRange.test.js (audit/evidence/T-203).
 *
 * Listening on 127.0.0.1 itself, the kernel only gives out a port nobody
 * holds there. Both Jest configs map 'supertest' to this file, so every test
 * gets it; the real package is imported by path, which the mapping skips.
 */
import http from 'node:http';
import supertest from 'supertest/index.js';

const { Test } = supertest;

class LoopbackTest extends Test {
  // supertest wants the URL in its constructor, but listening on an address
  // completes later; until end() the URL has no port.
  serverAddress(app, path) {
    if (app.address()) return super.serverAddress(app, path);
    this.pendingPath = path;
    return `http://127.0.0.1${path}`;
  }

  end(fn) {
    if (this.pendingPath === undefined) return super.end(fn);
    const path = this.pendingPath;
    delete this.pendingPath;
    const server = this.app;
    const failed = (err) => this.assert(err, null, fn);
    server.once('error', failed);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', failed);
      // supertest closes the server it started once the response is in.
      this._server = server;
      this.url = `http://127.0.0.1:${server.address().port}${path}`;
      super.end(fn);
    });
    return this;
  }
}

export default function request(app, options = {}) {
  // An http2 app or a URL string is left to supertest as it is.
  if (options.http2 || typeof app === 'string') return supertest(app, options);
  const obj = {};
  for (const method of http.METHODS.map((m) => m.toLowerCase())) {
    // A server of its own per request, as two requests in flight from one
    // request(app) cannot both start the same one.
    obj[method] = (url) => new LoopbackTest(typeof app === 'function' ? http.createServer(app) : app, method, url);
  }
  obj.del = obj.delete;
  return obj;
}

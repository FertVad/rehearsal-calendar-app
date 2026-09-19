import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceServer = fileURLToPath(new URL('../../', import.meta.url));
export const fixtureJwtSecret = 'r2-child-fixture-' + 's'.repeat(32);
export const fixtureAdminPassword = 'r2-owned-admin-password';

function copyTree(from, to, publicFiles = false) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    // Never read/copy runtime environment or database files from the checkout.
    if (entry.name.startsWith('.env') || entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target, publicFiles);
    else if (entry.isFile() && (publicFiles || /\.(?:js|mjs|cjs|json|sql)$/.test(entry.name))) copyFileSync(source, target);
  }
}

// A failure-only PostgreSQL wire endpoint. The real pg driver connects and
// receives a genuine protocol ErrorResponse; no successful SQL is simulated.
export async function createPgRefusal({ stall = false } = {}) {
  const sockets = new Set();
  let connections = 0;
  const server = net.createServer(socket => {
    connections++;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.once('data', () => {
      if (stall) return;
      const body = Buffer.from('SFATAL\0C57P03\0Mowned fixture private refusal\0\0');
      const header = Buffer.alloc(5);
      header[0] = 69;
      header.writeUInt32BE(body.length + 4, 1);
      socket.end(Buffer.concat([header, body]));
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  return {
    port,
    url: `postgresql://fixture:fixture@127.0.0.1:${port}/synthetic?sslmode=disable`,
    get connections() { return connections; },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

/** Run copied source only; never imports or executes sourceServer/server.js. */
export function createEntrypointFixture({ databaseUrl, environment = {}, explicitEnvironmentFile = true } = {}) {
  const allowedPg = databaseUrl ? new URL(databaseUrl) : undefined;
  if (allowedPg) {
    assert.equal(allowedPg.hostname, '127.0.0.1', 'startup fixture DB must be an owned loopback endpoint');
    assert.ok(Number(allowedPg.port) > 0);
  }
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'r2-entrypoint-')));
  const server = path.join(root, 'server');
  mkdirSync(server);
  const hashes = {};
  for (const filename of ['server.js', 'runtime.js', 'app.js', 'package.json', 'vercel.json']) {
    const source = path.join(sourceServer, filename);
    if (!existsSync(source)) continue;
    const bytes = readFileSync(source);
    writeFileSync(path.join(server, filename), bytes);
    hashes[filename] = createHash('sha256').update(bytes).digest('hex');
  }
  for (const directory of ['config', 'constants', 'database', 'i18n', 'middleware', 'routes', 'services', 'utils', 'migrations', 'public']) {
    copyTree(path.join(sourceServer, directory), path.join(server, directory), directory === 'public');
  }
  copyTree(path.join(sourceServer, '..', 'shared', 'contracts'), path.join(root, 'shared', 'contracts'));
  symlinkSync(path.join(sourceServer, 'node_modules'), path.join(server, 'node_modules'));

  const values = {
    NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '0',
    JWT_SECRET: fixtureJwtSecret, CRON_SECRET: 'r2-child-cron-' + 'c'.repeat(32),
    ADMIN_PASSWORD: fixtureAdminPassword, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
    ...environment,
  };
  const envFile = path.join(server, '.env');
  writeFileSync(envFile, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n'));
  const privateValues = new Set([databaseUrl, values.DATABASE_URL, values.POSTGRES_URL,
    values.JWT_SECRET, values.CRON_SECRET, values.ADMIN_PASSWORD, 'owned fixture private refusal'].filter(Boolean));
  const preload = path.join(root, 'observe-child.mjs');
  writeFileSync(preload, `
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
// Test children must not outlive their owner; IPC itself must not keep a
// correctly listener-free library/Vercel import alive.
process.on('disconnect', () => process.exit(1));
process.channel?.unref();
const read = fs.readFileSync;
fs.readFileSync = function(file, ...args) {
  if (typeof file !== 'number' && path.resolve(String(file)) === ${JSON.stringify(path.join(sourceServer, '.env'))}) {
    process.send?.({ type: 'blocked-real-env' });
    throw new Error('Real environment access forbidden');
  }
  return read.call(this, file, ...args);
};
syncBuiltinESMExports();
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options = typeof first === 'object' ? first : { port: first, host: args[1] };
  if (options.host !== '127.0.0.1' || Number(options.port) !== ${allowedPg ? Number(allowedPg.port) : -1}) {
    process.send?.({ type: 'blocked-network' });
    throw new Error('Only the owned PostgreSQL endpoint is permitted');
  }
  process.send?.({ type: 'pg-connection-attempt' });
  return connect.apply(this, args);
};
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) {
  this.once('listening', () => process.send?.({ type: this.r2OwnedFramework ? 'framework-listener' : 'entrypoint-listener', address: this.address() }));
  return listen.apply(this, args);
};
`);
  const driver = path.join(root, 'framework-driver.mjs');
  writeFileSync(driver, `
import http from 'node:http';
try {
  const entry = await import(${JSON.stringify(path.join(server, 'server.js'))});
  process.send?.({ type: 'imported', defaultHandler: typeof entry.default === 'function' });
  if (process.env.R2_FIXTURE_MODE === 'framework' && typeof entry.default === 'function') {
    const server = http.createServer(entry.default);
    server.r2OwnedFramework = true;
    server.listen(0, '127.0.0.1');
  }
  setImmediate(() => process.send?.({ type: 'import-settled' }));
} catch (error) {
  process.send?.({ type: 'import-failed', code: error.code || null });
  process.exitCode = 1;
}
`);
  let child;
  let stdout = '';
  let stderr = '';
  let closed;
  let processExit;
  let stdoutEnded = false;
  let stderrEnded = false;
  let resolveClosed;
  const events = [];
  const waiters = new Set();
  function signal() { for (const waiter of [...waiters]) waiter(); }
  function finishClosed() {
    if (!closed && processExit && stdoutEnded && stderrEnded) {
      closed = processExit;
      resolveClosed?.();
      signal();
    }
  }
  const waitFor = (predicate, timeoutMs = 6000) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { waiters.delete(check); reject(new Error('Owned child did not reach its expected state')); }, timeoutMs);
    function check() {
      if (predicate()) { clearTimeout(timeout); waiters.delete(check); resolve(); }
    }
    waiters.add(check);
    check();
  });
  const fixture = {
    root, server, hashes, events,
    get stdout() { return stdout; }, get stderr() { return stderr; },
    get connectionAttempts() { return events.filter(event => event.type === 'pg-connection-attempt').length; },
    get entrypointListeners() { return events.filter(event => event.type === 'entrypoint-listener'); },
    get exited() { return !!closed; },
    get exitStatus() { return closed; },
    async start({ mode = 'framework', vercel = false, processEnvironment = {} } = {}) {
      assert.equal(child, undefined, 'one child per fixture');
      const direct = mode === 'standalone';
      const childEnv = {
        PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, R2_FIXTURE_MODE: mode,
        ...(explicitEnvironmentFile ? { SERVER_ENV_FILE: envFile } : {}),
        ...(vercel ? { VERCEL: '1' } : {}), ...processEnvironment,
      };
      for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'JWT_SECRET', 'CRON_SECRET', 'ADMIN_PASSWORD']) {
        if (childEnv[key]) privateValues.add(childEnv[key]);
      }
      child = spawn(process.execPath, ['--import', preload, direct ? path.join(server, 'server.js') : driver], {
        cwd: server, env: childEnv, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.stdout.once('end', () => { stdoutEnded = true; finishClosed(); });
      child.stderr.once('end', () => { stderrEnded = true; finishClosed(); });
      child.on('message', event => { events.push(event); signal(); });
      child.on('error', error => { events.push({ type: 'child-error', code: error.code }); signal(); });
      child.once('exit', (code, terminationSignal) => {
        processExit = { code, signal: terminationSignal }; finishClosed();
      });
      child.once('close', (code, terminationSignal) => {
        processExit ??= { code, signal: terminationSignal };
        stdoutEnded = true;
        stderrEnded = true;
        finishClosed();
      });
      await waitFor(() => closed || events.some(event => event.type === 'import-failed')
        || (direct ? events.some(event => event.type === 'entrypoint-listener')
          : mode === 'framework' ? events.some(event => event.type === 'framework-listener')
            : events.some(event => event.type === 'import-settled')));
      return fixture;
    },
    async request(route, { method = 'GET', body, headers = {}, timeoutMs = 6000 } = {}) {
      assert.match(route, /^\/(?!\/)/);
      const listener = events.find(event => event.type === 'framework-listener' || event.type === 'entrypoint-listener');
      assert.ok(listener, 'copied entrypoint must provide an owned HTTP listener');
      assert.equal(listener.address.address, '127.0.0.1');
      const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
      return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: listener.address.port, path: route, method,
          headers: { ...headers, ...(bytes ? { 'Content-Type': 'application/json', 'Content-Length': bytes.length } : {}) } }, res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let json;
            try { json = JSON.parse(text); } catch { /* HTML is expected for public routes. */ }
            resolve({ status: res.statusCode, headers: res.headers, text, body: json });
          });
        });
        req.once('error', reject);
        req.setTimeout(timeoutMs, () => req.destroy(new Error('Owned HTTP request timed out')));
        req.end(bytes);
      });
    },
    assertBoundaries() {
      assert.deepEqual(events.filter(event => event.type.startsWith('blocked-')), []);
      assert.equal(existsSync(path.join(server, 'database', 'data.sqlite')), false);
      assert.equal(existsSync(path.join(server, 'server', 'database', 'data.sqlite')), false);
      const output = stdout + stderr;
      for (const value of privateValues) {
        assert.equal(output.includes(value), false, 'child diagnostics must not contain private fixture values');
      }
    },
    async disconnect() {
      assert.ok(child?.connected, 'fixture child has an owned IPC channel');
      child.disconnect();
      await waitFor(() => !!closed, 3000);
    },
    async close() {
      try {
        if (child && !closed) {
          const closing = new Promise(resolve => { resolveClosed = resolve; });
          child.kill('SIGTERM');
          const force = setTimeout(() => { if (!closed) child.kill('SIGKILL'); }, 2000);
          try { await closing; } finally { clearTimeout(force); }
        }
        // close waits for stdio/IPC drain, so late boundary events and logs are
        // included; inspect the owned tree before removing possible artifacts.
        fixture.assertBoundaries();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  };
  return fixture;
}

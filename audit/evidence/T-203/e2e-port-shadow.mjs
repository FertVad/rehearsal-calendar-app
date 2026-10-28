// Can another process take the e2e server's connections while it runs?
//
// e2e/run.mjs starts the server with HOST '::' on port 3001 and checks the
// port is free only once, before the run. The app then opens a new
// connection to localhost:3001 for the POST that stalled; the simulator's log
// shows it went to ::1 (IPv6#….3001, interface lo0).
//
// Here "ours" listens as the e2e server does ([::]:P). Then a second process,
// started afterwards, binds P on a more specific address, as a dev server or
// a probe with HOST=localhost/127.0.0.1/::1 would. It accepts the connection
// and never answers, like a server whose database is unreachable or busy.
// For each address the app may use we print who answers.
//
// node audit/evidence/T-203/e2e-port-shadow.mjs [port]
import http from 'node:http';
import net from 'node:net';
import { fork } from 'node:child_process';

const port = Number(process.argv[3] ?? process.argv[2] ?? 3901);

if (process.argv[2] === 'theirs') {
  // The other process: binds one address, accepts, never answers.
  const host = process.argv[4];
  const server = net.createServer(() => {});
  server.once('error', (error) => { process.send({ host, bound: false, code: error.code }); });
  server.listen(port, host, () => process.send({ host, bound: true }));
} else {
  const ours = http.createServer((_req, res) => res.end('ours'));
  await new Promise((resolve) => ours.listen(port, '::', resolve));
  console.log(`ours: listening like e2e's server on ${JSON.stringify(ours.address())}`);

  const ask = (host) => new Promise((resolve) => {
    // A fresh connection each time, as the app's POST had (Connection 14).
    const req = http.request({ host, port, agent: false, method: 'POST', path: '/api/native/projects/1/rehearsals', timeout: 3000 },
      (res) => { let body = ''; res.on('data', (c) => { body += c; }); res.on('end', () => resolve(body)); });
    req.on('timeout', () => { req.destroy(); resolve('NO ANSWER in 3 s (connected, request sent)'); });
    req.on('error', (error) => resolve(`error ${error.code}`));
    req.end('{}');
  });

  for (const host of ['::1', '127.0.0.1', 'localhost', '0.0.0.0']) {
    const child = fork(new URL(import.meta.url).pathname, ['theirs', String(port), host]);
    const result = await new Promise((resolve) => child.once('message', resolve));
    if (!result.bound) {
      console.log(`theirs on ${host}:${port}: refused (${result.code})`);
    } else {
      console.log(`theirs on ${host}:${port}: bound while ours is up`);
      for (const target of ['::1', '127.0.0.1']) console.log(`  POST to [${target}]:${port} -> ${await ask(target)}`);
    }
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
  }
  console.log(`after theirs exit: POST to [::1]:${port} -> ${await ask('::1')}`);
  ours.close();
}

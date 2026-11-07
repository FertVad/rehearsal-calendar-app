import net from 'node:net';
const { initDatabase } = await import(process.argv[2]);
const sockets = [];
const server = net.createServer(socket => sockets.push(socket));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const started = Date.now();
try { await initDatabase({ connectionString: `postgres://u:p@127.0.0.1:${port}/db` }); console.log('unexpected ok'); }
catch (error) { console.log(JSON.stringify({ code: error.code, elapsedMs: Date.now() - started, connections: sockets.length })); }
for (const socket of sockets) socket.destroy();
server.close();

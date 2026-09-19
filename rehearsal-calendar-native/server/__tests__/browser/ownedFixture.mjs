const cleanupTimeoutMs = 5000;

async function boundedCleanup(work, label, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded its cleanup deadline`)), timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

// Register before listen(). Only sockets accepted by this fixture are owned.
export function trackOwnedHttpServer(server) {
  const sockets = new Set();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  let closing;
  return {
    get socketCount() { return sockets.size; },
    close(timeoutMs = cleanupTimeoutMs) {
      closing ??= boundedCleanup(async () => {
        const closed = new Promise((resolve, reject) => {
          server.close(error => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve());
        });
        // Chromium preconnects need not send HTTP at all. Stop admission first,
        // then release every remaining connection accepted by this fixture.
        const disconnected = [...sockets].map(socket => new Promise(resolve => {
          socket.once('close', resolve);
          socket.destroy();
        }));
        await Promise.all([closed, ...disconnected]);
      }, 'Owned HTTP server', timeoutMs);
      return closing;
    },
  };
}

export async function closeOwnedBrowserFixture({ context, owned, diagnostic = () => {}, timeoutMs = cleanupTimeoutMs }) {
  const failures = [];
  diagnostic('cleanup: closing browser context');
  try {
    if (context) await boundedCleanup(() => context.close(), 'Browser context', timeoutMs);
  } catch (error) { failures.push(error); }
  diagnostic('cleanup: closing owned HTTP connections');
  try { await owned.close(timeoutMs); }
  catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, 'Browser fixture cleanup failed');
  diagnostic('cleanup: complete');
}

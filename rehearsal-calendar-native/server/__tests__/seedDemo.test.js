import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));

// The seeding machine's zone decides local dates, so every case pins TZ in a
// child process instead of trusting whatever zone the test run happens to use.
function datesIn(timeZone, now, expression) {
  const module = pathToFileURL(path.join(scripts, 'demoDates.mjs')).href;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e',
    `import { at, allDay } from ${JSON.stringify(module)};
     const now = new Date(${JSON.stringify(now)});
     console.log(JSON.stringify(${expression}));`],
  { env: { PATH: process.env.PATH, TZ: timeZone }, encoding: 'utf8' });
  return JSON.parse(output);
}

describe('demo seed dates', () => {
  it('stores a whole day as UTC midnight of the local date, not local midnight', () => {
    // 13:00 in Jerusalem (UTC+3 in August).
    expect(datesIn('Asia/Jerusalem', '2026-08-15T10:00:00Z', 'allDay(0, now)')).toEqual({
      startsAt: '2026-08-15T00:00:00.000Z', endsAt: '2026-08-15T23:59:59.999Z', isAllDay: true,
    });
    // The instant the seed used to write for the same day reads back a day early.
    expect(datesIn('Asia/Jerusalem', '2026-08-15T10:00:00Z', 'at(0, 0, 0, now)')).toBe('2026-08-14T21:00:00.000Z');
  });

  it('takes the date from the local calendar on both sides of UTC', () => {
    // 01:30 on the 16th in Jerusalem while UTC is still on the 15th.
    expect(datesIn('Asia/Jerusalem', '2026-08-15T22:30:00Z', 'allDay(0, now).startsAt')).toBe('2026-08-16T00:00:00.000Z');
    // 22:00 on the 15th in New York while UTC is already on the 16th.
    expect(datesIn('America/New_York', '2026-08-16T02:00:00Z', 'allDay(2, now)')).toEqual({
      startsAt: '2026-08-17T00:00:00.000Z', endsAt: '2026-08-17T23:59:59.999Z', isAllDay: true,
    });
  });
});

describe('demo seed target', () => {
  it('never discovers a .env from the working directory', async () => {
    // A listener stands in for whatever database a stray .env names. The seed
    // writes to production by design, so it must only ever reach a target that
    // was selected explicitly.
    let connections = 0;
    const listener = net.createServer((socket) => { connections++; socket.destroy(); });
    await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
    const cwd = mkdtempSync(path.join(tmpdir(), 'seed-demo-cwd-'));
    try {
      const url = `postgresql://seed:seed@127.0.0.1:${listener.address().port}/seed`;
      writeFileSync(path.join(cwd, '.env'), `DATABASE_URL=${url}\n`);
      const exitCode = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(scripts, 'seed-demo.mjs')], {
          cwd, env: { PATH: process.env.PATH, HOME: cwd }, stdio: 'ignore',
        });
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('seed did not exit')); }, 10000);
        child.once('exit', (code) => { clearTimeout(timer); resolve(code); });
      });
      expect(exitCode).not.toBe(0);
      expect(connections).toBe(0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      await new Promise((resolve) => listener.close(resolve));
    }
  });
});

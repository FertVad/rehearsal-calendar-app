// T-297: the --security-only scenarios after R2_STARTUP, each group in its own
// disposable PostgreSQL 15 (scripts/r0-postgres.mjs modes). R2_STARTUP itself
// cannot run in the agent's sandbox: the OS refuses to read any file named
// .env, including the fixture's own (see postgres.txt). Usage, from the root:
//   node audit/evidence/T-297/security-rest.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('../../../rehearsal-calendar-native/server/', import.meta.url));
const modes = ['--a02-b03-only', '--b04-only', '--h04-only', '--is02-only', '--r4-only', '--f05-only',
  '--r2-migrations-schema-only', '--r3-only', '--r6-only', '--r7-only', '--r8-only', '--t278-only', '--t293-only', '--t294-only'];
let failed = 0;
for (const mode of modes) {
  const run = spawnSync(process.execPath, ['scripts/r0-postgres.mjs', mode], { cwd: server, encoding: 'utf8', timeout: 300000 });
  const lines = `${run.stdout}\n${run.stderr}`.split('\n')
    .filter((line) => /^\{"scenario"|REGRESSION|failed unexpectedly/.test(line))
    .map((line) => line.replace(/,"contracts":\[.*?\](?=,"externalConnections")/, ''));
  console.log(`== ${mode}: exit ${run.status}`);
  for (const line of lines) console.log(line);
  if (run.status !== 0) failed++;
}
console.log(`groups failed: ${failed}`);

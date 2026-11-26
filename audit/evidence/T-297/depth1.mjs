// T-297: run the T294_UPGRADE scenario in a clone of depth 1, as CI's
// actions/checkout makes it. Usage:
//   git clone --depth 1 --branch auto/main file://<repo> <dir>
//   node audit/evidence/T-297/depth1.mjs <dir> [--t294-upgrade-only|--security-only]
// The clone gets the server's installed packages by a symlink (CI runs npm ci);
// nothing is fetched.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir, mode = '--t294-upgrade-only'] = process.argv.slice(2);
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
console.log(`clone: ${dir}`);
console.log(`HEAD: ${git('log', '-1', '--format=%h %s')}`);
console.log(`shallow: ${git('rev-parse', '--is-shallow-repository')}; commits in clone: ${git('rev-list', '--count', 'HEAD')}`);
console.log(`.git/shallow: ${readFileSync(path.join(dir, '.git/shallow'), 'utf8').trim()}`);
const probe = spawnSync('git', ['-C', dir, 'cat-file', '-e', '477ea2f^{commit}'], { encoding: 'utf8' });
console.log(`477ea2f in clone: ${probe.status === 0 ? 'yes' : 'no'}`);

const server = path.join(dir, 'rehearsal-calendar-native/server');
const modules = path.join(server, 'node_modules');
if (!existsSync(modules)) {
  symlinkSync(fileURLToPath(new URL('../../../rehearsal-calendar-native/server/node_modules', import.meta.url)), modules);
}
console.log(`$ node scripts/r0-postgres.mjs ${mode}`);
const run = spawnSync(process.execPath, ['scripts/r0-postgres.mjs', mode], { cwd: server, encoding: 'utf8', timeout: 540000 });
process.stdout.write(run.stdout);
process.stdout.write(run.stderr);
console.log(`exit code: ${run.status}`);

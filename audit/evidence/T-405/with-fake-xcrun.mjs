#!/usr/bin/env node
// T-405: runs a command with fake-xcrun/xcrun first in PATH - simctl's
// terminate of Safari fails with another error than "found nothing to
// terminate", every other xcrun call goes to /usr/bin/xcrun:
//   node audit/evidence/T-405/with-fake-xcrun.mjs npm --prefix rehearsal-calendar-native run e2e -- <flow>
// The script is copied, executable, to a directory of its own in the system's
// temporary one; the command's exit code is this one's.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [command, ...args] = process.argv.slice(2);
const bin = fs.mkdtempSync(path.join(os.tmpdir(), 't405-xcrun-'));
fs.writeFileSync(path.join(bin, 'xcrun'),
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-xcrun', 'xcrun')), { mode: 0o755 });
const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
const calls = path.join(bin, 'calls.log');
console.log(`[fake xcrun] terminates of Safari it failed:\n${fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trimEnd() : '(none)'}`);
fs.rmSync(bin, { recursive: true, force: true });
process.exit(result.status ?? 1);

// T-282: run node:test on this Mac as GitHub's Linux runner sees it —
// process.platform is 'linux', and xcrun, ffmpeg, ffprobe and the compiled
// compose.swift are not there (spawn ENOENT, as on ubuntu-24.04).
// node --import ../audit/evidence/T-282-as-linux.mjs --test e2e/__tests__/store-*.test.mjs
import childProcess from 'node:child_process';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';

Object.defineProperty(process, 'platform', { value: 'linux' });

const missing = (file) => ['xcrun', 'ffmpeg', 'ffprobe'].includes(path.basename(String(file)))
  || path.basename(String(file)).startsWith('compose-');
const enoent = (file) => Object.assign(new Error(`spawnSync ${file} ENOENT`), { code: 'ENOENT', errno: -2, syscall: `spawnSync ${file}`, path: file });

const { execFileSync, spawnSync } = childProcess;
childProcess.execFileSync = (file, ...rest) => {
  if (missing(file)) throw enoent(file);
  return execFileSync(file, ...rest);
};
childProcess.spawnSync = (file, ...rest) => (missing(file)
  ? { pid: 0, status: null, signal: null, stdout: '', stderr: '', output: [null, '', ''], error: enoent(file) }
  : spawnSync(file, ...rest));
syncBuiltinESMExports();

// T-282: xcrun, ffmpeg, ffprobe and the compiled compose.swift are not there
// (spawn ENOENT, as on ubuntu-24.04). Alone: a Mac without those tools, where the
// store tests must fail, not skip. With T-282-as-linux.mjs: GitHub's runner.
// node --import ../audit/evidence/T-282-no-tools.mjs --test e2e/__tests__/store-compose.test.mjs ...
import childProcess from 'node:child_process';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';

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

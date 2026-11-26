#!/usr/bin/env node
// T-405: what `xcrun simctl terminate <udid> com.apple.mobilesafari` answers
// with Safari not running and running, and what `launchctl list` shows of
// Safari before and after - on the "Rehearsly E2E" simulator, booted here and
// shut down after. Run under the e2e lock:
//   node e2e/hold-lock.mjs node ../audit/evidence/T-405/probe-terminate.mjs
import { spawnSync } from 'node:child_process';

const run = (...args) => {
  const result = spawnSync('xcrun', ['simctl', ...args], { encoding: 'utf8', timeout: 120000 });
  return { code: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
};
const show = (what, result) => console.log(`$ simctl ${what}\n  exit ${result.code}\n  stdout: ${result.stdout || '(empty)'}\n  stderr: ${result.stderr || '(empty)'}`);
const safariJobs = (udid) => run('spawn', udid, 'launchctl', 'list').stdout.split('\n').filter((line) => /mobilesafari/i.test(line));

const { devices } = JSON.parse(run('list', 'devices', '--json').stdout);
const udid = Object.values(devices).flat().find((device) => device.name === 'Rehearsly E2E' && device.isAvailable).udid;
console.log(`simulator ${udid}`);
show('bootstatus -b', run('bootstatus', udid, '-b'));
try {
  console.log('launchctl list, Safari lines, after boot:', JSON.stringify(safariJobs(udid)));
  show('terminate (Safari not running)', run('terminate', udid, 'com.apple.mobilesafari'));
  show('terminate (no such app)', run('terminate', udid, 'com.example.none'));
  show('launch Safari', run('launch', udid, 'com.apple.mobilesafari'));
  spawnSync('sleep', ['3']);
  console.log('launchctl list, Safari lines, Safari launched:', JSON.stringify(safariJobs(udid)));
  show('terminate (Safari running)', run('terminate', udid, 'com.apple.mobilesafari'));
  console.log('launchctl list, Safari lines, after terminate:', JSON.stringify(safariJobs(udid)));
  show('terminate again (just stopped)', run('terminate', udid, 'com.apple.mobilesafari'));
} finally {
  show('shutdown', run('shutdown', udid));
}

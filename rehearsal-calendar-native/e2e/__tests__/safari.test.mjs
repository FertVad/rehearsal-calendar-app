// A fresh Safari (T-405): the helper removes Safari's tabs only when Safari
// is known to be stopped, and the runner's check fails a run whose Safari
// restored a tab, or whose fresh flows left it nothing to check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { firstSafari, freshSafari, runsFreshSafari, safariLaunches, safariVerdict } from '../safari.mjs';

const UDID = '0E96462E-BD5B-4C19-9847-8E63D550B36E';
const STORES = ['BrowserState.db', 'SafariTabs.db', 'SafariTabs.db-shm', 'SafariTabs.db-wal'];

/** A simulator's home with Safari's tab stores, bookmarks and history in Library/Safari. */
function device() {
  const home = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'safari-test-')), 'Devices', UDID, 'data');
  const library = path.join(home, 'Library', 'Safari');
  fs.mkdirSync(library, { recursive: true });
  for (const name of [...STORES, 'Bookmarks.db', 'History.db']) fs.writeFileSync(path.join(library, name), '');
  return { home, left: () => fs.readdirSync(library).sort() };
}

/** simctl as the probe found it (audit/evidence/T-405/probe-terminate.txt), terminate answering `terminate`. */
const simctl = (home, terminate) => async (command) => {
  if (command === 'getenv') return home;
  if (command !== 'terminate') throw new Error(`unexpected simctl ${command}`);
  if (terminate) throw Object.assign(new Error('Command failed: xcrun simctl terminate'), terminate);
  return '';
};
const NOTHING = { code: 3, stderr: 'An error was encountered processing the command (domain=NSPOSIXErrorDomain, code=3):\n'
  + 'Simulator device failed to terminate com.apple.mobilesafari.\nfound nothing to terminate' };

test('Safari running: stopped, its tab stores removed, bookmarks and history kept', async () => {
  const { home, left } = device();
  assert.deepEqual(await freshSafari(UDID, { run: simctl(home, null) }), { was: 'stopped', removed: STORES });
  assert.deepEqual(left(), ['Bookmarks.db', 'History.db']);
});

test('Safari not running ("found nothing to terminate", exit 3): its tab stores removed', async () => {
  const { home, left } = device();
  assert.deepEqual(await freshSafari(UDID, { run: simctl(home, NOTHING) }), { was: 'not running', removed: STORES });
  assert.deepEqual(left(), ['Bookmarks.db', 'History.db']);
});

for (const [what, failure] of [
  ['another error', { code: 1, stderr: 'An error was encountered processing the command (domain=com.apple.CoreSimulator.SimError, code=405)' }],
  ['exit 3 with another text', { code: 3, stderr: 'Unable to terminate: device is shutting down' }],
  ['"found nothing to terminate" with another exit', { code: 1, stderr: NOTHING.stderr }],
  ['simctl out of its time', { code: null, killed: true, signal: 'SIGTERM', stderr: '' }],
]) {
  test(`terminate failing with ${what}: nothing removed, an error`, async () => {
    const { home, left } = device();
    await assert.rejects(freshSafari(UDID, { run: simctl(home, failure) }), /Safari not known to be stopped, nothing removed/);
    assert.deepEqual(left(), ['Bookmarks.db', ...STORES, 'History.db'].sort());
  });
}

test('a home that is not the simulator\'s: an error, nothing removed', async () => {
  const { left } = device();
  await assert.rejects(freshSafari(UDID, { run: simctl('/Users/someone', null) }), /the simulator's home is \/Users\/someone/);
  assert.equal(left().length, 6);
});

/** A run's artifacts: a folder per flow, its device log made of `lines`. */
function run(flows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'safari-run-'));
  for (const [flow, lines] of Object.entries(flows)) {
    fs.mkdirSync(path.join(dir, flow, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(dir, flow, 'logs', 'device-simulator.log'), `${lines.join('\n')}\n`);
  }
  fs.writeFileSync(path.join(dir, 'server.log'), 'Read 9 normal tabs from saved state\n');
  return dir;
}
const launch = (at, tabs) => `2026-11-24 ${at}-1000  localhost MobileSafari[50814]: (MobileSafariUI) [com.apple.mobilesafari:TabGroup] Read ${tabs} normal tabs from saved state`;

test('every launch of Safari, by flow, from the device logs', async () => {
  const dir = run({
    'Privacy policy lists Resend in every language': ['noise', launch('02:20:52.182893', 26)],
    "The profile's language, kept by the account": [launch('02:19:50.224056', 0), 'more noise', launch('02:20:06.818165', 0)],
    'Sign in': ['localhost Rehearsly[1]: nothing of Safari'],
  });
  assert.deepEqual(Object.fromEntries(await safariLaunches(dir)), {
    'Privacy policy lists Resend in every language': [{ at: '2026-11-24 02:20:52.182893-1000', tabs: 26 }],
    "The profile's language, kept by the account": [{ at: '2026-11-24 02:19:50.224056-1000', tabs: 0 }, { at: '2026-11-24 02:20:06.818165-1000', tabs: 0 }],
    'Sign in': [],
  });
  assert.equal((await safariLaunches(path.join(dir, 'none'))).size, 0);
});

test('a launch line cut between two pieces of the log: found once', async () => {
  // The log is read a megabyte at a time: this line starts 40 bytes before the first piece ends.
  const dir = run({ A: ['x'.repeat((1 << 20) - 41), launch('02:19:50.224056', 2), launch('02:20:00.000000', 0)] });
  assert.deepEqual((await safariLaunches(dir)).get('A'),
    [{ at: '2026-11-24 02:19:50.224056-1000', tabs: 2 }, { at: '2026-11-24 02:20:00.000000-1000', tabs: 0 }]);
});

// A device log over V8's longest string (~512 MB) cannot be read whole: the
// check read each log whole, and such a run left with 1 and no reason (T-405
// review). Safari's lines among MobileSafari noise, as in a real log.
test('a device log over 512 MB: read, its launches found', async () => {
  const dir = run({ 'A long flow': [] });
  const log = path.join(dir, 'A long flow', 'logs', 'device-simulator.log');
  const noise = '2026-11-24 02:20:52.000000-1000  localhost MobileSafari[50814]: (UIKitCore) [com.apple.UIKit:EventDispatch] '
    + 'Sending event to the window, nothing of tabs here\n';
  const chunk = Buffer.from(noise.repeat(Math.ceil((8 << 20) / noise.length)));
  const fd = fs.openSync(log, 'w');
  try {
    fs.writeSync(fd, `${launch('02:19:50.224056', 0)}\n`);
    for (let written = 0; written <= 520 << 20; written += chunk.length) fs.writeSync(fd, chunk);
    fs.writeSync(fd, `${launch('02:30:00.000001', 3)}\n`);
  } finally { fs.closeSync(fd); }
  try {
    assert.ok(fs.statSync(log).size > 0x1fffffe8, 'the log is longer than V8\'s longest string');
    assert.deepEqual((await safariLaunches(dir)).get('A long flow'),
      [{ at: '2026-11-24 02:19:50.224056-1000', tabs: 0 }, { at: '2026-11-24 02:30:00.000001-1000', tabs: 3 }]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('no tab restored: green, and the line says how many launches', () => {
  const launches = new Map([['A', [{ at: 't1', tabs: 0 }, { at: 't2', tabs: 0 }]], ['B', [{ at: 't3', tabs: 0 }]], ['C', []]]);
  assert.deepEqual(safariVerdict({ launches, fresh: ['A', 'B'] }),
    { summary: 'Safari launches: 3, tabs restored: 0 (fresh-safari.yaml)', failures: [] });
});

test('a launch that restored tabs: red, naming the flow and the number', () => {
  const launches = new Map([['Privacy policy lists Resend in every language', [{ at: '2026-11-24 02:20:52', tabs: 26 }]], ['B', [{ at: 't', tabs: 0 }]]]);
  const { summary, failures } = safariVerdict({ launches, fresh: ['B'] });
  assert.equal(summary, 'Safari launches: 2, tabs restored: 26 (fresh-safari.yaml)');
  assert.deepEqual(failures, ['"Privacy policy lists Resend in every language": Safari restored 26 tab(s) at launch (26 at 2026-11-24 02:20:52)']);
});

test('a fresh flow passed with no launch in its log: red, the check saw nothing', () => {
  const { summary, failures } = safariVerdict({ launches: new Map([['A', []]]), fresh: ['A', 'B'] });
  assert.equal(summary, 'Safari launches: 0, tabs restored: 0 (fresh-safari.yaml)');
  assert.equal(failures.length, 2);
  assert.match(failures[0], /^"A": passed after fresh-safari\.yaml, and its device log has no launch of Safari/);
  assert.match(failures[1], /^"B": /);
});

test('the flows that run fresh-safari.yaml', () => {
  assert.equal(runsFreshSafari('---\n- stopApp: ${APP_ID}\n- runFlow: ../subflows/fresh-safari.yaml\n- openLink: x\n'), true);
  assert.equal(runsFreshSafari('---\n- runFlow:\n    file: ../subflows/fresh-safari.yaml\n'), true);
  assert.equal(runsFreshSafari('---\n- runFlow:\n    file: ../subflows/open-link.yaml\n'), false);
  assert.equal(runsFreshSafari('# Safari starts with no tabs (fresh-safari.yaml, T-404).\n---\n- openLink: x\n'), false);
});

// The boot's first Safari (T-418): launched by the runner, read in the device
// log by its process until it says it started, stopped.
const HOMELESS = 'MobileSafari[38622]: (CoreFoundation) [com.apple.defaults:User Defaults] Disabling saving preferences for '
  + '{ com.apple.Accessibility, kCFPreferencesCurrentUser, any host, (null) } because home directory is inaccessible';
const STARTED = 'MobileSafari[38622]: (MobileSafariUI) [com.apple.mobilesafari:TabGroup] Read 0 normal tabs from saved state';

/** simctl for firstSafari: each launch a new pid, its log `logs[i]` (a list of answers, one per read, the last repeated). */
function booted(home, logs) {
  const calls = [];
  let launched = 0;
  const reads = new Map();
  const run = async (command, ...args) => {
    calls.push(command);
    if (command === 'getenv') return home;
    if (command === 'terminate') return '';
    if (command === 'launch') { launched += 1; return `com.apple.mobilesafari: ${1000 + launched}`; }
    if (command === 'spawn') {
      const pid = Number(/processIdentifier == (\d+)/.exec(args.at(-1))[1]);
      const answers = logs[pid - 1001];
      const at = reads.get(pid) ?? 0;
      reads.set(pid, at + 1);
      return answers[Math.min(at, answers.length - 1)];
    }
    throw new Error(`unexpected simctl ${command}`);
  };
  return { run, calls, wait: async () => {} };
}

test('the first Safari of the boot: launched, stopped once it said it started, its home readable', async () => {
  const { home, left } = device();
  const { run, calls, wait } = booted(home, [['', STARTED]]);
  assert.deepEqual(await firstSafari(UDID, { run, wait }), { pid: 1001, home: 'readable' });
  assert.deepEqual(calls.filter((c) => c !== 'getenv'), ['terminate', 'launch', 'spawn', 'spawn', 'terminate']);
  assert.deepEqual(left(), ['Bookmarks.db', 'History.db']);
});

test('its home inaccessible: said so, launched once all the same, and stopped', async () => {
  const { home } = device();
  const { run, calls, wait } = booted(home, [[`${HOMELESS}\n${STARTED}`]]);
  assert.deepEqual(await firstSafari(UDID, { run, wait }), { pid: 1001, home: 'inaccessible' });
  assert.equal(calls.filter((c) => c === 'launch').length, 1);
  assert.equal(calls.filter((c) => c !== 'getenv').at(-1), 'terminate');
});

test('a Safari that never says it started: an error, Safari stopped', async () => {
  const { home } = device();
  const { run, calls, wait } = booted(home, [['']]);
  await assert.rejects(firstSafari(UDID, { run, wait, startMs: 5000 }), /Safari \(1001\) did not say it had started .* in 5 s/);
  assert.equal(calls.filter((c) => c !== 'getenv').at(-1), 'terminate');
});

test('a launch with no process in simctl\'s answer: an error', async () => {
  const { home } = device();
  const run = async (command) => (command === 'getenv' ? home : command === 'launch' ? 'An error was encountered' : '');
  await assert.rejects(firstSafari(UDID, { run, wait: async () => {} }), /gave no process: An error was encountered/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, unlinkSync, rmSync, chmodSync, symlinkSync, realpathSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scanner = fileURLToPath(new URL('../check-secrets.sh', import.meta.url));
const environment = {
  PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', LC_ALL: 'C',
};

// Every invocation scans a fresh synthetic repository. The real checkout is only
// read to locate/copy the CLI itself; no fixture imports application configuration.
function fixture(t, options = {}) {
  const temporary = realpathSync(mkdtempSync(path.join(tmpdir(), 'is01-cli-fixture-')));
  const root = path.join(temporary, 'repository');
  mkdirSync(root);
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const runGit = (args, input) => {
    const result = spawnSync('/usr/bin/git', args, {
      cwd: root, env: environment, input, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, 0, 'synthetic Git fixture operation succeeds');
    return result.stdout;
  };
  const git = (...args) => runGit(args);
  git('-c', 'init.defaultBranch=main', 'init', '-q');
  let executable = scanner;
  let configPath;
  if (Object.hasOwn(options, 'exceptions')) {
    // Copy production CLI bytes unchanged; only its adjacent policy fixture is
    // replaced, avoiding any mutation of the repository's reviewed exceptions.
    const tools = path.join(options.toolsInsideRepo ? root : temporary, 'tools');
    mkdirSync(tools);
    for (const name of ['check-secrets.sh', 'check-secrets.mjs']) {
      copyFileSync(path.join(path.dirname(scanner), name), path.join(tools, name));
    }
    executable = path.join(tools, 'check-secrets.sh');
    configPath = path.join(tools, 'secret-scan-exceptions.json');
    writeFileSync(configPath, JSON.stringify(options.exceptions));
  }
  const write = (name, content) => {
    const target = path.join(root, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
    return target;
  };
  const scan = (args = [], settings = {}) => {
    const result = spawnSync('/bin/bash', [executable, ...args], {
      cwd: settings.cwd || root, env: { ...environment, ...settings.env },
      encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.error, undefined, 'scanner finishes without a process transport error');
    assert.equal(result.signal, null, 'scanner is not killed');
    return result;
  };
  return { root, temporary, git, runGit, write, scan, configPath };
}

const assignment = (name, value) => `${name}=${value}`;
const token = (letter = 'Q', length = 20) => letter.repeat(length);
const databaseValue = () => ['postgresql:', '//fixture:synthetic@fixture.invalid/database'].join('');
const databaseLine = () => assignment('DATABASE_URL', databaseValue());
const privateLine = () => assignment(['PRIVATE', 'KEY'].join('_'), 'synthetic-marker');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function verifyOutput(result, status, forbidden = []) {
  assert.equal(result.status, status, 'scanner returns the documented exit status');
  const output = result.stdout + result.stderr;
  for (const value of forbidden) {
    assert.equal(output.includes(value), false, 'scanner output does not contain fixture source values');
  }
  if (status !== 0) assert.doesNotMatch(output, /scan passed|no secrets found/i);
  const lines = result.stdout.trim() ? result.stdout.trim().split('\n') : [];
  const records = lines.map((line) => {
    let record;
    try { record = JSON.parse(line); } catch { assert.fail('stdout contains only JSON metadata records'); }
    if (Object.hasOwn(record, 'summary')) return record;
    assert.deepEqual(Object.keys(record).sort(), record.rule === 'scan-error'
      ? ['code', 'line', 'path', 'rule'] : ['line', 'path', 'rule']);
    assert.ok(typeof record.path === 'string' || (record.rule === 'scan-error' && record.path === null));
    assert.equal(typeof record.rule, 'string');
    assert.ok(Number.isInteger(record.line) && record.line >= 0);
    return record;
  });
  const summaries = records.filter((record) => Object.hasOwn(record, 'summary'));
  assert.equal(summaries.length, 1, 'one final summary describes the scan');
  assert.equal(summaries[0], records.at(-1), 'summary follows all metadata records');
  assert.equal(summaries[0].summary, ['pass', 'findings', 'error'][status]);
  assert.deepEqual(Object.keys(summaries[0]).sort(), ['errors', 'files', 'findings', 'mode', 'summary']);
  const findings = records.filter((record) => !Object.hasOwn(record, 'summary') && record.rule !== 'scan-error');
  const errors = records.filter((record) => record.rule === 'scan-error');
  assert.equal(summaries[0].findings, findings.length);
  assert.equal(summaries[0].errors, errors.length);
  assert.ok(Number.isInteger(summaries[0].files) && summaries[0].files >= 0);
  if (status === 0) assert.equal(findings.length + errors.length, 0);
  if (status === 1) { assert.ok(findings.length > 0); assert.equal(errors.length, 0); }
  if (status === 2) assert.ok(errors.length > 0);
  return findings;
}

test('JWT assignment with 20 characters is a finding', (t) => {
  const f = fixture(t);
  writeFileSync(path.join(f.root, 'settings.txt'), `JWT_SECRET=${'A'.repeat(20)}\n`);
  f.git('add', '--all');
  const result = f.scan();
  assert.equal(result.status, 1, 'scanner must reject the synthetic credential');
  assert.deepEqual(verifyOutput(result, 1, [token('A')]), [
    { path: 'settings.txt', line: 1, rule: 'jwt-secret' },
  ]);
});

test('missing indexed regular file is an incomplete scan', (t) => {
  const f = fixture(t);
  writeFileSync(path.join(f.root, 'settings.txt'), 'ordinary fixture\n');
  f.git('add', '--all');
  unlinkSync(path.join(f.root, 'settings.txt'));
  const result = f.scan();
  assert.equal(result.status, 2, 'scanner must not claim success when an indexed file is unreadable');
  verifyOutput(result, 2);
});

test('empty index and ordinary text both pass', (t) => {
  const f = fixture(t);
  assert.deepEqual(verifyOutput(f.scan(), 0), []);
  f.write('ordinary.txt', 'ordinary text\nprocess.env.JWT_SECRET || fallback\n');
  f.git('add', '--all');
  assert.deepEqual(verifyOutput(f.scan(), 0), []);
});

test('all existing credential families report rule, path and exact line without values', (t) => {
  const f = fixture(t);
  const rows = [
    ['database-url', databaseLine()],
    ['database-url', assignment('database_url', databaseValue().replace('postgresql:', 'postgres:'))],
    ['telegram-token', assignment('TELEGRAM_BOT_TOKEN', '123456:synthetic-bot-marker')],
    ['jwt-secret', assignment('jWt_sEcReT', token('A', 18) + '_-')],
    ['openai-key', ['sK', token('B')].join('-')],
    ['stripe-live-key', ['pK', 'LiVe', '7fixture'].join('_')],
    ['private-key-assignment', privateLine()],
    ['api-key', assignment('aPi_KeY', token('C'))],
    ['bearer-token', ['bEaReR', token('D')].join(' ')],
    ['password', assignment('PaSsWoRd', token('E', 8))],
  ];
  f.write('settings.txt', rows.map(([, line]) => line).join('\r\n') + '\r\n');
  f.git('add', '--all');
  const actual = verifyOutput(f.scan(), 1, [
    ...rows.map(([, line]) => line), databaseValue(), '123456:synthetic-bot-marker',
    token('A', 18) + '_-', token('B'), token('C'), token('D'), token('E', 8),
    '7fixture', 'synthetic-marker',
  ]);
  assert.deepEqual(actual.sort((a, b) => a.line - b.line), rows.map(([rule], index) => ({
    path: 'settings.txt', line: index + 1, rule,
  })));
});

test('length thresholds preserve 19/20 and 7/8 boundaries', (t) => {
  const f = fixture(t);
  const builders = [
    ['jwt-secret', (n) => assignment('JWT_SECRET', token('Q', n))],
    ['api-key', (n) => assignment('API_KEY', token('R', n))],
    ['openai-key', (n) => ['sk', token('S', n)].join('-')],
    ['bearer-token', (n) => ['Bearer', token('T', n)].join(' ')],
    ['password', (n) => assignment('password', token('U', n))],
  ];
  for (const [rule, build] of builders) {
    const threshold = rule === 'password' ? 8 : 20;
    f.write('boundary.txt', build(threshold - 1));
    f.git('add', '--all');
    assert.deepEqual(verifyOutput(f.scan(), 0), []);
    f.write('boundary.txt', build(threshold));
    assert.deepEqual(verifyOutput(f.scan(), 1, [build(threshold)]), [
      { path: 'boundary.txt', line: 1, rule },
    ]);
  }
});

test('filenames survive spaces, tabs, newlines, colon, leading dash and Unicode', (t) => {
  const f = fixture(t);
  const names = ['space name.txt', 'tab\tname.txt', 'line\nbreak.txt', 'colon:name.txt', '-option.txt', 'репетиция.txt',
    String.fromCodePoint(0xfeff) + 'bom.txt'];
  for (const name of names) f.write(name, databaseLine());
  f.git('add', '--all');
  const result = f.scan();
  const actual = verifyOutput(result, 1, [databaseValue()]);
  assert.deepEqual(actual.map((entry) => entry.path).sort(), [...names].sort());
  assert.ok(actual.every(({ rule, line }) => rule === 'database-url' && line === 1));
  assert.equal(result.stdout.includes('line\nbreak.txt'), false, 'filename newline is JSON escaped');
  assert.equal(result.stdout.includes('tab\tname.txt'), false, 'filename tab is JSON escaped');
});

test('root and subdirectory invocation scan the same complete tracked scope', (t) => {
  const f = fixture(t);
  f.write('audit/notes.md', databaseLine());
  f.write('application/safe.txt', 'ordinary text');
  f.git('add', '--all');
  const fromRoot = verifyOutput(f.scan(), 1, [databaseValue()]);
  const fromChild = verifyOutput(f.scan([], { cwd: path.join(f.root, 'application') }), 1, [databaseValue()]);
  assert.deepEqual(fromChild, fromRoot);
  assert.deepEqual(verifyOutput(f.scan(['--staged'], { cwd: path.join(f.root, 'application') }), 1, [databaseValue()]), fromRoot);
  assert.deepEqual(fromRoot, [{ path: 'audit/notes.md', line: 1, rule: 'database-url' }]);
});

test('Markdown, arbitrary examples and scanner-looking source names remain in scope', (t) => {
  const f = fixture(t);
  const names = ['README.md', 'config.example', 'config.example.backup', '.env.example',
    'nested/scripts/check-secrets.sh', 'scripts/check-secrets.mjs'];
  for (const name of names) f.write(name, databaseLine());
  f.git('add', '--all');
  const actual = verifyOutput(f.scan(), 1, [databaseValue()]);
  assert.deepEqual(actual.map(({ path: name }) => name).sort(), [...names].sort());
  assert.ok(actual.every(({ rule }) => rule === 'database-url'));
});

test('forbidden environment and key filenames are detected before missing content is opened', (t) => {
  const f = fixture(t);
  const names = ['.env', 'nested/.env.production', '.env.example.backup', '.ENV.EXAMPLE',
    'keys/private.pem', 'keys/signing.key', 'keys/id_rsa', 'keys/id_ed25519'];
  for (const name of names) f.write(name, token('V', 50));
  f.git('add', '--all');
  for (const name of names) unlinkSync(path.join(f.root, name));
  const actual = verifyOutput(f.scan(), 1, [token('V', 50)]);
  assert.deepEqual(actual.map(({ path: name }) => name).sort(), [...names].sort());
  assert.ok(actual.every(({ rule, line }) => rule === 'tracked-sensitive-file' && line === 0));
});

test('forbidden staged filename is reported without reading its corrupt object', (t) => {
  const f = fixture(t);
  f.write('.env', token('W', 50));
  f.git('add', '--all');
  const oid = f.git('rev-parse', ':.env').trim();
  unlinkSync(path.join(f.root, '.git', 'objects', oid.slice(0, 2), oid.slice(2)));
  assert.deepEqual(verifyOutput(f.scan(['--staged']), 1, [token('W', 50)]), [
    { path: '.env', line: 0, rule: 'tracked-sensitive-file' },
  ]);
});

test('ignored and untracked synthetic credentials are outside tracked scope', (t) => {
  const f = fixture(t);
  f.write('.gitignore', '.env\n');
  f.git('add', '--all');
  f.write('.env', databaseLine());
  f.write('untracked.txt', assignment('JWT_SECRET', token('X')));
  assert.deepEqual(verifyOutput(f.scan(), 0, [databaseValue(), token('X')]), []);
});

test('binary bytes do not hide ASCII credentials or disturb line numbers', (t) => {
  const f = fixture(t);
  const marker = assignment('API_KEY', token('Y'));
  f.write('asset.bin', Buffer.concat([Buffer.from([0, 255, 128, 10]), Buffer.from(marker), Buffer.from([0])]));
  f.git('add', '--all');
  assert.deepEqual(verifyOutput(f.scan(), 1, [token('Y')]), [
    { path: 'asset.bin', line: 2, rule: 'api-key' },
  ]);
});

test('staged and worktree snapshots are independent in both directions', (t) => {
  const f = fixture(t);
  f.write('settings.txt', databaseLine());
  f.git('add', '--all');
  f.write('settings.txt', 'ordinary working copy');
  verifyOutput(f.scan(['--staged']), 1, [databaseValue()]);
  assert.deepEqual(verifyOutput(f.scan(['--worktree']), 0), []);
  f.git('add', '--all');
  f.write('settings.txt', databaseLine());
  assert.deepEqual(verifyOutput(f.scan(['--staged']), 0), []);
  verifyOutput(f.scan(), 1, [databaseValue()]);
});

test('staged deletion is not read in either mode', (t) => {
  const f = fixture(t);
  f.write('deleted.txt', databaseLine());
  f.git('add', '--all');
  f.git('rm', '-f', '--', 'deleted.txt');
  assert.deepEqual(verifyOutput(f.scan(), 0), []);
  assert.deepEqual(verifyOutput(f.scan(['--staged']), 0), []);
});

test('staged object missing and corrupt content produce incomplete-scan errors', (t) => {
  const f = fixture(t);
  f.write('settings.txt', databaseLine());
  f.git('add', '--all');
  const oid = f.git('rev-parse', ':settings.txt').trim();
  const objectPath = path.join(f.root, '.git', 'objects', oid.slice(0, 2), oid.slice(2));
  const objectBytes = readFileSync(objectPath);
  unlinkSync(objectPath);
  verifyOutput(f.scan(['--staged']), 2, [databaseValue()]);
  writeFileSync(objectPath, Buffer.from('invalid fixture object'));
  verifyOutput(f.scan(['--staged']), 2, [databaseValue()]);
  writeFileSync(objectPath, objectBytes);
});

test('unreadable or replaced indexed regular files fail closed', (t) => {
  const f = fixture(t);
  const filename = f.write('settings.txt', 'ordinary fixture');
  f.git('add', '--all');
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
    chmodSync(filename, 0);
    try { verifyOutput(f.scan(), 2); } finally { chmodSync(filename, 0o600); }
  }
  unlinkSync(filename);
  mkdirSync(filename);
  verifyOutput(f.scan(), 2);
});

test('oversized regular file fails closed while the small staged snapshot remains readable', (t) => {
  const f = fixture(t);
  const filename = f.write('oversized.bin', '');
  f.git('add', '--all');
  truncateSync(filename, 64 * 1024 * 1024 + 1);
  verifyOutput(f.scan(), 2);
  assert.deepEqual(verifyOutput(f.scan(['--staged']), 0), []);
});

test('scan errors take precedence over findings', (t) => {
  const f = fixture(t);
  f.write('finding.txt', databaseLine());
  const absent = f.write('missing.txt', 'ordinary fixture');
  f.git('add', '--all');
  unlinkSync(absent);
  verifyOutput(f.scan(), 2, [databaseValue()]);
});

test('unknown, conflicting and repeated arguments are errors', (t) => {
  const f = fixture(t);
  for (const args of [['--unknown'], ['--staged', '--worktree'], ['--staged', '--staged'], ['settings.txt']]) {
    verifyOutput(f.scan(args), 2);
  }
});

test('nonrepository and failed Git executable are errors', (t) => {
  const f = fixture(t);
  verifyOutput(f.scan([], { cwd: f.temporary }), 2);
  const binaries = path.join(f.temporary, 'bin');
  mkdirSync(binaries);
  f.write('ordinary.txt', 'ordinary fixture');
  f.git('add', '--all');
  // Real failing child process, not a substituted file list or Git response.
  const diagnostic = token('G', 30);
  writeFileSync(path.join(binaries, 'git'), `#!/bin/sh\nprintf '%s\\n' '${diagnostic}' >&2\nexit 73\n`, { mode: 0o755 });
  verifyOutput(f.scan([], { env: { PATH: `${binaries}:${environment.PATH}` } }), 2, [diagnostic]);
});

test('unmerged index stages are unsupported rather than partially scanned', (t) => {
  const f = fixture(t);
  f.write('conflict.txt', 'ordinary fixture');
  f.git('add', '--all');
  const oid = f.git('rev-parse', ':conflict.txt').trim();
  f.git('update-index', '--force-remove', '--', 'conflict.txt');
  f.runGit(['update-index', '--index-info'], `100644 ${oid} 1\tconflict.txt\n100644 ${oid} 2\tconflict.txt\n`);
  verifyOutput(f.scan(), 2);
  verifyOutput(f.scan(['--staged']), 2);
});

test('tracked symlinks and gitlinks are unsupported in both modes', (t) => {
  const f = fixture(t);
  const outside = path.join(f.temporary, 'outside.txt');
  writeFileSync(outside, databaseLine());
  symlinkSync(outside, path.join(f.root, 'link.txt'));
  f.git('add', '--all');
  verifyOutput(f.scan(), 2, [databaseValue()]);
  verifyOutput(f.scan(['--staged']), 2, [databaseValue()]);
  f.git('rm', '-f', '--', 'link.txt');
  f.git('update-index', '--add', '--cacheinfo', '160000', '1'.repeat(40), 'submodule');
  verifyOutput(f.scan(), 2);
  verifyOutput(f.scan(['--staged']), 2);
});

test('sensitive filenames still report unsupported and unmerged index errors without content reads', (t) => {
  const f = fixture(t);
  const outside = path.join(f.temporary, 'outside.txt');
  writeFileSync(outside, databaseLine());
  symlinkSync(outside, path.join(f.root, '.env'));
  f.git('add', '--all');
  const expected = [{ path: '.env', line: 0, rule: 'tracked-sensitive-file' }];
  assert.deepEqual(verifyOutput(f.scan(), 2, [databaseValue()]), expected);
  assert.deepEqual(verifyOutput(f.scan(['--staged']), 2, [databaseValue()]), expected);
  f.git('rm', '-f', '--', '.env');
  f.write('.env', 'ordinary synthetic fixture');
  f.git('add', '--all');
  const oid = f.git('rev-parse', ':.env').trim();
  f.git('update-index', '--force-remove', '--', '.env');
  f.runGit(['update-index', '--index-info'], `100644 ${oid} 1\t.env\n100644 ${oid} 2\t.env\n`);
  unlinkSync(path.join(f.root, '.env'));
  assert.deepEqual(verifyOutput(f.scan(), 2, [databaseValue()]), expected);
  assert.deepEqual(verifyOutput(f.scan(['--staged']), 2, [databaseValue()]), expected);
});

test('worktree symlink replacement cannot escape the tracked regular path', (t) => {
  const f = fixture(t);
  f.write('directory/settings.txt', 'ordinary fixture');
  f.git('add', '--all');
  const outside = path.join(f.temporary, 'outside');
  mkdirSync(outside);
  writeFileSync(path.join(outside, 'settings.txt'), databaseLine());
  rmSync(path.join(f.root, 'directory'), { recursive: true });
  symlinkSync(outside, path.join(f.root, 'directory'));
  verifyOutput(f.scan(), 2, [databaseValue()]);
  assert.deepEqual(verifyOutput(f.scan(['--staged']), 0), []);
  unlinkSync(path.join(f.root, 'directory'));
  mkdirSync(path.join(f.root, 'directory'));
  symlinkSync(path.join(outside, 'settings.txt'), path.join(f.root, 'directory', 'settings.txt'));
  verifyOutput(f.scan(), 2, [databaseValue()]);
});

test('ancestor replacement during validation is rejected before any external inode read', (t) => {
  const f = fixture(t);
  const target = f.write('directory/settings.txt', 'ordinary indexed fixture');
  f.git('add', '--all');
  const directory = path.dirname(target);
  const outside = path.join(f.temporary, 'outside');
  mkdirSync(outside);
  const externalFile = path.join(outside, 'settings.txt');
  writeFileSync(externalFile, databaseLine());
  const report = path.join(f.temporary, 'read-observation.json');
  const preload = path.join(f.temporary, 'filesystem-barrier.mjs');
  // The preload changes only synthetic filesystem state at a deterministic
  // barrier. Every production check runs normally. A separate inode observer
  // forbids/records an outside read, so exit 2 alone cannot make this test pass.
  writeFileSync(preload, `
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const originalRealpath = fs.realpathSync;
const originalRead = fs.readFileSync;
const outsideIdentity = fs.statSync(${JSON.stringify(externalFile)});
let barrierTriggered = false;
let outsideReadAttempts = 0;
fs.realpathSync = function(file, ...args) {
  const result = originalRealpath.call(this, file, ...args);
  if (file === ${JSON.stringify(target)} && !barrierTriggered) {
    barrierTriggered = true;
    fs.renameSync(${JSON.stringify(directory)}, ${JSON.stringify(directory + '-original')});
    fs.symlinkSync(${JSON.stringify(outside)}, ${JSON.stringify(directory)});
  }
  return result;
};
fs.readFileSync = function(file, ...args) {
  let identity;
  try { identity = typeof file === 'number' ? fs.fstatSync(file) : fs.statSync(file); }
  catch { /* Preserve the original read error for unrelated files. */ }
  if (identity?.dev === outsideIdentity.dev && identity?.ino === outsideIdentity.ino) {
    outsideReadAttempts++;
    throw new Error('fixture outside read forbidden');
  }
  return originalRead.call(this, file, ...args);
};
process.on('exit', () => {
  fs.writeFileSync(${JSON.stringify(report)}, JSON.stringify({ barrierTriggered, outsideReadAttempts }));
});
syncBuiltinESMExports();
`);
  verifyOutput(f.scan([], { env: { NODE_OPTIONS: `--import=${preload}` } }), 2, [databaseValue()]);
  assert.deepEqual(JSON.parse(readFileSync(report, 'utf8')), {
    barrierTriggered: true, outsideReadAttempts: 0,
  });
});

test('exceptions require the exact path, rule and complete normalized line', (t) => {
  const line = databaseLine();
  const entry = { path: 'docs/template.txt', rule: 'database-url', lineSha256: sha256(line), reason: 'synthetic fixture placeholder' };
  const f = fixture(t, { exceptions: [entry] });
  f.write(entry.path, line + '\r\n');
  f.git('add', '--all');
  assert.deepEqual(verifyOutput(f.scan(), 0, [databaseValue()]), []);
  assert.deepEqual(verifyOutput(f.scan(['--staged']), 0, [databaseValue()]), []);
  f.write(entry.path, line + '-modified\n');
  verifyOutput(f.scan(), 1, [databaseValue()]);
  f.write(entry.path, line + '\n');
  f.write('docs/other.txt', line);
  f.git('add', '--all');
  assert.deepEqual(verifyOutput(f.scan(), 1, [databaseValue()]), [
    { path: 'docs/other.txt', line: 1, rule: 'database-url' },
  ]);
});

test('exception for one rule cannot silence another credential on the same line', (t) => {
  const line = databaseLine() + ' ' + assignment('API_KEY', token('Z'));
  const entry = { path: 'template.txt', rule: 'database-url', lineSha256: sha256(line), reason: 'synthetic fixture only' };
  const f = fixture(t, { exceptions: [entry] });
  f.write(entry.path, line);
  f.git('add', '--all');
  assert.deepEqual(verifyOutput(f.scan(), 1, [databaseValue(), token('Z')]), [
    { path: 'template.txt', line: 1, rule: 'api-key' },
  ]);
});

test('staged scan uses indexed policy when the CLI is inside the scanned repository', (t) => {
  const line = databaseLine();
  const entry = { path: 'template.txt', rule: 'database-url', lineSha256: sha256(line), reason: 'synthetic fixture placeholder' };
  const f = fixture(t, { exceptions: [], toolsInsideRepo: true });
  f.write(entry.path, line);
  f.git('add', '--all');
  writeFileSync(f.configPath, JSON.stringify([entry]));
  const stagedBefore = f.scan(['--staged']);
  assert.equal(stagedBefore.status, 1, 'unstaged exception cannot hide the indexed credential');
  assert.ok(verifyOutput(stagedBefore, 1, [databaseValue()]).some(
    ({ path: name, rule }) => name === entry.path && rule === entry.rule,
  ));
  f.git('add', '--all');
  writeFileSync(f.configPath, '[]');
  const stagedAfter = f.scan(['--staged']);
  // The actual CLI sources are also tracked and scanned here; they may have
  // their own findings. Scope this assertion to the reviewed target exception.
  assert.ok([0, 1].includes(stagedAfter.status), 'indexed valid policy remains available');
  assert.equal(verifyOutput(stagedAfter, stagedAfter.status, [databaseValue()]).some(
    ({ path: name, rule }) => name === entry.path && rule === entry.rule,
  ), false);
  const working = f.scan();
  assert.equal(working.status, 1);
  assert.ok(verifyOutput(working, 1, [databaseValue()]).some(
    ({ path: name, rule }) => name === entry.path && rule === entry.rule,
  ));
});

test('bare carriage return remains part of exception line identity', (t) => {
  const line = databaseLine() + '\rmetadata';
  const entry = { path: 'template.txt', rule: 'database-url', lineSha256: sha256(line), reason: 'synthetic bytes' };
  const f = fixture(t, { exceptions: [entry] });
  f.write(entry.path, line + '\n');
  f.git('add', '--all');
  assert.deepEqual(verifyOutput(f.scan(), 0), []);
  f.write(entry.path, line.replace('\r', '') + '\n');
  verifyOutput(f.scan(), 1, [databaseValue()]);
  const withoutCr = databaseLine();
  writeFileSync(f.configPath, JSON.stringify([{ ...entry, lineSha256: sha256(withoutCr) }]));
  f.write(entry.path, withoutCr + '\r');
  verifyOutput(f.scan(), 1, [databaseValue()]);
});

test('exception hashes use raw line bytes including Unicode and invalid UTF-8', (t) => {
  const line = Buffer.concat([Buffer.from('пример '), Buffer.from([255, 128]), Buffer.from(databaseLine())]);
  const entry = { path: 'template.bin', rule: 'database-url', lineSha256: sha256(line), reason: 'synthetic raw bytes' };
  const f = fixture(t, { exceptions: [entry] });
  f.write(entry.path, Buffer.concat([line, Buffer.from('\r\n')]));
  f.git('add', '--all');
  assert.deepEqual(verifyOutput(f.scan(), 0), []);
  assert.deepEqual(verifyOutput(f.scan(['--staged']), 0), []);
  f.write(entry.path, Buffer.concat([Buffer.from([0]), line]));
  verifyOutput(f.scan(), 1, [databaseValue()]);
});

test('exception policy JSON is scanned when tracked', (t) => {
  const f = fixture(t, { exceptions: [] });
  f.write('scripts/secret-scan-exceptions.json', JSON.stringify({ note: databaseLine() }));
  f.git('add', '--all');
  assert.deepEqual(verifyOutput(f.scan(), 1, [databaseValue()]), [
    { path: 'scripts/secret-scan-exceptions.json', line: 1, rule: 'database-url' },
  ]);
});

test('oversized exception policies fail closed in external and staged tool bundles', (t) => {
  const entry = { path: 'template.txt', rule: 'database-url', lineSha256: sha256(databaseLine()), reason: token('J', 1024 * 1024) };
  const external = fixture(t, { exceptions: [entry] });
  verifyOutput(external.scan(), 2, [token('J', 40)]);
  const internal = fixture(t, { exceptions: [entry], toolsInsideRepo: true });
  internal.git('add', '--all');
  writeFileSync(internal.configPath, '[]');
  verifyOutput(internal.scan(['--staged']), 2, [token('J', 40)]);
});

test('missing, malformed and ambiguous exception policies fail closed', (t) => {
  const entry = { path: 'template.txt', rule: 'database-url', lineSha256: sha256(databaseLine()), reason: 'synthetic placeholder' };
  const f = fixture(t, { exceptions: [] });
  f.write('ordinary.txt', 'ordinary fixture');
  f.git('add', '--all');
  const policies = [
    '{', '{}', JSON.stringify([{ ...entry, extra: true }]),
    JSON.stringify([{ ...entry, rule: 'unknown-rule' }]),
    JSON.stringify([{ ...entry, lineSha256: 'not-a-hash' }]),
    JSON.stringify([{ ...entry, reason: '' }]), JSON.stringify([entry, entry]),
    JSON.stringify([{ path: entry.path, rule: entry.rule, lineSha256: entry.lineSha256 }]),
    JSON.stringify([{ ...entry, path: '../outside.txt' }]),
    JSON.stringify([{ ...entry, path: '*' }]),
    JSON.stringify([{ ...entry, rule: 'tracked-sensitive-file' }]),
    `[${JSON.stringify(entry).replace('"path":', '"path":"other.txt","path":')}]`,
  ];
  for (const policy of policies) {
    writeFileSync(f.configPath, policy);
    verifyOutput(f.scan(), 2);
  }
  unlinkSync(f.configPath);
  verifyOutput(f.scan(), 2);
});

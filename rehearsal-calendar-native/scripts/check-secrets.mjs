import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Limited detectors, not a promise to identify every secret. All environments
// use the same JavaScript regex dialect, including counted repetitions.
const rules = [
  ['database-url', /DATABASE_URL=postgres(?:ql)?:\/\//i],
  ['telegram-token', /TELEGRAM_BOT_TOKEN=[0-9]/i],
  ['jwt-secret', /JWT_SECRET=[A-Za-z0-9_-]{20,}/i],
  ['openai-key', /sk-[A-Za-z0-9]{20,}/i],
  ['stripe-live-key', /pk_live_[A-Za-z0-9]/i],
  ['private-key-assignment', new RegExp('PRIVATE' + '_KEY=', 'i')],
  ['api-key', /API_KEY=[A-Za-z0-9]{20,}/i],
  ['bearer-token', /Bearer [A-Za-z0-9]{20,}/i],
  ['password', new RegExp('password' + '=.{8,}', 'i')],
];
const ruleNames = new Set(rules.map(([name]) => name));
const maxFileBytes = 64 * 1024 * 1024;
const maxIndexBytes = 32 * 1024 * 1024;
const exceptionPath = fileURLToPath(new URL('./secret-scan-exceptions.json', import.meta.url));
// A leading U+FEFF can be part of a filename; never strip it as a text BOM.
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

class ScanError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const emit = record => process.stdout.write(JSON.stringify(record) + '\n');
const fail = code => { throw new ScanError(code); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const exceptionKey = (file, rule, digest) => JSON.stringify([file, rule, digest]);

function git(args, cwd, maxBuffer = maxIndexBytes) {
  try {
    return execFileSync('git', args, {
      cwd, encoding: null, timeout: 30000, maxBuffer, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    // Git stderr may include untrusted data. Never echo it or its error object.
    fail('GIT_COMMAND_FAILED');
  }
}

function decode(bytes) {
  try { return decoder.decode(bytes); }
  catch { fail('INVALID_UTF8_METADATA'); }
}

function isRelativePath(value) {
  return typeof value === 'string' && value.length > 0 && !value.includes('\0')
    && !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..');
}

function isSensitivePath(file) {
  const basename = path.posix.basename(file);
  if (/^\.env(?:\.|$)/i.test(basename) && basename !== '.env.example') return true;
  return /\.(?:pem|key|p8|p12|pfx|jks|keystore|mobileprovision)$/i.test(basename)
    || /^id_(?:rsa|dsa|ecdsa|ed25519)$/i.test(basename);
}

function readRegularFile(file, limit = maxFileBytes, validatePath = () => {}) {
  let descriptor;
  try {
    const initial = lstatSync(file);
    if (!initial.isFile()) fail('UNSUPPORTED_FILE_TYPE');
    if (initial.size > limit) fail('FILE_SIZE_LIMIT');
    // Bind the expected inode before checking ancestry, then verify both again
    // after open. A replacement observed between these checks is incomplete.
    validatePath();
    descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== initial.dev || opened.ino !== initial.ino) fail('FILE_CHANGED_DURING_SCAN');
    if (opened.size > limit) fail('FILE_SIZE_LIMIT');
    validatePath();
    const current = lstatSync(file);
    if (!current.isFile() || current.dev !== opened.dev || current.ino !== opened.ino) fail('FILE_CHANGED_DURING_SCAN');
    const bytes = readFileSync(descriptor);
    const final = fstatSync(descriptor);
    if (bytes.length > limit) fail('FILE_SIZE_LIMIT');
    if (final.size !== opened.size || final.mtimeMs !== opened.mtimeMs || final.ctimeMs !== opened.ctimeMs) {
      fail('FILE_CHANGED_DURING_SCAN');
    }
    return bytes;
  } catch (error) {
    if (error instanceof ScanError) throw error;
    fail('FILE_READ_FAILED');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function parseExceptions(text) {
  // This JSON schema is only an array of objects with string fields. Parse that
  // subset strictly so duplicate keys cannot be hidden by JSON.parse's last-win
  // behavior, including duplicate keys expressed with Unicode escapes.
  let position = 0;
  const whitespace = () => { while (/[\t\n\r ]/.test(text[position] || '\0')) position++; };
  const take = character => {
    whitespace();
    if (text[position++] !== character) fail('EXCEPTIONS_CONFIG_INVALID');
  };
  const string = () => {
    whitespace();
    const start = position;
    if (text[position++] !== '"') fail('EXCEPTIONS_CONFIG_INVALID');
    while (position < text.length) {
      const character = text[position++];
      if (character === '\\') { position++; continue; }
      if (character === '"') {
        try { return JSON.parse(text.slice(start, position)); }
        catch { fail('EXCEPTIONS_CONFIG_INVALID'); }
      }
    }
    fail('EXCEPTIONS_CONFIG_INVALID');
  };
  const entries = [];
  take('[');
  whitespace();
  if (text[position] !== ']') {
    while (true) {
      take('{');
      const entry = Object.create(null);
      whitespace();
      if (text[position] !== '}') {
        while (true) {
          const key = string();
          if (Object.hasOwn(entry, key)) fail('EXCEPTIONS_CONFIG_DUPLICATE');
          take(':');
          entry[key] = string();
          whitespace();
          if (text[position] !== ',') break;
          position++;
        }
      }
      take('}');
      entries.push(entry);
      whitespace();
      if (text[position] !== ',') break;
      position++;
    }
  }
  take(']');
  whitespace();
  if (position !== text.length) fail('EXCEPTIONS_CONFIG_INVALID');
  return entries;
}

function readExceptions(root, indexEntries, mode) {
  let entries;
  try {
    const relative = path.relative(root, exceptionPath);
    const internal = isRelativePath(relative) && !relative.startsWith('../');
    let bytes;
    if (internal && mode === 'staged') {
      const policies = indexEntries.filter(entry => entry.file === relative);
      if (policies.length !== 1 || policies[0].stage !== 0 || !['100644', '100755'].includes(policies[0].mode)) {
        fail('EXCEPTIONS_CONFIG_INVALID');
      }
      bytes = readStaged(root, policies[0], 1024 * 1024);
    } else if (internal) {
      bytes = readWorktree(root, { file: relative }, 1024 * 1024);
    } else {
      // Copied external tool bundles use adjacent policy as trusted tool input.
      bytes = readRegularFile(exceptionPath, 1024 * 1024, () => {
        if (realpathSync(exceptionPath) !== exceptionPath) fail('EXCEPTIONS_CONFIG_INVALID');
      });
    }
    if (bytes.length > 1024 * 1024) fail('EXCEPTIONS_CONFIG_INVALID');
    entries = parseExceptions(decode(bytes));
  }
  catch (error) {
    if (error instanceof ScanError && error.code === 'EXCEPTIONS_CONFIG_DUPLICATE') throw error;
    fail('EXCEPTIONS_CONFIG_INVALID');
  }
  const allowedKeys = ['lineSha256', 'path', 'reason', 'rule'];
  const accepted = new Set();
  for (const entry of entries) {
    if (Object.keys(entry).sort().join('\0') !== allowedKeys.join('\0')
      || !isRelativePath(entry.path) || /[*?\[\]]/.test(entry.path) || !ruleNames.has(entry.rule)
      || !/^[0-9a-f]{64}$/.test(entry.lineSha256) || !entry.reason.trim()
      || isSensitivePath(entry.path)) fail('EXCEPTIONS_CONFIG_INVALID');
    const key = exceptionKey(entry.path, entry.rule, entry.lineSha256);
    if (accepted.has(key)) fail('EXCEPTIONS_CONFIG_DUPLICATE');
    accepted.add(key);
  }
  return accepted;
}

function readIndex(root) {
  const raw = git(['ls-files', '--stage', '-z'], root);
  if (raw.length && raw.at(-1) !== 0) fail('INDEX_METADATA_INVALID');
  const entries = [];
  let start = 0;
  for (let end = 0; end < raw.length; end++) {
    if (raw[end] !== 0) continue;
    const record = raw.subarray(start, end);
    start = end + 1;
    const tab = record.indexOf(9);
    if (tab < 0) fail('INDEX_METADATA_INVALID');
    const metadata = /^([0-7]{6}) ([0-9a-f]{40}|[0-9a-f]{64}) ([0-3])$/.exec(decode(record.subarray(0, tab)));
    const file = decode(record.subarray(tab + 1));
    if (!metadata || !isRelativePath(file)) fail('INDEX_METADATA_INVALID');
    entries.push({ mode: metadata[1], oid: metadata[2], stage: Number(metadata[3]), file });
  }
  return entries;
}

function readWorktree(root, entry, limit = maxFileBytes) {
  const absolute = path.join(root, entry.file);
  return readRegularFile(absolute, limit, () => {
    // Refuse detected symlink ancestry before reading. Node's path APIs do not
    // provide an atomic openat traversal against a hostile concurrent writer;
    // immutable staged blobs are the stronger snapshot for a commit guard.
    if (realpathSync(absolute) !== absolute) fail('SYMLINK_PATH_REFUSED');
  });
}

function readStaged(root, entry, limit = maxFileBytes) {
  const sizeText = decode(git(['cat-file', '-s', entry.oid], root, 1024)).trim();
  if (!/^\d+$/.test(sizeText)) fail('BLOB_METADATA_INVALID');
  const size = Number(sizeText);
  if (!Number.isSafeInteger(size) || size > limit) fail('FILE_SIZE_LIMIT');
  const bytes = git(['cat-file', 'blob', entry.oid], root, limit + 1);
  if (bytes.length !== size) fail('BLOB_METADATA_INVALID');
  return bytes;
}

function inspectLines(file, bytes, exceptions, report) {
  let line = 1;
  let start = 0;
  for (let end = 0; end <= bytes.length; end++) {
    if (end < bytes.length && bytes[end] !== 10) continue;
    let logicalEnd = end;
    // LF/CRLF share a fingerprint. All other whitespace remains significant.
    if (end < bytes.length && logicalEnd > start && bytes[logicalEnd - 1] === 13) logicalEnd--;
    const content = bytes.subarray(start, logicalEnd);
    const text = content.toString('latin1'); // byte-preserving, including binary blobs
    let digest;
    for (const [rule, pattern] of rules) {
      if (!pattern.test(text)) continue;
      digest ??= sha256(content);
      if (!exceptions.has(exceptionKey(file, rule, digest))) report({ path: file, line, rule });
    }
    line++;
    start = end + 1;
  }
}

function main() {
  let mode = 'unknown';
  let files = 0;
  let findings = 0;
  let errors = 0;
  const report = finding => { findings++; emit(finding); };
  const reportError = (code, file = null) => {
    errors++;
    emit({ path: file, line: 0, rule: 'scan-error', code });
  };
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && !['--worktree', '--staged'].includes(args[0]))) fail('INVALID_ARGUMENTS');
    mode = args[0] === '--staged' ? 'staged' : 'worktree';
    const rootOutput = git(['rev-parse', '--show-toplevel'], process.cwd());
    if (rootOutput.at(-1) !== 10) fail('GIT_ROOT_INVALID');
    const root = realpathSync(decode(rootOutput.subarray(0, -1)));
    const entries = readIndex(root);
    const exceptions = readExceptions(root, entries, mode);
    const skipped = new Set();
    // Classify the whole index before opening any tracked file contents.
    for (const entry of entries) {
      if (skipped.has(entry.file)) continue;
      if (isSensitivePath(entry.file)) {
        report({ path: entry.file, line: 0, rule: 'tracked-sensitive-file' });
        skipped.add(entry.file);
      }
      if (entry.stage !== 0) {
        reportError('UNMERGED_INDEX', entry.file);
        skipped.add(entry.file);
      } else if (!['100644', '100755'].includes(entry.mode)) {
        reportError('UNSUPPORTED_INDEX_MODE', entry.file);
        skipped.add(entry.file);
      }
    }
    for (const entry of entries) {
      if (skipped.has(entry.file)) continue;
      try {
        const bytes = mode === 'staged' ? readStaged(root, entry) : readWorktree(root, entry);
        inspectLines(entry.file, bytes, exceptions, report);
        files++;
      } catch (error) {
        reportError(error instanceof ScanError ? error.code : 'SCAN_OPERATION_FAILED', entry.file);
      }
    }
  } catch (error) {
    reportError(error instanceof ScanError ? error.code : 'SCAN_OPERATION_FAILED');
  }
  emit({ summary: errors ? 'error' : findings ? 'findings' : 'pass', mode, files, findings, errors });
  return errors ? 2 : findings ? 1 : 0;
}

process.exitCode = main();

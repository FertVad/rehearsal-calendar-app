/**
 * The iOS project e2e builds the app from: the one `expo prebuild` makes of
 * this tree's app.json, as the App Store build is made (T-227).
 *
 * TestFlight 1.0.0 (1) opened on a black screen: T-040 had taken the
 * NSReminders* keys out of app.json, expo-calendar calls EXFatal without them
 * when its module is created, and in Release the other Expo modules were then
 * never registered (9d265da). No flow saw it. The e2e app was built from the
 * checkout's ios/, which is not in git and which nobody had prebuilt since
 * T-040, so its Info.plist still had the keys; a build already there was
 * reused whatever had changed; and nothing ran Release.
 *
 * So e2e has an iOS project of its own, e2e/.native/ios, never the tree's
 * ios/: in the main checkout that is the project releases are built from. It
 * is generated from a project root of its own, e2e/.native — copies of
 * app.json and package.json, links to assets/, locales/ and node_modules/ — so
 * prebuild reads nothing else of the tree (no .env) and writes nothing in it.
 * `pod install` follows. Both again whenever what they are made of changed
 * (`nativeInputs`): the project is stamped with the hash of its inputs, and a
 * project or an app whose stamp is not this tree's is not used.
 *
 * Measured on the 8 GB Mac (2026-11-08): the hash 40 ms; prebuild 6 s and
 * pod install 7 min. So the project is generated only when its inputs change,
 * and a Debug app built from it is kept as long as they do not — its JS comes
 * from Metro. A Release app carries its JS, so it is built on every run that
 * runs a Release flow. React Native's codegen rewrites its sources at the
 * start of every build, so all that includes them compiles again — ten
 * minutes of it here; clang's compilation cache (CLANG_ENABLE_COMPILE_CACHE,
 * in e2e/.build) takes what is unchanged from the build before.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const NATIVE = path.join(ROOT, 'e2e', '.native');
export const IOS = path.join(NATIVE, 'ios');
export const WORKSPACE = path.join(IOS, 'Rehearsly.xcworkspace');
const STAMP = path.join(NATIVE, 'inputs.sha256');
/** The flows run on the Release build; every other flow runs on Debug. */
export const RELEASE_FLOWS = path.join(ROOT, 'e2e', 'release');

const PREBUILD = ['prebuild', '--platform', 'ios', '--no-install', '--clean'];
const COPIED = ['app.json', 'package.json'];
// plugins/: app.json's own config plugins, and the scripts their build phases run.
const LINKED = ['assets', 'locales', 'node_modules', 'plugins'];
// A Release build bundles the JS in a build phase that takes the project root
// to be the folder above ios/ — here e2e/.native, which has no code. The phase
// reads ios/.xcode.env.local last, so the JS is bundled from the tree, with its
// metro.config.js, as the App Store build bundles it.
const xcodeEnvLocal = (root) => {
  const main = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).main;
  return `export PROJECT_ROOT=${JSON.stringify(root)}\nexport ENTRY_FILE=${JSON.stringify(path.join(root, main))}\n`;
};

const files = (dir) => (fs.existsSync(dir)
  ? fs.readdirSync(dir, { recursive: true }).map((name) => path.join(dir, String(name))).filter((file) => fs.statSync(file).isFile())
  : []);

/**
 * What the generated project and the native code built from it are made of:
 * the app's config and what it points at (icons, permission texts in every
 * language, its own config plugins), the packages as declared, locked and
 * installed.
 */
export function nativeInputs(root = ROOT) {
  return [
    path.join(root, 'app.json'),
    path.join(root, 'package.json'),
    path.join(root, 'package-lock.json'),
    path.join(root, 'node_modules', '.package-lock.json'),
    ...files(path.join(root, 'locales')),
    ...files(path.join(root, 'assets')),
    ...files(path.join(root, 'plugins')).filter((file) => !file.split(path.sep).includes('__tests__')),
  ].filter((file) => fs.existsSync(file)).sort();
}

/** The inputs' hash, with how the project is made of them: a new recipe is a new project too. */
export function inputsHash(root = ROOT) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ PREBUILD, COPIED, LINKED, env: xcodeEnvLocal(root) })).update('\0');
  for (const file of nativeInputs(root)) {
    hash.update(path.relative(root, file)).update('\0').update(fs.readFileSync(file)).update('\0');
  }
  return hash.digest('hex');
}

/**
 * What is installed in node_modules against package-lock.json; a list of
 * what differs, empty when they agree. The project is linked to node_modules
 * and prebuild runs with --no-install, so what autolinking finds there is what
 * the app is built of — and the supervisor's node_modules is the main
 * checkout's, which a change of the lockfile does not reinstall. A package the
 * lock has at another version, a package it has that is not there (unless
 * optional: one for another platform), a package at the top of node_modules
 * the lock does not have (autolinking would link a native module the commit
 * removed): each is a project the commit does not make.
 */
export function installedMismatch(root = ROOT) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const packages = lock.packages ?? {};
  const problems = [];
  for (const [where, entry] of Object.entries(packages)) {
    if (!where || entry.link || entry.inBundle) continue;
    const manifest = path.join(root, where, 'package.json');
    if (!fs.existsSync(manifest)) {
      if (!entry.optional) problems.push(`${where} ${entry.version} is not installed`);
      continue;
    }
    const installed = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
    if (entry.version && installed !== entry.version) problems.push(`${where} is ${installed}, the lock has ${entry.version}`);
  }
  const modules = path.join(root, 'node_modules');
  const top = (dir, prefix = '') => (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
    .filter((name) => !name.startsWith('.'))
    .flatMap((name) => (name.startsWith('@') && !prefix ? top(path.join(dir, name), `${name}/`) : [`${prefix}${name}`]));
  for (const name of top(modules)) {
    if (!packages[`node_modules/${name}`] && fs.existsSync(path.join(modules, name, 'package.json'))) {
      problems.push(`node_modules/${name} is installed and the lock does not have it`);
    }
  }
  return problems;
}

/**
 * Refuses node_modules that are not what package-lock.json says
 * (`installedMismatch`): the machine's install, not the commit, so a
 * MachineError — the run says neither green nor red of the change.
 */
export function requireInstalledAsLocked(root = ROOT) {
  const problems = installedMismatch(root);
  if (problems.length) {
    throw new MachineError(`node_modules is not what package-lock.json says (${problems.length}): `
      + `${problems.slice(0, 8).join('; ')}${problems.length > 8 ? '; …' : ''} — run npm ci in ${root}`);
  }
}

const read = (file) => { try { return fs.readFileSync(file, 'utf8').trim(); } catch { return null; } };

/** The stamp next to a built app: the inputs of the project it was built from. */
export const appStamp = (app) => `${app}.inputs`;
export const builtFrom = (app, hash) => Boolean(app) && fs.existsSync(app) && read(appStamp(app)) === hash;

/** Something the machine could not do — the network for the Pods — rather than the change. */
export class MachineError extends Error {}
const NETWORK = /Could not resolve host|Failed to connect|Connection (?:refused|reset|timed out)|SSL_ERROR|curl: \(\d+\)|Couldn't connect to server/;

function run(command, args, { cwd, env, log, timeout }) {
  const out = fs.openSync(log, 'a');
  try {
    execFileSync(command, args, { cwd, env, stdio: ['ignore', out, out], timeout });
  } catch (error) {
    const text = read(log) ?? '';
    const errors = text.split('\n').filter((line) => /\berror\b|\[!\]/i.test(line)).slice(0, 8).map((line) => line.slice(0, 300));
    const message = `${path.basename(command)} ${args[0]} failed (${error.status ?? error.signal}) — see ${log}\n${errors.join('\n')}`;
    throw NETWORK.test(text) ? new MachineError(message) : new Error(message);
  } finally {
    fs.closeSync(out);
  }
}

/**
 * The project for `hash`, generated unless it is there already (or `force`).
 * The stamp goes only when prebuild and pod install both went through, so a
 * half-made project is never taken for a whole one.
 */
export function prepareProject({ hash, log, step, force = false, root = ROOT }) {
  if (!force && read(STAMP) === hash && fs.existsSync(WORKSPACE)) {
    step('the iOS project is the one app.json, the locales and the packages make now: kept');
    return false;
  }
  step('generating the iOS project from app.json (expo prebuild, pod install, some 7 minutes) — its inputs changed');
  fs.rmSync(STAMP, { force: true });
  // The Pods go with it: --clean makes ios/ anew, and a key app.json no
  // longer has must not survive in an Info.plist left from before.
  fs.rmSync(NATIVE, { recursive: true, force: true });
  fs.mkdirSync(NATIVE, { recursive: true });
  for (const name of COPIED) fs.copyFileSync(path.join(root, name), path.join(NATIVE, name));
  for (const name of LINKED) fs.symlinkSync(path.join(root, name), path.join(NATIVE, name));
  fs.writeFileSync(log, '');

  const env = { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', EXPO_NO_GIT_STATUS: '1', EXPO_NO_DOTENV: '1', LANG: 'en_US.UTF-8' };
  const started = Date.now();
  run(process.execPath, [path.join(root, 'node_modules', 'expo', 'bin', 'cli'), ...PREBUILD], { cwd: NATIVE, env, log, timeout: 10 * 60 * 1000 });
  const prebuilt = Date.now();
  fs.writeFileSync(path.join(IOS, '.xcode.env.local'), xcodeEnvLocal(root));
  run('pod', ['install'], { cwd: IOS, env, log, timeout: 30 * 60 * 1000 });
  fs.writeFileSync(STAMP, `${hash}\n`);
  step(`  prebuild ${Math.round((prebuilt - started) / 1000)} s, pod install ${Math.round((Date.now() - prebuilt) / 1000)} s`);
  return true;
}

// Eight compilers of React Native's C++ at once do not fit in 8 GB: four did a
// third more work in the same ten minutes.
const JOBS = Number(process.env.E2E_BUILD_JOBS) || Math.max(2, Math.floor(os.totalmem() / 2 ** 31));

/** The app `configuration` builds to. */
export const appPath = (build, configuration) =>
  path.join(build, 'Build', 'Products', `${configuration}-iphonesimulator`, 'Rehearsly.app');

/**
 * `configuration` of the generated project, for the simulator `udid`, into
 * `build`; the app is stamped with `hash` once the build went through.
 */
export function buildApp({ configuration, udid, build, hash, log, env }) {
  const app = appPath(build, configuration);
  fs.rmSync(appStamp(app), { force: true });
  fs.writeFileSync(log, '');
  run('xcodebuild', ['-workspace', WORKSPACE, '-scheme', 'Rehearsly',
    '-configuration', configuration, '-sdk', 'iphonesimulator', '-destination', `id=${udid}`,
    '-derivedDataPath', build, '-jobs', String(JOBS),
    // Release builds x86_64 as well by default: twice the time, for a slice
    // this simulator never runs.
    'ONLY_ACTIVE_ARCH=YES',
    // Only clang's: Swift's is not needed — the codegen does not touch it.
    'CLANG_ENABLE_COMPILE_CACHE=YES',
    'build'], { cwd: IOS, env, log, timeout: 90 * 60 * 1000 });
  fs.writeFileSync(appStamp(app), `${hash}\n`);
  return app;
}

/**
 * The flows given split by the build they run on: those in e2e/release on
 * Release, the rest on Debug. None given is the whole set: e2e/flows on Debug
 * and e2e/release on Release.
 */
export function splitFlows(given, flowFiles) {
  const inRelease = (file) => path.resolve(file).startsWith(RELEASE_FLOWS + path.sep) || path.resolve(file) === RELEASE_FLOWS;
  if (!given.length) return { debug: flowFiles([path.join(ROOT, 'e2e', 'flows')]), release: flowFiles([RELEASE_FLOWS]) };
  const all = flowFiles(given);
  return { debug: all.filter((file) => !inRelease(file)), release: all.filter(inRelease) };
}

/**
 * Refuses a Release build that could reach any API but `apiUrl`. Its JS is
 * bundled for production: EXPO_PUBLIC_ variables are written into the code,
 * not read at run time, so the address the app takes (`envApiUrl`, and the
 * fallback, PRODUCTION_API_URL) must be `apiUrl` as written, and no read of
 * process.env.EXPO_PUBLIC_API_URL may be left — at run time it would be empty
 * and the fallback would be rehearsly.me. The JS is checked as Metro wrote it
 * (`js`), and the bytecode Hermes made of it, which the app runs (`bytecode`),
 * for the local address and none of production's.
 */
export function checkReleaseBundle({ js, bytecode, apiUrl }) {
  const problems = [];
  const literal = JSON.stringify(apiUrl);
  const envFiles = [...js.matchAll(/\},\d+,\[[^\]]*\],"([^"]*\.env[^"/]*)"\);/g)].map((match) => match[1]);
  if (envFiles.length) problems.push(`the bundle carries env files ${JSON.stringify(envFiles)}`);
  const left = [...js.matchAll(/process\.env\.EXPO_PUBLIC_API_URL\b|process\.env\[["']EXPO_PUBLIC_API_URL["']\]/g)];
  if (left.length) problems.push(`the bundle still reads EXPO_PUBLIC_API_URL at run time (${left.length}×): it was not written in`);
  for (const name of ['envApiUrl', 'PRODUCTION_API_URL']) {
    const values = [...js.matchAll(new RegExp(`\\b${name}\\s*=\\s*([^;\\n]+)`, 'g'))].map((match) => match[1].trim());
    if (values.length !== 1 || !values[0].startsWith(literal)) problems.push(`${name} is ${JSON.stringify(values)}, not ${literal}`);
  }
  const text = Buffer.from(bytecode).toString('latin1');
  if (!text.includes(apiUrl)) problems.push(`the app's bytecode does not carry ${apiUrl}`);
  if (/rehearsly\.me\/api/.test(text)) problems.push('the app\'s bytecode carries rehearsly.me/api');
  if (problems.length) throw new Error(`The Release build could reach another API: ${problems.join('; ')}`);
}

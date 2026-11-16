#!/usr/bin/env node
/**
 * dSYMs for the frameworks React Native ships built (T-237).
 *
 * React.framework (React-Core-prebuilt), ReactNativeDependencies.framework and
 * hermes.framework come into the app as binaries from Maven, so Xcode makes no
 * dSYM for them, the archive had none, and App Store Connect could not
 * symbolicate a crash inside them ("Upload Symbols Failed", 1.0.0 (3)). React
 * Native publishes their dSYMs next to the binaries, same version, same
 * build: react-native-artifacts-<version>-{reactnative-core,
 * reactnative-dependencies,hermes-framework}-dSYM-release.tar.gz.
 *
 *   node dsyms.mjs phase                  the app target's build phase (withPrebuiltDsyms.js)
 *   node dsyms.mjs check-archive <path>   every framework in the archive has its dSYM
 *                                         (UUIDs read here and by xcrun dwarfdump --uuid, which must agree)
 *   node dsyms.mjs pin <version>          the checksums of a new version, into checksums.json
 *
 * The phase runs when the build makes dSYMs (DEBUG_INFORMATION_FORMAT
 * dwarf-with-dsym) and embeds the Release flavour of the three (no DEBUG=1 in
 * GCC_PREPROCESSOR_DEFINITIONS): Release, for a device or a simulator. Expo's
 * Debug makes a dSYM of the app as well, but embeds the Debug flavour, of
 * which React Native publishes no dSYMs. Each tarball is
 * downloaded once per version into a cache, and only if its sha256 is the one
 * pinned in checksums.json; then each dSYM's UUIDs must be those of the
 * framework the app embeds, arch by arch. Either not so, the build fails —
 * never an archive without them. The dSYMs go to DWARF_DSYM_FOLDER_PATH,
 * where the app's own dSYM is, and from where `xcodebuild archive` takes all
 * of them into the archive's dSYMs/ (CocoaPods' install_dsym does the same
 * for the dSYMs a pod ships).
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CHECKSUMS = path.join(HERE, 'checksums.json');
export const MAVEN = 'https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts';

/**
 * The three frameworks: the pod that brings each (its name in Manifest.lock),
 * where CocoaPods puts the slice the app embeds, the tarball of its dSYMs and
 * the slice folder in it for each platform.
 */
export const FRAMEWORKS = [
  {
    name: 'React', pod: 'React-Core-prebuilt', embedded: 'React-Core-prebuilt/React.framework/React',
    artifact: 'reactnative-core-dSYM-release', slices: { iphoneos: 'ios-arm64', iphonesimulator: 'ios-arm64_x86_64-simulator' },
  },
  {
    name: 'ReactNativeDependencies', pod: 'ReactNativeDependencies', embedded: 'ReactNativeDependencies/ReactNativeDependencies.framework/ReactNativeDependencies',
    artifact: 'reactnative-dependencies-dSYM-release', slices: { iphoneos: 'ios-arm64', iphonesimulator: 'ios-arm64_x86_64-simulator' },
  },
  {
    name: 'hermes', pod: 'hermes-engine', embedded: 'hermes-engine/Pre-built/hermes.framework/hermes',
    artifact: 'hermes-framework-dSYM-release', slices: { iphoneos: 'iphoneos', iphonesimulator: 'iphonesimulator' },
  },
];

export const artifactUrl = (base, version, artifact) =>
  `${base}/${version}/react-native-artifacts-${version}-${artifact}.tar.gz`;

const CPU = { 0x0100000c: 'arm64', 0x01000007: 'x86_64', 12: 'armv7', 7: 'i386' };
const archName = (cputype, cpusubtype) =>
  (cputype === 0x0100000c && (cpusubtype & 0xff) === 2 ? 'arm64e' : CPU[cputype] ?? `cpu${cputype}`);

function readAt(fd, offset, length) {
  const buffer = Buffer.alloc(length);
  const read = fs.readSync(fd, buffer, 0, length, offset);
  return buffer.subarray(0, read);
}

const formatUuid = (bytes) => {
  const hex = bytes.toString('hex').toUpperCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

function thinUuid(fd, offset) {
  const header = readAt(fd, offset, 32);
  const magic = header.readUInt32LE(0);
  if (magic !== 0xfeedfacf && magic !== 0xfeedface) throw new Error(`not a Mach-O at ${offset}`);
  const headerSize = magic === 0xfeedfacf ? 32 : 28;
  const ncmds = header.readUInt32LE(16);
  const commands = readAt(fd, offset + headerSize, header.readUInt32LE(20));
  let at = 0;
  for (let i = 0; i < ncmds && at + 8 <= commands.length; i += 1) {
    const cmd = commands.readUInt32LE(at);
    if (cmd === 0x1b) return { arch: archName(header.readInt32LE(4), header.readInt32LE(8)), uuid: formatUuid(commands.subarray(at + 8, at + 24)) };
    at += commands.readUInt32LE(at + 4);
  }
  throw new Error(`no LC_UUID in the Mach-O at ${offset}`);
}

/**
 * The UUID of every arch of a Mach-O file — a binary or a dSYM's DWARF
 * file, thin or universal — as `dwarfdump --uuid` lists them.
 */
export function machoUuids(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = readAt(fd, 0, 8);
    if (head.length < 8) throw new Error(`${file} is not a Mach-O file`);
    const magic = head.readUInt32BE(0);
    if (magic === 0xcafebabe || magic === 0xcafebabf) {
      const wide = magic === 0xcafebabf;
      const count = head.readUInt32BE(4);
      const table = readAt(fd, 8, count * (wide ? 32 : 20));
      return Array.from({ length: count }, (_, i) => {
        const entry = i * (wide ? 32 : 20);
        const offset = wide ? Number(table.readBigUInt64BE(entry + 8)) : table.readUInt32BE(entry + 8);
        return thinUuid(fd, offset);
      });
    }
    return [thinUuid(fd, 0)];
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  } finally {
    fs.closeSync(fd);
  }
}

const dwarfFile = (dsym) => {
  const dir = path.join(dsym, 'Contents', 'Resources', 'DWARF');
  const names = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  if (names.length !== 1) throw new Error(`${dsym} has ${names.length} DWARF files, not one`);
  return path.join(dir, names[0]);
};

/**
 * What of `binary` the dSYM does not cover: each arch of the binary whose
 * UUID the dSYM does not have. Empty when it covers all.
 */
export function uncovered(binary, dsym) {
  const have = new Set(machoUuids(dwarfFile(dsym)).map(({ arch, uuid }) => `${arch} ${uuid}`));
  return machoUuids(binary).filter(({ arch, uuid }) => !have.has(`${arch} ${uuid}`));
}

/** The version of `pod` CocoaPods installed, from Pods/Manifest.lock. */
export function podVersion(manifestLock, pod) {
  const text = fs.readFileSync(manifestLock, 'utf8');
  const match = text.match(new RegExp(`^  - ${pod.replace(/[-]/g, '\\-')} \\(([^)]+)\\)`, 'm'));
  if (!match) throw new Error(`${pod} is not in ${manifestLock}`);
  return match[1];
}

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function download(url, file) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

/**
 * The slice folders of `artifact` at `version`, from the cache, or downloaded
 * into it: kept only when the tarball's sha256 is `expected`.
 */
async function cachedArtifact({ cache, base, version, artifact, expected, slices, log }) {
  const dir = path.join(cache, version, artifact);
  const done = path.join(dir, '.sha256');
  if (fs.existsSync(done) && fs.readFileSync(done, 'utf8').trim() === expected) return dir;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(cache, version), { recursive: true });
  // What a build cut short left: hundreds of MB, never used.
  for (const name of fs.readdirSync(path.join(cache, version)).filter((entry) => entry.startsWith(`.${artifact}-`))) {
    fs.rmSync(path.join(cache, version, name), { recursive: true, force: true });
  }
  const tmp = fs.mkdtempSync(path.join(cache, version, `.${artifact}-`));
  try {
    const url = artifactUrl(base, version, artifact);
    const tarball = path.join(tmp, 'dsyms.tar.gz');
    log(`downloading ${url}`);
    await download(url, tarball);
    const actual = sha256(tarball);
    if (actual !== expected) throw new Error(`${url} has sha256 ${actual}, checksums.json pins ${expected}`);
    const out = path.join(tmp, 'out');
    fs.mkdirSync(out);
    execFileSync('tar', ['-xzf', tarball, '-C', out, ...slices.map((slice) => `./${slice}`)]);
    fs.writeFileSync(path.join(out, '.sha256'), `${expected}\n`);
    fs.renameSync(out, dir);
    return dir;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Whether the three frameworks embedded are their Debug flavour: the pods'
 * own "Replace … for the right configuration" phases take Debug exactly when
 * GCC_PREPROCESSOR_DEFINITIONS has DEBUG=1 (hermes-engine.podspec,
 * ReactNativeDependencies.podspec), else Release. Expo's app target makes a
 * dSYM in Debug too, so DEBUG_INFORMATION_FORMAT alone does not tell.
 */
const debugFlavour = (env) => /(^|\s)DEBUG=1(\s|$)/.test(env.GCC_PREPROCESSOR_DEFINITIONS ?? '');

const defaultCache = () => path.join(os.homedir(), 'Library', 'Caches', 'rehearsly', 'prebuilt-dsyms');

/**
 * The build phase. `env` is Xcode's; the rest is for the tests. Resolves to
 * the dSYMs it put in DWARF_DSYM_FOLDER_PATH, or to [] when this build makes
 * no dSYMs; rejects whenever one of the three can not be put there whole and
 * matching.
 */
export async function copyDsyms({
  env = process.env, base = MAVEN, checksums = JSON.parse(fs.readFileSync(CHECKSUMS, 'utf8')),
  cache = env.REHEARSLY_DSYM_CACHE || defaultCache(), log = console.log,
} = {}) {
  if (env.DEBUG_INFORMATION_FORMAT !== 'dwarf-with-dsym') {
    log(`DEBUG_INFORMATION_FORMAT is ${env.DEBUG_INFORMATION_FORMAT || 'unset'}: this build makes no dSYMs, nor these`);
    return [];
  }
  if (debugFlavour(env)) {
    log('GCC_PREPROCESSOR_DEFINITIONS has DEBUG=1: the pods embed the Debug React and Hermes, and React Native publishes dSYMs of the Release ones only');
    return [];
  }
  for (const name of ['PLATFORM_NAME', 'DWARF_DSYM_FOLDER_PATH', 'PODS_XCFRAMEWORKS_BUILD_DIR', 'PODS_ROOT']) {
    if (!env[name]) throw new Error(`${name} is not set: run as the app target's build phase`);
  }
  const platform = env.PLATFORM_NAME;
  const manifestLock = path.join(env.PODS_ROOT, 'Manifest.lock');
  const copied = [];
  for (const framework of FRAMEWORKS) {
    const slice = framework.slices[platform];
    if (!slice) throw new Error(`no dSYMs of ${framework.name} for the platform ${platform}`);
    const version = podVersion(manifestLock, framework.pod);
    const expected = checksums[version]?.[framework.artifact];
    if (!expected) {
      throw new Error(`checksums.json pins no sha256 of ${framework.artifact} ${version}: `
        + `run node plugins/prebuilt-dsyms/dsyms.mjs pin ${version} (docs/app-store-release.md)`);
    }
    const dir = await cachedArtifact({ cache, base, version, artifact: framework.artifact, expected, slices: [...new Set(Object.values(framework.slices))], log });
    const dsym = path.join(dir, slice, `${framework.name}.framework.dSYM`);
    const binary = path.join(env.PODS_XCFRAMEWORKS_BUILD_DIR, framework.embedded);
    if (!fs.existsSync(binary)) throw new Error(`${binary} is not there: the app does not embed ${framework.name}.framework from where it did`);
    if (!fs.existsSync(dsym)) throw new Error(`${framework.artifact} ${version} has no ${slice}/${framework.name}.framework.dSYM`);
    const missing = uncovered(binary, dsym);
    if (missing.length) {
      throw new Error(`${framework.name}.framework.dSYM (${framework.artifact} ${version}) is not of the ${framework.name} the app embeds: `
        + `${missing.map(({ arch, uuid }) => `${uuid} (${arch})`).join(', ')} not in it — ${binary}`);
    }
    const target = path.join(env.DWARF_DSYM_FOLDER_PATH, `${framework.name}.framework.dSYM`);
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(env.DWARF_DSYM_FOLDER_PATH, { recursive: true });
    fs.cpSync(dsym, target, { recursive: true, mode: fs.constants.COPYFILE_FICLONE });
    log(`${framework.name}.framework.dSYM ${version}: ${machoUuids(binary).map(({ arch, uuid }) => `${uuid} (${arch})`).join(', ')} -> ${target}`);
    copied.push(target);
  }
  return copied;
}

/**
 * Each framework in the archive's app and the dSYM of it in the archive's
 * dSYMs/, by UUID: `lines` as `dwarfdump --uuid` prints them, `missing` the
 * framework archs no dSYM there has.
 */
export function checkArchive(archive) {
  const app = fs.readdirSync(path.join(archive, 'Products', 'Applications')).find((name) => name.endsWith('.app'));
  if (!app) throw new Error(`${archive} has no app in Products/Applications`);
  const frameworks = path.join(archive, 'Products', 'Applications', app, 'Frameworks');
  const dsymsDir = path.join(archive, 'dSYMs');
  const dsyms = fs.existsSync(dsymsDir) ? fs.readdirSync(dsymsDir).filter((name) => name.endsWith('.dSYM')).sort() : [];
  const have = new Map();
  const lines = ['dSYMs/:'];
  for (const name of dsyms) {
    const file = dwarfFile(path.join(dsymsDir, name));
    for (const { arch, uuid } of machoUuids(file)) {
      have.set(`${arch} ${uuid}`, name);
      lines.push(`UUID: ${uuid} (${arch}) ${path.relative(archive, file)}`);
    }
  }
  lines.push('', `Products/Applications/${app}/Frameworks:`);
  const missing = [];
  const names = fs.existsSync(frameworks) ? fs.readdirSync(frameworks).filter((name) => name.endsWith('.framework')).sort() : [];
  for (const name of names) {
    const binary = path.join(frameworks, name, path.basename(name, '.framework'));
    for (const { arch, uuid } of machoUuids(binary)) {
      const dsym = have.get(`${arch} ${uuid}`);
      lines.push(`UUID: ${uuid} (${arch}) ${path.relative(archive, binary)} — ${dsym ? `dSYM ${dsym}` : 'NO dSYM'}`);
      if (!dsym) missing.push({ framework: name, arch, uuid });
    }
  }
  return { lines, missing, files: [...dsyms.map((name) => dwarfFile(path.join(dsymsDir, name))), ...names.map((name) => path.join(frameworks, name, path.basename(name, '.framework')))] };
}

/**
 * `xcrun dwarfdump --uuid` of each file, and whether it says what machoUuids
 * read: Apple's tool, beside this file's reading of the same load command.
 */
function dwarfdump(files) {
  const lines = [];
  const disagree = [];
  for (const file of files) {
    const out = execFileSync('xcrun', ['dwarfdump', '--uuid', file]).toString().trim();
    lines.push(out);
    const theirs = [...out.matchAll(/UUID: (\S+) \((\S+)\)/g)].map(([, uuid, arch]) => `${arch} ${uuid}`).sort();
    const ours = machoUuids(file).map(({ arch, uuid }) => `${arch} ${uuid}`).sort();
    if (theirs.join() !== ours.join()) disagree.push(file);
  }
  return { lines, disagree };
}

async function pin(version) {
  const checksums = JSON.parse(fs.readFileSync(CHECKSUMS, 'utf8'));
  checksums[version] = {};
  for (const { artifact } of FRAMEWORKS) {
    const url = `${artifactUrl(MAVEN, version, artifact)}.sha256`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status} — React Native ${version} publishes no ${artifact}`);
    const sum = (await response.text()).trim().split(/\s+/)[0];
    if (!/^[0-9a-f]{64}$/.test(sum)) throw new Error(`${url} is not a sha256: ${sum}`);
    checksums[version][artifact] = sum;
  }
  fs.writeFileSync(CHECKSUMS, `${JSON.stringify(checksums, null, 2)}\n`);
  console.log(`checksums.json: ${version} pinned. A Release build now checks the dSYMs' UUIDs against the frameworks.`);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, arg] = process.argv.slice(2);
  try {
    if (command === 'phase') {
      await copyDsyms();
    } else if (command === 'check-archive' && arg) {
      const { lines, missing, files } = checkArchive(arg);
      console.log(lines.join('\n'));
      const apple = dwarfdump(files);
      console.log(`\nxcrun dwarfdump --uuid:\n${apple.lines.join('\n')}`);
      if (apple.disagree.length) {
        console.error(`\ndwarfdump reads other UUIDs than dsyms.mjs in: ${apple.disagree.join(', ')}`);
        process.exit(1);
      }
      if (missing.length) {
        console.error(`\n${missing.length} framework arch(s) without a dSYM: ${missing.map(({ framework, arch }) => `${framework} (${arch})`).join(', ')}`);
        process.exit(1);
      }
      console.log('\nevery framework has its dSYM');
    } else if (command === 'pin' && arg) {
      await pin(arg);
    } else {
      console.error('usage: node dsyms.mjs phase | check-archive <path.xcarchive> | pin <react-native version>');
      process.exit(64);
    }
  } catch (error) {
    // Xcode shows a line starting "error:" as the build's error.
    console.error(`error: ${error.message}`);
    process.exit(1);
  }
}

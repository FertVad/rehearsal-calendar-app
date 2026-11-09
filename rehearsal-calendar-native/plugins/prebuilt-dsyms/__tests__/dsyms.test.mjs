// The dSYMs of the frameworks React Native ships built (T-237): the build
// phase puts them where the archive takes them from only when their tarball
// is the pinned one and their UUIDs are those of the frameworks the app
// embeds; otherwise the build fails. The config plugin adds that phase once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { checkArchive, copyDsyms, FRAMEWORKS, machoUuids } from '../dsyms.mjs';

const require = createRequire(import.meta.url);
const ARM64 = 0x0100000c;
const X86_64 = 0x01000007;
const uuidBytes = (uuid) => Buffer.from(uuid.replace(/-/g, ''), 'hex');

/** A 64-bit Mach-O with a symbol table command and then LC_UUID. */
function thin(uuid, cputype = ARM64) {
  const commands = Buffer.alloc(48);
  commands.writeUInt32LE(0x2, 0); // LC_SYMTAB
  commands.writeUInt32LE(24, 4);
  commands.writeUInt32LE(0x1b, 24); // LC_UUID
  commands.writeUInt32LE(24, 28);
  uuidBytes(uuid).copy(commands, 32);
  const header = Buffer.alloc(32);
  header.writeUInt32LE(0xfeedfacf, 0);
  header.writeInt32LE(cputype, 4);
  header.writeUInt32LE(6, 12);
  header.writeUInt32LE(2, 16);
  header.writeUInt32LE(commands.length, 20);
  return Buffer.concat([header, commands]);
}

/** A universal file of `slices` ([cputype, thin]), each at a 4 KB boundary. */
function fat(slices) {
  const header = Buffer.alloc(8 + slices.length * 20);
  header.writeUInt32BE(0xcafebabe, 0);
  header.writeUInt32BE(slices.length, 4);
  const parts = [header];
  let offset = 4096;
  slices.forEach(([cputype, body], i) => {
    header.writeUInt32BE(cputype, 8 + i * 20);
    header.writeUInt32BE(offset, 8 + i * 20 + 8);
    header.writeUInt32BE(body.length, 8 + i * 20 + 12);
    header.writeUInt32BE(12, 8 + i * 20 + 16);
    const before = parts.reduce((sum, part) => sum + part.length, 0);
    parts.push(Buffer.alloc(offset - before), body);
    offset += 4096;
  });
  return Buffer.concat(parts);
}

const U = {
  React: '76FBCEE9-3517-30B3-9DC6-62C4E914E908',
  ReactNativeDependencies: 'B35F1182-B82E-3372-8A74-A4FE502C0906',
  hermes: '80D5528F-2C78-3B90-B90F-747E89A9F880',
  other: '11111111-2222-3333-4444-555555555555',
};

const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
const dsymOf = (dir, name, data) => write(path.join(dir, `${name}.framework.dSYM`, 'Contents', 'Resources', 'DWARF', name), data);

test('the UUIDs of a thin and of a universal Mach-O, arch by arch', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsyms-macho-'));
  write(path.join(dir, 'thin'), thin(U.React));
  write(path.join(dir, 'fat'), fat([[X86_64, thin(U.other, X86_64)], [ARM64, thin(U.hermes)]]));
  write(path.join(dir, 'text'), 'not a binary at all');
  assert.deepEqual(machoUuids(path.join(dir, 'thin')), [{ arch: 'arm64', uuid: U.React }]);
  assert.deepEqual(machoUuids(path.join(dir, 'fat')), [{ arch: 'x86_64', uuid: U.other }, { arch: 'arm64', uuid: U.hermes }]);
  assert.throws(() => machoUuids(path.join(dir, 'text')), /not a Mach-O/);
});

/**
 * Maven as the phase sees it, the tarballs made of `dsyms` ({ name: thin }
 * per framework, device slice), and an Xcode build of a device app embedding
 * `embedded` ({ name: thin }).
 */
async function world({ dsyms = { React: U.React, ReactNativeDependencies: U.ReactNativeDependencies, hermes: U.hermes }, embedded = dsyms, version = '0.81.5' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsyms-phase-'));
  const served = {};
  const checksums = { [version]: {} };
  for (const framework of FRAMEWORKS) {
    const src = path.join(root, 'src', framework.artifact);
    for (const slice of new Set(Object.values(framework.slices))) {
      dsymOf(path.join(src, slice), framework.name, slice === framework.slices.iphoneos ? thin(dsyms[framework.name]) : thin(U.other));
    }
    const tarball = path.join(root, `${framework.artifact}.tar.gz`);
    execFileSync('tar', ['-czf', tarball, '-C', src, '.']);
    const data = fs.readFileSync(tarball);
    served[`/maven/${version}/react-native-artifacts-${version}-${framework.artifact}.tar.gz`] = data;
    checksums[version][framework.artifact] = createHash('sha256').update(data).digest('hex');
  }
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    const body = served[req.url];
    res.writeHead(body ? 200 : 404).end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const pods = path.join(root, 'Pods');
  write(path.join(pods, 'Manifest.lock'), `PODS:\n${FRAMEWORKS.map(({ pod }) => `  - ${pod} (${version}):\n    - glog\n`).join('')}`);
  const xcframeworks = path.join(root, 'XCFrameworkIntermediates');
  for (const framework of FRAMEWORKS) write(path.join(xcframeworks, framework.embedded), thin(embedded[framework.name]));
  const env = {
    DEBUG_INFORMATION_FORMAT: 'dwarf-with-dsym', PLATFORM_NAME: 'iphoneos', PODS_ROOT: pods,
    PODS_XCFRAMEWORKS_BUILD_DIR: xcframeworks, DWARF_DSYM_FOLDER_PATH: path.join(root, 'Release-iphoneos'),
  };
  const base = `http://127.0.0.1:${server.address().port}/maven`;
  const run = (over = {}) => copyDsyms({ env, base, checksums, cache: path.join(root, 'cache'), log: () => {}, ...over });
  return { root, env, run, base, checksums, requests, close: () => server.close() };
}

test('Release: the three dSYMs go beside the app\'s, each with the UUID of the framework the app embeds; the next build takes them from the cache', async () => {
  const w = await world();
  try {
    // A download a build cut short left behind.
    const leftover = path.join(w.root, 'cache', '0.81.5', '.hermes-framework-dSYM-release-AbC123');
    write(path.join(leftover, 'dsyms.tar.gz'), 'half');
    const copied = await w.run();
    assert.ok(!fs.existsSync(leftover), 'a cut-short download stays in the cache');
    assert.deepEqual(copied.map((dsym) => path.basename(dsym)),
      ['React.framework.dSYM', 'ReactNativeDependencies.framework.dSYM', 'hermes.framework.dSYM']);
    for (const name of ['React', 'ReactNativeDependencies', 'hermes']) {
      const dwarf = path.join(w.env.DWARF_DSYM_FOLDER_PATH, `${name}.framework.dSYM`, 'Contents', 'Resources', 'DWARF', name);
      assert.deepEqual(machoUuids(dwarf), [{ arch: 'arm64', uuid: U[name] }]);
    }
    assert.equal(w.requests.length, 3);
    await w.run();
    assert.equal(w.requests.length, 3, 'the second build downloaded again');
  } finally {
    w.close();
  }
});

test('a dSYM that is not of the embedded framework fails the build, and is not put beside the app', async () => {
  const w = await world({ embedded: { React: U.React, ReactNativeDependencies: U.ReactNativeDependencies, hermes: U.other } });
  try {
    await assert.rejects(w.run(), /hermes\.framework\.dSYM .* is not of the hermes the app embeds: 11111111-2222-3333-4444-555555555555 \(arm64\) not in it/);
    assert.ok(!fs.existsSync(path.join(w.env.DWARF_DSYM_FOLDER_PATH, 'hermes.framework.dSYM')));
  } finally {
    w.close();
  }
});

test('a tarball whose sha256 is not the pinned one fails the build and is not cached', async () => {
  const w = await world();
  try {
    const checksums = structuredClone(w.checksums);
    checksums['0.81.5']['reactnative-core-dSYM-release'] = '0'.repeat(64);
    await assert.rejects(w.run({ checksums }), /reactnative-core-dSYM-release\.tar\.gz has sha256 [0-9a-f]{64}, checksums\.json pins 0{64}/);
    assert.ok(!fs.existsSync(path.join(w.root, 'cache', '0.81.5', 'reactnative-core-dSYM-release')));
    assert.ok(!fs.existsSync(path.join(w.env.DWARF_DSYM_FOLDER_PATH, 'React.framework.dSYM')));
  } finally {
    w.close();
  }
});

test('a React Native version with no pinned checksums fails the build — before any download', async () => {
  const w = await world({ version: '0.82.0' });
  try {
    await assert.rejects(w.run({ checksums: {} }), /checksums\.json pins no sha256 of reactnative-core-dSYM-release 0\.82\.0: run node plugins\/prebuilt-dsyms\/dsyms\.mjs pin 0\.82\.0/);
    assert.equal(w.requests.length, 0);
  } finally {
    w.close();
  }
});

test('Maven without the tarball fails the build', async () => {
  const w = await world();
  try {
    await assert.rejects(w.run({ base: `${w.base}/nowhere` }), /reactnative-core-dSYM-release\.tar\.gz: HTTP 404/);
    assert.ok(!fs.existsSync(path.join(w.env.DWARF_DSYM_FOLDER_PATH, 'React.framework.dSYM')));
  } finally {
    w.close();
  }
});

test('a build that makes no dSYMs (Debug) gets none of these either, and downloads nothing', async () => {
  const w = await world();
  try {
    assert.deepEqual(await w.run({ env: { ...w.env, DEBUG_INFORMATION_FORMAT: 'dwarf' } }), []);
    assert.equal(w.requests.length, 0);
  } finally {
    w.close();
  }
});

test('Debug that makes dSYMs (Expo\'s app target: dwarf-with-dsym, DEBUG=1) embeds the Debug React and Hermes: no release dSYMs, no download, no failure', async () => {
  // e2e's Debug build: the app target makes its own dSYM, and the pods,
  // seeing DEBUG=1, embed the Debug flavour of the three frameworks, whose
  // UUIDs no release dSYM has (434F146C-… React, T-237's first e2e run).
  const w = await world({ embedded: { React: U.other, ReactNativeDependencies: U.other, hermes: U.other } });
  try {
    const env = { ...w.env, CONFIGURATION: 'Debug', GCC_PREPROCESSOR_DEFINITIONS: 'DEBUG=1  COCOAPODS=1 FB_SONARKIT_ENABLED=1' };
    assert.deepEqual(await w.run({ env }), []);
    assert.equal(w.requests.length, 0);
    assert.ok(!fs.existsSync(path.join(w.env.DWARF_DSYM_FOLDER_PATH, 'React.framework.dSYM')));
  } finally {
    w.close();
  }
});

test('Release keeps the phase whatever else GCC_PREPROCESSOR_DEFINITIONS holds, as long as it is not DEBUG=1', async () => {
  const w = await world();
  try {
    const env = { ...w.env, CONFIGURATION: 'Release', GCC_PREPROCESSOR_DEFINITIONS: 'COCOAPODS=1 NDEBUG=1 RCT_DEBUG=0' };
    assert.equal((await w.run({ env })).length, 3);
  } finally {
    w.close();
  }
});

test('an archive is checked framework by framework: each arch of each needs a dSYM with its UUID', () => {
  const archive = fs.mkdtempSync(path.join(os.tmpdir(), 'dsyms-archive-'));
  const app = path.join(archive, 'Products', 'Applications', 'Rehearsly.app');
  write(path.join(app, 'Frameworks', 'React.framework', 'React'), thin(U.React));
  write(path.join(app, 'Frameworks', 'hermes.framework', 'hermes'), thin(U.hermes));
  write(path.join(archive, 'dSYMs', 'Rehearsly.app.dSYM', 'Contents', 'Resources', 'DWARF', 'Rehearsly'), thin(U.other));
  assert.deepEqual(checkArchive(archive).missing.map(({ framework }) => framework), ['React.framework', 'hermes.framework']);
  dsymOf(path.join(archive, 'dSYMs'), 'React', thin(U.React));
  dsymOf(path.join(archive, 'dSYMs'), 'hermes', thin(U.other));
  const { missing, lines } = checkArchive(archive);
  assert.deepEqual(missing, [{ framework: 'hermes.framework', arch: 'arm64', uuid: U.hermes }], 'a dSYM of another build is no dSYM');
  assert.ok(lines.includes(`UUID: ${U.React} (arm64) Products/Applications/Rehearsly.app/Frameworks/React.framework/React — dSYM React.framework.dSYM`));
});

test('the config plugin adds the phase to the app target once, with the frameworks as inputs and the dSYMs as outputs', () => {
  const { IOSConfig } = require('expo/config-plugins');
  const { addPhase, PHASE_NAME } = require('../withPrebuiltDsyms.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsyms-plugin-'));
  // The project expo prebuild starts from.
  execFileSync('tar', ['-xzf', require.resolve('expo/template.tgz'), '-C', root, '--strip-components', '1', 'package/ios']);
  const project = IOSConfig.XcodeUtils.getPbxproj(root);
  addPhase(addPhase(project));
  const phases = Object.values(project.hash.project.objects.PBXShellScriptBuildPhase)
    .filter((phase) => typeof phase === 'object' && phase.name === `"${PHASE_NAME}"`);
  assert.equal(phases.length, 1);
  const [phase] = phases;
  const target = project.getFirstTarget().firstTarget;
  assert.ok(target.buildPhases.some(({ comment }) => comment === PHASE_NAME), 'not in the app target');
  assert.match(phase.shellScript, /\$NODE_BINARY.*\$PROJECT_DIR\/\.\.\/plugins\/prebuilt-dsyms\/dsyms\.mjs.* phase/);
  assert.deepEqual(phase.inputPaths.slice(0, 3), [
    '"${PODS_XCFRAMEWORKS_BUILD_DIR}/React-Core-prebuilt/React.framework/React"',
    '"${PODS_XCFRAMEWORKS_BUILD_DIR}/ReactNativeDependencies/ReactNativeDependencies.framework/ReactNativeDependencies"',
    '"${PODS_XCFRAMEWORKS_BUILD_DIR}/hermes-engine/Pre-built/hermes.framework/hermes"',
  ]);
  assert.deepEqual(phase.outputPaths, ['React', 'ReactNativeDependencies', 'hermes']
    .map((name) => `"$(DWARF_DSYM_FOLDER_PATH)/${name}.framework.dSYM"`));
});

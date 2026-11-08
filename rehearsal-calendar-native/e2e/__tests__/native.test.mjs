// The iOS project e2e builds from (T-227): it is made anew when what it is made
// of changes, an app built from other inputs is not used, the Release flows
// are told from the Debug ones, and a Release bundle that could reach another
// API is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appStamp, builtFrom, checkReleaseBundle, inputsHash, RELEASE_FLOWS, splitFlows } from '../native.mjs';

const API = 'http://127.0.0.1:3001/api';

function tree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-'));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  write('app.json', JSON.stringify({ expo: { ios: { infoPlist: { NSRemindersUsageDescription: 'never asks' } } } }));
  write('package.json', JSON.stringify({ main: 'index.ts', dependencies: { 'expo-calendar': '~15.0.8' } }));
  write('package-lock.json', '{}');
  write('locales/en.json', JSON.stringify({ ios: { NSRemindersUsageDescription: 'never asks' } }));
  write('assets/icon.png', 'png');
  write('src/App.tsx', 'export {}');
  return { root, write };
}

test('the project is made anew when app.json, the locales, the assets or the packages change — not the JS', () => {
  const { root, write } = tree();
  const first = inputsHash(root);
  assert.equal(inputsHash(root), first);
  write('src/App.tsx', 'export const changed = 1;');
  assert.equal(inputsHash(root), first, 'the JS comes from Metro or the Release bundle, not the project');
  for (const [file, text] of [
    // 9d265da: the keys T-040 had taken out of app.json and the locales.
    ['app.json', JSON.stringify({ expo: { ios: { infoPlist: {} } } })],
    ['locales/en.json', '{}'],
    ['locales/de.json', '{}'],
    ['assets/icon.png', 'another png'],
    ['package-lock.json', '{"lockfileVersion":3}'],
    ['node_modules/.package-lock.json', '{}'],
  ]) {
    const before = inputsHash(root);
    write(file, text);
    assert.notEqual(inputsHash(root), before, `${file} changed and the project would be kept`);
  }
});

test('an app is used only when it was built from these inputs', () => {
  const { root } = tree();
  const app = path.join(root, 'Build', 'Rehearsly.app');
  assert.equal(builtFrom(app, 'abc'), false, 'no app');
  fs.mkdirSync(app, { recursive: true });
  assert.equal(builtFrom(app, 'abc'), false, 'an app with no stamp — the main tree\'s, built before T-227');
  fs.writeFileSync(appStamp(app), 'other\n');
  assert.equal(builtFrom(app, 'abc'), false, 'an app of other inputs');
  fs.writeFileSync(appStamp(app), 'abc\n');
  assert.equal(builtFrom(app, 'abc'), true);
  assert.equal(builtFrom(null, 'abc'), false);
});

test('the flows in e2e/release run on Release, the rest on Debug; none given is both sets', () => {
  const listed = (given) => given.flatMap((entry) => (entry.endsWith('.yaml') ? [entry] : [`${entry}/a.yaml`, `${entry}/b.yaml`]));
  const flows = path.join(path.dirname(RELEASE_FLOWS), 'flows');
  assert.deepEqual(splitFlows([], listed), {
    debug: [`${flows}/a.yaml`, `${flows}/b.yaml`],
    release: [`${RELEASE_FLOWS}/a.yaml`, `${RELEASE_FLOWS}/b.yaml`],
  });
  assert.deepEqual(splitFlows([`${flows}/01-login.yaml`], listed), { debug: [`${flows}/01-login.yaml`], release: [] });
  assert.deepEqual(splitFlows([`${RELEASE_FLOWS}/01-launch.yaml`, `${flows}/01-login.yaml`], listed),
    { debug: [`${flows}/01-login.yaml`], release: [`${RELEASE_FLOWS}/01-launch.yaml`] });
});

// As Metro writes the production bundle of api.ts with the address given (seen on 2026-11-08).
const bundled = (address) => `
  var PRODUCTION_API_URL = ${JSON.stringify(address)};
  var getApiUrl = function () {
    var envApiUrl = ${JSON.stringify(address)};
    {
      _utilsLogger.logger.info(\`Using EXPO_PUBLIC_API_URL: \${envApiUrl}\`);
      return envApiUrl;
    }
  };
  prefixes: [prefix, 'rehearsalapp://', 'https://rehearsly.me'],`;
const bytecodeOf = (text) => Buffer.concat([Buffer.from([0xc6, 0x1f, 0xbc, 0x03]), Buffer.from(text, 'latin1')]);

test('a Release bundle for the local server passes', () => {
  checkReleaseBundle({ js: bundled(API), bytecode: bytecodeOf(`\0${API}\0https://rehearsly.me\0`), apiUrl: API });
});

test('a Release bundle that could reach another API is refused', () => {
  const refused = (input, why) => assert.throws(() => checkReleaseBundle({ apiUrl: API, ...input }), why);
  const good = { js: bundled(API), bytecode: bytecodeOf(`\0${API}\0`) };
  refused({ ...good, js: bundled('https://rehearsly.me/api') }, /envApiUrl is \["\\"https:\/\/rehearsly\.me\/api\\""\]/);
  refused({ ...good, js: bundled(API).replace(`envApiUrl = ${JSON.stringify(API)}`, 'envApiUrl = process.env.EXPO_PUBLIC_API_URL') },
    /still reads EXPO_PUBLIC_API_URL at run time/);
  refused({ ...good, js: bundled(API).replace(`PRODUCTION_API_URL = ${JSON.stringify(API)}`, "PRODUCTION_API_URL = 'https://rehearsly.me/api'") },
    /PRODUCTION_API_URL is/);
  refused({ ...good, js: `${bundled(API)}\n__d(function(){},12,[],"/app/.env.local");` }, /env files/);
  refused({ ...good, bytecode: bytecodeOf('\0https://rehearsly.me/api\0') }, /does not carry .*rehearsly\.me\/api/);
  refused({ ...good, bytecode: bytecodeOf(`\0${API}\0https://rehearsly.me/api\0`) }, /carries rehearsly\.me\/api/);
});

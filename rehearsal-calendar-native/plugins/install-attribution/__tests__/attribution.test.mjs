// T-424: an install from an ad gets Apple's install postback only when the
// advertised app sets a SKAdNetwork conversion value. The project `expo
// prebuild` makes from app.json must compile that call into the app, once per
// launch, with the value "installed" — and ask for nothing else.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FILE = 'RehearslyAttribution.m';
let project;
let ios;

// As e2e/native.mjs makes the e2e project: a folder of its own, app.json and
// package.json copied, the rest linked; prebuild only, no pods.
before(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'rehearsly-prebuild-'));
  for (const name of ['app.json', 'package.json']) fs.copyFileSync(path.join(ROOT, name), path.join(project, name));
  for (const name of ['assets', 'locales', 'node_modules', 'plugins']) fs.symlinkSync(path.join(ROOT, name), path.join(project, name));
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'expo', 'bin', 'cli'), 'prebuild', '--platform', 'ios', '--no-install', '--clean'], {
    cwd: project,
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', EXPO_NO_GIT_STATUS: '1', EXPO_NO_DOTENV: '1', LANG: 'en_US.UTF-8' },
    stdio: 'pipe',
    timeout: 5 * 60 * 1000,
  });
  ios = path.join(project, 'ios');
});

after(() => {
  if (project) fs.rmSync(project, { recursive: true, force: true });
});

const count = (text, pattern) => (text.match(pattern) ?? []).length;

test('the generated app target compiles the attribution module once', () => {
  const source = path.join(ios, 'Rehearsly', FILE);
  assert.ok(fs.existsSync(source), `${FILE} is not in the generated project`);
  const pbxproj = fs.readFileSync(path.join(ios, 'Rehearsly.xcodeproj', 'project.pbxproj'), 'utf8');
  assert.equal(count(pbxproj, new RegExp(`/\\* ${FILE} in Sources \\*/ = \\{isa = PBXBuildFile`, 'g')), 1, 'one build file');
  const sources = pbxproj.slice(pbxproj.indexOf('/* Begin PBXSourcesBuildPhase section */'), pbxproj.indexOf('/* End PBXSourcesBuildPhase section */'));
  assert.equal(count(sources, new RegExp(`/\\* ${FILE} in Sources \\*/`, 'g')), 1, 'in the Sources phase once');
});

test('the module sets the value "installed", once per launch, the window left open', () => {
  const code = fs.readFileSync(path.join(ios, 'Rehearsly', FILE), 'utf8').replace(/\/\/.*$/gm, '');
  const install = code.slice(code.indexOf('RCT_EXPORT_METHOD(install'));
  // A second call in the same launch returns before any SKAdNetwork call.
  const guard = install.indexOf('if (!first)');
  assert.ok(/dispatch_once\(&once/.test(install) && guard > 0, 'guarded by dispatch_once');
  assert.ok(guard < install.indexOf('[SKAdNetwork'), 'the guard comes before the calls');
  // One call on each iOS: 16.1+, 15.4–16.0, 15.1–15.3 — branches of one if.
  assert.match(install, /if \(@available\(iOS 16\.1, \*\)\) \{\s*\[SKAdNetwork updatePostbackConversionValue:0\s+coarseValue:SKAdNetworkCoarseConversionValueLow\s+lockWindow:NO\s+completionHandler:done\];\s*\} else if \(@available\(iOS 15\.4, \*\)\) \{\s*\[SKAdNetwork updatePostbackConversionValue:0 completionHandler:done\];\s*\} else \{/);
  assert.equal(count(install, /\[SKAdNetwork /g), 3);
  assert.equal(count(install, /\[SKAdNetwork registerAppForAdNetworkAttribution\]/g), 1);
  assert.doesNotMatch(install, /lockWindow:YES/);
});

test('nothing else is asked of iOS: no ad network list, no tracking prompt', () => {
  const plist = fs.readFileSync(path.join(ios, 'Rehearsly', 'Info.plist'), 'utf8');
  assert.doesNotMatch(plist, /SKAdNetworkItems|NSUserTrackingUsageDescription/);
  const code = fs.readFileSync(path.join(ios, 'Rehearsly', FILE), 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /AppTrackingTransparency|ATTrackingManager|advertisingIdentifier|identifierForVendor|NSURLSession/);
});

test('the app calls it once, as it loads', () => {
  const app = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
  assert.equal(count(app, /registerInstall\(\)/g), 1);
  assert.match(app, /^void registerInstall\(\);$/m, 'at the top level of App.tsx, not in a component that renders again');
});

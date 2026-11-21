// Where the App Store preview's touch marks come from (T-289): the app itself
// tells the store's recorder where and when each touch landed — and only an
// e2e bundle launched with `rehearslyStoreTouches` does. A production bundle
// has no such code at all: metro.config.js hands e2e/device/App.js to
// index.ts only when e2e/run.mjs sets REHEARSLY_E2E; and in an e2e bundle the
// app is the real one, untouched, unless the launch asks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { recorderUrl, touchRoute } = require(path.join(ROOT, 'e2e', 'device', 'storeTouches.js'));

/** What the project's Metro resolves for `name` imported from `from`, with REHEARSLY_E2E as `e2e` says: in a process of its own. */
function resolves(name, from, e2e) {
  const script = `
    const config = require(${JSON.stringify(path.join(ROOT, 'metro.config.js'))});
    const context = { originModulePath: ${JSON.stringify(from)}, resolveRequest: () => ({ type: 'sourceFile', filePath: 'the real one' }) };
    // Metro's own resolver when the config has none.
    const resolve = config.resolver.resolveRequest ?? context.resolveRequest;
    process.stdout.write(JSON.stringify(resolve(context, ${JSON.stringify(name)}, 'ios')));`;
  const env = { ...process.env };
  delete env.REHEARSLY_E2E;
  if (e2e) env.REHEARSLY_E2E = '1';
  return JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: ROOT, env, encoding: 'utf8' })).filePath;
}

test('a production bundle gets the real App: no touch is ever reported', () => {
  assert.equal(resolves('./App', path.join(ROOT, 'index.ts'), false), 'the real one');
});

test('an e2e bundle gets e2e/device/App.js for index.ts\'s ./App, and only for it', () => {
  assert.equal(resolves('./App', path.join(ROOT, 'index.ts'), true), path.join(ROOT, 'e2e', 'device', 'App.js'));
  assert.equal(resolves('./App', path.join(ROOT, 'src', 'index.ts'), true), 'the real one');
});

/** e2e/device/App.js as an e2e bundle runs it, the launch's arguments `args`: what it exports as the app. */
function appWith(args) {
  const realApp = function RealApp() { return null; };
  const fakes = {
    'react-native': { Settings: { get: (key) => args[key] }, View: 'View', Dimensions: { get: () => ({ width: 440, height: 956 }) } },
    '../../App': { default: realApp },
  };
  const load = Module._load;
  Module._load = function (request, parent, isMain) {
    if (Object.hasOwn(fakes, request)) return fakes[request];
    return load.call(this, request, parent, isMain);
  };
  const file = path.join(ROOT, 'e2e', 'device', 'App.js');
  try {
    delete require.cache[file];
    return { app: require(file).default, realApp };
  } finally {
    Module._load = load;
  }
}

test('without the launch argument the e2e bundle\'s app is the real App, as it is', () => {
  const { app, realApp } = appWith({});
  assert.equal(app, realApp);
  // Another address than a recorder on this machine: the same.
  assert.equal(appWith({ rehearslyStoreTouches: 'https://rehearsly.me' }).app.name, 'RealApp');
});

test('with it, the app sits in a view that only listens', () => {
  const { app, realApp } = appWith({ rehearslyStoreTouches: 'http://127.0.0.1:3003' });
  assert.notEqual(app, realApp);
  const element = app({ some: 'prop' });
  assert.equal(element.type, 'View');
  assert.equal(typeof element.props.onTouchStartCapture, 'function');
  assert.equal(typeof element.props.onTouchEndCapture, 'function');
  // Nothing that would take a touch for itself.
  assert.equal(element.props.onStartShouldSetResponder, undefined);
  assert.equal(element.props.onStartShouldSetResponderCapture, undefined);
  assert.equal(element.props.children.type, realApp);
  assert.deepEqual(element.props.children.props, { some: 'prop' });
});

test('only a recorder on this machine is told, and told where, when and on what screen', () => {
  assert.equal(recorderUrl(undefined), null);
  assert.equal(recorderUrl('1'), null);
  assert.equal(recorderUrl('http://example.com:3003'), null);
  assert.equal(recorderUrl('http://127.0.0.1:3003/x'), null);
  assert.equal(recorderUrl('http://127.0.0.1:3003'), 'http://127.0.0.1:3003');
  assert.equal(touchRoute('down', { identifier: 2, pageX: 110.26, pageY: 300 }, 1700000000123.4, { width: 440, height: 956 }),
    '/touch?phase=down&id=2&x=110.3&y=300&at=1700000000123&w=440&h=956');
});

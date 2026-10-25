// What Metro's watcher hears during an e2e run, with the project's own config.
//
// Maestro writes its screenshots and view hierarchies into e2e/out while the
// flows run. Metro watched them like any file of the project: each one was a
// change, each change an HMR "update-start", and the app put up its
// "Refreshing..." banner — a window of its own, made and taken down over the
// screen under test. A tap that landed while it went was lost (flow 30, T-207:
// the touch was cancelled, the calendar never chosen). What the run writes is
// not the app, and is not watched; the app's own files still are.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const createFileMap = require('metro/private/node-haste/DependencyGraph/createFileMap').default;

process.env.REHEARSLY_E2E = '1';
const config = require(path.join(ROOT, 'metro.config.js'));

const tag = `metro-watch-${process.pid}`;
const outDir = path.join(ROOT, 'e2e', 'out', 'artifacts', tag);
const appDir = path.join(ROOT, 'e2e', tag);
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metro-watch-'));
let fileMap = null;
after(async () => {
  await fileMap?.end();
  for (const dir of [outDir, appDir, cacheDir]) fs.rmSync(dir, { recursive: true, force: true });
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Metro's file map over the two folders, with the project's resolver. */
async function watch() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(appDir, { recursive: true });
  fileMap = createFileMap({
    ...config,
    projectRoot: ROOT,
    watchFolders: [outDir, appDir],
    fileMapCacheDirectory: cacheDir,
    resetCache: true,
    maxWorkers: 1,
    resolver: { ...config.resolver, useWatchman: false },
  }, { watch: true, extractDependencies: false });
  await fileMap.build();
  const heard = [];
  fileMap.on('change', (event) => heard.push(...event.eventsQueue.map((e) => e.filePath)));
  return heard;
}

test("a screenshot Maestro writes into e2e/out is not a change to Metro; the app's files are", async () => {
  const heard = await watch();

  // What Maestro leaves for a step: a screenshot and the hierarchy beside it.
  fs.writeFileSync(path.join(outDir, 'step-033-tapOnElement-Allow_Full_Access.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(outDir, 'step-033-tapOnElement-Allow_Full_Access.json'), '{}');
  // A file of the app's own, outside e2e/out: the watcher is on, and hears it.
  const appFile = path.join(appDir, 'probe.ts');
  fs.writeFileSync(appFile, 'export {};\n');

  for (let waited = 0; !heard.includes(appFile) && waited < 10000; waited += 100) await sleep(100);
  await sleep(500);

  assert.ok(heard.includes(appFile), `the watcher heard nothing at all: ${JSON.stringify(heard)}`);
  assert.deepEqual(heard.filter((file) => file.startsWith(outDir)), [],
    'files written into e2e/out reached Metro as changes');
});

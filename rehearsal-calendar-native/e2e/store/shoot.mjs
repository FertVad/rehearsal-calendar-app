#!/usr/bin/env node
/**
 * The App Store's screenshots, taken and made into the store's pictures (T-274):
 *
 *   node e2e/store/shoot.mjs [<locale>…]     every locale of captions.json when none is named
 *
 * For each locale, the e2e stand as `npm run e2e` stands it up — its own
 * PostgreSQL container, server and Metro, nothing real reached — but on the
 * store's simulator, "Rehearsly Store" (iPhone 17 Pro Max, 1320×2868), its
 * status bar at 9:41 with the battery full, and seeded with that page's world
 * (e2e/run.mjs --store=<locale>, e2e/store/seed.mjs). The run takes the e2e
 * lock itself, so the simulator is made and booted under it and never beside
 * an e2e run. e2e/store/shots.yaml takes the eight screenshots; they are kept
 * in e2e/store/out/shots/<locale>, and compose.mjs makes the pictures:
 * e2e/store/out/<locale>/01.png…08.png and e2e/store/out/<locale>-6.3/.
 *
 * Exits as the run did when it failed: 75 is the machine's (Docker, a port,
 * the simulator), and the locales after it are not taken.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, OUT, compose, shotsOf } from './compose.mjs';

const STORE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(STORE, '..', '..');
const ARTIFACTS = path.join(ROOT, 'e2e', 'out', 'artifacts');

const locales = process.argv.slice(2).length ? process.argv.slice(2) : LOCALES;
for (const locale of locales) {
  if (!LOCALES.includes(locale)) {
    console.error(`[store] no captions for ${locale} in captions.json: ${LOCALES.join(', ')}`);
    process.exit(64);
  }
}

/** The newest screenshot of each frame a run took since `since` (Maestro puts them in the run's artifacts). */
function takenSince(since) {
  const found = new Map();
  if (!fs.existsSync(ARTIFACTS)) return found;
  for (const name of fs.readdirSync(ARTIFACTS, { recursive: true })) {
    const match = /(?:^|\/)store-0([1-8])\.png$/.exec(name);
    if (!match) continue;
    const file = path.join(ARTIFACTS, name);
    const { mtimeMs } = fs.statSync(file);
    if (mtimeMs >= since && mtimeMs >= (found.get(match[1])?.mtimeMs ?? 0)) found.set(match[1], { file, mtimeMs });
  }
  return found;
}

for (const locale of locales) {
  console.log(`[store] ${locale}: standing up the stand and taking the screenshots`);
  const since = Date.now();
  const run = spawnSync(process.execPath, [path.join(ROOT, 'e2e', 'run.mjs'), `--store=${locale}`, path.join(STORE, 'shots.yaml')],
    { cwd: ROOT, stdio: 'inherit' });
  if (run.status !== 0) {
    console.error(`[store] ${locale}: the run ended ${run.status ?? run.signal}; see e2e/out`);
    process.exit(run.status ?? 1);
  }
  const taken = takenSince(since);
  const shots = shotsOf(locale);
  fs.mkdirSync(path.dirname(shots[0]), { recursive: true });
  for (const [i, shot] of shots.entries()) {
    const frame = taken.get(String(i + 1));
    if (!frame) {
      console.error(`[store] ${locale}: no screenshot store-0${i + 1} in ${ARTIFACTS}`);
      process.exit(1);
    }
    fs.copyFileSync(frame.file, shot);
  }
  const made = await compose({ locale, shots });
  console.log(`[store] ${locale}: 8 pictures, type ${made.fontSize} px — ${path.join(OUT, locale)} and ${path.join(OUT, `${locale}-6.3`)}`);
}

// T-290: the montage's rule "no lit element out of its hole for more than two
// frames in a row" (montage.mjs lightLags) on the five real recordings
// (e2e/store/out/clips), with the light as e23d16a's montage placed it and as
// this one does. The element's place frame by frame is this montage's
// (follow: the recording's frames matched), the same for both.
//
//   node audit/evidence/T-290/rule.mjs [<base>]      (from the repository's root; base e23d16a)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const STORE = path.join(ROOT, 'rehearsal-calendar-native', 'e2e', 'store');
const base = process.argv[2] ?? 'e23d16a';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't290-rule-'));

/** montage.mjs as `source` has it, its plan exported, its own imports from e2e/store. */
async function load(name, source) {
  const text = source.replace(/^function plan\(/m, 'export function plan(')
    .replace("from './compose.mjs'", `from '${pathToFileURL(path.join(STORE, 'compose.mjs')).href}'`);
  const file = path.join(dir, `${name}.mjs`);
  fs.writeFileSync(file, text);
  return import(pathToFileURL(file).href);
}

const old = await load('old', execFileSync('git', ['show', `${base}:rehearsal-calendar-native/e2e/store/montage.mjs`], { cwd: ROOT, encoding: 'utf8' }));
const now = await load('now', fs.readFileSync(path.join(STORE, 'montage.mjs'), 'utf8'));

let failed = 0;
for (const locale of ['ru', 'en-US', 'en-GB', 'es-ES', 'de-DE']) {
  const clips = now.clipsOf(locale);
  const before = old.plan(clips);
  // This montage's plan refuses a lagging light itself; it does not here.
  const after = now.plan(clips);
  for (const [label, lights] of [[base, before.lights], ['now', after.lights]]) {
    const runs = now.lightLags(lights, after.followed);
    if (label === base && runs.length) failed++;
    console.log(`${locale} ${label}: ${runs.length ? 'RED' : 'green'}${runs.map((r) => `\n  "${r.name}" hole ${r.hole + 1}: off its element ${r.frames} frames in a row, `
      + `${r.from.toFixed(3)}–${r.to.toFixed(3)} s (frames ${Math.round(r.from * 30)}–${Math.round(r.to * 30)}), up to ${Math.round(r.off)} px`).join('')}`);
  }
  for (const p of after.followed.filter((f) => f.hole === 0)) {
    console.log(`  ${p.name}: the element from frame ${Math.round(p.frames[0].t * 30)}, `
      + p.frames.map((f) => `${Math.round(f.t * 30)}:${Math.round(f.y)}`).join(' ') + ' (frame:y px of its centre)');
  }
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${failed} of 5 red on ${base}`);

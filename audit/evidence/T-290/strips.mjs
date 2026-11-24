// T-290: the frames of each made preview one after another — from the tap on
// day A to the tap on day B, and from the tap on Busy 0.6 s on — each with its
// number, and ru's frame at 22.23 s with how bright the app comes through to
// the right of «Все в курсе:».
//
//   node audit/evidence/T-290/strips.mjs      (from the repository's root, after montage.mjs made the five)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..', '..', '..');
const STORE = path.join(ROOT, 'rehearsal-calendar-native', 'e2e', 'store');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't290-strips-'));
const text = fs.readFileSync(path.join(STORE, 'montage.mjs'), 'utf8').replace(/^function plan\(/m, 'export function plan(')
  .replace("from './compose.mjs'", `from '${pathToFileURL(path.join(STORE, 'compose.mjs')).href}'`);
fs.writeFileSync(path.join(dir, 'montage.mjs'), text);
const M = await import(pathToFileURL(path.join(dir, 'montage.mjs')).href);
const fps = M.VIDEO.fps;

/** Frames `first`…`last` of `video`, cut to rows `top`…`bottom`, halved, 12 a row left to right, into `out` (its name says `first`). */
function strip(video, first, last, top, bottom, out) {
  const n = last - first + 1, rows = Math.ceil(n / 12);
  execFileSync(M.tool('ffmpeg'), ['-v', 'error', '-y', '-i', video, '-vf',
    `select='between(n\\,${first}\\,${last})',crop=886:${bottom - top}:0:${top},scale=443:-2,`
      + `tile=12x${rows}:padding=6:color=0x0D1117`,
    '-fps_mode', 'passthrough', '-frames:v', '1', out]);
  return out;
}

const lines = [];
for (const locale of ['ru', 'en-US', 'en-GB', 'es-ES', 'de-DE']) {
  const { shots, taps } = M.plan(M.clipsOf(locale));
  const month = shots[2];
  const [a, b, busy] = taps.filter((t) => t.t >= month.start && t.t < month.end);
  const video = path.join(STORE, 'out', 'video', `${locale}.mp4`);
  const tick = (t) => Math.round(t * fps);
  const days = strip(video, tick(a.t), tick(b.t), 300, 900, path.join(HERE, `${locale}-days-${tick(a.t)}.png`));
  const modes = strip(video, tick(busy.t), tick(busy.t + 0.6), 900, 1400, path.join(HERE, `${locale}-modes-${tick(busy.t)}.png`));
  lines.push(`${locale}: day A tapped at frame ${tick(a.t)}, day B at ${tick(b.t)} → ${path.basename(days)}; Busy at ${tick(busy.t)}, to ${tick(busy.t + 0.6)} → ${path.basename(modes)}`);
}

// ru, 22.23 s (frame 667): to the right of «Все в курсе:», on its height.
const ru = path.join(STORE, 'out', 'video', 'ru.mp4');
const png = path.join(HERE, 'ru-22_23s.png');
execFileSync(M.tool('ffmpeg'), ['-v', 'error', '-y', '-i', ru, '-vf', "select='eq(n\\,667)'", '-fps_mode', 'passthrough', '-frames:v', '1', png]);
const raw = execFileSync(M.tool('ffmpeg'), ['-v', 'error', '-i', ru, '-vf', "select='eq(n\\,667)',crop=190:30:470:1380",
  '-fps_mode', 'passthrough', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 20 });
let most = 0;
for (let i = 0; i < raw.length; i += 3) most = Math.max(most, raw[i], raw[i + 1], raw[i + 2]);
lines.push(`ru frame 667 (22.23 s), x 470–660, y 1380–1410 px: brightest channel ${most} of 255 → ${path.basename(png)}`);
fs.rmSync(dir, { recursive: true, force: true });
console.log(lines.join('\n'));

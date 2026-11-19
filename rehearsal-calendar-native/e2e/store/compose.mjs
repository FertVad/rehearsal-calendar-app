#!/usr/bin/env node
/**
 * The App Store's pictures from the app's own screenshots (T-274):
 *
 *   node e2e/store/compose.mjs [<locale>…] [--preview=<dir>]
 *                                            e2e/store/out/shots/<locale>/01.png…08.png
 *                                            → e2e/store/out/<locale>/01.png…08.png (1320×2868)
 *                                              and e2e/store/out/<locale>-6.3/ (1206×2622)
 *
 * shoot.mjs takes the screenshots and calls this; it runs alone too, on the
 * shots of an earlier run, when only a caption changed.
 *
 * Each picture: the caption at the top, two lines exactly as captions.json
 * breaks them, and the screenshot under it, whole, its corners rounded. The
 * landing's look — its background, text and accent colours read from
 * server/public/styles.css, SF Pro from the system's own file. A caption too
 * wide makes the type smaller for the whole language, so the eight read as a
 * set. PNG without alpha, which App Store Connect refuses.
 *
 * Drawn by compose.swift (CoreText, CoreGraphics), compiled once into
 * e2e/store/out/.bin — the app's packages stay as package-lock.json has them.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(STORE, '..', '..');
export const OUT = path.join(STORE, 'out');
export const CAPTIONS = path.join(STORE, 'captions.json');
const STYLES = path.join(ROOT, 'server', 'public', 'styles.css');
const FONT = '/System/Library/Fonts/SFNS.ttf';
const SOURCE = path.join(STORE, 'compose.swift');

/** The 6.9" display App Store Connect asks for, and the 6.3" one beside it. */
export const SIZES = [
  { suffix: '', width: 1320, height: 2868 },
  { suffix: '-6.3', width: 1206, height: 2622 },
];

/** The landing's colours, as its stylesheet names them. */
export function landingColours() {
  const css = fs.readFileSync(STYLES, 'utf8');
  const value = (name) => {
    const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
    if (!match) throw new Error(`${STYLES} has no --${name}`);
    return match[1].trim();
  };
  // The hairline round the screenshot: the landing's line, a little stronger on a picture this size.
  return { background: value('bg'), text: value('fg'), accent: value('accent'), line: 'rgba(139, 148, 158, .35)' };
}

/** compose.swift, compiled once for each version of it. */
export function binary() {
  const source = fs.readFileSync(SOURCE);
  const bin = path.join(OUT, '.bin', `compose-${createHash('sha256').update(source).digest('hex').slice(0, 12)}`);
  if (!fs.existsSync(bin)) {
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    execFileSync('xcrun', ['swiftc', '-O', SOURCE, '-o', `${bin}.tmp`], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 600000 });
    fs.renameSync(`${bin}.tmp`, bin);
  }
  return bin;
}

/**
 * Draws `locale`'s eight pictures from `shots` (eight PNGs of the app, in
 * order) into `out`/<locale> and `out`/<locale>-6.3. Returns what was drawn:
 * { fontSize, captionBottom, pictures: [{ file, width, height, lines, fontSize, shot }] },
 * the full-size ones, in px of the full size.
 */
export async function compose({ locale, shots, out = OUT, captionsFile = CAPTIONS }) {
  const all = JSON.parse(fs.readFileSync(captionsFile, 'utf8'));
  const captions = all[locale]?.screenshots;
  if (!captions) throw new Error(`${captionsFile} has no captions for ${locale}`);
  if (captions.length !== 8 || shots.length !== 8) {
    throw new Error(`8 screenshots are needed, and 8 captions: ${shots.length} and ${captions.length} for ${locale}`);
  }
  for (const shot of shots) if (!fs.existsSync(shot)) throw new Error(`no screenshot ${shot}`);
  const job = {
    captions,
    shots,
    outputs: SIZES.map(({ suffix, width, height }) => ({ dir: path.join(out, `${locale}${suffix}`), width, height })),
    font: FONT,
    colours: landingColours(),
  };
  const jobFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'store-job-')), 'job.json');
  fs.writeFileSync(jobFile, JSON.stringify(job));
  try {
    return JSON.parse(execFileSync(binary(), ['draw', jobFile], { encoding: 'utf8', maxBuffer: 1 << 24 }));
  } finally {
    fs.rmSync(path.dirname(jobFile), { recursive: true, force: true });
  }
}

/** The language macOS's text recognition reads a locale's captions in. */
const READ_AS = { 'en-US': 'en-US', 'en-GB': 'en-GB', ru: 'ru-RU', 'es-ES': 'es-ES', 'de-DE': 'de-DE' };

/** For each of `files`, its lines of text above `bottom` px, top first, as macOS reads them (the test's check). */
export function readText(files, { locale, bottom }) {
  return JSON.parse(execFileSync(binary(), ['read', String(bottom), READ_AS[locale] ?? 'en-US', ...files], { encoding: 'utf8' }));
}

/** The locales captions.json has, in its order. */
export const LOCALES = Object.keys(JSON.parse(fs.readFileSync(CAPTIONS, 'utf8')));

/** A locale's screenshots, as shoot.mjs keeps them. */
export const shotsOf = (locale) => Array.from({ length: 8 }, (_, i) => path.join(OUT, 'shots', locale, `${String(i + 1).padStart(2, '0')}.png`));

/**
 * A locale's eight pictures in a row, 600 px tall, in `dir`/<locale>.png: a
 * preview small enough for git and for a look over the set, never the
 * pictures the store gets.
 */
export function preview(locale, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${locale}.png`);
  const pictures = Array.from({ length: 8 }, (_, i) => path.join(OUT, locale, `${String(i + 1).padStart(2, '0')}.png`));
  execFileSync(binary(), ['sheet', file, '600', landingColours().background, ...pictures]);
  return file;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // --preview=<dir>: the previews too, of the pictures made.
  const previewDir = process.argv.find((arg) => arg.startsWith('--preview='))?.slice('--preview='.length);
  const named = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  for (const locale of named.length ? named : LOCALES) {
    const made = await compose({ locale, shots: shotsOf(locale) });
    console.log(`[store] ${locale}: 8 pictures, type ${made.fontSize} px — ${path.join(OUT, locale)}, ${path.join(OUT, `${locale}-6.3`)}`);
    if (previewDir) console.log(`[store] ${locale}: preview ${preview(locale, previewDir)}`);
  }
}

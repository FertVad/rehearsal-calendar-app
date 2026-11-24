// The App Store's pictures (T-274): what e2e/store/compose.mjs makes of eight
// screenshots and e2e/store/captions.json. Each is the size App Store Connect
// takes, has no alpha channel (it refuses a PNG with one), and carries its
// caption as the file has it — the words read back off the picture itself, the
// line break where the file puts it, one size of type for a whole language.
//
// The pictures are drawn by compose.swift (built by xcrun swiftc, Core
// Graphics) and read back by macOS's text recognition: on any other system,
// GitHub's Linux runner among them, those tests are skipped and say why. On a
// Mac they run, and a Mac without Xcode fails them: that machine is broken (T-282).
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { readPng } from '../ink.mjs';
// As a namespace: on the composer before T-288 the tests still run, and fail on what they check.
import * as C from '../store/compose.mjs';

const { CAPTIONS, SIZES, compose, readText } = C;
const STORE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'store');
const captions = JSON.parse(fs.readFileSync(CAPTIONS, 'utf8'));
/** A caption as it is drawn: its main word's brackets gone (the composer's own, once it has one). */
const plain = (text) => (C.plain ?? ((t) => t))(text);
/** The app's lilac, the main word's colour: #C084FC. */
const LILAC = [0xc0, 0x84, 0xfc];
const lilac = ([r, g, b]) => r > 140 && b > 190 && b - g > 70 && r - g > 30;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'store-compose-'));
/** False on a Mac; elsewhere, why the drawing tests do not run. */
const MAC_ONLY = process.platform === 'darwin' ? false : 'needs macOS: compose.swift is built by xcrun swiftc';

/** A PNG of `width`×`height` in one colour, with an alpha channel: what the composer must not pass on. */
function writeShot(file, width, height, [r, g, b]) {
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x++) row.set([r, g, b, 255], 1 + x * 4);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type, 'ascii'), body])) >>> 0, 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

/** The colour type in a PNG's header: 2 is RGB, 6 RGB with alpha. */
const colourType = (file) => fs.readFileSync(file)[25];

test('the sizes App Store Connect takes: 1320×2868 and 1206×2622', () => {
  assert.deepEqual(SIZES.map(({ width, height }) => [width, height]), [[1320, 2868], [1206, 2622]]);
});

test('the fonts are the repository\'s, in e2e/store/fonts, each with its OFL.txt beside it; no system font (T-288)', () => {
  const fonts = Object.values(C.FONTS ?? {});
  assert.ok(fonts.length >= 4, `fonts: ${JSON.stringify(C.FONTS)}`);
  for (const file of fonts) {
    assert.equal(path.relative(path.join(STORE, 'fonts'), file).startsWith('..'), false, `${file} outside e2e/store/fonts`);
    assert.ok(fs.statSync(file).size > 10000, file);
    const licence = path.join(path.dirname(file), 'OFL.txt');
    assert.match(fs.readFileSync(licence, 'utf8'), /SIL OPEN FONT LICENSE/i, licence);
  }
  // Literata upright and italic, Caveat, Inter Tight.
  assert.deepEqual(fonts.map((f) => path.basename(f)).sort(),
    ['Caveat[wght].ttf', 'InterTight[wght].ttf', 'Literata-Italic[opsz,wght].ttf', 'Literata[opsz,wght].ttf']);
  // Nothing the store draws takes SF Pro, or any font of the system's.
  for (const name of ['compose.swift', 'compose.mjs', 'montage.mjs']) {
    assert.doesNotMatch(fs.readFileSync(path.join(STORE, name), 'utf8'), /\/System\/Library\/Fonts|SFNS/, name);
  }
});

test('every caption of every language marks at most one main word, in [brackets] within one line (T-288)', () => {
  const texts = (entry) => [entry.hook, ...Object.values(entry.hookByDay ?? {}), ...(entry.video ?? []), ...(entry.screenshots ?? []),
    entry.signIn, ...Object.values(entry.finale ?? {})].filter((t) => typeof t === 'string');
  for (const [locale, entry] of Object.entries(captions)) {
    for (const text of texts(entry)) {
      const pairs = text.match(/\[[^\[\]\n]+\]/g) ?? [];
      assert.ok(pairs.length <= 1, `${locale}: ${JSON.stringify(text)} marks ${pairs.length}`);
      // No bracket left over: none outside the one pair, none across a line break.
      assert.doesNotMatch(text.replace(/\[[^\[\]\n]+\]/, ''), /[\[\]]/, `${locale}: ${JSON.stringify(text)}`);
    }
  }
  // Every screenshot caption and every caption of the video has its main word.
  for (const [locale, entry] of Object.entries(captions)) {
    for (const text of [...entry.screenshots, entry.hook, ...entry.video.slice(0, 6)]) {
      assert.match(text, /\[[^\]]+\]/, `${locale}: ${JSON.stringify(text)} has no main word`);
    }
  }
});

test('a missing screenshot or language is refused, not drawn over', async () => {
  const none = Array.from({ length: 8 }, (_, i) => path.join(TMP, `none-${i + 1}.png`));
  await assert.rejects(compose({ locale: 'en-US', shots: none.slice(0, 7), out: path.join(TMP, 'x') }), /8 screenshots/);
  await assert.rejects(compose({ locale: 'fr-FR', shots: none, out: path.join(TMP, 'x') }), /fr-FR/);
  await assert.rejects(compose({ locale: 'en-US', shots: none, out: path.join(TMP, 'x') }), /no screenshot/);
});

describe('drawn by compose.swift', { skip: MAC_ONLY }, () => {
  const shots = [];
  const made = {};
  before(async () => {
    for (let i = 0; i < 8; i++) {
      const file = path.join(TMP, `shot-${i + 1}.png`);
      writeShot(file, 1320, 2868, [40 + i * 20, 120, 200 - i * 20]);
      shots.push(file);
    }
    for (const locale of ['en-US', 'ru', 'de-DE', 'es-ES']) {
      made[locale] = await compose({ locale, shots, out: path.join(TMP, 'out') });
    }
  });

  test('eight pictures a language, at each size, RGB without alpha', () => {
    for (const locale of Object.keys(made)) {
      for (const { suffix, width, height } of SIZES) {
        for (let i = 1; i <= 8; i++) {
          const file = path.join(TMP, 'out', `${locale}${suffix}`, `${String(i).padStart(2, '0')}.png`);
          assert.ok(fs.existsSync(file), file);
          assert.equal(colourType(file), 2, `${file} has an alpha channel`);
          const header = fs.readFileSync(file).subarray(16, 24);
          assert.deepEqual([header.readUInt32BE(0), header.readUInt32BE(4)], [width, height], file);
        }
      }
    }
    // And one of each size decoded whole: three channels, every pixel there.
    for (const { suffix, width, height } of SIZES) {
      const png = readPng(path.join(TMP, 'out', `de-DE${suffix}`, '02.png'));
      assert.deepEqual([png.width, png.height, png.channels, png.data.length], [width, height, 3, width * height * 3]);
    }
  });

  test('each caption is captions.json\'s, broken where the file breaks it, read back off the picture', () => {
    for (const locale of Object.keys(made)) {
      const want = captions[locale].screenshots.map(plain);
      assert.deepEqual(made[locale].pictures.map((p) => p.lines.join('\n')), want, locale);
      // The words on the pictures, line by line, as macOS's text recognition reads them.
      const read = readText(made[locale].pictures.map((p) => p.file), { locale, bottom: made[locale].captionBottom });
      // Italic Cyrillic's и and з are written as u and 3 are, and macOS reads «из» in italic as "u3":
      // those read the same on both sides; every other letter must be the file's.
      const letters = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').replace(/u/g, 'и').replace(/3/g, 'з');
      for (const [i, caption] of want.entries()) {
        assert.deepEqual(read[i].map(letters), caption.split('\n').map(letters), `${locale} ${i + 1}: ${JSON.stringify(read[i])}`);
      }
    }
  });

  test('drawn with Literata and its italic from e2e/store/fonts, as Core Text says it loaded them (T-288)', () => {
    for (const locale of Object.keys(made)) {
      assert.deepEqual(made[locale].fonts?.map((f) => fs.realpathSync(f)), [C.FONTS.play, C.FONTS.playItalic].map((f) => fs.realpathSync(f)), locale);
      assert.equal(made[locale].lineHeight, 1.1);
    }
  });

  test('the main word: no bracket on the picture, its letters lilac (#C084FC), the rest of the caption not (T-288)', () => {
    for (const locale of Object.keys(made)) {
      const read = readText(made[locale].pictures.map((p) => p.file), { locale, bottom: made[locale].captionBottom });
      for (const [i, picture] of made[locale].pictures.entries()) {
        assert.doesNotMatch(read[i].join('\n'), /[\[\]]/, `${locale} ${i + 1}: ${JSON.stringify(read[i])}`);
        const em = picture.emphasis;
        assert.ok(em && em.right > em.left, `${locale} ${i + 1}: no main word drawn (${JSON.stringify(em)})`);
        const png = readPng(picture.file);
        const pixel = (x, y) => { const at = (y * png.width + x) * png.channels; return [...png.data.subarray(at, at + 3)]; };
        let inside = 0, outside = 0, purest = 0;
        for (let y = 0; y < made[locale].captionBottom; y++) {
          for (let x = 0; x < png.width; x++) {
            const p = pixel(x, y);
            if (!lilac(p)) continue;
            const within = x >= em.left - 2 && x <= em.right + 2 && y >= em.top - 2 && y <= em.bottom + 2;
            if (within) inside++; else outside++;
            if (within && p.every((v, c) => Math.abs(v - LILAC[c]) <= 6)) purest++;
          }
        }
        // The main word's ink is lilac — its strokes' middles exactly #C084FC — and nothing else of the caption is.
        assert.ok(inside > 500 && purest > 100, `${locale} ${i + 1}: ${inside} lilac pixels in the main word, ${purest} of them #C084FC`);
        assert.equal(outside, 0, `${locale} ${i + 1}: ${outside} lilac pixels outside the main word`);
      }
    }
  });

  test('each line starts at the window\'s left edge: its first letter\'s ink within a few px of the screenshot\'s (T-288)', () => {
    for (const locale of Object.keys(made)) {
      for (const [i, picture] of made[locale].pictures.entries()) {
        const png = readPng(picture.file);
        const bg = [...png.data.subarray(0, 3)];
        const ink = (x, y) => { const at = (y * png.width + x) * png.channels; return png.data.subarray(at, at + 3).some((v, c) => Math.abs(v - bg[c]) > 60); };
        // Each line's rows from its ink's top (an italic b's serif rises above the capitals) to its baseline,
        // as the composer says; before it, the band in equal parts.
        const rows = picture.lineBoxes
          ?? picture.lines.map((_, k, all) => ({ inkTop: 110 + (310 / all.length) * k, baseline: 110 + (310 / all.length) * (k + 1) }));
        assert.equal(rows.length, picture.lines.length);
        for (const [k, { inkTop, baseline }] of rows.entries()) {
          let first = Infinity;
          for (let y = Math.ceil(inkTop); y <= Math.floor(baseline); y++) {
            for (let x = 0; x < first; x++) if (ink(x, y)) { first = x; break; }
          }
          assert.ok(Math.abs(first - picture.shot.left) <= 4,
            `${locale} ${i + 1}, line ${k + 1} ${JSON.stringify(picture.lines[k])}: first ink at x ${first}, the window at ${picture.shot.left}`);
        }
      }
    }
  });

  test('one size of type for the whole language, at most 104 px, made smaller for all when one caption is too wide', async () => {
    for (const locale of Object.keys(made)) {
      assert.equal(new Set(made[locale].pictures.map((p) => p.fontSize)).size, 1, locale);
      assert.ok(made[locale].fontSize <= 104, `${locale}: ${made[locale].fontSize}`);
    }
    // German's "wann sie keine Zeit haben" is wider than English's longest line.
    assert.ok(made['de-DE'].fontSize <= made['en-US'].fontSize);
    const wide = { 'xx-XX': { screenshots: [...captions['en-US'].screenshots] } };
    wide['xx-XX'].screenshots[6] = 'Invite everyone with one link\nwith one link to the project';
    const file = path.join(TMP, 'wide.json');
    fs.writeFileSync(file, JSON.stringify(wide));
    const narrowed = await compose({ locale: 'xx-XX', shots, out: path.join(TMP, 'wide'), captionsFile: file });
    assert.ok(narrowed.fontSize < made['en-US'].fontSize, `${narrowed.fontSize} < ${made['en-US'].fontSize}`);
    assert.deepEqual(narrowed.pictures.map((p) => p.fontSize), Array(8).fill(narrowed.fontSize));
    // The wide line still inside the picture's margins: nothing drawn at its edges.
    const png = readPng(narrowed.pictures[6].file);
    for (let y = 0; y < narrowed.captionBottom; y++) {
      for (const x of [0, 10, png.width - 11, png.width - 1]) {
        const at = (y * png.width + x) * png.channels;
        assert.ok(png.data[at] < 80 && png.data[at + 1] < 80 && png.data[at + 2] < 80, `ink at ${x},${y}`);
      }
    }
  });

  test('the screenshot is under the caption, whole, with rounded corners', () => {
    const { file, shot } = made['en-US'].pictures[0];
    const png = readPng(file);
    const pixel = (x, y) => [...png.data.subarray((y * png.width + x) * 3, (y * png.width + x) * 3 + 3)];
    assert.ok(shot.top > made['en-US'].captionBottom);
    assert.ok(shot.top + shot.height <= png.height && shot.left >= 0 && shot.left + shot.width <= png.width);
    assert.equal(Math.round(shot.width / shot.height * 1000), Math.round(1320 / 2868 * 1000));
    // Its middle is the shot's colour; its very corner is the background.
    assert.deepEqual(pixel(Math.round(shot.left + shot.width / 2), Math.round(shot.top + shot.height / 2)), [40, 120, 200]);
    assert.notDeepEqual(pixel(Math.round(shot.left) + 2, Math.round(shot.top) + 2), [40, 120, 200]);
  });
});

process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));

// The App Store's pictures (T-274): what e2e/store/compose.mjs makes of eight
// screenshots and e2e/store/captions.json. Each is the size App Store Connect
// takes, has no alpha channel (it refuses a PNG with one), and carries its
// caption as the file has it — the words read back off the picture itself, the
// line break where the file puts it, one size of type for a whole language.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { readPng } from '../ink.mjs';
import { CAPTIONS, SIZES, compose, readText } from '../store/compose.mjs';

const captions = JSON.parse(fs.readFileSync(CAPTIONS, 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'store-compose-'));

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

const shots = [];
const made = {};
before(async () => {
  for (let i = 0; i < 8; i++) {
    const file = path.join(TMP, `shot-${i + 1}.png`);
    writeShot(file, 1320, 2868, [40 + i * 20, 120, 200 - i * 20]);
    shots.push(file);
  }
  for (const locale of ['en-US', 'ru', 'de-DE']) {
    made[locale] = await compose({ locale, shots, out: path.join(TMP, 'out') });
  }
});

test('eight pictures a language, 1320×2868 and 1206×2622, RGB without alpha', () => {
  assert.deepEqual(SIZES.map(({ width, height }) => [width, height]), [[1320, 2868], [1206, 2622]]);
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
    const want = captions[locale].screenshots;
    assert.deepEqual(made[locale].pictures.map((p) => p.lines.join('\n')), want, locale);
    // The words on the pictures, line by line, as macOS's text recognition reads them.
    const read = readText(made[locale].pictures.map((p) => p.file), { locale, bottom: made[locale].captionBottom });
    const letters = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    for (const [i, caption] of want.entries()) {
      assert.deepEqual(read[i].map(letters), caption.split('\n').map(letters), `${locale} ${i + 1}: ${JSON.stringify(read[i])}`);
    }
  }
});

test('one size of type for the whole language, made smaller for all when one caption is too wide', async () => {
  for (const locale of Object.keys(made)) {
    assert.equal(new Set(made[locale].pictures.map((p) => p.fontSize)).size, 1, locale);
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

test('a missing screenshot or language is refused, not drawn over', async () => {
  await assert.rejects(compose({ locale: 'en-US', shots: shots.slice(0, 7), out: path.join(TMP, 'x') }), /8 screenshots/);
  await assert.rejects(compose({ locale: 'fr-FR', shots, out: path.join(TMP, 'x') }), /fr-FR/);
});

process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));

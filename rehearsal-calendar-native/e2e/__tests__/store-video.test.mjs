// The App Store's preview video (T-275, made anew by T-285): what
// e2e/store/montage.mjs makes of seven screen recordings and captions.json.
//
// Apple's rules for a preview (App Review 2.3.4): the app as it is on the
// whole screen — a preview with a device frame, or "framing around the video
// screen capture", is refused — and an app that needs signing in says so. So:
// the recording fills the whole 886×1920 frame, its edges and corners too;
// the captions go over it, on a dark band only under the text, white on it at
// least 4.5:1; the closing card says how to sign in. Read back by ffprobe as
// App Store Connect reads it: 886×1920, 30 frames a second, H.264, 20 to 28
// seconds, a silent stereo AAC track at 48 kHz (it refuses one without).
// A preview plays by itself from its first frame: the hook's shot shows the
// Planner with its windows, never the Planner loading — "Loading…", a project
// with no members — under the hook (T-286).
//
// The video is made on a Mac only: its captions are drawn by compose.swift
// (xcrun swiftc, Core Graphics) and read back by macOS's text recognition, its
// recordings come from the simulator. On any other system, GitHub's Linux
// runner among them, the tests that make it are skipped and say why; the
// captions' file and the arithmetic of the cut are checked everywhere. On a Mac
// they run, and a Mac without ffmpeg or Xcode fails them: that machine is
// broken (T-282).
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readPng } from '../ink.mjs';
import { CAPTIONS, LOCALES, readText } from '../store/compose.mjs';
// As a namespace: on the montage before T-285 the tests still run, and fail on what they check.
import * as M from '../store/montage.mjs';

const captions = JSON.parse(fs.readFileSync(CAPTIONS, 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'store-video-'));
/** False on a Mac; elsewhere, why the tests that make the video do not run. */
const MAC_ONLY = process.platform === 'darwin' ? false : 'needs macOS: the captions are drawn by compose.swift, built by xcrun swiftc';

const nbsp = (text) => text.replace(/ /g, ' ');
/** The phrases a line must never break inside. */
const WHOLE = ['12 of 12', '12 из 12', '12 de 12', '12 von 12', 'iPhone-Kalender'];

describe('captions.json for the video', () => {
  for (const locale of LOCALES) {
    test(`${locale}: a hook, seven captions and a sign-in line, within their lengths, broken only where the file breaks them`, () => {
      const { hook, video, signIn } = captions[locale];
      assert.equal(typeof hook, 'string');
      assert.ok(!hook.includes('\n') && hook.length <= 26, `hook ${JSON.stringify(hook)}`);
      assert.equal(typeof signIn, 'string');
      assert.ok(!signIn.includes('\n') && signIn.length <= 48, `signIn ${JSON.stringify(signIn)}`);
      assert.equal(video?.length, 7);
      for (const caption of video) {
        const lines = caption.split('\n');
        assert.ok(lines.length <= 2 && lines.every((l) => l.length > 0 && l.length <= 26), JSON.stringify(caption));
        // "12 of 12" and the like are one, and hold together with no-break spaces.
        for (const phrase of WHOLE) {
          if (nbsp(caption).replace(/\n/g, ' ').includes(phrase)) {
            assert.ok(lines.some((l) => nbsp(l).includes(phrase)), `${phrase} broken in ${JSON.stringify(caption)}`);
            if (/^12 /.test(phrase)) assert.ok(caption.includes(phrase.replace(/ /g, ' ')), `${phrase} without no-break spaces`);
          }
        }
      }
    });
  }
  test('en-GB is en-US', () => {
    const { screenshots: a, ...gb } = captions['en-GB'];
    const { screenshots: b, ...us } = captions['en-US'];
    assert.deepEqual(gb, us);
    assert.ok(a && b);
  });
});

test('the format App Store Connect takes, and eight shots from seven recordings', () => {
  assert.deepEqual(M.VIDEO, { width: 886, height: 1920, fps: 30 });
  assert.equal(M.SHOTS?.length, 8);
  assert.equal(M.RECORDINGS, 7);
  assert.deepEqual(M.SHOTS.map((s) => s.caption), ['hook', 0, 1, 2, 3, 4, 5, 6]);
  assert.ok(M.SHOTS.every((s) => s.length === null || s.length >= M.MIN_CAPTION), 'every caption on screen at least MIN_CAPTION');
  assert.ok(M.SHOTS.every((s) => s.place === 'top' || s.place === 'bottom'));
  assert.equal(M.MAX_SPEEDUP, 2);
  assert.ok(M.HOOK_DARK >= 1 && M.HOOK_DARK < M.SHOTS[0].length);
});

test('stillness is cut to STILL, the flow\'s pauses too', () => {
  const { cuts, length } = M.stillness([0, 1, 2, 3, 4], 5, [{ from: 0.5, to: 1.5 }]);
  const round = (v) => Math.round(v * 100) / 100;
  assert.equal(M.STILL, 0.2);
  assert.deepEqual(cuts.map(({ at, by }) => [at, round(by)]), [[1, 0.8], [2, 1.6], [3, 2.4], [4, 3.2]]);
  assert.equal(round(length), 1.8);
  // A screen that keeps changing is not cut at all.
  assert.deepEqual(M.stillness([0, 0.1, 0.2, 0.3], 0.4), { cuts: [], length: 0.4 });
});

test('the poster frame\'s time code, as App Store Connect writes it', () => {
  assert.equal(M.timeCode(2.5), '00:00:02:15');
  assert.equal(M.timeCode(0), '00:00:00:00');
  assert.equal(M.timeCode(61 + 29 / 30), '00:01:01:29');
});

test('too few recordings, or a missing one, are refused before anything is made', async () => {
  const none = Array.from({ length: 7 }, (_, i) => path.join(TMP, `none-${i + 1}.mp4`));
  await assert.rejects(M.montage({ locale: 'en-US', clips: none.slice(0, 6), out: path.join(TMP, 'refused') }), /7 recordings/);
  await assert.rejects(M.montage({ locale: 'en-US', clips: none, out: path.join(TMP, 'refused') }), /no recording/);
});

/** sRGB's relative luminance of [r, g, b] (0–255). */
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('every language\'s captions as compose.swift draws them', { skip: MAC_ONLY }, () => {
  for (const locale of LOCALES) {
    test(`${locale}: each caption's lines as the file has them, none wider than the frame; the sign-in line at 40 px or more`, () => {
      const dir = fs.mkdtempSync(path.join(TMP, `${locale}-`));
      const words = M.videoCaptions(locale);
      const drawn = M.overlays(words, dir);
      const want = M.SHOTS.map((s) => (s.caption === 'hook' ? words.hook : words.video[s.caption]));
      assert.equal(drawn.overlays.length, 8);
      for (const [k, overlay] of drawn.overlays.entries()) {
        assert.deepEqual(overlay.lines, want[k].split('\n'), `shot ${k}`);
        assert.ok(overlay.widths.every((w) => w <= M.VIDEO.width - 96 + 0.5), `shot ${k}: ${overlay.widths}`);
        assert.equal(overlay.place, M.SHOTS[k].place);
        // The band stays off the frame's edges: there the recording shows, untouched.
        assert.ok(overlay.band.top > 4 && overlay.band.bottom < M.VIDEO.height - 4, JSON.stringify(overlay.band));
      }
      assert.ok(drawn.fontSize >= 40, `type ${drawn.fontSize}`);
      assert.ok(drawn.signIn.fontSize >= 40, `sign-in ${drawn.signIn.fontSize}`);
      // One line, or two where the language's editor said: after the colon, ru after «Нужен вход».
      const lines = drawn.signIn.lines;
      if (lines.length === 2) assert.ok(/:$/.test(lines[0]) || lines[0] === 'Нужен вход', JSON.stringify(lines));
      assert.equal(lines.join(' '), words.signIn);
    });
  }
});

/**
 * A recording as the simulator makes one, H.264, at its 1320×2868: one colour,
 * or `then` for its last `thenFor` seconds.
 */
function recording(file, seconds, rgb, { rate = 60, then, thenFor = 0 } = {}) {
  const hex = (c) => `0x${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const source = (c, d) => `color=c=${hex(c)}:s=1320x2868:r=${rate}:d=${d}`;
  const args = then
    ? ['-f', 'lavfi', '-i', source(rgb, seconds - thenFor), '-f', 'lavfi', '-i', source(then, thenFor), '-filter_complex', '[0:v][1:v]concat=n=2:v=1[v]', '-map', '[v]']
    : ['-f', 'lavfi', '-i', source(rgb, seconds)];
  execFileSync(M.tool('ffmpeg'), ['-v', 'error', '-y', ...args, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file]);
  return file;
}

// The first white: the worst a caption's band can be over.
const COLOURS = [[255, 255, 255], [200, 60, 60], [60, 180, 90], [220, 180, 40], [150, 70, 200], [40, 190, 190], [230, 120, 40]];
const COUNTED = [250, 250, 120];
// The Planner loading, before its windows (the first recording's start): blue,
// which no darkness turns grey — under any of it blue stays above red.
const LOADING = [0, 0, 255];
/** Recording 01: loading this long, then the Planner with its windows; the flow marks it ready this long in. */
const LOADS = 0.8;
const READY = 1.0;

describe('made by ffmpeg, its captions by compose.swift', { skip: MAC_ONLY }, () => {
  const clips = [];
  let made;
  const pixel = (png, x, y) => { const at = (y * png.width + x) * png.channels; return [...png.data.subarray(at, at + 3)]; };
  const near = (got, want, by = 14) => got.every((v, c) => Math.abs(v - want[c]) <= by);
  const frame = (seconds, name) => readPng(M.frameAt(made.file, seconds, path.join(TMP, `${name}.png`)));
  before(async () => {
    // Most shorter than their shots, and held; the fifth longer, and sped up.
    const lengths = [1.5, 2, 1, 2, 6, 1.5, 1.2];
    for (const [i, seconds] of lengths.entries()) clips.push(recording(path.join(TMP, `clip-${i + 1}.mp4`), seconds, COLOURS[i]));
    // The hook's: the Planner loading first, then its windows; the flow's mark
    // beside it, as record.mjs keeps it (01.json).
    clips[0] = recording(path.join(TMP, 'clip-1.mp4'), 2, LOADING, { then: COLOURS[0], thenFor: 2 - LOADS });
    fs.writeFileSync(path.join(TMP, 'clip-1.json'), JSON.stringify({ waits: [], marks: { ready: READY } }));
    // The seen count's: its last half second the count at 12 of 12.
    clips[5] = recording(path.join(TMP, 'clip-6.mp4'), 1.5, COLOURS[5], { then: COUNTED, thenFor: 0.5 });
    made = await M.montage({ locale: 'en-US', clips, out: path.join(TMP, 'out') });
  });

  test('886×1920 at 30 fps, H.264, 20 to 28 seconds, with a silent stereo AAC track at 48 kHz', () => {
    assert.equal(made.file, path.join(TMP, 'out', 'en-US.mp4'));
    const p = M.probe(made.file);
    assert.deepEqual(
      { codec: p.video.codec, width: p.video.width, height: p.video.height, fps: p.video.fps, pixFmt: p.video.pixFmt },
      { codec: 'h264', width: 886, height: 1920, fps: '30/1', pixFmt: 'yuv420p' });
    assert.deepEqual({ codec: p.audio.codec, sampleRate: p.audio.sampleRate, channels: p.audio.channels },
      { codec: 'aac', sampleRate: 48000, channels: 2 });
    assert.ok(p.duration >= 20 && p.duration <= 28, `${p.duration} s`);
    assert.ok(Math.abs(p.duration - made.length) < 0.1, `${p.duration} s for a cut of ${made.length}`);
    const { stderr } = spawnSync(M.tool('ffmpeg'), ['-hide_banner', '-nostats', '-i', made.file, '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-'],
      { encoding: 'utf8' });
    const loudest = /max_volume:\s*(-?[\d.]+|-inf) dB/.exec(stderr)?.[1];
    assert.ok(loudest === '-inf' || Number(loudest) <= -90, `max_volume ${loudest}`);
  });

  test('no frame round the recording: its edges and corners are the recording\'s, in every shot', () => {
    const { width: w, height: h } = M.VIDEO;
    const points = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3], [2, h / 2], [w - 3, h / 2], [w / 2, 2], [w / 2, h - 3], [w / 2, h / 2]];
    for (const [k, shot] of made.shots.entries()) {
      // Mid-shot; the hook's once its darkness has lifted, the last before its card comes.
      const at = k === 0 ? shot.length - 0.15 : k === made.shots.length - 1 ? shot.start + 0.6 : shot.start + shot.length / 2;
      const png = frame(k === 0 ? at : at, `edges-${k}`);
      const want = k === 6 ? COUNTED : COLOURS[[0, 0, 1, 2, 3, 4, 5, 6][k]];
      for (const [x, y] of points) {
        assert.ok(near(pixel(png, x, y), want), `shot ${k} at ${x},${y}: ${pixel(png, x, y)} for the recording's ${want}`);
      }
    }
  });

  test('each caption over its shot as captions.json breaks it, on a band white reads on at 4.5:1 or more', () => {
    const want = ['hook', ...captions['en-US'].video.map((_, i) => i)].map((c) => (c === 'hook' ? captions['en-US'].hook : captions['en-US'].video[c]));
    const letters = (text) => nbsp(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const files = made.shots.map((shot, k) => M.frameAt(made.file, shot.start + shot.length - 0.3, path.join(TMP, `caption-${k}.png`)));
    for (const [k, overlay] of made.overlays.entries()) {
      const [read] = readText([files[k]], { locale: 'en-US', top: overlay.band.top, bottom: overlay.band.bottom });
      assert.deepEqual(read.map(letters), want[k].split('\n').map(letters), `shot ${k}: ${JSON.stringify(read)}`);
    }
    // Over white (shot 1's recording), the band beside the text, where no letter is.
    const { band } = made.overlays[1];
    const png = readPng(files[1]);
    const y = Math.round((band.coreTop + band.coreBottom) / 2);
    const contrast = 1.05 / (luminance(pixel(png, 4, y)) + 0.05);
    assert.ok(contrast >= 4.5, `white on the band over white: ${contrast.toFixed(2)}:1 (${pixel(png, 4, y)})`);
  });

  test('the hook over the Planner darkened, lifting before the poster frame; the hook still on it', () => {
    const dark = frame(0.5, 'hook-dark');
    assert.ok(luminance(pixel(dark, 443, 960)) < 0.25, `${pixel(dark, 443, 960)}`);
    assert.ok(made.poster.seconds > M.HOOK_DARK + 0.5 && made.poster.seconds < made.shots[1].start, `${made.poster.seconds}`);
    assert.equal(made.poster.timeCode, M.timeCode(made.poster.seconds));
    const poster = frame(made.poster.seconds, 'poster');
    assert.ok(near(pixel(poster, 443, 960), COLOURS[0]), `${pixel(poster, 443, 960)}`);
    const [read] = readText([path.join(TMP, 'poster.png')], { locale: 'en-US', top: made.overlays[0].band.top, bottom: made.overlays[0].band.bottom });
    assert.match(read.join(' '), /Tuesday/);
  });

  test('the hook\'s shot shows no frame of the Planner loading, from its very first: only the Planner with its windows', () => {
    // Every frame of shot 0, its middle 2×2 pixels, read in one pass.
    const shot = made.shots[0];
    const raw = execFileSync(M.tool('ffmpeg'), ['-v', 'error', '-i', made.file, '-t', shot.length.toFixed(3),
      '-vf', 'crop=2:2:442:958,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 20 });
    const frames = Array.from({ length: raw.length / 3 }, (_, k) => [...raw.subarray(k * 3, k * 3 + 3)]);
    assert.ok(frames.length >= Math.floor(shot.length * M.VIDEO.fps) - 1, `${frames.length} frames`);
    const loading = frames.map((rgb, k) => ({ at: (k / M.VIDEO.fps).toFixed(3), rgb })).filter(({ rgb: [r, , b] }) => b - r > 12);
    assert.deepEqual(loading.map(({ at, rgb }) => `${at} s ${rgb}`), [], `${loading.length} of shot 0's ${frames.length} frames show the Planner loading`);
  });

  test('a hook\'s recording without its "ready" mark is refused: where the loading ends is not guessed', async () => {
    const unmarked = [...clips];
    unmarked[0] = recording(path.join(TMP, 'unmarked.mp4'), 2, LOADING, { then: COLOURS[0], thenFor: 1 });
    await assert.rejects(M.montage({ locale: 'en-US', clips: unmarked, out: path.join(TMP, 'refused') }), /unmarked\.json: no "ready" mark/);
  });

  test('the seen count\'s caption comes only once the count is at 12 of 12, and stays 2 s', () => {
    const shot = made.shots[6];
    const { band } = made.overlays[6];
    const y = Math.round((band.coreTop + band.coreBottom) / 2);
    const early = frame(shot.start + 0.3, 'seen-early');
    assert.ok(near(pixel(early, 4, y), COLOURS[5]), `no caption before 12 of 12: ${pixel(early, 4, y)}`);
    const late = frame(shot.start + shot.captionAt + 0.1, 'seen-late');
    assert.ok(near(pixel(late, 443, 960), COUNTED), `12 of 12 on screen: ${pixel(late, 443, 960)}`);
    assert.ok(luminance(pixel(late, 4, y)) < 0.25, `the caption's band: ${pixel(late, 4, y)}`);
    assert.ok(shot.length - shot.captionAt >= M.MIN_CAPTION);
  });

  test('the last shot closes on the mark, the name and the sign-in line, held about 3 s', () => {
    const end = made.length - 0.1;
    const png = frame(end, 'end');
    assert.ok(!near(pixel(png, 443, 300), COLOURS[6], 60), `${pixel(png, 443, 300)}`);
    const { top, bottom } = made.signIn;
    const [read] = readText([path.join(TMP, 'end.png')], { locale: 'en-US', top: Math.floor(top - 20), bottom: Math.ceil(bottom + 20) });
    const letters = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    assert.equal(letters(read.join(' ')), letters(captions['en-US'].signIn));
    // The slogan stays on, where it was over the week.
    const { band } = made.overlays[7];
    const [slogan] = readText([path.join(TMP, 'end.png')], { locale: 'en-US', top: band.top, bottom: band.bottom });
    assert.equal(letters(slogan.join(' ')), letters(captions['en-US'].video[6]));
    const card = made.shots[7];
    // From the dissolve's start (the week's 2 s) to the end: about 3 s.
    assert.ok(card.length - 2 >= 2.8 && card.length - 2 <= 3.6, `${card.length}`);
  });

  test('a recording far longer than its shot is refused, not raced through', async () => {
    const long = [...clips];
    long[3] = recording(path.join(TMP, 'long.mp4'), 10, COLOURS[3]);
    await assert.rejects(M.montage({ locale: 'en-US', clips: long, out: path.join(TMP, 'refused') }), /recording 04/);
  });
});

process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));

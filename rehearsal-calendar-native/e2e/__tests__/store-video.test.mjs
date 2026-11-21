// The App Store's preview video (T-275; the storyboard «Свет на главном»,
// T-289): what e2e/store/montage.mjs makes of seven screen recordings, what
// record.mjs kept beside them, and captions.json.
//
// Apple's rules for a preview (App Review 2.3.4): the app as it is on the
// whole screen — a preview with a device frame, or "framing around the video
// screen capture", is refused — and an app that needs signing in says so.
// Read back by ffprobe as App Store Connect reads it: 886×1920, 30 frames a
// second, H.264, 28 to 30 seconds, a silent stereo AAC track at 48 kHz.
//
// The storyboard's: the light falls where the recording's own hierarchy put
// the elements, never by eye; a touch mark is where and when the app said a
// finger went down, and nowhere else; the captions in «Пьеса» with no band
// under them, white and lilac at 4.5:1 or more over white; the hook for the
// day the hook's recording was shot on; 12 of 12's caption on the frame it
// came in; the finale struck through; the closing card with its sign-in line.
//
// The video is made on a Mac only: its layer is drawn by compose.swift (xcrun
// swiftc, Core Graphics) and read back by macOS's text recognition, its
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
// As a namespace: on the montage before T-289 the tests still run, and fail on what they check.
import * as M from '../store/montage.mjs';

const captions = JSON.parse(fs.readFileSync(CAPTIONS, 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'store-video-'));
/** False on a Mac; elsewhere, why the tests that make the video do not run. */
const MAC_ONLY = process.platform === 'darwin' ? false : 'needs macOS: the layer is drawn by compose.swift, built by xcrun swiftc';

const nbsp = (text) => text.replace(/ /g, ' ');
const unmarked = (text) => text.replace(/[[\]]/g, '');
/** The phrases a line must never break inside. */
const WHOLE = ['12 of 12', '12 из 12', '12 de 12', '12 von 12', 'iPhone-Kalender'];
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

describe('captions.json for the video', () => {
  for (const locale of LOCALES) {
    test(`${locale}: a hook for every day, six captions, the finale and a sign-in line, broken only where the file breaks them`, () => {
      const { hookByDay, video, finale, signIn } = captions[locale];
      for (const day of DAYS) {
        const lines = unmarked(hookByDay?.[day] ?? '').split('\n');
        assert.ok(lines.length === 2 && lines.every((l) => l.length > 0 && l.length <= 26), `hookByDay.${day} ${JSON.stringify(hookByDay?.[day])}`);
      }
      // The old slogan is gone: the finale says it (T-289).
      assert.equal(video?.length, 6);
      for (const marked of video) {
        assert.equal((marked.match(/\[/g) ?? []).length, 1, `one main word: ${JSON.stringify(marked)}`);
        const caption = unmarked(marked);
        const lines = caption.split('\n');
        assert.ok(lines.length <= 2 && lines.every((l) => l.length > 0 && l.length <= 26), JSON.stringify(caption));
        // "12 of 12" and the like are one, and hold together with no-break spaces.
        for (const phrase of WHOLE) {
          if (nbsp(caption).replace(/\n/g, ' ').includes(phrase)) {
            assert.ok(lines.some((l) => nbsp(l).includes(phrase)), `${phrase} broken in ${JSON.stringify(caption)}`);
            if (/^12 /.test(phrase)) assert.ok(caption.includes(phrase.replace(/ /g, ' ')), `${phrase} without no-break spaces`);
          }
        }
      }
      // The pencil strikes through a part of the line.
      assert.ok(finale?.line?.includes(finale.struck) && finale.struck.length > 0 && finale.insert, JSON.stringify(finale));
      // ru in one line; the others after their colon, as their editors broke them (T-288).
      const signLines = signIn.split('\n');
      if (locale === 'ru') assert.equal(signLines.length, 1, signIn);
      else assert.ok(signLines.length === 2 && /:$/.test(signLines[0]), signIn);
    });
  }
  test('en-GB is en-US', () => {
    const { screenshots: a, ...gb } = captions['en-GB'];
    const { screenshots: b, ...us } = captions['en-US'];
    assert.deepEqual(gb, us);
    assert.ok(a && b);
  });
});

test('the format App Store Connect takes, and the storyboard: nine shots, 29 s, from seven recordings', () => {
  assert.deepEqual(M.VIDEO, { width: 886, height: 1920, fps: 30 });
  assert.equal(M.SHOTS?.length, 9);
  assert.equal(M.RECORDINGS, 7);
  assert.deepEqual(M.SHOTS.map((s) => s.caption), ['hook', 0, 1, 2, 3, 4, 5, 'finale', undefined]);
  assert.deepEqual(M.SHOTS.map((s) => s.clip), [0, 0, 1, 2, 3, 4, 5, 6, 6]);
  assert.equal(Math.round(M.SHOTS.reduce((sum, s) => sum + s.length, 0) * 100) / 100, 29);
  assert.ok(M.SHOTS.filter((s) => s.caption !== undefined).every((s) => s.length >= M.MIN_CAPTION));
  assert.equal(M.MAX_SPEEDUP, 2);
  assert.equal(M.SHADE, '#04030A');
  assert.equal(M.DIM, 0.62);
});

test('a recording\'s stillness is cut to STILL; what lies between "cut" and "resume" is taken out, but the frame on screen at "resume"', () => {
  const round = (v) => Math.round(v * 1000) / 1000;
  const { frames, length, map } = M.keeping([0, 1, 2, 3, 4], 5);
  assert.deepEqual(frames.map((f) => round(f.shown)), [0, 0.2, 0.4, 0.6, 0.8]);
  assert.equal(round(length), 1);
  // A screen that keeps changing is not cut at all.
  assert.deepEqual(M.keeping([0, 0.1, 0.2, 0.3], 0.4).frames.map((f) => round(f.shown)), [0, 0.1, 0.2, 0.3]);
  // A moment in a gap cut short keeps its distance to the nearer frame.
  assert.equal(round(map(1.95)), 0.35);
  assert.equal(round(map(1.05)), 0.25);
  // From "ready": the frame on screen then, nothing before it.
  const ready = M.keeping([0, 0.5, 0.9, 1.1, 1.2], 1.3, { from: 1.0 });
  assert.deepEqual(ready.frames.map((f) => f.at), [0.9, 1.1, 1.2]);
  assert.equal(ready.map(0.5), null);
  // A span: frames 1.0 and 1.1 dropped, 1.2 — on screen at "resume" (1.25) — kept.
  const cut = M.keeping([0, 0.9, 1.0, 1.1, 1.2, 1.3], 1.4, { spans: [{ from: 0.95, to: 1.25 }] });
  assert.deepEqual(cut.frames.map((f) => f.at), [0, 0.9, 1.2, 1.3]);
  assert.equal(cut.map(1.05), null, 'a touch in what was cut out is no touch of the video');
});

test('the poster frame\'s time code, as App Store Connect writes it', () => {
  assert.equal(M.timeCode(2.5), '00:00:02:15');
  assert.equal(M.timeCode(2.5 - 1 / 30), '00:00:02:14');
  assert.equal(M.timeCode(61 + 29 / 30), '00:01:01:29');
});

test('the hook\'s day is the day it was shot on in the page\'s country', () => {
  // 03:00 UTC on Thursday 19 November 2026: still Wednesday in New York, Thursday in Moscow.
  const at = Date.UTC(2026, 10, 19, 3);
  assert.equal(M.shotOn({ recordedAt: at, zone: 'America/New_York' }), 'wed');
  assert.equal(M.shotOn({ recordedAt: at, zone: 'Europe/Moscow' }), 'thu');
  assert.throws(() => M.shotOn({ file: '01.json' }), /recordedAt/);
  assert.equal(M.videoCaptions('ru', 'thu').hook, captions.ru.hookByDay.thu);
  assert.equal(M.videoCaptions('es-ES', 'sat').hook, captions['es-ES'].hookByDay.sat);
});

test('a hole of light is the elements\' frames as the hierarchy gives them, never placed by eye', () => {
  const el = (identifier, X, Y, Width, Height, extra = {}) => ({ identifier, frame: { X, Y, Width, Height }, children: [], ...extra });
  // As the driver gives it: a frameless root round the app's window and the status bar.
  const tree = { axElement: { identifier: '', frame: { X: 0, Y: 0, Width: 0, Height: 0 }, children: [
    el('', 0, 0, 440, 956, { children: [
      el('planner-row-2026-11-18-09:00', 16, 300, 408, 56), el('planner-row-2026-11-18-12:00', 16, 244, 408, 56),
      el('day-2026-11-26', 284, 268, 52, 52), el('day-2026-11-27', 340, 268, 52, 52),
      el('', 60, 350, 320, 260, { elementType: 7 }), el('planner-row-offscreen', 16, 2000, 408, 56),
      // A strip of weeks, far wider than the screen; a list's content, taller.
      el('calendar-strip', -17687, 193, 35526, 72), el('', 0, 62, 440, 1576),
      el('rehearsal-item-5', 20, 399, 400, 88),
    ] }),
    el('', 0, 0, 440, 54),
  ] } };
  // Topmost first; several joined into one; iOS's alert by its type.
  assert.deepEqual(M.findHoles(tree, 'planner-row-.*#1').holes, [{ x: 16, y: 244, w: 408, h: 56 }]);
  assert.deepEqual(M.findHoles(tree, 'planner-row-.*#1;planner-row-.*#2').holes.map((h) => h.y), [244, 300]);
  assert.deepEqual(M.findHoles(tree, 'day-2026-11-26,day-2026-11-27').holes, [{ x: 284, y: 268, w: 108, h: 52 }]);
  assert.deepEqual(M.findHoles(tree, '@alert').holes, [{ x: 60, y: 350, w: 320, h: 260 }]);
  assert.deepEqual(M.findHoles(tree, '@alert').screen, { width: 440, height: 956 });
  assert.deepEqual(M.findHoles(tree, 'rehearsal-item-5').holes, [{ x: 20, y: 399, w: 400, h: 88 }]);
  // Not on screen: refused.
  assert.throws(() => M.findHoles(tree, 'planner-row-.*#3'), /no planner-row-\.\*#3 on screen/);
  assert.throws(() => M.findHoles(tree, 'mode-selector'), /no mode-selector/);
  // In px of the video: the recording's 1320×2868 (3 px a point) filled into 886×1920.
  const k = 886 / 1320 * 3, offY = (2868 * 886 / 1320 - 1920) / 2;
  const [x, y, w, h, r] = M.holeOf({ x: 16, y: 244, w: 408, h: 56 }, { width: 440, height: 956 }, { width: 1320, height: 2868 });
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  assert.ok(near(x, 16 * k - M.HOLE_PAD) && near(y, 244 * k - offY - M.HOLE_PAD), `${x}, ${y}`);
  assert.ok(near(w, 408 * k + 2 * M.HOLE_PAD) && near(h, 56 * k + 2 * M.HOLE_PAD), `${w}×${h}`);
  assert.ok(r > 0 && r <= h / 2);
});

test('a touch\'s place on the window is the tap Maestro\'s driver logged as the finger went down, at the same x', () => {
  const log = [
    '2026-11-20 12:54:08.871484-1000 maestro-driver-iosUITests-Runner[93636:93215756] Tapping 220.0, 316.0',
    '2026-11-20 12:54:09.429515-1000 maestro-driver-iosUITests-Runner[93636:93215756] Tapping took 0.5404870510101318',
    '2026-11-20 12:54:19.300545-1000 maestro-driver-iosUITests-Runner[93636:93215756] Tapping 315.5, 234.0',
  ].join('\n');
  const taps = M.driverTaps(log);
  assert.deepEqual(taps, [{ at: Date.parse('2026-11-20T22:54:08.871Z'), x: 220, y: 316 }, { at: Date.parse('2026-11-20T22:54:19.300Z'), x: 315.5, y: 234 }]);
  const recordedAt = Date.parse('2026-11-20T22:54:00.000Z');
  const placed = M.placeTouches({ recordedAt, touches: [
    { id: '0', at: 9.2, x: 220, y: 256 },        // 0.33 s into the driver's first tap: the sheet's y is 60 less
    { id: '1', at: 19.6, x: 315.5, y: 174 },     // the second
    { id: '2', at: 30, x: 100, y: 100 },         // no tap of the driver's near it: no place, no mark
    { id: '3', at: 19.5, x: 50, y: 174 },        // another x: not that tap
  ] }, taps);
  assert.deepEqual(placed.map((t) => [t.windowX, t.windowY]), [[220, 316], [315.5, 234], [undefined, undefined], [undefined, undefined]]);
});

/** sRGB's relative luminance of [r, g, b] (0–255). */
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const LILAC = luminance([0xC0, 0x84, 0xFC]);

describe('every language as compose.swift lays it out', { skip: MAC_ONLY }, () => {
  for (const locale of LOCALES) {
    test(`${locale}: the captions in «Пьеса», flush left on the app's margin, one size; the sign-in line at 40 px as the file breaks it`, () => {
      const dir = fs.mkdtempSync(path.join(TMP, `${locale}-`));
      const words = M.videoCaptions(locale, 'tue');
      const laid = M.layout(words, dir);
      assert.ok(laid.fonts.some((f) => /Literata\[/.test(f)) && laid.fonts.some((f) => /Literata-Italic/.test(f)), laid.fonts.join(', '));
      assert.ok(laid.fonts.some((f) => /Caveat/.test(f)) && laid.fonts.some((f) => /InterTight/.test(f)), laid.fonts.join(', '));
      assert.ok(laid.fontSize >= 50 && laid.fontSize <= 70, `type ${laid.fontSize}`);
      assert.ok(laid.hookSize >= 66 && laid.hookSize <= 88, `hook ${laid.hookSize}`);
      for (const c of laid.captions) {
        assert.deepEqual(c.lines, unmarked(c.text).split('\n'), 'broken only where captions.json breaks it');
        assert.ok(c.inks.every((ink) => Math.abs(ink.left - 42) < 0.5 && ink.right <= 886 - 42 + 0.5), JSON.stringify(c.inks));
        assert.equal(c.emphasis.length, 1, `its main word: ${c.text}`);
        assert.ok(c.contrast.white >= 4.5 && c.contrast.lilac >= 4.5, `${c.text}: ${JSON.stringify(c.contrast)}`);
      }
      assert.ok(laid.finale.fontSize >= 66 && laid.finale.fontSize <= 88, `finale ${laid.finale.fontSize}`);
      assert.deepEqual(laid.signIn.lines, words.signIn.split('\n'));
      assert.equal(laid.signIn.fontSize, 40);
      assert.ok(laid.signIn.widths.every((w) => w <= 886 - 84), JSON.stringify(laid.signIn.widths));
    });
  }
});

/**
 * A recording as the simulator makes one, H.264 at its 1320×2868: `parts`, [rgb,
 * seconds] each in turn; `changes` keeps a frame only where the screen changed,
 * as the simulator records.
 */
function recording(file, parts, { changes = false } = {}) {
  const hex = (c) => `0x${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const inputs = parts.flatMap(([rgb, seconds]) => ['-f', 'lavfi', '-i', `color=c=${hex(rgb)}:s=1320x2868:r=60:d=${seconds}`]);
  const join = `${parts.map((_, i) => `[${i}:v]`).join('')}concat=n=${parts.length}:v=1${changes ? ',mpdecimate=hi=1:lo=1:frac=0' : ''}[v]`;
  execFileSync(M.tool('ffmpeg'), ['-v', 'error', '-y', ...inputs, '-filter_complex', join, '-map', '[v]',
    ...(changes ? ['-fps_mode', 'vfr'] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file]);
  return file;
}
/** What record.mjs keeps beside a recording. */
function log(clip, body) {
  fs.writeFileSync(clip.replace(/\.mp4$/, '.json'), JSON.stringify(body));
}

const WHITE = [255, 255, 255], BLACK = [0, 0, 0];
// The Planner loading, before its windows (recording 01's start): blue, which
// no shade turns grey — under any of it blue stays above red.
const LOADING = [0, 0, 255];
const GREY = [128, 128, 128], COUNTED = [250, 250, 120], PULLED = [40, 40, 250];
const SCREEN = { width: 440, height: 956 };
const hole = (name, at, ...frames) => ({ name, at, screen: SCREEN, holes: frames.map(([x, y, w, h]) => ({ x, y, w, h })) });
// Wednesday 18 November 2026, 15:00 in New York.
const WEDNESDAY = Date.UTC(2026, 10, 18, 20);
const shot = { recordedAt: WEDNESDAY, zone: 'America/New_York', waits: [], marks: {}, spans: [], lights: [], touches: [] };
/** The touch the test makes in recording 04, and the swipe beside it, in points. */
// On a sheet the app's y starts below the window's top: the mark goes where
// Maestro's driver tapped on the window (windowX, windowY; placeTouches).
const TAP = { at: 0.6, x: 220, y: 440, windowX: 220, windowY: 500 };

describe('made by ffmpeg, its layer by compose.swift', { skip: MAC_ONLY }, () => {
  const clips = [];
  let made;
  const pixel = (png, x, y) => { const at = (Math.round(y) * png.width + Math.round(x)) * png.channels; return [...png.data.subarray(at, at + 3)]; };
  const near = (got, want, by = 14) => got.every((v, c) => Math.abs(v - want[c]) <= by);
  const frame = (seconds, name) => readPng(M.frameAt(made.file, seconds, path.join(TMP, `${name}.png`)));
  /** The recording's colour under the shade at `dim`. */
  const shaded = (rgb, dim) => rgb.map((v, c) => Math.round(v * (1 - dim) + [4, 3, 10][c] * dim));
  before(async () => {
    const at = (i) => path.join(TMP, `clip-${i + 1}.mp4`);
    // 01: the Planner loading, then its windows; ready at 1.0; the answer and today's card.
    clips.push(recording(at(0), [[LOADING, 0.8], [WHITE, 1.2]]));
    log(clips[0], { ...shot, marks: { ready: 1.0 }, lights: [hole('answer', 1.2, [20, 420, 400, 56]), hole('day', 1.3, [20, 392, 400, 250])] });
    // 02: the month — white, the worst a caption's shadow is over; two days lit
    // (one hole round both, as record.mjs joins them), then the modes.
    clips.push(recording(at(1), [[WHITE, 2]]));
    log(clips[1], { ...shot, lights: [hole('days', 0.05, [280, 400, 120, 50]), hole('modes', 1.4, [20, 560, 400, 70])] });
    // 03: Calendar Sync, white.
    clips.push(recording(at(2), [[WHITE, 1.5]]));
    log(clips[2], { ...shot, lights: [hole('apple', 0.05, [20, 300, 400, 80]), hole('both', 0.8, [20, 300, 400, 80], [20, 180, 400, 70])] });
    // 04: the picker, black: a tap at 0.6 s, and a finger dragged — no tap.
    clips.push(recording(at(3), [[BLACK, 2]]));
    log(clips[3], { ...shot, lights: [hole('pick', 0.05, [8, 200, 424, 46]), hole('done', 0.4, [340, 150, 90, 44]), hole('windows', 1.5, [12, 120, 416, 60])],
      touches: [{ id: '1', ...TAP, screen: SCREEN, upAt: TAP.at + 0.08, upX: TAP.x + 2, upY: TAP.y },
        { id: '2', at: 1.2, x: 220, y: 330, screen: SCREEN, upAt: 1.6, upX: 220, upY: 700 }] });
    // 05: the form, black, no touch at all.
    clips.push(recording(at(4), [[BLACK, 1.5]]));
    log(clips[4], { ...shot, lights: [hole('save', 0.05, [16, 430, 408, 54]), hole('alert', 0.6, [60, 120, 320, 260])] });
    // 06: the count — grey; pulled (cut out); grey; 12 of 12 from 1.0 s, seen by the flow at 1.3 s.
    clips.push(recording(at(5), [[GREY, 0.3], [PULLED, 0.3], [[120, 120, 120], 0.4], [COUNTED, 1.0]], { changes: true }));
    log(clips[5], { ...shot, marks: { counted: 1.3 }, spans: [{ from: 0.3, to: 0.6 }], lights: [hole('card', 0.05, [16, 200, 408, 70])] });
    // 07: the week, black.
    clips.push(recording(at(6), [[BLACK, 1.2]]));
    log(clips[6], { ...shot });
    made = await M.montage({ locale: 'en-US', clips, out: path.join(TMP, 'out') });
  });

  test('886×1920 at 30 fps, H.264, 28 to 30 seconds, with a silent stereo AAC track at 48 kHz', () => {
    assert.equal(made.file, path.join(TMP, 'out', 'en-US.mp4'));
    const p = M.probe(made.file);
    assert.deepEqual(
      { codec: p.video.codec, width: p.video.width, height: p.video.height, fps: p.video.fps, pixFmt: p.video.pixFmt },
      { codec: 'h264', width: 886, height: 1920, fps: '30/1', pixFmt: 'yuv420p' });
    assert.deepEqual({ codec: p.audio.codec, sampleRate: p.audio.sampleRate, channels: p.audio.channels },
      { codec: 'aac', sampleRate: 48000, channels: 2 });
    assert.ok(p.duration >= 28 && p.duration <= 30, `${p.duration} s`);
    const { stderr } = spawnSync(M.tool('ffmpeg'), ['-hide_banner', '-nostats', '-i', made.file, '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-'],
      { encoding: 'utf8' });
    const loudest = /max_volume:\s*(-?[\d.]+|-inf) dB/.exec(stderr)?.[1];
    assert.ok(loudest === '-inf' || Number(loudest) <= -90, `max_volume ${loudest}`);
  });

  test('the hook for the day recording 01 was shot on, typed over the Planner in the shade; its last frame the poster', () => {
    assert.equal(made.day, 'wed');
    assert.equal(made.words.hook, captions['en-US'].hookByDay.wed);
    assert.equal(made.poster.timeCode, '00:00:02:14');
    const poster = frame(made.poster.seconds, 'poster');
    const hook = made.drawn.captions[0];
    const [read] = readText([path.join(TMP, 'poster.png')], { locale: 'en-US', top: Math.floor(hook.box.top - 30), bottom: Math.ceil(hook.box.bottom + 30) });
    assert.match(read.join(' '), /Wednesday/);
    // The answer lit by then, the rest at 0.64.
    const [x, y] = M.toVideo({ width: 1320, height: 2868 }, SCREEN).point(220, 448);
    assert.ok(near(pixel(poster, x, y), WHITE, 20), `the answer: ${pixel(poster, x, y)}`);
    assert.ok(near(pixel(poster, 443, 1500), shaded(WHITE, 0.64), 10), `the rest: ${pixel(poster, 443, 1500)}`);
    const early = frame(0.5, 'hook-early');
    assert.ok(near(pixel(early, 443, 1500), shaded(WHITE, 0.86), 10), `in the shade at first: ${pixel(early, 443, 1500)}`);
    assert.ok(near(pixel(early, x, y), shaded(WHITE, 0.86), 10), `the answer not lit yet: ${pixel(early, x, y)}`);
  });

  test('the hook\'s shot shows no frame of the Planner loading, from its very first: only the Planner with its windows', () => {
    const first = made.shots[0];
    const raw = execFileSync(M.tool('ffmpeg'), ['-v', 'error', '-i', made.file, '-t', first.length.toFixed(3),
      '-vf', 'crop=2:2:870:1850,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 20 });
    const frames = Array.from({ length: raw.length / 3 }, (_, k) => [...raw.subarray(k * 3, k * 3 + 3)]);
    assert.ok(frames.length >= Math.floor(first.length * M.VIDEO.fps) - 1, `${frames.length} frames`);
    const loading = frames.map((rgb, k) => ({ at: (k / M.VIDEO.fps).toFixed(3), rgb })).filter(({ rgb: [r, , b] }) => b - r > 12);
    assert.deepEqual(loading.map(({ at, rgb }) => `${at} s ${rgb}`), [], `${loading.length} of shot 1's ${frames.length} frames show the Planner loading`);
  });

  test('the light falls where the hierarchy put the elements: inside the hole the recording as it is, beside it the shade', () => {
    const month = made.shots[2];
    const lit = made.lights.find((l) => Math.abs(l.t - month.start) < 1e-6);
    const want = M.holeOf({ x: 280, y: 400, w: 120, h: 50 }, SCREEN, { width: 1320, height: 2868 }, { round: true });
    assert.deepEqual(lit.holes.map((h) => h.map((v) => Math.round(v))), [want.map((v) => Math.round(v))]);
    assert.equal(lit.dim, 0.62);
    const png = frame(month.start + 0.5, 'light');
    const [x, y, w, h] = want;
    assert.ok(near(pixel(png, x + w / 2, y + h / 2), WHITE, 6), `in the hole: ${pixel(png, x + w / 2, y + h / 2)}`);
    for (const [px, py] of [[x - 40, y + h / 2], [x + w + 40, y + h / 2], [x + w / 2, y - 40], [x + w / 2, y + h + 40]]) {
      assert.ok(near(pixel(png, px, py), shaded(WHITE, 0.62), 8), `beside it, ${px},${py}: ${pixel(png, px, py)}`);
    }
    // The next light at the moment it was read, moving there.
    const modes = made.lights.find((l) => l.t > month.start + 0.01 && l.t < month.start + month.length);
    assert.ok(Math.abs(modes.t - (month.start + 1.4)) < 0.05, `the modes lit at ${modes.t - month.start} s into the shot`);
    // No frame round the recording: its edges as shaded as its middle.
    for (const [px, py] of [[2, 2], [883, 2], [2, 1917], [883, 1917]]) {
      assert.ok(near(pixel(png, px, py), shaded(WHITE, 0.62), 8), `edge ${px},${py}: ${pixel(png, px, py)}`);
    }
  });

  test('a touch mark where and when the app said the finger went down; none for a finger dragged; none where there was no touch', () => {
    const picker = made.shots[4];
    const marks = made.taps.filter((t) => t.t >= picker.start && t.t < picker.start + picker.length);
    assert.equal(marks.length, 1, JSON.stringify(marks));
    const [x, y] = M.toVideo({ width: 1320, height: 2868 }, SCREEN).point(TAP.windowX, TAP.windowY);
    assert.ok(Math.abs(marks[0].t - (picker.start + TAP.at)) < 1 / 60, `at ${marks[0].t - picker.start} s into the shot`);
    assert.ok(Math.abs(marks[0].x - x) < 0.01 && Math.abs(marks[0].y - y) < 0.01, `at ${marks[0].x}, ${marks[0].y}`);
    // Held at 0.15 s: its white edge 39 px out, white at 30 % inside; a frame before it, nothing.
    const held = frame(marks[0].t + 0.15, 'tap-held');
    assert.ok(luminance(pixel(held, x + 39, y)) > 0.6, `its edge: ${pixel(held, x + 39, y)}`);
    assert.ok(near(pixel(held, x, y), [77, 77, 77], 20), `inside it: ${pixel(held, x, y)}`);
    const before = frame(marks[0].t - 0.1, 'tap-before');
    assert.ok(luminance(pixel(before, x + 39, y)) < 0.01, `before it: ${pixel(before, x + 39, y)}`);
    // The dragged finger's place, while it was down: nothing.
    const [dx, dy] = M.toVideo({ width: 1320, height: 2868 }, SCREEN).point(220, 330);
    const dragged = frame(picker.start + 1.3, 'dragged');
    assert.ok(luminance(pixel(dragged, dx + 39, dy)) < 0.01, `a drag: ${pixel(dragged, dx + 39, dy)}`);
    // The form's recording had no touch: no mark in its shot, nothing bright on it but its caption.
    const form = made.shots[5];
    assert.deepEqual(made.taps.filter((t) => t.t >= form.start && t.t < form.start + form.length), []);
    const png = frame(form.start + 0.3, 'no-touch');
    let brightest = 0;
    for (let py = 40; py < 1300; py += 6) for (let px = 4; px < 882; px += 6) brightest = Math.max(brightest, luminance(pixel(png, px, py)));
    assert.ok(brightest < 0.01, `something bright on a recording with no touch: ${brightest}`);
  });

  test('no band under a caption; white and lilac read at 4.5:1 or more over white where its shadow is weakest', () => {
    const shot = made.shots[1];
    const caption = made.drawn.captions.find((c) => c.start === shot.captionAt);
    const png = frame(shot.start + shot.length - 0.2, 'caption');
    // No band: beside the caption, on its rows, the recording only shaded, as far above and below it.
    const middle = (caption.box.top + caption.box.bottom) / 2;
    const beside = pixel(png, 882, middle), elsewhere = pixel(png, 882, middle - 400);
    assert.ok(near(beside, elsewhere, 6) && near(beside, shaded(WHITE, 0.62), 8), `beside the caption ${beside}, elsewhere ${elsewhere}`);
    for (const { x, y } of caption.samples.slice(0, 2)) {
      const L = luminance(pixel(png, x, y));
      const white = 1.05 / (L + 0.05), lilac = (LILAC + 0.05) / (L + 0.05);
      assert.ok(white >= 4.5 && lilac >= 4.5, `at ${x},${y} ${pixel(png, x, y)}: white ${white.toFixed(2)}:1, lilac ${lilac.toFixed(2)}:1`);
    }
    assert.ok(made.drawn.contrast.white >= 4.5 && made.drawn.contrast.lilac >= 4.5, JSON.stringify(made.drawn.contrast));
    // Its main word in the lilac.
    const [k] = caption.emphasis;
    let lilacSeen = false;
    for (let py = Math.round(k.top); py < k.bottom && !lilacSeen; py += 2) {
      for (let px = Math.round(k.left); px < k.right && !lilacSeen; px += 2) lilacSeen = near(pixel(png, px, py), [0xC0, 0x84, 0xFC], 24);
    }
    assert.ok(lilacSeen, 'no lilac in the main word');
  });

  test('12 of 12\'s caption comes on the frame 12 of 12 came in, and stays 2 s; the pulls to refresh are cut out', () => {
    const seen = made.shots[6];
    const raw = execFileSync(M.tool('ffmpeg'), ['-v', 'error', '-ss', seen.start.toFixed(3), '-i', made.file, '-t', seen.length.toFixed(3),
      '-vf', 'crop=2:2:870:1850,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 20 });
    const colours = Array.from({ length: raw.length / 3 }, (_, k) => [...raw.subarray(k * 3, k * 3 + 3)]);
    const shadedPulled = shaded(PULLED, 0.62), shadedCounted = shaded(COUNTED, 0.62);
    assert.deepEqual(colours.filter((rgb) => near(rgb, shadedPulled, 12)), [], 'a frame of the list pulled');
    const came = colours.findIndex((rgb) => near(rgb, shadedCounted, 12));
    assert.ok(came > 0, 'no 12 of 12');
    assert.ok(Math.abs(seen.start + came / M.VIDEO.fps - seen.captionAt) <= 1 / M.VIDEO.fps + 1e-6,
      `12 of 12 at ${(came / M.VIDEO.fps).toFixed(3)} s, its caption at ${(seen.captionAt - seen.start).toFixed(3)} s`);
    assert.ok(seen.start + seen.length - seen.captionAt >= M.MIN_CAPTION);
  });

  test('the finale: the line, the pencil through its struck part, the word over it', () => {
    const finale = made.shots[7];
    const f = made.drawn.finale;
    const png = frame(finale.start + 2.0, 'finale');
    // The pencil: lilac across the struck part.
    let lilac = 0;
    for (let px = Math.round(f.struck.left); px < f.struck.right; px += 4) {
      for (let py = Math.round(f.inks[0].top); py < f.inks[0].bottom; py += 1) if (near(pixel(png, px, py), [0xC0, 0x84, 0xFC], 30)) { lilac++; break; }
    }
    const columns = Math.floor((f.struck.right - f.struck.left) / 4);
    assert.ok(lilac >= columns * 0.8, `the pencil in ${lilac} of ${columns} columns`);
    const [read] = readText([path.join(TMP, 'finale.png')], { locale: 'en-US', top: Math.floor(f.insert.y - 120), bottom: Math.ceil(f.box.bottom + 20) });
    const letters = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    assert.ok(letters(read.join(' ')).includes(letters(captions['en-US'].finale.insert)), JSON.stringify(read));
  });

  test('the closing card: the mark, the name and the sign-in line, held about 3.5 s after its dissolve', () => {
    const card = made.shots[8];
    assert.ok(card.length - 0.5 >= 2.9 && card.length <= 3.6, `${card.length}`);
    const png = frame(made.length - 0.1, 'end');
    const { top, bottom } = made.drawn.signIn;
    const [read] = readText([path.join(TMP, 'end.png')], { locale: 'en-US', top: Math.floor(top - 20), bottom: Math.ceil(bottom + 20) });
    const letters = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    assert.equal(letters(read.join(' ')), letters(captions['en-US'].signIn));
    assert.equal(made.drawn.signIn.fontSize, 40);
    assert.ok(top > 1920 * 0.8, `the sign-in line at its foot: ${top}`);
    const [name] = readText([path.join(TMP, 'end.png')], { locale: 'en-US', top: Math.floor(made.drawn.card.nameBaseline - 100), bottom: Math.ceil(made.drawn.card.nameBaseline + 30) });
    assert.match(name.join(' '), /Rehearsly/);
    assert.ok(!near(pixel(png, 443, 300), BLACK, 6), 'the card, not the week');
  });

  test('refused before anything is made: too few recordings, a missing one, no "ready", one far too long', async () => {
    const none = Array.from({ length: 7 }, (_, i) => path.join(TMP, `none-${i + 1}.mp4`));
    await assert.rejects(M.montage({ locale: 'en-US', clips: none.slice(0, 6), out: path.join(TMP, 'refused') }), /7 recordings/);
    await assert.rejects(M.montage({ locale: 'en-US', clips: none, out: path.join(TMP, 'refused') }), /no recording/);
    const unmarkedClips = [...clips];
    unmarkedClips[0] = recording(path.join(TMP, 'unmarked.mp4'), [[LOADING, 1], [WHITE, 1]]);
    log(unmarkedClips[0], { ...shot });
    await assert.rejects(M.montage({ locale: 'en-US', clips: unmarkedClips, out: path.join(TMP, 'refused') }), /unmarked\.json: no "ready" mark/);
    // A touch shown with no place on the window: not guessed, refused.
    const unplaced = [...clips];
    unplaced[3] = path.join(TMP, 'unplaced.mp4');
    fs.copyFileSync(clips[3], unplaced[3]);
    const picked = JSON.parse(fs.readFileSync(clips[3].replace(/\.mp4$/, '.json'), 'utf8'));
    log(unplaced[3], { ...picked, touches: picked.touches.map((t) => ({ ...t, windowX: undefined, windowY: undefined })) });
    await assert.rejects(M.montage({ locale: 'en-US', clips: unplaced, out: path.join(TMP, 'refused') }), /no place on the window/);
    const long = [...clips];
    long[3] = recording(path.join(TMP, 'long.mp4'), [[BLACK, 10]]);
    log(long[3], JSON.parse(fs.readFileSync(clips[3].replace(/\.mp4$/, '.json'), 'utf8')));
    await assert.rejects(M.montage({ locale: 'en-US', clips: long, out: path.join(TMP, 'refused') }), /recording 04/);
  });
});

process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));

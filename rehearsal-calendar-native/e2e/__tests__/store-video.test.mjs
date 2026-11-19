// The App Store's preview video (T-275): what e2e/store/montage.mjs makes of
// seven screen recordings and captions.json's `video` captions. Read back by
// ffprobe as App Store Connect reads it: 886×1920, 30 frames a second, H.264,
// 15 to 30 seconds, with a silent stereo AAC track at 48 kHz (it refuses a
// preview without sound). The caption of each shot is in the band at the top,
// broken where captions.json breaks it, read back off the video's own frames;
// the recording is in the window under it, and the last shot closes on the mark.
//
// The video is made on a Mac only: its captions are drawn by compose.swift
// (xcrun swiftc, Core Graphics) and read back by macOS's text recognition, its
// recordings come from the simulator. On any other system, GitHub's Linux
// runner among them, the tests that make it are skipped and say why; the
// arithmetic of the cut runs everywhere. On a Mac they run, and a Mac without
// ffmpeg or Xcode fails them: that machine is broken (T-282).
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readPng } from '../ink.mjs';
import { CAPTIONS, readText } from '../store/compose.mjs';
import { STILL, SLOTS, VIDEO, frameAt, montage, probe, stillness, tool } from '../store/montage.mjs';

const captions = JSON.parse(fs.readFileSync(CAPTIONS, 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'store-video-'));
/** False on a Mac; elsewhere, why the tests that make the video do not run. */
const MAC_ONLY = process.platform === 'darwin' ? false : 'needs macOS: the captions are drawn by compose.swift, built by xcrun swiftc';

/**
 * A recording as the simulator makes one, H.264, `seconds` long, one colour a
 * clip: at half the 1320×2868 the simulator records, which is scaled the same
 * way and makes faster.
 */
function recording(file, seconds, rgb, rate = 60) {
  const colour = `0x${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  execFileSync(tool('ffmpeg'), ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${colour}:s=660x1434:r=${rate}:d=${seconds}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file]);
  return file;
}

const COLOURS = [[40, 120, 200], [200, 60, 60], [60, 180, 90], [220, 180, 40], [150, 70, 200], [40, 190, 190], [230, 120, 40]];

test('the format App Store Connect takes, and seven shots of 15 to 30 seconds in all', () => {
  assert.deepEqual(VIDEO, { width: 886, height: 1920, fps: 30 });
  assert.equal(SLOTS.length, 7);
  const total = SLOTS.reduce((a, b) => a + b, 0);
  assert.ok(total >= 15 && total <= 30, `${total} s`);
});

test('stillness is cut to STILL, the flow\'s own pauses kept whole', () => {
  const { cuts, length } = stillness([0, 1, 2, 3, 4], 5, [{ from: 0.5, to: 1.5 }]);
  const round = (v) => Math.round(v * 100) / 100;
  assert.equal(STILL, 0.2);
  assert.deepEqual(cuts.map(({ at, by }) => [at, round(by)]), [[1, 0.5], [2, 1], [3, 1.8], [4, 2.6]]);
  assert.equal(round(length), 2.4);
  // A screen that keeps changing is not cut at all.
  assert.deepEqual(stillness([0, 0.1, 0.2, 0.3], 0.4, []), { cuts: [], length: 0.4 });
});

test('too few recordings, or a missing one, are refused before anything is made', async () => {
  const none = SLOTS.map((_, i) => path.join(TMP, `none-${i + 1}.mp4`));
  await assert.rejects(montage({ locale: 'en-US', clips: none.slice(0, 6), out: path.join(TMP, 'refused') }), /7 recordings/);
  await assert.rejects(montage({ locale: 'en-US', clips: none, out: path.join(TMP, 'refused') }), /no recording/);
});

describe('made by ffmpeg, its captions by compose.swift', { skip: MAC_ONLY }, () => {
  const clips = [];
  let made;
  before(async () => {
    // Shorter than their shots, most of them, and the fourth longer: held, and sped up.
    const lengths = [1.5, 2, 1, 9, 2.5, 1, 1.2];
    for (const [i, seconds] of lengths.entries()) clips.push(recording(path.join(TMP, `clip-${i + 1}.mp4`), seconds, COLOURS[i]));
    // The second as the simulator records a screen standing still between taps:
    // a frame a second for nine, the flow pausing on purpose for its first three.
    clips[1] = recording(path.join(TMP, 'clip-2.mp4'), 9, COLOURS[1], 1);
    fs.writeFileSync(path.join(TMP, 'clip-2.json'), JSON.stringify({ waits: [{ from: 0, to: 3 }] }));
    made = await montage({ locale: 'en-US', clips, out: path.join(TMP, 'out') });
  });

  test('886×1920 at 30 fps, H.264, 15 to 30 seconds, with a silent stereo AAC track at 48 kHz', () => {
    assert.equal(made.file, path.join(TMP, 'out', 'en-US.mp4'));
    const p = probe(made.file);
    assert.deepEqual(
      { codec: p.video.codec, width: p.video.width, height: p.video.height, fps: p.video.fps, pixFmt: p.video.pixFmt },
      { codec: 'h264', width: 886, height: 1920, fps: '30/1', pixFmt: 'yuv420p' });
    assert.deepEqual({ codec: p.audio.codec, sampleRate: p.audio.sampleRate, channels: p.audio.channels },
      { codec: 'aac', sampleRate: 48000, channels: 2 });
    assert.ok(p.duration >= 15 && p.duration <= 30, `${p.duration} s`);
    assert.ok(Math.abs(p.duration - SLOTS.reduce((a, b) => a + b, 0)) < 0.1, `${p.duration} s for shots of ${SLOTS.join(' + ')}`);
    assert.ok(p.video.duration <= 30 && p.audio.duration <= 30, `video ${p.video.duration} s, audio ${p.audio.duration} s`);
  });

  test('silent: the audio track carries no sound', () => {
    const { stderr } = spawnSync(tool('ffmpeg'), ['-hide_banner', '-nostats', '-i', made.file, '-map', '0:a', '-af', 'volumedetect', '-f', 'null', '-'],
      { encoding: 'utf8' });
    const loudest = /max_volume:\s*(-?[\d.]+|-inf) dB/.exec(stderr)?.[1];
    assert.ok(loudest === '-inf' || Number(loudest) <= -90, `max_volume ${loudest}`);
  });

  test('seven shots, each as long as the storyboard gives it: a short recording held, a long one sped up', () => {
    assert.deepEqual(made.shots.map((s) => s.length), SLOTS);
    assert.ok(Math.abs(made.shots[3].speed - 9 / SLOTS[3]) < 0.02, `${made.shots[3].speed}`);
    assert.ok(made.shots.filter((_, i) => i !== 3).every((s) => s.speed === 1));
    // Nine seconds as recorded, five once the stillness Maestro left is cut: not sped up.
    assert.ok(Math.abs(made.shots[1].recorded - 9) < 0.05 && Math.abs(made.shots[1].kept - 5) < 0.05, JSON.stringify(made.shots[1]));
  });

  test('each shot shows its recording in the window, its caption above it as captions.json breaks it', () => {
    const want = captions['en-US'].video;
    const files = made.shots.map((shot, i) => frameAt(made.file, shot.start + shot.length / 2 - 0.2, path.join(TMP, `frame-${i + 1}.png`)));
    const read = readText(files, { locale: 'en-US', bottom: made.captionBottom });
    const letters = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    for (const [i, caption] of want.entries()) {
      assert.deepEqual(read[i].map(letters), caption.split('\n').map(letters), `${i + 1}: ${JSON.stringify(read[i])}`);
      // The middle of the window is that shot's recording, as far as H.264 keeps a colour.
      const png = readPng(files[i]);
      const { left, top, width, height } = made.hole;
      const x = Math.round(left + width / 2), y = Math.round(top + height / 3);
      const at = (y * png.width + x) * png.channels;
      const got = [...png.data.subarray(at, at + 3)];
      assert.ok(got.every((v, c) => Math.abs(v - COLOURS[i][c]) <= 14), `${i + 1}: ${got} for ${COLOURS[i]}`);
    }
    // Two-line captions too: the last breaks where the file does.
    assert.ok(want[6].includes('\n'));
  });

  test('the window is under the band, whole, and the last shot closes on the mark', () => {
    const { left, top, width, height } = made.hole;
    assert.ok(top > made.captionBottom && top + height <= VIDEO.height && left >= 0 && left + width <= VIDEO.width);
    assert.equal(Math.round(width / height * 100), Math.round(1320 / 2868 * 100));
    const last = SLOTS.reduce((a, b) => a + b, 0) - 0.1;
    const png = readPng(frameAt(made.file, last, path.join(TMP, 'end.png')));
    const at = ((top + height / 2) * png.width + Math.round(left + width / 2)) * png.channels;
    // Not the recording's orange any more: the card is over it.
    const got = [...png.data.subarray(at, at + 3)];
    assert.ok(Math.abs(got[0] - COLOURS[6][0]) > 60, `${got}`);
  });

  test('a recording far longer than its shot is refused, not raced through', async () => {
    const long = [...clips];
    long[0] = recording(path.join(TMP, 'long.mp4'), 10, COLOURS[0]);
    await assert.rejects(montage({ locale: 'en-US', clips: long, out: path.join(TMP, 'refused') }), /shot 1/);
  });
});

process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));

#!/usr/bin/env node
/**
 * The App Store's preview video (T-275; the storyboard «Свет на главном»,
 * T-289) from seven screen recordings:
 *
 *   node e2e/store/montage.mjs [<locale>…] [--preview=<dir>]
 *                       e2e/store/out/clips/<locale>/01.mov…07.mov (record.mjs takes them)
 *                       → e2e/store/out/video/<locale>.mp4
 *
 * record.mjs records and calls this; it runs alone too, on the recordings of
 * an earlier run, when only a caption changed.
 *
 * As App Store Connect takes a preview for the 6.9" display: 886×1920, 30
 * frames a second, H.264 High at 10 Mb/s, and a stereo AAC track at 48 kHz —
 * silent, no music, but there: a preview without a sound track is refused.
 *
 * Apple's rules for a preview (App Review 2.3.4; README "The preview video's
 * rules"): the app as it is on the whole screen — so the recording fills the
 * whole frame, scaled down to it and nothing more (the simulator's 1320×2868
 * is a hair taller: the rest cut evenly off the top and the bottom), with no
 * device frame, window, background, border or shadow round it, and no zoom;
 * shots joined by a cut, or the one dissolve to the closing card.
 *
 * Over the recording, one layer that compose.swift draws frame by frame
 * (`video`), piped straight into ffmpeg:
 * - the light: the screen in a shade (SHADE, `dim` of it), rounded holes with
 *   a soft edge where what matters is — each hole the frame of elements read
 *   from the screen's hierarchy by testID while the recording ran (record.mjs
 *   `/light`), never placed by eye; read again after a tap moved the screen,
 *   so it follows its element; moving to its next place in LIGHT_MOVE;
 * - the touch marks: where and when the app itself said a finger went down
 *   (record.mjs `/touch`, e2e/device/App.js) — none where it said none; a
 *   finger that moved (a list pulled) is no tap and gets none; every one in
 *   the light that has begun by then, or no video is made (touchesOutside);
 * - the captions in «Пьеса», as the screenshots' (T-288): flush left on the
 *   app's margin, no band, the shade denser round the lines, softly;
 * - the hook typed out (captions.json `hookByDay`, the day recording 01 was
 *   shot on in the page's country — the Planner's first card's day);
 * - the finale, struck through in pencil, the right word written over it;
 * - the closing card, dissolving in: the mark, the name, the sign-in line.
 *
 * The recordings are cut to their action: the screen standing still — Maestro
 * looking for its next tap, the flow's own pauses — is cut to STILL; what the
 * flow marked between "cut" and "resume" (a sheet going, a list pulled to
 * refresh) is taken out. A recording still too long for its shot is played
 * faster, up to MAX_SPEEDUP; beyond that it is refused, never raced through:
 * shoot the scene again. One shorter than its shot is held on its last frame.
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTIONS, FONTS, LOCALES, OUT, binary, landingColours } from './compose.mjs';

const STORE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(STORE, '..', '..');
const MARK = path.join(ROOT, 'server', 'public', 'assets', 'mark.png');

/** The preview's frame, as App Store Connect asks for the 6.9" and 6.7" displays. */
export const VIDEO = { width: 886, height: 1920, fps: 30 };

/** The recordings a preview is cut from (video.yaml's seven). */
export const RECORDINGS = 7;

/** How much faster than it was recorded a shot may be played. */
export const MAX_SPEEDUP = 2;

/** The screen kept still this long at most. */
export const STILL = 0.2;

/** No caption is on screen for less. */
export const MIN_CAPTION = 2;

/** The shade over what is not lit, and how dense it is unless a shot says otherwise. */
export const SHADE = '#04030A';
export const DIM = 0.62;

/** A hole of light: this much room round the elements' frames, and its corners' radius, in px of the video. */
export const HOLE_PAD = 8;
const HOLE_RADIUS = 28;

/** A hole moves to its next place in this long (compose.swift lightMove). */
export const LIGHT_MOVE = 0.3;

/** A finger that moved more than this many points went somewhere: no tap, no mark. */
export const SWIPE = 10;

/** A caption comes this long into its shot (the seen count's at 12 of 12). */
const CAPTION_AT = 0.12;

/** The one dissolve, into the closing card. */
const DISSOLVE = 0.5;

/**
 * The storyboard «Свет на главном» (T-289; README "The storyboard"): nine
 * shots, 29 s. For each its recording (0-based), its length, its caption
 * (`hook`, `finale`, or captions.json's `video` index) and the caption's
 * centre, of the frame's height; its light: in order, the holes recorded under
 * `name` (record.mjs `/light`) — at the moment they were read, or `at` seconds
 * into the shot; read again under the same name, moving there — and the
 * shade's `dim`. A shot's first light is there from its first frame; the next
 * move to their place, whole by the tap on them. `still`: the stillness kept in its
 * recording (the seen count's numbers stay a moment each).
 */
export const SHOTS = [
  { clip: 0, length: 2.5, caption: 'hook', centre: 0.24, hook: true,            // the Planner in the shade; the hook typed; the answer lit
    light: [{ at: 0, dim: 0.86 }, { at: 1.6, name: 'answer', dim: 0.64 }] },
  { clip: 0, length: 2.5, caption: 0, centre: 0.79, light: [{ at: 0, name: 'day', move: true }] }, // today's card
  { clip: 1, length: 3, caption: 1, centre: 0.13, light: [{ name: 'days', round: true }, { name: 'modes' }] }, // two days, Busy
  { clip: 2, length: 2.5, caption: 2, centre: 0.63, light: [{ name: 'apple' }, { name: 'both' }] }, // the iPhone's calendar, sync on
  { clip: 3, length: 3.5, caption: 3, centre: 0.82, light: [{ name: 'pick' }, { name: 'done', round: true }, { name: 'windows' }] }, // three; Done; weighed again
  // Save; the conflict. The button's spinner turns under the alert, so the
  // screen is never still: the recording ends a second after the alert was read.
  { clip: 4, length: 3.5, caption: 4, centre: 0.80, light: [{ name: 'save', dim: 0.82 }, { name: 'alert', dim: 0.6, radius: 52 }],
    until: { light: 'alert', after: 1.0 } },
  { clip: 5, length: 5, caption: 5, centre: 0.74, seen: true, still: 0.5, light: [{ name: 'card' }] }, // the count to 12 of 12
  { clip: 6, length: 3, caption: 'finale', centre: 0.47, light: [{ at: 0, dim: 0.8 }] }, // the week; the finale
  { clip: 6, length: 3.5, card: true },                                          // the closing card
];

/** ffmpeg and ffprobe: on PATH, or where Homebrew puts them. */
export function tool(name) {
  const dirs = [...(process.env.PATH ?? '').split(path.delimiter), '/opt/homebrew/bin', '/usr/local/bin'];
  for (const dir of dirs) {
    const file = path.join(dir, name);
    if (dir && fs.existsSync(file)) return file;
  }
  throw new Error(`${name} is not installed (brew install ffmpeg)`);
}

/** What ffprobe says of a file: its length, its video stream and its audio stream. */
export function probe(file) {
  const out = JSON.parse(execFileSync(tool('ffprobe'), ['-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,codec_name,profile,width,height,r_frame_rate,avg_frame_rate,pix_fmt,sample_rate,channels,duration',
    '-of', 'json', file], { encoding: 'utf8' }));
  const video = out.streams.find((s) => s.codec_type === 'video');
  const audio = out.streams.find((s) => s.codec_type === 'audio');
  return {
    duration: Number(out.format.duration),
    video: video && { codec: video.codec_name, profile: video.profile, width: video.width, height: video.height,
      fps: video.r_frame_rate, avgFps: video.avg_frame_rate, pixFmt: video.pix_fmt, duration: Number(video.duration) },
    audio: audio && { codec: audio.codec_name, sampleRate: Number(audio.sample_rate), channels: audio.channels,
      duration: Number(audio.duration) },
  };
}

/** The frame of `file` at `seconds`, as a PNG at `png`. */
export function frameAt(file, seconds, png) {
  execFileSync(tool('ffmpeg'), ['-v', 'error', '-y', '-ss', String(Math.max(0, seconds)), '-i', file, '-frames:v', '1', png]);
  return png;
}

/**
 * Which of a recording's frames are kept, and when each is shown. The
 * simulator records a frame only when the screen changes, so a gap between
 * `times` (the frames', in seconds from the first) is the screen standing
 * still; each gap is kept `still` long at most. Frames before `from` are
 * dropped but the one on screen then (the hook's recording starts on the
 * Planner with its windows, readyAt), and within each of `spans` ({ from, to },
 * the flow's "cut" and "resume") all but the one on screen at its end. Returns
 * { frames: [{ index, at, shown }] — kept frames, `at` in the recording, `shown`
 * in the kept time — length, map(t) } where map gives a moment of the recording
 * in the kept time, or null where it was cut out (before `from`, in a span).
 */
export function keeping(times, duration, { from = 0, spans = [], still = STILL } = {}) {
  const last = (t) => times.findLastIndex((v) => v <= t + 1e-6);
  const first = Math.max(0, last(from));
  const dropped = new Set();
  for (const span of spans) {
    const end = last(span.to);
    for (let i = first; i < end; i++) if (times[i] >= span.from - 1e-6) dropped.add(i);
  }
  const frames = [];
  for (let i = first; i < times.length; i++) {
    if (dropped.has(i)) continue;
    const prev = frames.at(-1);
    frames.push({ index: i, at: times[i], shown: prev ? prev.shown + Math.min(times[i] - prev.at, still) : 0 });
  }
  const end = frames.at(-1);
  const length = end.shown + Math.min(Math.max(0, duration - end.at), still);
  const map = (t) => {
    if (t < times[first] - 1e-6 && t < from) return null;
    if (spans.some((s) => t >= s.from - 1e-6 && t < s.to)) return null;
    const p = frames.findLast((f) => f.at <= t + 1e-6) ?? frames[0];
    const n = frames.find((f) => f.at > t + 1e-6);
    const d1 = Math.max(0, t - p.at);
    if (!n) return Math.min(length, p.shown + Math.min(d1, still));
    const d2 = n.at - t, half = (n.shown - p.shown) / 2;
    // In a gap cut short, a moment keeps its distance to the nearer frame, up
    // to the gap's middle: so a moment later in the recording is never earlier
    // in the video — a light read early in a still gap stays before the tap
    // that ends it (T-289: the picker's Done was lit after it was tapped).
    return d2 < d1 ? n.shown - Math.min(d2, half) : p.shown + Math.min(d1, half);
  };
  return { frames, length, map };
}

/** A recording's log, as record.mjs keeps it beside it: its marks, spans, lights, touches and when it was shot. */
function logOf(clip) {
  const file = clip.replace(/\.[^./]+$/, '.json');
  return fs.existsSync(file) ? { file, ...JSON.parse(fs.readFileSync(file, 'utf8')) } : { file };
}

/**
 * When the Planner had its windows on screen in the hook's recording, in
 * seconds of the recording: the flow marks it once Maestro sees them (video.yaml
 * `mark ready`). Before it the Planner is loading — "Loading…", a project with
 * no members, "Analyzing availability…" — which no shot shows (T-286).
 */
function readyAt(log) {
  const ready = log.marks?.ready;
  if (!Number.isFinite(ready)) {
    throw new Error(`${log.file}: no "ready" mark, when the Planner showed its windows; record the scene again (record.mjs)`);
  }
  return ready;
}

/** The times of a recording's frames, in seconds from its first, in order. */
function frameTimes(clip) {
  const out = execFileSync(tool('ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time',
    '-of', 'csv=p=0', clip], { encoding: 'utf8' });
  const times = out.split('\n').filter((line) => line.trim()).map(Number).filter(Number.isFinite).sort((x, y) => x - y);
  return times.map((t) => t - times[0]);
}

/** The day of the week a recording was shot on, in its page's country: `mon`…`sun`. */
export function shotOn(log) {
  if (!Number.isFinite(log.recordedAt) || typeof log.zone !== 'string') {
    throw new Error(`${log.file}: not when and where it was shot (recordedAt, zone); record it again (record.mjs)`);
  }
  const day = new Intl.DateTimeFormat('en-US', { timeZone: log.zone, weekday: 'short' }).format(new Date(log.recordedAt));
  return day.slice(0, 3).toLowerCase();
}

/**
 * The screen's elements matching `spec` in a hierarchy as Maestro's driver
 * gives it (record.mjs `/light`): holes separated by ";", each the frames of
 * its elements separated by "," joined into one. An element is a testID — a
 * regular expression matched whole against `identifier`, `#n` the nth from
 * the top when several match — or `@alert`, iOS's own alert, which has none.
 * Returns { screen: { width, height }, holes: [{ x, y, w, h }] } in points.
 * An element not on screen is an error: the light is never placed by eye.
 */
export function findHoles(tree, spec) {
  const root = tree?.axElement ?? tree;
  const frameOf = (e) => {
    const f = e?.frame ?? {};
    return { x: Number(f.X ?? f.x), y: Number(f.Y ?? f.y), w: Number(f.Width ?? f.width), h: Number(f.Height ?? f.height) };
  };
  const all = [];
  const walk = (e) => { all.push(e); for (const c of e.children ?? []) walk(c); };
  walk(root);
  // The screen: the app's window, the largest frame from the top left corner —
  // the root is a frameless wrapper round it and the status bar, and a strip
  // of weeks can be far wider than the screen.
  const screen = all.map(frameOf).filter((f) => f.x === 0 && f.y === 0 && f.w > 0 && f.h > 0).sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (!screen) throw new Error('the hierarchy has no screen');
  const onScreen = (f) => f.w > 0 && f.h > 0 && f.x < screen.w && f.y < screen.h && f.x + f.w > 0 && f.y + f.h > 0;
  const pick = (token) => {
    let found;
    let nth = 1;
    if (token === '@alert') {
      found = all.filter((e) => Number(e.elementType) === 7);
    } else {
      const [, pattern, n] = /^(.*?)(?:#(\d+))?$/.exec(token);
      nth = Number(n ?? 1);
      const re = new RegExp(`^(?:${pattern})$`);
      found = all.filter((e) => typeof e.identifier === 'string' && re.test(e.identifier));
    }
    const frames = [];
    for (const f of found.map(frameOf).filter(onScreen)) {
      if (!frames.some((g) => g.x === f.x && g.y === f.y && g.w === f.w && g.h === f.h)) frames.push(f);
    }
    frames.sort((a, b) => a.y - b.y || a.x - b.x);
    const frame = frames[nth - 1];
    if (!frame) throw new Error(`no ${token} on screen (${frames.length} found)`);
    return frame;
  };
  const holes = spec.split(';').filter(Boolean).map((group) => {
    const frames = group.split(',').filter(Boolean).map(pick);
    const x = Math.min(...frames.map((f) => f.x)), y = Math.min(...frames.map((f) => f.y));
    return { x, y, w: Math.max(...frames.map((f) => f.x + f.w)) - x, h: Math.max(...frames.map((f) => f.y + f.h)) - y };
  });
  if (holes.length < 1 || holes.length > 2) throw new Error(`one or two holes of light, not ${holes.length}: ${spec}`);
  return { screen: { width: screen.w, height: screen.h }, holes };
}

/**
 * Maestro's own taps, as its iOS driver logs them ("Tapping 220.0, 316.0"):
 * [{ at (ms since the epoch), x, y }], in points of the window. The app's own
 * report of a touch (e2e/device/App.js) is in its root view's points, and on a
 * sheet iOS presents (a stack screen shown modally) that root starts below
 * the window's top: there the app's y is not the screen's.
 */
export function driverTaps(log) {
  const taps = [];
  for (const m of log.matchAll(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d\.\d{3})\d*([+-]\d\d)(\d\d) .*\bTapping (-?[\d.]+), (-?[\d.]+)\s*$/gm)) {
    taps.push({ at: Date.parse(`${m[1]}T${m[2]}${m[3]}:${m[4]}`), x: Number(m[5]), y: Number(m[6]) });
  }
  return taps;
}

/**
 * Each of a recording's touches with where on the window it was: the tap
 * Maestro's driver made just before the app felt it go down (the driver logs
 * a tap as it starts it; the finger is down within it), at the same x — a
 * sheet moves the app's y, never its x. A touch with none is left without:
 * montage.mjs draws no mark for it.
 */
export function placeTouches(recording, taps) {
  return (recording.touches ?? []).map((touch) => {
    const down = recording.recordedAt + touch.at * 1000;
    const tap = taps.filter((t) => t.at <= down + 100 && t.at >= down - 1500 && Math.abs(t.x - touch.x) <= 3).at(-1);
    return tap ? { ...touch, windowX: tap.x, windowY: tap.y } : touch;
  });
}

/**
 * From points of the screen (a `screen` as the app or the hierarchy gave it)
 * to px of the video: the recording at its `size` filled into the frame, as
 * the cut does it — scaled to cover, the rest cut evenly off.
 */
export function toVideo(size, screen) {
  const { width: W, height: H } = VIDEO;
  const s = Math.max(W / size.width, H / size.height);
  const offX = (size.width * s - W) / 2, offY = (size.height * s - H) / 2;
  const k = (size.width / screen.width) * s;
  return { point: (x, y) => [x * k - offX, y * k - offY], scale: k };
}

/** A hole of light in px of the video, from a frame in points: [x, y, w, h, radius]. */
export function holeOf(frame, screen, size, { round = false, radius = HOLE_RADIUS } = {}) {
  const v = toVideo(size, screen);
  const [x, y] = v.point(frame.x, frame.y);
  const w = frame.w * v.scale + 2 * HOLE_PAD, h = frame.h * v.scale + 2 * HOLE_PAD;
  return [x - HOLE_PAD, y - HOLE_PAD, w, h, round ? Math.min(w, h) / 2 : Math.min(radius, w / 2, h / 2)];
}

/** Whether (x, y) is in a hole [x, y, w, h, radius] — its rounded rectangle, the soft edge not counted. */
function inHole([hx, hy, hw, hh, hr], x, y) {
  const r = Math.min(hr, hw / 2, hh / 2);
  const qx = Math.abs(x - (hx + hw / 2)) - (hw / 2 - r), qy = Math.abs(y - (hy + hh / 2)) - (hh / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r <= 0;
}

/**
 * The touch marks outside the light that has begun by their time: the last
 * light keyframe at or before a mark (`lights`, `taps` in the video's time and
 * px) has no hole round it. In the storyboard every tap is on a lit element,
 * so one outside is the light left where the element was (T-289, 21.11: the
 * month pushed down under its two days' holes) or lit after the tap.
 */
export function touchesOutside(lights, taps) {
  const inOrder = [...lights].sort((a, b) => a.t - b.t);
  return taps.filter((tap) => {
    const light = inOrder.filter((l) => l.t <= tap.t + 1e-6).at(-1);
    return light !== undefined && !light.holes.some((h) => inHole(h, tap.x, tap.y));
  });
}

/** App Store Connect's time code of a frame (previewFrameTimeCode): hours:minutes:seconds:frames at VIDEO.fps. */
export function timeCode(seconds) {
  const frames = Math.round(seconds * VIDEO.fps);
  const pad = (v) => String(v).padStart(2, '0');
  const s = Math.floor(frames / VIDEO.fps);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(frames % VIDEO.fps)}`;
}

/**
 * A locale's words for the video, their main words in [brackets] (compose.swift
 * sets them apart): the hook for `day` (captions.json `hookByDay`), the six
 * captions, the finale ({ line, struck, insert }) and the sign-in line.
 */
export function videoCaptions(locale, day, captionsFile = CAPTIONS) {
  const all = JSON.parse(fs.readFileSync(captionsFile, 'utf8'))[locale];
  const hook = all?.hookByDay?.[day];
  if (!hook) throw new Error(`${captionsFile} has no hook for ${locale} on ${day} (hookByDay)`);
  if (!all.signIn || all.video?.length !== 6) throw new Error(`${captionsFile} needs six video captions and a signIn for ${locale}`);
  const { line, struck, insert } = all.finale ?? {};
  if (!line || !struck || !insert || !line.includes(struck)) {
    throw new Error(`${captionsFile}: ${locale}'s finale needs a line, the part of it struck through and the word written over it`);
  }
  return { hook, video: all.video, finale: { line, struck, insert }, signIn: all.signIn };
}

/**
 * How each recording goes into its shots: which frames, shown when, how fast;
 * each shot's start and length; when its caption comes; and, in the video's
 * time and px, its lights and touch marks — all from what record.mjs kept.
 */
function plan(clips) {
  const recordings = clips.map((clip, r) => {
    const probed = probe(clip);
    const v = probed.video;
    let duration = probed.duration;
    let times = frameTimes(clip);
    const log = logOf(clip);
    const mine = SHOTS.filter((s) => s.clip === r);
    // A recording that ends where its shot's `until` says: a light read, and a moment after.
    const until = mine.find((s) => s.until)?.until;
    let end = null;
    if (until) {
      const read = (log.lights ?? []).find((l) => l.name === until.light);
      if (!read) throw new Error(`${log.file}: no light "${until.light}" (video.yaml); record the scene again`);
      end = read.at + until.after;
      duration = Math.min(duration, end);
      times = times.filter((t) => t <= end);
    }
    const from = mine.some((s) => s.hook) ? readyAt(log) : 0;
    const still = mine.find((s) => s.still)?.still ?? STILL;
    const kept = keeping(times, duration, { from, spans: log.spans ?? [], still });
    const budget = mine.reduce((sum, s) => sum + s.length, 0);
    let speed = Math.max(1, kept.length / budget);
    let counted = null;
    const seen = mine.find((s) => s.seen);
    if (seen) {
      // The count's caption comes on the frame 12 of 12 came in: the last one
      // recorded at or before the flow saw it (video.yaml `mark counted`).
      const at = log.marks?.counted;
      if (!Number.isFinite(at)) throw new Error(`${log.file}: no "counted" mark, when 12 of 12 was on screen; record the scene again`);
      counted = kept.frames.findLast((f) => f.at <= at + 1e-6)?.shown ?? 0;
      speed = Math.max(1, counted / (seen.length - MIN_CAPTION));
    }
    const label = `recording ${String(r + 1).padStart(2, '0')} (shot ${mine.map((s) => SHOTS.indexOf(s) + 1).join('–')})`;
    if (speed > MAX_SPEEDUP) {
      throw new Error(`${label}: ${kept.length.toFixed(1)} s with its stillness cut (${duration.toFixed(1)} s as recorded) `
        + `for ${budget.toFixed(1)} s — more than ${MAX_SPEEDUP}× faster would race it; shoot the scene again with less in it (${clip})`);
    }
    return { clip, log, duration, end, size: { width: v.width, height: v.height }, times, kept, speed, counted, budget };
  });

  let start = 0;
  const shots = SHOTS.map((s, k) => {
    const shot = { ...s, index: k, start, end: start + s.length };
    start += s.length;
    return shot;
  });
  const total = start;
  // Where each recording starts in the video, and a moment of it there.
  for (const [r, rec] of recordings.entries()) rec.start = shots.find((s) => s.clip === r).start;
  const when = (rec, t) => {
    const k = rec.kept.map(t);
    return k === null ? null : rec.start + k / rec.speed;
  };

  // A moment of a recording in the video; one in what was cut out, where the cut ends.
  const whenShown = (rec, t) => when(rec, t) ?? when(rec, (rec.log.spans ?? []).find((s) => t >= s.from - 1e-6 && t < s.to)?.to ?? t);

  // The touch marks: when the app said a finger went down and came up near
  // where it went down, where on the window Maestro's driver put it
  // (placeTouches) — in a shot, outside what was cut out.
  const taps = [];
  for (const [r, rec] of recordings.entries()) {
    const span = shots.filter((s) => s.clip === r && !s.card);
    const from = span[0].start, to = span.at(-1).end;
    for (const touch of rec.log.touches ?? []) {
      const moved = Math.hypot((touch.upX ?? touch.x) - touch.x, (touch.upY ?? touch.y) - touch.y);
      if (moved > SWIPE) continue;
      const t = when(rec, touch.at);
      if (t === null || t < from || t >= to) continue;
      if (!Number.isFinite(touch.windowX) || !Number.isFinite(touch.windowY)) {
        throw new Error(`${rec.log.file}: a touch at ${touch.at.toFixed(2)} s with no place on the window (windowX, windowY: record.mjs `
          + 'takes it from Maestro\'s driver); record the scene again');
      }
      const [x, y] = toVideo(rec.size, touch.screen).point(touch.windowX, touch.windowY);
      taps.push({ t, x, y, file: rec.log.file, at: touch.at });
    }
  }
  taps.sort((a, b) => a.t - b.t);

  // The light: keyframes in the video's time. Each light of a shot is every
  // reading the flow made of it (record.mjs `/light`, the same name again
  // after a tap moved the screen): the first where the shot says, each next
  // one a move to where its elements then were — a hole follows its element.
  const lights = [];
  for (const shot of shots) {
    if (shot.card) continue;
    const rec = recordings[shot.clip];
    const mine = [];
    for (const [i, l] of (shot.light ?? []).entries()) {
      const reads = l.name ? (rec.log.lights ?? []).filter((x) => x.name === l.name) : [null];
      if (!reads.length) throw new Error(`${rec.log.file}: no light "${l.name}" (video.yaml); record the scene again`);
      for (const [j, read] of reads.entries()) {
        const holes = read ? read.holes.map((f) => holeOf(f, read.screen, rec.size, l)) : [];
        let t = shot.start + (l.at ?? 0);
        // Moved to when it was read; the shot's very first is there on its first frame.
        if (read && (j > 0 || (l.at === undefined && i > 0))) t = Math.min(shot.end - LIGHT_MOVE, Math.max(shot.start, whenShown(rec, read.at)));
        // A shot's first light is there on its first frame — a cut changes the screen at once; the rest move.
        mine.push({ name: l.name, t, holes, dim: l.dim ?? DIM, instant: i === 0 && j === 0 && !l.move, read: read?.at });
      }
    }
    mine.sort((a, b) => a.t - b.t);
    // The light on an element is whole when the finger comes down on it: a
    // move ends by the first tap in its holes, if the tap before that one —
    // in the holes before — and the previous move allow (T-289, 21.11: the
    // flow reads Done a moment before tapping it).
    const inShot = taps.filter((tap) => tap.t >= shot.start && tap.t < shot.end);
    for (const [k, light] of mine.entries()) {
      if (k === 0 || light.instant) continue;
      const target = inShot.find((tap) => tap.t >= light.t - 1e-6 && light.holes.some((h) => inHole(h, tap.x, tap.y)));
      if (!target) continue;
      const before = inShot.filter((tap) => tap.t < target.t - 1e-6).at(-1);
      // Never before a cut it was read after, or in: the screen changed there.
      const cut = (rec.log.spans ?? []).filter((s) => light.read !== undefined && s.from <= light.read).map((s) => whenShown(rec, s.to));
      const least = Math.max(shot.start, mine[k - 1].t + 0.01, before ? before.t + 0.05 : -Infinity, ...cut);
      light.t = Math.max(least, Math.min(light.t, target.t - LIGHT_MOVE));
    }
    lights.push(...mine);
  }

  // Every tap of the storyboard is on a lit element: one outside the light
  // that has begun by then is a light gone wrong, and no video is made of it.
  const astray = touchesOutside(lights, taps);
  if (astray.length) {
    throw new Error(astray.map((tap) => `${tap.file}: a touch at ${tap.at.toFixed(2)} s (${tap.t.toFixed(2)} s of the video, `
      + `${Math.round(tap.x)}, ${Math.round(tap.y)} px) outside the light that has begun`).join('; ')
      + ' — read the light again where its element is (video.yaml) and record the scene again');
  }

  for (const shot of shots) {
    if (shot.card || shot.caption === undefined) continue;
    const rec = recordings[shot.clip];
    shot.captionAt = shot.seen ? rec.start + rec.counted / rec.speed : shot.start + (shot.hook ? 0 : CAPTION_AT);
    if (shot.end - shot.captionAt < MIN_CAPTION - 1e-6) throw new Error(`shot ${shot.index + 1}: its caption would be on screen under ${MIN_CAPTION} s`);
  }
  return { recordings, shots, lights, taps, length: total };
}

/** setpts's expression: each kept frame at its time in the kept recording, played `speed` times faster. */
function timing({ kept, speed }) {
  const t = '(PTS-STARTPTS)*TB';
  let less = '0', by = 0;
  for (const f of kept.frames) {
    const next = f.at - f.shown;
    if (Math.abs(next - by) > 1e-4) {
      less += `+gte(${t}\\,${(f.at - 0.0005).toFixed(4)})*${(next - by).toFixed(4)}`;
      by = next;
    }
  }
  return `(${t}-(${less}))/${speed}/TB`;
}

/**
 * select's expression: the kept frames, by their times; none after where a
 * shot's `until` ends the recording. (Not the container's duration otherwise:
 * a recording of frames only where the screen changed can say it is shorter
 * than its last frame's time.)
 */
function selection({ kept, times, end }) {
  return `${end === null ? '' : `lt(t\\,${(end + 0.0005).toFixed(4)})*`}${dropped({ kept, times })}`;
}
function dropped({ kept, times }) {
  const keep = new Set(kept.frames.map((f) => f.index));
  const out = [];
  // Runs of dropped frames, as time ranges.
  for (let i = 0; i < times.length; i++) {
    if (keep.has(i)) continue;
    let j = i;
    while (j + 1 < times.length && !keep.has(j + 1)) j++;
    out.push(`between(t\\,${(times[i] - 0.0005).toFixed(4)}\\,${(times[j] + 0.0005).toFixed(4)})`);
    i = j;
  }
  return out.length ? `not(${out.join('+')})` : '1';
}

/** The caption's words for a shot. */
const captionOf = (shot, words) => (shot.caption === 'hook' ? words.hook : words.video[shot.caption]);

/**
 * Cuts `locale`'s preview from `clips` (seven recordings, in video.yaml's
 * order) into `out`/<locale>.mp4. Returns { file, length, day, words, shots:
 * [{ index, start, length, captionAt, speed }], lights, taps (in the video's
 * time and px), drawn (what compose.swift laid out: the captions' lines and
 * boxes, their shadows' contrast, the finale, the sign-in line), poster: {
 * seconds, timeCode } }.
 */
export async function montage({ locale, clips, out = path.join(OUT, 'video'), captionsFile = CAPTIONS }) {
  if (clips.length !== RECORDINGS) throw new Error(`${RECORDINGS} recordings are needed: ${clips.length} for ${locale}`);
  for (const clip of clips) if (!fs.existsSync(clip)) throw new Error(`no recording ${clip}`);
  const day = shotOn(logOf(clips[0]));
  const words = videoCaptions(locale, day, captionsFile);
  const { recordings, shots, lights, taps, length: total } = plan(clips);
  const { width: W, height: H, fps } = VIDEO;
  const frames = Math.round(total * fps);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'store-video-'));
  try {
    const manifest = path.join(work, 'drawn.json');
    const finale = shots.find((s) => s.caption === 'finale');
    const card = shots.find((s) => s.card);
    const job = path.join(work, 'video.json');
    fs.writeFileSync(job, JSON.stringify({
      width: W, height: H, fps, frames, manifest,
      fonts: { roman: FONTS.play, italic: FONTS.playItalic, hand: FONTS.hand, brand: FONTS.brand },
      colours: landingColours(), shade: SHADE, mark: MARK, name: 'Rehearsly',
      lights, taps,
      captions: shots.filter((s) => s.captionAt !== undefined && s.caption !== 'finale')
        .map((s) => ({ kind: s.hook ? 'typed' : 'play', text: captionOf(s, words), start: s.captionAt, end: s.end, centre: s.centre })),
      finale: { ...words.finale, start: finale.start, end: card.start + DISSOLVE, centre: finale.centre },
      card: { start: card.start, dissolve: DISSOLVE, signIn: words.signIn },
    }));

    const graph = [];
    for (const [r, rec] of recordings.entries()) {
      const mine = shots.filter((s) => s.clip === r);
      const length = mine.reduce((sum, s) => sum + s.length, 0);
      // The kept frames, timed anew at 30; the whole frame filled, scaled down
      // to it, the rest cut evenly off top and bottom; held past its end.
      graph.push(`[${r}:v]select='${selection(rec)}',setpts=${timing(rec)},fps=${fps},`
        + `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1,`
        + `tpad=stop_mode=clone:stop_duration=${length.toFixed(3)},trim=duration=${length.toFixed(3)},setpts=PTS-STARTPTS[r${r}]`);
    }
    const overlayInput = RECORDINGS, audioInput = RECORDINGS + 1;
    graph.push(`${recordings.map((_, r) => `[r${r}]`).join('')}concat=n=${RECORDINGS}:v=1:a=0,setsar=1[base]`);
    // The layer compose.swift draws, over every frame. Its alpha straight, not
    // premultiplied: a straight blend in YUV is the same as in RGB, while
    // premultiplied YUV made the shade denser than it is (84 for 99 over white).
    graph.push(`[base][${overlayInput}:v]overlay=0:0:eof_action=repeat,format=yuv420p[video]`);

    fs.mkdirSync(out, { recursive: true });
    const file = path.join(out, `${locale}.mp4`);
    const args = ['-v', 'error', '-y', ...clips.flatMap((clip) => ['-i', clip]),
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(fps), '-i', 'pipe:0',
      '-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-filter_complex', graph.join(';'), '-map', '[video]', '-map', `${audioInput}:a`,
      '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p', '-r', String(fps),
      '-b:v', '10M', '-maxrate', '12M', '-bufsize', '20M',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
      '-t', total.toFixed(3), '-movflags', '+faststart', file];
    // compose.swift's frames straight into ffmpeg: a pipe, never 6 GB on disk.
    const drawer = spawn(binary(), ['video', job], { stdio: ['ignore', 'pipe', 'inherit'] });
    const encoder = spawn(tool('ffmpeg'), args, { stdio: [drawer.stdout, 'inherit', 'inherit'] });
    const done = (child, name) => new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => (code === 0 ? resolve() : reject(new Error(`${name} ended ${code ?? signal}`))));
    });
    await Promise.all([done(drawer, 'compose.swift video'), done(encoder, 'ffmpeg')]);
    const drawn = JSON.parse(fs.readFileSync(manifest, 'utf8'));

    // The poster frame: the hook's shot's last frame — the answer lit, the hook typed.
    const hookShot = shots.find((s) => s.hook);
    const poster = (Math.round(hookShot.end * fps) - 1) / fps;
    return {
      file, length: total, day, words, drawn, lights, taps,
      poster: { seconds: poster, timeCode: timeCode(poster) },
      shots: shots.map(({ index, start, length, captionAt, clip }) => ({ index, start, length, captionAt, speed: recordings[clip].speed,
        recorded: recordings[clip].duration, kept: recordings[clip].kept.length })),
    };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/**
 * How compose.swift lays out a locale's words (`videoCaptions`), drawing no
 * frame: the type's sizes, each caption's lines and boxes, the finale, the
 * sign-in line. On the storyboard's places, under its shade with no light.
 */
export function layout(words, dir) {
  const manifest = path.join(dir, 'laid.json');
  const job = path.join(dir, 'laid-job.json');
  const at = (k) => SHOTS.slice(0, k).reduce((sum, s) => sum + s.length, 0);
  const finale = SHOTS.findIndex((s) => s.caption === 'finale'), card = SHOTS.findIndex((s) => s.card);
  fs.writeFileSync(job, JSON.stringify({
    width: VIDEO.width, height: VIDEO.height, fps: VIDEO.fps, frames: 0, manifest,
    fonts: { roman: FONTS.play, italic: FONTS.playItalic, hand: FONTS.hand, brand: FONTS.brand },
    colours: landingColours(), shade: SHADE, mark: MARK, name: 'Rehearsly',
    lights: [{ t: 0, holes: [], dim: DIM, instant: true }], taps: [],
    captions: SHOTS.map((s, k) => ({ s, k })).filter(({ s }) => s.caption !== undefined && s.caption !== 'finale')
      .map(({ s, k }) => ({ kind: s.hook ? 'typed' : 'play', text: captionOf(s, words), start: at(k), end: at(k + 1), centre: s.centre })),
    finale: { ...words.finale, start: at(finale), end: at(card) + DISSOLVE, centre: SHOTS[finale].centre },
    card: { start: at(card), dissolve: DISSOLVE, signIn: words.signIn },
  }));
  execFileSync(binary(), ['video', job], { stdio: ['ignore', 'ignore', 'inherit'] });
  return JSON.parse(fs.readFileSync(manifest, 'utf8'));
}

/** A locale's recordings, as record.mjs keeps them. */
export const clipsOf = (locale) => Array.from({ length: RECORDINGS }, (_, i) => path.join(OUT, 'clips', locale, `${String(i + 1).padStart(2, '0')}.mov`));

/**
 * The frames to look at of a made preview (T-289): the hook typing, the poster
 * frame, a touch mark in the month, 12 of 12 with its caption, the finale, the
 * closing card — { name, at } in seconds.
 */
export function looks(made) {
  const month = made.shots[2], seen = made.shots[6], finale = made.shots[7], card = made.shots[8];
  const taps = made.taps.filter((t) => t.t >= month.start && t.t < month.start + month.length);
  // The second day pressed, its hole where the month pushed it, before the modes are lit (T-289, 21.11).
  const modes = made.lights.find((l) => l.name === 'modes' && l.t >= month.start);
  const second = taps[1] ? Math.min(taps[1].t + 0.15, (modes?.t ?? Infinity) - 0.02) : month.start + 1.4;
  return [
    { name: 'hook', at: 1.0 },
    { name: 'poster', at: made.poster.seconds },
    { name: 'tap', at: taps[0] ? taps[0].t + 0.12 : month.start + 0.8 },
    { name: 'second-day', at: second },
    // Each caption, risen, a moment before its shot ends.
    ...[1, 2, 3, 4, 5].map((k) => ({ name: `caption-${k + 1}`, at: made.shots[k].start + made.shots[k].length - 0.25 })),
    { name: 'counted', at: Math.min(seen.start + seen.length - 0.1, seen.captionAt + 0.8) },
    { name: 'finale', at: finale.start + 2.0 },
    { name: 'card', at: card.start + 1.5 },
  ];
}

/**
 * The frames of a made preview (`looks`), each a PNG in `dir`/<locale>/ and
 * all six in one picture, `dir`/<locale>.png, 960 px tall — small enough for
 * git, never the video itself.
 */
export function preview(locale, dir, made) {
  const own = path.join(dir, locale);
  fs.mkdirSync(own, { recursive: true });
  const shots = looks(made).map(({ name, at }) => {
    const full = frameAt(made.file, at, path.join(own, `${name}-full.png`));
    const small = path.join(own, `${at.toFixed(2).replace('.', '_')}s-${name}.png`);
    execFileSync(binary(), ['sheet', small, '960', landingColours().background, full]);
    fs.rmSync(full);
    return small;
  });
  const sheet = path.join(dir, `${locale}.png`);
  execFileSync(binary(), ['sheet', sheet, '960', landingColours().background, ...shots]);
  return sheet;
}

/** What ffprobe says of a made video, in one line for the report. */
export function describe(file) {
  const { duration, video: v, audio: a } = probe(file);
  return `${path.basename(file)}: ${duration.toFixed(2)} s; video ${v.codec} ${v.profile} ${v.width}×${v.height} ${v.fps} fps ${v.pixFmt}; `
    + `audio ${a.codec} ${a.sampleRate} Hz ${a.channels} ch`;
}

/** The report's lines for a made preview: its shots, their lights and touches, the poster frame. */
export function report(locale, made) {
  const { drawn } = made;
  return [
    `${locale}: ${made.length.toFixed(2)} s, shot on ${made.day}; captions ${drawn.fontSize} px, hook ${drawn.hookSize} px, `
      + `finale ${drawn.finale.fontSize} px; sign-in ${drawn.signIn.fontSize} px in ${drawn.signIn.lines.length} line(s); `
      + `worst contrast over white: text ${drawn.contrast.white.toFixed(2)}:1, lilac ${drawn.contrast.lilac.toFixed(2)}:1; `
      + `the app's white round the captions at most ${Math.max(...[...drawn.captions, drawn.finale].map((c) => c.under)).toFixed(1)} of 255`,
    ...made.shots.map((s) => {
      const taps = made.taps.filter((t) => t.t >= s.start && t.t < s.start + s.length);
      const lights = made.lights.filter((l) => l.t >= s.start - 1e-6 && l.t < s.start + s.length);
      return `${locale}: shot ${s.index + 1} ${s.start.toFixed(2)}–${(s.start + s.length).toFixed(2)} s`
        + `${s.captionAt !== undefined ? `, caption from ${s.captionAt.toFixed(2)} s` : ''}`
        + `, light ${lights.map((l) => `${l.t.toFixed(2)} s ${l.name ?? 'none'} ${l.holes.length} hole(s) shade ${l.dim}`).join(' / ') || '—'}`
        + `, touches ${taps.map((t) => `${t.t.toFixed(2)} s (${Math.round(t.x)}, ${Math.round(t.y)})`).join(' ') || '—'}`
        + `; ${s.recorded.toFixed(1)} s recorded → ${s.kept.toFixed(1)} s kept, ×${s.speed.toFixed(2)}`;
    }),
    `${locale}: poster frame ${made.poster.timeCode} (${made.poster.seconds.toFixed(3)} s)`,
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const previewDir = process.argv.find((arg) => arg.startsWith('--preview='))?.slice('--preview='.length);
  const named = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  for (const locale of named.length ? named : LOCALES) {
    const made = await montage({ locale, clips: clipsOf(locale) });
    console.log(`[store] ${describe(made.file)}`);
    for (const line of report(locale, made)) console.log(`[store] ${line}`);
    if (previewDir) console.log(`[store] ${locale}: preview ${preview(locale, previewDir, made)}`);
  }
}

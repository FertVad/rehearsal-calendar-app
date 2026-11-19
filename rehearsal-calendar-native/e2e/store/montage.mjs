#!/usr/bin/env node
/**
 * The App Store's preview video (T-275) from seven screen recordings:
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
 * silent, but there: a preview without sound is refused. 29.8 s, under the 30
 * it allows. The storyboard's seven shots (SLOTS), one recording each, cut
 * together; each shot in the screenshots' look (compose.swift `card`): the
 * landing's background and glow, its caption in the band at the top as
 * captions.json's `video` breaks it, SF Pro, one size of type for the
 * language, and the recording in the window under it, its corners rounded.
 * The last shot closes on the landing's mark and the app's name.
 *
 * A recording shorter than its shot is held on its last frame; a longer one is
 * played faster to fit, up to MAX_SPEEDUP — beyond that the flow is too slow
 * for the shot and the recording is refused, never raced through.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTIONS, LOCALES, OUT, binary, landingColours } from './compose.mjs';

const STORE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(STORE, '..', '..');
const FONT = '/System/Library/Fonts/SFNS.ttf';
const MARK = path.join(ROOT, 'server', 'public', 'assets', 'mark.png');

/** The preview's frame, as App Store Connect asks for the 6.9" and 6.7" displays. */
export const VIDEO = { width: 886, height: 1920, fps: 30 };

/**
 * The storyboard's shots, in seconds: the Planner filling (the cover), busy
 * days marked, Calendar Sync on, three people picked, the form's conflicts and
 * save, the seen count to 12 of 12, the week and the mark. 29.8 in all.
 */
export const SLOTS = [3, 5, 4, 6, 5, 4, 2.8];

/** How much faster than it was recorded a shot may be played. */
export const MAX_SPEEDUP = 2;

/** The closing card fades in this long before the end, over half a second. */
const END_CARD = 1.4;

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

/** compose.swift's overlays for `captions`: one a shot, and the closing card. */
function cards(captions, dir) {
  const job = path.join(dir, 'card.json');
  fs.writeFileSync(job, JSON.stringify({
    captions, width: VIDEO.width, height: VIDEO.height, dir, font: FONT, colours: landingColours(), mark: MARK, name: 'Rehearsly',
  }));
  return JSON.parse(execFileSync(binary(), ['card', job], { encoding: 'utf8', maxBuffer: 1 << 24 }));
}

/** The screen kept still this long at most, but where the flow paused on purpose. */
export const STILL = 0.2;

/**
 * Where a recording is cut shorter, and how long it is then. The simulator
 * records a frame only when the screen changes, so a gap between `times` (the
 * frames', in seconds from the first) is the screen standing still: while
 * Maestro looks for what to tap next, one to three seconds a tap. Each gap is
 * kept as long as the flow's own pauses in it (`waits`, the recorder's
 * [{ from, to }]) and at least STILL; the rest of it is cut. Returns
 * { cuts: [{ at, by }] — from the frame at `at` on, `by` seconds earlier,
 * cumulative — and length, the recording's length after the cuts }.
 */
export function stillness(times, duration, waits = []) {
  const cuts = [];
  let cut = 0;
  for (let i = 1; i < times.length; i++) {
    const [a, b] = [times[i - 1], times[i]];
    if (b - a <= STILL) continue;
    const paused = waits.reduce((sum, w) => sum + Math.max(0, Math.min(b, w.to) - Math.max(a, w.from)), 0);
    const keep = Math.max(STILL, paused);
    if (b - a - keep > 0.01) {
      cut += b - a - keep;
      cuts.push({ at: b, by: cut });
    }
  }
  return { cuts, length: duration - cut };
}

/** The times of a recording's frames, in seconds from its first, in order. */
function frameTimes(clip) {
  const out = execFileSync(tool('ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time',
    '-of', 'csv=p=0', clip], { encoding: 'utf8' });
  const times = out.split('\n').filter((line) => line.trim()).map(Number).filter(Number.isFinite).sort((x, y) => x - y);
  return times.map((t) => t - times[0]);
}

/** The flow's pauses in a recording, as record.mjs wrote them beside it (none for a recording without). */
function waitsOf(clip) {
  const file = clip.replace(/\.[^.]+$/, '.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).waits ?? [] : [];
}

/** How each recording goes into its shot: where it starts, how long, what is cut, how much faster. */
function fit(clips) {
  let start = 0;
  return clips.map((clip, i) => {
    const recorded = probe(clip).duration;
    const { cuts, length: kept } = stillness(frameTimes(clip), recorded, waitsOf(clip));
    const length = SLOTS[i];
    const speed = kept > length ? kept / length : 1;
    if (speed > MAX_SPEEDUP) {
      throw new Error(`shot ${i + 1}: the recording is ${kept.toFixed(1)} s with its stillness cut (${recorded.toFixed(1)} s as `
        + `recorded) and its shot ${length} s — more than ${MAX_SPEEDUP}× faster would race it; take less into the shot (${clip})`);
    }
    const shot = { start, length, speed, recorded, kept, cuts };
    start += length;
    return shot;
  });
}

/** setpts's expression: the frame's time from the first, less the stillness cut before it, played `speed` times faster. */
function timing({ cuts, speed }) {
  const t = '(PTS-STARTPTS)*TB';
  // Cumulative: the last cut at or before the frame says by how much.
  let less = '0';
  for (const [i, { at, by }] of cuts.entries()) {
    const step = by - (i ? cuts[i - 1].by : 0);
    less += `+gte(${t}\\,${(at - 0.0005).toFixed(4)})*${step.toFixed(4)}`;
  }
  return `(${t}-(${less}))/${speed}/TB`;
}

/**
 * Cuts `locale`'s preview from `clips` (seven recordings, in the storyboard's
 * order) into `out`/<locale>.mp4. Returns { file, shots: [{ start, length,
 * speed, recorded }], hole: the recording's window in px, captionBottom, fontSize }.
 */
export async function montage({ locale, clips, out = path.join(OUT, 'video'), captionsFile = CAPTIONS }) {
  const captions = JSON.parse(fs.readFileSync(captionsFile, 'utf8'))[locale]?.video;
  if (!captions) throw new Error(`${captionsFile} has no video captions for ${locale}`);
  if (captions.length !== SLOTS.length || clips.length !== SLOTS.length) {
    throw new Error(`${SLOTS.length} recordings are needed, and ${SLOTS.length} captions: ${clips.length} and ${captions.length} for ${locale}`);
  }
  for (const clip of clips) if (!fs.existsSync(clip)) throw new Error(`no recording ${clip}`);
  const shots = fit(clips);
  const total = SLOTS.reduce((a, b) => a + b, 0);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'store-video-'));
  try {
    const drawn = cards(captions, work);
    const { left, top, width, height } = drawn.hole;
    const background = `0x${landingColours().background.replace('#', '')}`;
    const n = SLOTS.length;
    const inputs = [
      ...clips.flatMap((clip) => ['-i', clip]),
      // Each overlay one picture, held over its shot; the closing card a
      // stream as long as the last shot, to fade in.
      ...drawn.overlays.flatMap((png) => ['-i', png]),
      '-loop', '1', '-framerate', String(VIDEO.fps), '-t', String(SLOTS[n - 1]), '-i', drawn.end,
      '-f', 'lavfi', '-t', String(total), '-i', `anullsrc=channel_layout=stereo:sample_rate=48000`,
    ];
    const graph = shots.map((shot, i) => { const { length } = shot; return [
      // The simulator records only the frames that change: its stillness
      // shortened, then timed anew, at 30.
      `[${i}:v]setpts=${timing(shot)},fps=${VIDEO.fps},scale=${width}:${height}:flags=lanczos,setsar=1,`
        + `tpad=stop_mode=clone:stop_duration=${length},trim=duration=${length},setpts=PTS-STARTPTS,`
        + `pad=${VIDEO.width}:${VIDEO.height}:${left}:${top}:color=${background}[rec${i}]`,
      `[rec${i}][${n + i}:v]overlay=0:0:eof_action=repeat,format=yuv420p[shot${i}]`,
    ].join(';'); });
    // The last shot: the card fades in over it.
    const last = n - 1;
    graph[last] = graph[last].replace(`[shot${last}]`, `[pre${last}]`)
      + `;[${2 * n}:v]format=rgba,fade=t=in:st=${(SLOTS[last] - END_CARD).toFixed(2)}:d=0.5:alpha=1[card]`
      + `;[pre${last}][card]overlay=0:0:shortest=1,format=yuv420p[shot${last}]`;
    const filter = `${graph.join(';')};${shots.map((_, i) => `[shot${i}]`).join('')}concat=n=${n}:v=1:a=0,setsar=1[video]`;

    fs.mkdirSync(out, { recursive: true });
    const file = path.join(out, `${locale}.mp4`);
    execFileSync(tool('ffmpeg'), ['-v', 'error', '-y', ...inputs, '-filter_complex', filter,
      '-map', '[video]', '-map', `${2 * n + 1}:a`,
      '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p', '-r', String(VIDEO.fps),
      '-b:v', '10M', '-maxrate', '12M', '-bufsize', '20M',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
      '-t', String(total), '-movflags', '+faststart', file], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 600000 });
    return { file, shots, hole: drawn.hole, captionBottom: drawn.captionBottom, fontSize: drawn.fontSize };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** A locale's recordings, as record.mjs keeps them. */
export const clipsOf = (locale) => SLOTS.map((_, i) => path.join(OUT, 'clips', locale, `${String(i + 1).padStart(2, '0')}.mov`));

/**
 * A locale's preview in one picture, `dir`/<locale>.png: a frame of each shot,
 * a quarter second before its end — what the shot came to — the last one the
 * closing card, 600 px tall, side by side —
 * small enough for git, never the video itself.
 */
export function preview(locale, dir, file = path.join(OUT, 'video', `${locale}.mp4`)) {
  fs.mkdirSync(dir, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'store-poster-'));
  try {
    let start = 0;
    const frames = SLOTS.map((length, i) => {
      const at = i === SLOTS.length - 1 ? start + length - 0.1 : start + length - 0.25;
      start += length;
      return frameAt(file, at, path.join(work, `${i + 1}.png`));
    });
    const sheet = path.join(dir, `${locale}.png`);
    execFileSync(binary(), ['sheet', sheet, '600', landingColours().background, ...frames]);
    return sheet;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** What ffprobe says of a made video, in one line for the report. */
export function describe(file) {
  const { duration, video: v, audio: a } = probe(file);
  return `${path.basename(file)}: ${duration.toFixed(2)} s; video ${v.codec} ${v.profile} ${v.width}×${v.height} ${v.fps} fps ${v.pixFmt}; `
    + `audio ${a.codec} ${a.sampleRate} Hz ${a.channels} ch`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const previewDir = process.argv.find((arg) => arg.startsWith('--preview='))?.slice('--preview='.length);
  const named = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  for (const locale of named.length ? named : LOCALES) {
    const made = await montage({ locale, clips: clipsOf(locale) });
    console.log(`[store] ${describe(made.file)}`);
    console.log(`[store] ${locale}: shots ${made.shots.map((s) => `${s.recorded.toFixed(1)}→${s.length}s`).join(', ')}`);
    if (previewDir) console.log(`[store] ${locale}: preview ${preview(locale, previewDir, made.file)}`);
  }
}

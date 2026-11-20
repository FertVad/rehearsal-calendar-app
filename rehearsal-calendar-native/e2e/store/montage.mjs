#!/usr/bin/env node
/**
 * The App Store's preview video (T-275, made anew by T-285) from seven screen
 * recordings:
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
 * shots joined by a cut, or a dissolve to the closing card. The captions go
 * over the recording (compose.swift `video`). And the app needs signing in,
 * which the closing card says.
 *
 * The storyboard (SHOTS), eight shots from seven recordings: the hook over the
 * Planner with its windows, darkened, the darkness lifting after HOOK_DARK —
 * never the Planner loading under it (readyAt); the Planner's windows; a
 * week marked; Calendar Sync; three picked; the form's conflict; the seen
 * count to 12 of 12 — its caption only once it is there; the week, then the
 * mark, the name, the slogan and the sign-in line.
 *
 * The recordings are cut to their action: the screen standing still — Maestro
 * looking for its next tap, the flow's own pauses — is cut to STILL. A
 * recording still too long for its shot is played faster, up to MAX_SPEEDUP;
 * beyond that it is refused, never raced through: shoot the scene again.
 * One shorter than its shot is held on its last frame.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTIONS, FONTS, LOCALES, OUT, binary, landingColours, plain } from './compose.mjs';

const STORE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(STORE, '..', '..');
/** The repository's Inter Tight, never the system's SF Pro (T-288); T-289 sets the video as the screenshots are. */
const FONT = FONTS.brand;
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

/** The hook's shot: the Planner, its windows there, held darkened this long, then lifted over DISSOLVE. */
export const HOOK_DARK = 1.5;
const DISSOLVE = 0.5;

/** The seen count's shot: the recording played in this long at most, its caption held this long after. */
const SEEN_PLAY = 2.2;
const SEEN_HOLD = 2.2;

/** The last shot: the week this long, then the closing card dissolves in and stays to the end. */
const WEEK = 2.0;

/**
 * The storyboard: for each shot its recording (0-based), its caption (`hook`,
 * or captions.json's `video` index), how long it is, and where its caption
 * goes — the top or the bottom, whichever keeps the band and the text off what
 * the caption is about (README "Where each caption goes"). The seen count's
 * length is what its recording takes, plus SEEN_HOLD (`seen`).
 */
export const SHOTS = [
  { clip: 0, caption: 'hook', length: 2.6, place: 'bottom', hook: true }, // the Planner with its windows, darkened; the darkness lifts
  { clip: 0, caption: 0, length: 2.4, place: 'bottom' },                  // the Planner's windows (title and first windows at the top)
  { clip: 1, caption: 1, length: 3.0, place: 'top' },                     // the month: the days marked are in the middle, the sheet and Save at the bottom
  { clip: 2, caption: 2, length: 2.4, place: 'bottom' },                  // Calendar Sync: all of it in the top half
  { clip: 3, caption: 3, length: 3.4, place: 'bottom' },                  // three picked: "3 of 12" in the upper third
  { clip: 4, caption: 4, length: 3.7, place: 'bottom' },                  // the form's conflict alert: its title and who cannot, mid-screen
  { clip: 5, caption: 5, length: null, place: 'bottom', seen: true },     // the seen count, under the week strip, near the middle
  { clip: 6, caption: 6, length: WEEK + 3.3, place: 'bottom', end: true },// the week strip at the top; then the closing card
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
 * Where a recording is cut shorter, and how long it is then. The simulator
 * records a frame only when the screen changes, so a gap between `times` (the
 * frames', in seconds from the first) is the screen standing still: Maestro
 * looking for what to tap next, or the flow pausing. Each gap is kept STILL
 * long; the rest of it is cut. Returns { cuts: [{ at, by }] — from the frame
 * at `at` on, `by` seconds earlier, cumulative — and length, the recording's
 * length after the cuts }.
 */
export function stillness(times, duration) {
  const cuts = [];
  let cut = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap - STILL > 0.01) {
      cut += gap - STILL;
      cuts.push({ at: times[i], by: cut });
    }
  }
  return { cuts, length: duration - cut };
}

/**
 * When the Planner had its windows on screen in the hook's recording, in
 * seconds of the recording: the flow marks it once Maestro sees them (video.yaml
 * `mark ready`, kept by record.mjs beside the recording as 01.json `marks`).
 * Before it the Planner is loading — "Loading…", a project with no members,
 * "Analyzing availability…" — which no shot shows (T-286).
 */
function readyAt(clip) {
  const file = clip.replace(/\.[^./]+$/, '.json');
  const ready = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).marks?.ready : undefined;
  if (!Number.isFinite(ready)) {
    throw new Error(`${file}: no "ready" mark, when the Planner showed its windows; record the scene again (record.mjs)`);
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

/**
 * How each recording goes into its shots: from where (the hook's recording
 * from the Planner with its windows — readyAt — never the Planner loading),
 * held how long first, how fast, and each shot's start, length and the moment
 * its caption comes.
 */
function plan(clips) {
  const recordings = clips.map((clip, r) => {
    const recorded = probe(clip).duration;
    const times = frameTimes(clip);
    const { cuts, length: kept } = stillness(times, recorded);
    const shots = SHOTS.filter((s) => s.clip === r);
    const hook = shots.some((s) => s.hook);
    // The hook's recording starts on the frame on screen when the Planner was
    // ready — the last recorded at or before it, as the simulator records a
    // frame only when the screen changes — in the recording's time once its
    // stillness is cut.
    let from = 0;
    if (hook) {
      const ready = readyAt(clip);
      const at = times[Math.max(0, times.findLastIndex((t) => t <= ready))];
      from = at - (cuts.findLast((c) => c.at <= at)?.by ?? 0);
    }
    const hold = hook ? HOOK_DARK : 0;
    const seen = shots.some((s) => s.seen);
    const end = shots.some((s) => s.end);
    const budget = seen ? SEEN_PLAY : end ? WEEK : shots.reduce((sum, s) => sum + s.length, 0) - hold;
    const speed = Math.max(1, (kept - from) / budget);
    const numbers = shots.map((s) => SHOTS.indexOf(s) + 1).join('–');
    if (speed > MAX_SPEEDUP) {
      throw new Error(`recording ${String(r + 1).padStart(2, '0')} (shot ${numbers}): ${(kept - from).toFixed(1)} s with its stillness cut `
        + `(${recorded.toFixed(1)} s as recorded) for ${budget.toFixed(1)} s — more than ${MAX_SPEEDUP}× faster would race it; `
        + `shoot the scene again with less in it (${clip})`);
    }
    return { clip, recorded, kept, cuts, from, hold, speed, played: (kept - from) / speed };
  });
  let start = 0;
  const shots = SHOTS.map((s, k) => {
    const rec = recordings[s.clip];
    // The seen count's caption comes when its recording has played out: the flow waits for 12/12 and stops (video.yaml, shot 6).
    const length = s.seen ? rec.played + SEEN_HOLD : s.length;
    const captionAt = s.seen ? rec.played : 0;
    const shot = { ...s, index: k, start, length, captionAt, caption: s.caption, speed: rec.speed, recorded: rec.recorded, kept: rec.kept };
    start += length;
    return shot;
  });
  for (const shot of shots) {
    if (shot.length - shot.captionAt < MIN_CAPTION - 1e-6) throw new Error(`shot ${shot.index + 1}: its caption would be on screen under ${MIN_CAPTION} s`);
  }
  return { recordings, shots, length: start };
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

/** App Store Connect's time code of a frame (previewFrameTimeCode): hours:minutes:seconds:frames at VIDEO.fps. */
export function timeCode(seconds) {
  const frames = Math.round(seconds * VIDEO.fps);
  const pad = (v) => String(v).padStart(2, '0');
  const s = Math.floor(frames / VIDEO.fps);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(frames % VIDEO.fps)}`;
}

/**
 * A locale's captions for the video: the hook, the seven, the sign-in line —
 * as they read, their main word's brackets (T-288) taken out: until T-289 the
 * video does not set the main word apart.
 */
export function videoCaptions(locale, captionsFile = CAPTIONS) {
  const all = JSON.parse(fs.readFileSync(captionsFile, 'utf8'))[locale];
  if (!all?.hook || !all?.signIn || all?.video?.length !== 7) {
    throw new Error(`${captionsFile} needs a hook, seven video captions and a signIn for ${locale}`);
  }
  return { hook: plain(all.hook), video: all.video.map(plain), signIn: plain(all.signIn) };
}

/**
 * Where the sign-in line breaks when one line of it is under 40 px: after its
 * colon; Russian has none, and breaks after «Нужен вход», as its native editor
 * asked (T-285).
 */
const SIGN_IN_BREAK = '^[^:]*:|^Нужен вход';

/**
 * compose.swift's pictures for a locale's captions (`videoCaptions`), in
 * `dir`: one overlay a shot, the hook's darkness, the closing card. Returns
 * what it drew: { fontSize, overlays: [{ file, place, lines, widths, text,
 * band }], dim, end, signIn: { lines, fontSize, top, bottom } }, in px of the video.
 */
export function overlays(words, dir) {
  const job = path.join(dir, 'video.json');
  fs.writeFileSync(job, JSON.stringify({
    captions: SHOTS.map((s) => ({ text: s.caption === 'hook' ? words.hook : words.video[s.caption], place: s.place })),
    signIn: words.signIn, signInBreak: SIGN_IN_BREAK,
    width: VIDEO.width, height: VIDEO.height, dir, font: FONT, colours: landingColours(), mark: MARK, name: 'Rehearsly',
  }));
  return JSON.parse(execFileSync(binary(), ['video', job], { encoding: 'utf8', maxBuffer: 1 << 24 }));
}

/**
 * Cuts `locale`'s preview from `clips` (seven recordings, in video.yaml's
 * order) into `out`/<locale>.mp4. Returns { file, length, shots: [{ index,
 * start, length, place, captionAt, speed, recorded, kept }], overlays (what
 * compose.swift drew: each caption's lines, place and band), fontSize, signIn,
 * poster: { seconds, timeCode } }.
 */
export async function montage({ locale, clips, out = path.join(OUT, 'video'), captionsFile = CAPTIONS }) {
  const words = videoCaptions(locale, captionsFile);
  if (clips.length !== RECORDINGS) throw new Error(`${RECORDINGS} recordings are needed: ${clips.length} for ${locale}`);
  for (const clip of clips) if (!fs.existsSync(clip)) throw new Error(`no recording ${clip}`);
  const { recordings, shots, length: total } = plan(clips);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'store-video-'));
  try {
    const drawn = overlays(words, work);

    const n = RECORDINGS;
    const still = (png, seconds) => ['-loop', '1', '-framerate', String(VIDEO.fps), '-t', seconds.toFixed(3), '-i', png];
    const hookShot = shots.find((s) => s.hook);
    const endShot = shots.find((s) => s.end);
    const inputs = [
      ...clips.flatMap((clip) => ['-i', clip]),                                  // 0…6
      ...shots.flatMap((s, k) => still(drawn.overlays[k].file, s.length)),       // 7…14
      ...still(drawn.dim, hookShot.length),                                      // 15
      ...still(drawn.end, endShot.length),                                       // 16
      '-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000', // 17
    ];
    const dimInput = n + shots.length, endInput = dimInput + 1, audioInput = endInput + 1;
    const { width: W, height: H, fps } = VIDEO;
    const graph = [];
    for (const [r, rec] of recordings.entries()) {
      const mine = shots.filter((s) => s.clip === r);
      const length = mine.reduce((sum, s) => sum + s.length, 0);
      // Its stillness cut, timed anew at 30, from where it starts — a frame
      // later than its first frame's time, so the frame before it is not
      // taken in its place, and held past its end for that; the whole frame
      // filled, scaled down to it, the rest cut evenly off top and bottom.
      const start = rec.from ? rec.from / rec.speed + 1 / fps + 0.004 : 0;
      graph.push(`[${r}:v]setpts=${timing(rec)},fps=${fps},tpad=stop_mode=clone:stop_duration=1,trim=start=${start.toFixed(3)},`
        + `setpts=PTS-STARTPTS,scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1,`
        + `tpad=start_mode=clone:start_duration=${rec.hold}:stop_mode=clone:stop_duration=${length.toFixed(3)},`
        + `trim=duration=${length.toFixed(3)},setpts=PTS-STARTPTS${mine.length > 1 ? `,split=${mine.length}${mine.map((s) => `[c${s.index}]`).join('')}` : `[r${mine[0].index}]`}`);
      if (mine.length > 1) {
        let at = 0;
        for (const s of mine) {
          graph.push(`[c${s.index}]trim=start=${at.toFixed(3)}:duration=${s.length.toFixed(3)},setpts=PTS-STARTPTS[r${s.index}]`);
          at += s.length;
        }
      }
    }
    for (const s of shots) {
      let base = `r${s.index}`;
      if (s.hook) {
        graph.push(`[${dimInput}:v]format=rgba,fade=t=out:st=${HOOK_DARK}:d=${DISSOLVE}:alpha=1[dim]`,
          `[${base}][dim]overlay=0:0:shortest=1[h${s.index}]`);
        base = `h${s.index}`;
      }
      const enable = s.captionAt ? `:enable='gte(t\\,${s.captionAt.toFixed(3)})'` : '';
      if (s.end) {
        // The caption over the week, then the card — which has the same caption, without its band — dissolving in over both.
        graph.push(`[${base}][${n + s.index}:v]overlay=0:0:shortest=1[w${s.index}]`,
          `[${endInput}:v]format=rgba,fade=t=in:st=${WEEK}:d=${DISSOLVE}:alpha=1[card]`,
          `[w${s.index}][card]overlay=0:0:shortest=1,format=yuv420p[s${s.index}]`);
        continue;
      }
      graph.push(`[${base}][${n + s.index}:v]overlay=0:0:shortest=1${enable},format=yuv420p[s${s.index}]`);
    }
    const filter = `${graph.join(';')};${shots.map((s) => `[s${s.index}]`).join('')}concat=n=${shots.length}:v=1:a=0,setsar=1[video]`;

    fs.mkdirSync(out, { recursive: true });
    const file = path.join(out, `${locale}.mp4`);
    execFileSync(tool('ffmpeg'), ['-v', 'error', '-y', ...inputs, '-filter_complex', filter,
      '-map', '[video]', '-map', `${audioInput}:a`,
      '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p', '-r', String(fps),
      '-b:v', '10M', '-maxrate', '12M', '-bufsize', '20M',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
      '-t', total.toFixed(3), '-movflags', '+faststart', file], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 600000 });
    // The poster frame: the hook's shot at its end — the windows lit, the hook still on.
    const poster = Math.round((hookShot.length - 0.1) * fps) / fps;
    return {
      file, length: total, poster: { seconds: poster, timeCode: timeCode(poster) },
      shots: shots.map(({ index, start, length, place, captionAt, speed, recorded, kept }) => ({ index, start, length, place, captionAt, speed, recorded, kept })),
      overlays: drawn.overlays, fontSize: drawn.fontSize, signIn: drawn.signIn,
    };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** A locale's recordings, as record.mjs keeps them. */
export const clipsOf = (locale) => Array.from({ length: RECORDINGS }, (_, i) => path.join(OUT, 'clips', locale, `${String(i + 1).padStart(2, '0')}.mov`));

/**
 * Three frames of a made preview in one picture, `dir`/<locale>.png, 960 px
 * tall: the poster frame (shot 0), the form's conflict at the end of shot 5,
 * the closing card — small enough for git, never the video itself.
 */
export function preview(locale, dir, made) {
  fs.mkdirSync(dir, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'store-poster-'));
  try {
    const conflict = made.shots[5];
    const at = [made.poster.seconds, conflict.start + conflict.length - 0.25, made.length - 0.1];
    const frames = at.map((t, i) => frameAt(made.file, t, path.join(work, `${i}.png`)));
    const sheet = path.join(dir, `${locale}.png`);
    execFileSync(binary(), ['sheet', sheet, '960', landingColours().background, ...frames]);
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

/** The report's lines for a made preview: its shots, where each caption went, the poster frame. */
export function report(locale, made) {
  return [
    `${locale}: ${made.length.toFixed(2)} s, type ${made.fontSize} px, sign-in ${made.signIn.fontSize} px in ${made.signIn.lines.length} line(s)`,
    ...made.shots.map((s) => `${locale}: shot ${s.index} ${s.start.toFixed(2)}–${(s.start + s.length).toFixed(2)} s, caption ${s.place}`
      + `${s.captionAt ? ` from ${s.captionAt.toFixed(2)} s in` : ''}, ${s.recorded.toFixed(1)} s recorded → ${s.kept.toFixed(1)} s kept, ×${s.speed.toFixed(2)}`),
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

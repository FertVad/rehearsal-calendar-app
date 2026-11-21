#!/usr/bin/env node
/**
 * The App Store's preview video (T-275), recorded and cut:
 *
 *   node e2e/store/record.mjs [<locale>…] [--preview=<dir>]
 *                                            every locale of captions.json when none is named
 *
 * For each locale, the stand shoot.mjs stands up — the e2e stand on the
 * store's simulator, "Rehearsly Store" (iPhone 17 Pro Max), its status bar at
 * 9:41, seeded with that page's world (e2e/run.mjs --store=<locale>), under
 * the e2e lock run.mjs takes — and e2e/store/video.yaml plays the storyboard
 * on it at a person's pace. The flow asks this script, on RECORDER, to start
 * and stop recording around each of the seven shots: `xcrun simctl io <udid>
 * recordVideo --codec=h264`, kept in e2e/store/out/clips/<locale>/01.mov…07.mov,
 * with the flow's pauses during each beside it (01.json…), to see where the
 * time went: since T-285 the cut takes them out like any other stillness.
 * Then montage.mjs cuts them into e2e/store/out/video/<locale>.mp4.
 *
 * The recorder answers on 127.0.0.1 only, and only while the run is on:
 *   GET /start?clip=<01…07>&device=<udid>   recording begun when it answers
 *   GET /stop                               the file whole when it answers
 *   GET /wait?ms=<n>                        a person's pause in the flow (≤ 5 s)
 *   GET /mark?name=<word>                   now, in seconds of the recording under
 *                                           way, kept in its .json `marks` (T-286:
 *                                           `ready`, the Planner's windows there);
 *                                           `cut` and `resume` take out what is
 *                                           between them (`spans`, T-289)
 *   GET /light?name=<word>&holes=<…>&app=<bundle id>
 *                                           where the light falls (T-289): the
 *                                           frames of the elements named, read
 *                                           from the screen's hierarchy now, as
 *                                           Maestro's own driver sees it; kept in
 *                                           `lights` (lightHoles says how to name them)
 *   GET /touch?phase=down|up&id=&x=&y=&at=&w=&h=
 *                                           a touch, as the app itself reports it
 *                                           (e2e/device/App.js, launched with
 *                                           rehearslyStoreTouches; T-289); kept in
 *                                           `touches`
 *
 * Each recording's .json beside it: `recordedAt` (ms since the epoch when it
 * began) and `zone` (the page's country's), so montage.mjs knows the day it
 * was shot on (the hook's, T-289); `waits`, `marks`, `spans`, `lights` and
 * `touches`, their times in seconds of the recording, places in points of the
 * screen (`screen`).
 *
 * Exits as the run did when it failed: 75 is the machine's (Docker, a port,
 * the simulator), and the locales after it are not taken.
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, OUT } from './compose.mjs';
import { clipsOf, describe, driverTaps, findHoles, montage, placeTouches, preview, report } from './montage.mjs';
import { LAST_HOUR, latePages, storeZone } from './seed.mjs';

const STORE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(STORE, '..', '..');
/** Where video.yaml's scripts find the recorder (e2e/store/scripts/recorder.js says the same). */
const RECORDER = { host: '127.0.0.1', port: 3003 };

const args = process.argv.slice(2);
const previewDir = args.find((arg) => arg.startsWith('--preview='))?.slice('--preview='.length);
const named = args.filter((arg) => !arg.startsWith('--'));
const locales = named.length ? named : LOCALES;
for (const locale of locales) {
  if (!LOCALES.includes(locale)) {
    console.error(`[store] no captions for ${locale} in captions.json: ${LOCALES.join(', ')}`);
    process.exit(64);
  }
}
// The seed refuses after LAST_HOUR in the page's country: say so now.
const MINUTES_A_PAGE = 8;
const late = latePages(locales, MINUTES_A_PAGE);
if (late.length) {
  console.error(`[store] ${late.join(', ')} would be seeded after ${LAST_HOUR}:59 in its country, when the Planner's `
    + 'first card has no room for all four levels; see e2e/store/README.md for the hours');
  process.exit(64);
}

/**
 * The ports Maestro's iOS driver listens on: an XCTest runner on the
 * simulator (a process of the Mac's), "maestro-driver-iosUITests-Runner", on
 * a port of its choosing (its log says "starting server 127.0.0.1:<port>").
 */
function driverPorts() {
  let out = '';
  try {
    out = execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fcn'], { encoding: 'utf8' });
  } catch (error) {
    out = error.stdout ?? '';
  }
  const ports = [];
  let command = '';
  for (const line of out.split('\n')) {
    if (line.startsWith('c')) command = line.slice(1);
    else if (line.startsWith('n') && /^maestro/i.test(command)) {
      const port = /:(\d+)$/.exec(line)?.[1];
      if (port) ports.push(Number(port));
    }
  }
  return [...new Set(ports)];
}

let driverPort = null;
/**
 * The screen's hierarchy now, as Maestro's driver reads it for its own
 * commands (POST /viewHierarchy): the app's elements, their testIDs
 * (`identifier`) and frames in points — and iOS's own, an alert among them.
 * Asked while the flow waits on the recorder, so the driver has nothing else to do.
 */
async function hierarchy(app) {
  const ports = [...new Set([driverPort, ...driverPorts()].filter(Boolean))];
  const said = [];
  for (const port of ports) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/viewHierarchy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds: [app], excludeKeyboardElements: false }), signal: AbortSignal.timeout(20000),
      });
      const text = await response.text();
      if (!response.ok) { said.push(`${port}: ${response.status} ${text.slice(0, 200)}`); continue; }
      driverPort = port;
      return JSON.parse(text);
    } catch (error) {
      said.push(`${port}: ${error.message}`);
    }
  }
  throw new Error(`no Maestro driver gave the screen's hierarchy (${said.join('; ') || 'none listening'})`);
}

/** The recorder for one locale's run: its recordings go to `dir`; `zone`, the page's country's. */
function recorder(dir, zone) {
  let recording = null;
  const seconds = (ms) => (ms - recording.began) / 1000;
  const stop = () => new Promise((resolve, reject) => {
    if (!recording) return reject(new Error('nothing is being recorded'));
    const { child, file, began, waits, marks, spans, lights, touches, pending, failed } = recording;
    recording = null;
    if (failed) { child.kill('SIGINT'); return reject(failed); }
    if (pending.length) { child.kill('SIGINT'); return reject(new Error(`${file}: a light waits for a tap that never came`)); }
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`the recording of ${file} did not end`)); }, 20000);
    child.once('exit', () => {
      clearTimeout(timer);
      if (!fs.existsSync(file) || fs.statSync(file).size === 0) return reject(new Error(`no recording in ${file}`));
      if (spans.some((s) => s.to === undefined)) return reject(new Error(`${file}: a "cut" with no "resume" after it`));
      // Beside the recording: the flow's pauses, to see where the time went;
      // its marks, spans and lights and the app's touches, for montage.mjs.
      fs.writeFileSync(file.replace(/\.mov$/, '.json'), JSON.stringify({
        recordedAt: began, zone, waits, marks, spans, lights,
        touches: touches.filter((t) => t.upAt !== undefined),
      }));
      resolve(file);
    });
    // SIGINT is how simctl is told to finish the file.
    child.kill('SIGINT');
  });
  const start = (clip, device) => new Promise((resolve, reject) => {
    if (recording) return reject(new Error(`still recording ${recording.file}`));
    const file = path.join(dir, `${clip}.mov`);
    fs.rmSync(file, { force: true });
    const child = spawn('xcrun', ['simctl', 'io', device, 'recordVideo', '--codec=h264', '--force', file],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    recording = { child, file, began: null, waits: [], marks: {}, spans: [], lights: [], touches: [], pending: [], failed: null };
    const mine = recording;
    let said = '';
    const timer = setTimeout(() => reject(new Error(`recording did not start: ${said.trim()}`)), 15000);
    const listen = (chunk) => {
      said += chunk;
      if (mine.began === null && /Recording started/i.test(said)) { mine.began = Date.now(); clearTimeout(timer); resolve(file); }
    };
    child.stdout.on('data', listen);
    child.stderr.on('data', listen);
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (recording?.child === child) recording = null;
      reject(new Error(`simctl recordVideo ended (${code}): ${said.trim()}`));
    });
  });
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${RECORDER.host}`);
    const answer = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
    try {
      if (url.pathname === '/start') {
        const clip = url.searchParams.get('clip') ?? '';
        const device = url.searchParams.get('device') ?? '';
        if (!/^0[1-7]$/.test(clip) || !/^[0-9A-F-]{36}$/i.test(device)) return answer(400, { error: 'clip 01…07 and a simulator udid' });
        return answer(200, { recording: await start(clip, device) });
      }
      if (url.pathname === '/stop') {
        // A light still being read finishes first.
        await recording?.reading;
        return answer(200, { recorded: await stop() });
      }
      if (url.pathname === '/wait') {
        const ms = Math.min(5000, Math.max(0, Number(url.searchParams.get('ms')) || 0));
        const from = Date.now();
        await new Promise((resolve) => setTimeout(resolve, ms));
        // In seconds of the recording under way, if one is.
        if (recording?.began) recording.waits.push({ from: (from - recording.began) / 1000, to: (Date.now() - recording.began) / 1000 });
        return answer(200, { waited: ms });
      }
      if (url.pathname === '/mark') {
        const name = url.searchParams.get('name') ?? '';
        if (!/^[a-z]{1,20}$/.test(name)) return answer(400, { error: 'a mark is named in small letters' });
        if (!recording?.began) return answer(409, { error: 'nothing is being recorded' });
        const now = seconds(Date.now());
        // What lies between a "cut" and its "resume" is taken out (T-289): a list pulled to refresh, a sheet going.
        const open = recording.spans.at(-1);
        if (name === 'cut') {
          if (open && open.to === undefined) return answer(409, { error: 'already cut' });
          recording.spans.push({ from: now });
        } else if (name === 'resume') {
          if (!open || open.to !== undefined) return answer(409, { error: 'a "resume" with no "cut" before it' });
          open.to = now;
        } else {
          recording.marks[name] = now;
        }
        return answer(200, { marked: name });
      }
      if (url.pathname === '/light') {
        const name = url.searchParams.get('name') ?? '';
        const spec = url.searchParams.get('holes') ?? '';
        const app = url.searchParams.get('app') ?? '';
        if (!/^[a-z]{1,20}$/.test(name)) return answer(400, { error: 'a light is named in small letters' });
        if (!recording?.began) return answer(409, { error: 'nothing is being recorded' });
        const mine = recording;
        const read = async () => {
          const at = seconds(Date.now());
          const tree = await hierarchy(app);
          try {
            const { screen, holes } = findHoles(tree, spec);
            mine.lights.push({ name, at, spec, screen, holes });
            return holes;
          } catch (error) {
            // What the driver gave, to see why: beside the recordings.
            const file = mine.file.replace(/\.mov$/, `-${name}-hierarchy.json`);
            fs.writeFileSync(file, JSON.stringify(tree, null, 1));
            throw new Error(`${error.message} (the hierarchy: ${file})`);
          }
        };
        // after=up&ms=<n>: read n ms after the next finger lifts — what a tap
        // brings up (an alert), the moment it is there, not when Maestro
        // gets round to seeing it. The flow goes on to make that tap.
        const after = Number(url.searchParams.get('ms'));
        if (url.searchParams.get('after') === 'up' && after >= 0 && after <= 3000) {
          mine.pending.push((upAt) => {
            mine.reading = new Promise((resolve) => setTimeout(resolve, Math.max(0, upAt + after - Date.now())))
              .then(read).catch((error) => { mine.failed = error; });
          });
          return answer(200, { lit: name, after });
        }
        return answer(200, { lit: name, holes: await read() });
      }
      if (url.pathname === '/touch') {
        // From the app: kept only while a recording is under way.
        const p = Object.fromEntries(['id', 'x', 'y', 'at', 'w', 'h'].map((k) => [k, url.searchParams.get(k)]));
        const phase = url.searchParams.get('phase');
        if (!recording?.began) return answer(200, { kept: false });
        const x = Number(p.x), y = Number(p.y), at = seconds(Number(p.at));
        if (![x, y, at].every(Number.isFinite)) return answer(400, { error: 'a touch has x, y and at' });
        if (phase === 'down') {
          recording.touches.push({ id: p.id, at, x, y, screen: { width: Number(p.w), height: Number(p.h) } });
        } else if (phase === 'up') {
          const touch = recording.touches.findLast((t) => t.id === p.id && t.upAt === undefined);
          if (touch) Object.assign(touch, { upAt: at, upX: x, upY: y });
          for (const go of recording.pending.splice(0)) go(Number(p.at));
        } else {
          return answer(400, { error: 'a touch goes down or up' });
        }
        return answer(200, { kept: true });
      }
      return answer(404, { error: 'no such thing' });
    } catch (error) {
      console.error(`[store] recorder: ${error.message}`);
      return answer(500, { error: error.message });
    }
  });
  return {
    listen: () => new Promise((resolve, reject) => {
      server.once('error', (error) => reject(new Error(`the recorder cannot listen on ${RECORDER.host}:${RECORDER.port}: ${error.message}`)));
      server.listen(RECORDER.port, RECORDER.host, resolve);
    }),
    close: async () => {
      if (recording) await stop().catch(() => {});
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

/** run.mjs, waited for without blocking the recorder: its exit code. */
const run = (locale) => new Promise((resolve) => {
  const child = spawn(process.execPath, [path.join(ROOT, 'e2e', 'run.mjs'), `--store=${locale}`, path.join(STORE, 'video.yaml')],
    { cwd: ROOT, stdio: 'inherit' });
  child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
});

for (const locale of locales) {
  const clips = clipsOf(locale);
  const dir = path.dirname(clips[0]);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  console.log(`[store] ${locale}: standing up the stand and recording the preview`);
  const rec = recorder(dir, storeZone(locale));
  try {
    await rec.listen();
  } catch (error) {
    console.error(`[store] ${error.message}`);
    process.exit(75);
  }
  const started = Date.now();
  const code = await run(locale);
  await rec.close();
  if (code !== 0) {
    console.error(`[store] ${locale}: the run ended ${code}; see e2e/out`);
    process.exit(code);
  }
  const missing = clips.filter((clip) => !fs.existsSync(clip));
  if (missing.length) {
    console.error(`[store] ${locale}: no recording ${missing.map((clip) => path.relative(OUT, clip)).join(', ')}`);
    process.exit(1);
  }
  // Where on the window each touch was: Maestro's driver logged its taps
  // ("Tapping x, y") into this run's artifacts (montage.mjs placeTouches).
  const artifacts = path.join(ROOT, 'e2e', 'out', 'artifacts');
  const logs = fs.readdirSync(artifacts).map((run) => path.join(artifacts, run))
    .filter((dir) => fs.statSync(dir).isDirectory() && fs.statSync(dir).birthtimeMs >= started - 1000)
    .flatMap((dir) => fs.readdirSync(dir).filter((f) => /^xctest_runner_.*\.log$/.test(f)).map((f) => path.join(dir, f)));
  const taps = logs.flatMap((file) => driverTaps(fs.readFileSync(file, 'utf8')));
  console.log(`[store] ${locale}: ${taps.length} taps in Maestro's driver log (${logs.map((f) => path.relative(ROOT, f)).join(', ') || 'none'})`);
  for (const clip of clips) {
    const file = clip.replace(/\.mov$/, '.json');
    const kept = JSON.parse(fs.readFileSync(file, 'utf8'));
    kept.touches = placeTouches(kept, taps);
    fs.writeFileSync(file, JSON.stringify(kept));
  }
  const made = await montage({ locale, clips });
  console.log(`[store] ${describe(made.file)}`);
  for (const line of report(locale, made)) console.log(`[store] ${line}`);
  if (previewDir) console.log(`[store] ${locale}: preview ${preview(locale, previewDir, made)}`);
}

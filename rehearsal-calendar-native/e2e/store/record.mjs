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
 *                                           `ready`, the Planner's windows there)
 *
 * Exits as the run did when it failed: 75 is the machine's (Docker, a port,
 * the simulator), and the locales after it are not taken.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, OUT } from './compose.mjs';
import { clipsOf, describe, montage, preview, report } from './montage.mjs';
import { LAST_HOUR, latePages } from './seed.mjs';

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

/** The recorder for one locale's run: its recordings go to `dir`. */
function recorder(dir) {
  let recording = null;
  const stop = () => new Promise((resolve, reject) => {
    if (!recording) return reject(new Error('nothing is being recorded'));
    const { child, file, waits, marks } = recording;
    recording = null;
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`the recording of ${file} did not end`)); }, 20000);
    child.once('exit', () => {
      clearTimeout(timer);
      if (!fs.existsSync(file) || fs.statSync(file).size === 0) return reject(new Error(`no recording in ${file}`));
      // The flow's own pauses and marks, beside the recording: the pauses to
      // see where the time went, the marks for montage.mjs (readyAt).
      fs.writeFileSync(file.replace(/\.mov$/, '.json'), JSON.stringify({ waits, marks }));
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
    recording = { child, file, began: null, waits: [], marks: {} };
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
      if (url.pathname === '/stop') return answer(200, { recorded: await stop() });
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
        recording.marks[name] = (Date.now() - recording.began) / 1000;
        return answer(200, { marked: name });
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
  const rec = recorder(dir);
  try {
    await rec.listen();
  } catch (error) {
    console.error(`[store] ${error.message}`);
    process.exit(75);
  }
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
  const made = await montage({ locale, clips });
  console.log(`[store] ${describe(made.file)}`);
  for (const line of report(locale, made)) console.log(`[store] ${line}`);
  if (previewDir) console.log(`[store] ${locale}: preview ${preview(locale, previewDir, made)}`);
}

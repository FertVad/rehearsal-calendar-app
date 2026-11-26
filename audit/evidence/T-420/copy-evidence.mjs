// T-420: copies the files the report rests on into audit/evidence/T-420 - the
// red run 2026-11-26_082731 from the monitor's copy (AUTODEV/notes/T-420-red,
// the runner keeps six runs), and screenshots of this task's own runs.
// node copy-evidence.mjs <T-420-red dir> <e2e/out/artifacts dir>
import fs from 'node:fs';
import path from 'node:path';

const [red, artifacts] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const FLOW = "iOS's rating window after a save, once a version; Rate Rehearsly in the profile";
const PROBE = 'T-420 probe - Rate Rehearsly, the wait after Safari has left the page';

const copies = [
  [path.join(red, 'screenshots/step-133-assertCondition-apps_.apple_.com.png'), 'red-082731/step-133-assertCondition-apps_.apple_.com.png'],
  [path.join(red, 'screen-hierarchy/step-133-assertCondition-apps_.apple_.com.json'), 'red-082731/step-133-assertCondition-apps_.apple_.com.json'],
  [path.join(red, 'maestro.log'), 'red-082731/maestro.log'],
  [path.join(red, 'device-simulator.08-31-19..47.log.gz'), 'red-082731/device-simulator.08-31-19..47.log.gz'],
  [path.join(red, 'device-xctest.log.gz'), 'red-082731/device-xctest.log.gz'],
  [path.join(red, 'xctest_runner_2026-11-26_082824.log.gz'), 'red-082731/xctest_runner_2026-11-26_082824.log.gz'],
  [path.join(artifacts, '2026-11-26_104908', PROBE, 'screenshots'), 'probe-red-104908'],
  [path.join(artifacts, '2026-11-26_105528', PROBE, 'takeScreenshot'), 'probe-green-105528'],
  [path.join(artifacts, '2026-11-26_111648', FLOW, 'takeScreenshot'), 'green-111648'],
];
for (const [from, to] of copies) {
  const dest = path.join(here, to);
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(dest, f));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(from, dest);
  }
  console.log(`${to}`);
}

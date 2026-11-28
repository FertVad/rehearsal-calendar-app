// T-431: every Safari process in the device-simulator.log(s) given - its first
// line, "app ax", home readable or not - and what came just before it in the
// same log: the last terminate request for Safari (simctl's, "Termination
// requested by simulator host") and the open that launched it (CoreSimulatorBridge
// "Opening URL", i.e. Maestro's openLink, or an app's open).
// node safari-starts.mjs <device-simulator.log or a folder to search>...
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const time = (line) => line.slice(11, 26);
const logs = (where) => (fs.statSync(where).isDirectory()
  ? fs.readdirSync(where).flatMap((name) => logs(path.join(where, name)))
  : (path.basename(where) === 'device-simulator.log' ? [where] : []));
for (const file of process.argv.slice(2).flatMap(logs)) {
  const procs = new Map();
  let lastTerminate = null;
  let lastTerminateAnswer = null;
  let lastOpen = null;
  let lastAx = null; // accessibility server events seen (AXRuntime, axauditd...)
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (/terminate application com\.apple\.mobilesafari: "Termination requested/.test(line)) lastTerminate = time(line);
    if (/Error reported for termination request.*mobilesafari|found nothing to terminate/.test(line)) lastTerminateAnswer = 'nothing to terminate';
    if (/terminate application com\.apple\.mobilesafari: "Termination requested/.test(line)) lastTerminateAnswer = 'asked';
    if (/CoreSimulatorBridge.*Opening URL/.test(line)) lastOpen = `${time(line)} ${line.slice(line.indexOf('Opening URL'), line.indexOf('Opening URL') + 60)}`;
    const m = / MobileSafari\[(\d+)\]: /.exec(line);
    if (!m) continue;
    let p = procs.get(m[1]);
    if (!p) {
      p = { from: time(line), ax: new Set(), homeless: false, terminate: lastTerminate, answer: lastTerminateAnswer, open: lastOpen, file };
      procs.set(m[1], p);
    }
    const ax = /\(app ax: (\d)\)/.exec(line);
    if (ax) p.ax.add(ax[1]);
    if (/home directory is inaccessible/.test(line)) p.homeless = true;
  }
  console.log(file.replace(/.*e2e\/out\//, ''));
  for (const [pid, p] of procs) {
    console.log(`  MobileSafari[${pid}] ${p.from}  ax ${[...p.ax].join('/') || '-'}  home ${p.homeless ? 'INACCESSIBLE' : 'readable'}  | last terminate ${p.terminate ?? '-'} (${p.answer ?? '-'})  | last open ${p.open ?? '-'}`);
  }
}

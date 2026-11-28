/**
 * Safari with no tabs for the flows that open a page in it (docs/e2e.md, "A
 * fresh Safari"): the helper the e2e server runs for
 * e2e/subflows/fresh-safari.yaml, and the runner's check, after the flows,
 * that no launch of Safari restored a tab (T-404, T-405).
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

const SAFARI = 'com.apple.mobilesafari';

/** `xcrun simctl …`; a failure carries simctl's exit code (`code`) and its stderr. */
const simctl = (...args) => new Promise((resolve, reject) => {
  execFile('xcrun', ['simctl', ...args], { timeout: 30000 }, (error, stdout, stderr) => {
    if (!error) return resolve(stdout.trim());
    error.stderr = String(stderr ?? '').trim();
    return reject(error);
  });
});

// Where Safari keeps its tabs on the simulator: the device's own
// Library/Safari, not Safari's data container. Emptying the container left
// all 26 to be restored (T-404, audit/evidence/T-404). SafariTabs.db is the
// tabs; BrowserState.db is where older iOS kept them. Bookmarks and history
// stay: Safari restores no page from them.
const SAFARI_TABS = /^(SafariTabs|BrowserState)\.db(-shm|-wal)?$/;

/**
 * What `simctl terminate <udid> com.apple.mobilesafari` says when there is
 * nothing to stop (iOS 26.5, audit/evidence/T-405/probe-terminate.txt): exit
 * 3, NSPOSIXErrorDomain code=3, "found nothing to terminate". Safari stopped
 * is exit 0.
 */
const NOT_RUNNING_EXIT = 3;
const NOT_RUNNING_TEXT = /found nothing to terminate/;

/**
 * Safari stopped and its tabs forgotten: none of an earlier run or flow for it
 * to restore at its next launch. Maestro's clearState cannot do it: it
 * reinstalls the app, and the simulator refuses to uninstall Safari
 * (IXErrorDomain 22). Returns `{ was, removed }`: 'stopped' or 'not running',
 * and the files removed.
 *
 * Files are removed only when Safari is known to be stopped: terminate
 * succeeded, or said there was nothing to stop. Any other answer - another
 * error, simctl out of its time - throws and removes nothing: a Safari still
 * running could write its tabs back, and the flow would read whatever page it
 * restored (T-405).
 */
export async function freshSafari(device, { run = simctl } = {}) {
  let was = 'stopped';
  try {
    await run('terminate', device, SAFARI);
  } catch (error) {
    if (error.code !== NOT_RUNNING_EXIT || !NOT_RUNNING_TEXT.test(error.stderr ?? '')) {
      const why = error.killed ? `killed after ${error.signal}, out of its time` : `exit ${error.code}`;
      throw new Error(`Safari not known to be stopped, nothing removed: simctl terminate ${why}: ${(error.stderr || error.message).split('\n')[0]}`);
    }
    was = 'not running';
  }
  const home = await run('getenv', device, 'HOME');
  if (!home.endsWith(`/Devices/${device}/data`)) throw new Error(`the simulator's home is ${home}`);
  const library = path.join(home, 'Library', 'Safari');
  const removed = fs.existsSync(library) ? fs.readdirSync(library).filter((name) => SAFARI_TABS.test(name)) : [];
  for (const name of removed) fs.rmSync(path.join(library, name), { force: true });
  return { was, removed };
}

// Safari says it once at every launch, in the device log Maestro keeps for
// each flow (<run>/<flow name>/logs/device-simulator.log):
// "… MobileSafari[50814]: (MobileSafariUI) [com.apple.mobilesafari:TabGroup] Read 0 normal tabs from saved state"
const LAUNCH = /^(\S+ \S+).*MobileSafari.*Read (\d+) normal tabs from saved state/;
const LAUNCH_TEXT = 'normal tabs from saved state';

// What CoreFoundation says, at the start of a Safari that cannot read its
// preferences, for each domain it reads, com.apple.Accessibility among them:
// "Disabling saving preferences for { com.apple.Accessibility, kCFPreferencesCurrentUser, any host, (null) } because home directory is inaccessible"
const HOMELESS_TEXT = 'because home directory is inaccessible';


// Safari's line in `launchctl list` on the simulator, its pid first:
// "56170	0	UIKitApplication:com.apple.mobilesafari[3186][rb-legacy]"
const SAFARI_JOB = /^(\d+)\s+\S+\s+UIKitApplication:com\.apple\.mobilesafari\[/m;

/**
 * Safari's process once it runs: launched by `simctl launch`, or - given a
 * link - by `simctl openurl`, as Maestro's openLink opens one (both are
 * CoreSimulatorBridge's "Opening URL" in the device log), and found in
 * launchctl's list. Throws when there is none in `startMs`.
 */
async function launchSafari(device, { run, wait, startMs, link }) {
  if (!link) {
    const said = await run('launch', device, SAFARI);
    const pid = Number(/^com\.apple\.mobilesafari: (\d+)$/m.exec(said)?.[1]);
    if (!pid) throw new Error(`simctl launch ${SAFARI} gave no process: ${said}`);
    return pid;
  }
  await run('openurl', device, link);
  for (let waited = 0; ; waited += 1000) {
    const pid = Number(SAFARI_JOB.exec(await run('spawn', device, 'launchctl', 'list'))?.[1]);
    if (pid) return pid;
    if (waited >= startMs) throw new Error(`simctl openurl ${link}: no Safari running after ${startMs / 1000} s`);
    await wait(1000);
  }
}

/**
 * Safari launched (launchSafari) and read in the device log until it says it
 * started (LAUNCH_TEXT): `{ pid, home }`, home 'inaccessible' when
 * CoreFoundation said so by then - it says it before Safari reads its tabs -
 * else 'readable'. Left running. Throws, Safari stopped, when it never said it
 * started.
 *
 * It must have started, not only been launched: a Safari Maestro launched and
 * a flow stopped 0.2 s later never logged a line, and the next one, the tap's,
 * came up as a first (T-418).
 */
async function startSafari(device, { run, wait, startMs, link }) {
  const pid = await launchSafari(device, { run, wait, startMs, link });
  let log = '';
  for (let waited = 0; !log.includes(LAUNCH_TEXT); waited += 1000) {
    if (waited >= startMs) {
      await freshSafari(device, { run });
      throw new Error(`Safari (${pid}) did not say it had started ("${LAUNCH_TEXT}") in ${startMs / 1000} s`);
    }
    await wait(1000);
    log = await run('spawn', device, 'log', 'show', '--last', '5m', '--info', '--debug', '--style', 'compact', '--predicate',
      `processIdentifier == ${pid} AND (eventMessage CONTAINS "${LAUNCH_TEXT}" OR eventMessage CONTAINS "${HOMELESS_TEXT}")`);
  }
  return { pid, home: log.includes(HOMELESS_TEXT) ? 'inaccessible' : 'readable' };
}

/**
 * Safari launched once after the simulator's boot and stopped, before any
 * flow (T-418, docs/e2e.md "Safari's first launch"). A Safari can come up
 * unable to read its preferences - its home directory "inaccessible",
 * com.apple.Accessibility with the rest - and so with its accessibility off
 * ("app ax: 0") for its whole life: Maestro's driver cannot read it, and fails
 * the flow as a crash. The boot's first did so in half the runs alone, so the
 * runner takes it: a flow whose Safari the app launches (44, 107) then gets a
 * later one. Later ones can too, rarely (T-431): a flow that opens a link
 * has it opened in a Safari checked readable (openInSafari).
 *
 * Returns `{ pid, home }` (startSafari) for the run's log. Safari is left
 * stopped, with no tabs (freshSafari).
 */
export async function firstSafari(device, { run = simctl, wait = pause, startMs = 30000 } = {}) {
  await freshSafari(device, { run });
  const started = await startSafari(device, { run, wait, startMs });
  await freshSafari(device, { run });
  return started;
}

/**
 * A link opened in a fresh Safari - no tabs - that Maestro's driver can read
 * (e2e/subflows/open-in-safari.yaml, T-431; docs/e2e.md "A Safari without its
 * home"). In place of the flow's own openLink, and the same: `simctl openurl`.
 *
 * The boot's first Safari was not the only one to come up with its home
 * inaccessible and its accessibility off: on c57a1dc's night run the boot's
 * fifth did, 2 h 40 min after the boot, launched by flow 98's openLink, and
 * the flow failed as a crash with the page on the screen. Such a Safari says
 * so in its first lines and stays unreadable to its end; a new process can be
 * readable (T-418: the Safari after an inaccessible first was, every time). So
 * the home of the Safari the link launched is checked, not assumed: one that
 * came up without it is stopped, and the link opened again in a new one, at
 * most `launches` in all; then it throws, Safari stopped.
 *
 * Safari is not launched first and the link opened in it: then iOS lost the
 * tap on Safari's question that follows, in three of four runs of flow 98
 * (T-431, audit/evidence/T-431).
 *
 * Returns `{ pid, homeless }`: the readable Safari left running with the link,
 * and the processes replaced (the runner counts them, safaris-replaced.log).
 */
export async function openInSafari(device, link, { run = simctl, wait = pause, startMs = 30000, launches = 3 } = {}) {
  const homeless = [];
  while (homeless.length < launches) {
    await freshSafari(device, { run });
    const { pid, home } = await startSafari(device, { run, wait, startMs, link });
    if (home === 'readable') return { pid, homeless };
    homeless.push(pid);
  }
  await freshSafari(device, { run });
  throw new Error(`Safari came up with its home directory inaccessible ${launches} times (${homeless.join(', ')}): Maestro could not read it`);
}

/**
 * Every Safari launch in a run's artifacts, by flow: `Map<flow name, [{ at, tabs }]>`.
 *
 * A full run keeps about 2.3 GB of device logs, 127 MB the largest (T-405
 * review): each log is read in pieces, not whole - a log over V8's longest
 * string (~512 MB) could not be read at all - and LAUNCH runs only on the lines
 * that have its text, found by indexOf: on every line it took 6 minutes of a
 * full run, silent, after its last flow.
 */
export async function safariLaunches(runDir) {
  const launches = new Map();
  if (!fs.existsSync(runDir)) return launches;
  for (const flow of fs.readdirSync(runDir)) {
    const log = path.join(runDir, flow, 'logs', 'device-simulator.log');
    if (!fs.existsSync(log)) continue;
    const list = [];
    const scan = (text) => {
      let at = text.indexOf(LAUNCH_TEXT);
      while (at !== -1) {
        const start = text.lastIndexOf('\n', at) + 1;
        const end = text.indexOf('\n', at) === -1 ? text.length : text.indexOf('\n', at);
        const match = LAUNCH.exec(text.slice(start, end));
        if (match) list.push({ at: match[1], tabs: Number(match[2]) });
        at = text.indexOf(LAUNCH_TEXT, end);
      }
    };
    // Each piece scanned up to its last line end; the line it cuts goes on with the next.
    let rest = '';
    for await (const piece of fs.createReadStream(log, { encoding: 'utf8', highWaterMark: 1 << 20 })) {
      const text = rest + piece;
      const cut = text.lastIndexOf('\n') + 1;
      scan(text.slice(0, cut));
      rest = text.slice(cut);
    }
    scan(rest);
    launches.set(flow, list);
  }
  return launches;
}

/**
 * Whether a flow file runs e2e/subflows/fresh-safari.yaml or
 * open-in-safari.yaml (which makes Safari fresh, then launches it with the
 * link): named on a line that is not a comment.
 */
export const runsFreshSafari = (text) => text.split('\n').some((line) => !/^\s*#/.test(line) && /\b(fresh-safari|open-in-safari)\.yaml\b/.test(line));

/**
 * The run's verdict on a fresh Safari. `launches`: safariLaunches; `fresh`:
 * the names of the flows that ran fresh-safari.yaml and passed. A launch that
 * restored a tab fails it, and so does a fresh flow that passed with no launch
 * of Safari in its log: then the check saw nothing - the line changed, the
 * log was not kept - and would pass however many tabs came back.
 * `{ summary, failures }`, each a line to print.
 */
export function safariVerdict({ launches, fresh }) {
  let count = 0;
  let restored = 0;
  const failures = [];
  for (const [flow, list] of launches) {
    count += list.length;
    const tabs = list.reduce((sum, launch) => sum + launch.tabs, 0);
    restored += tabs;
    if (tabs) failures.push(`"${flow}": Safari restored ${tabs} tab(s) at launch (${list.filter((launch) => launch.tabs).map((launch) => `${launch.tabs} at ${launch.at}`).join(', ')})`);
  }
  for (const flow of fresh) {
    if (!launches.get(flow)?.length) {
      failures.push(`"${flow}": passed after fresh-safari.yaml, and its device log has no launch of Safari ("Read <n> normal tabs from saved state") - nothing to check it by`);
    }
  }
  return { summary: `Safari launches: ${count}, tabs restored: ${restored} (fresh-safari.yaml)`, failures };
}

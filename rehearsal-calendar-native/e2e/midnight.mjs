/**
 * A run past midnight (docs/e2e.md, T-226): which flows go to Maestro next,
 * whether the run waits for the machine's midnight first, and whether it
 * cannot wait at all.
 *
 * The seed is made for the machine's today, so a flow must not run across a
 * midnight: its sign-in on the old day, its calendar on the new. A batch is as
 * many flows as end before midnight at FLOW_BOUND_MS each, and when not one
 * fits the run waits for midnight and seeds the new day.
 *
 * The wait is time the supervisor does not give: its limit is a setup and a
 * share per flow (tools/autodev/lib/checks.mjs, e2eLimitMs), 12 min 30 s for
 * one flow. A one-flow run that waited up to 10 minutes after a 3 min 19 s
 * setup was stopped by it before Maestro started (review of T-226). So the
 * runner has the same deadline, and a wait it cannot end before it — the wait,
 * the new day's seed, a Maestro and the flows left, each as long as the
 * longest — is not begun: the run stops as not ready (75), which the
 * supervisor takes again after its pause, past midnight.
 */

import fs from 'node:fs';
import path from 'node:path';

// Measured on T-225's night and T-226's runs.
/** The longest flow: 70-privacy-lists-resend.yaml, 200 s, with room. */
export const LONGEST_FLOW_MS = 210 * 1000;
/** What a Maestro takes before its first flow: 53–54 s. */
export const MAESTRO_START_MS = 60 * 1000;
/** A new day's database, server and seed: 15 s; and the teardown after the last flow, 11 s. */
export const RESEED_MS = 30 * 1000;
export const TEARDOWN_MS = 15 * 1000;
/** A flow's bound, a Maestro of its own included: a batch of one ends before midnight. */
export const FLOW_BOUND_MS = 5 * 60 * 1000;

// The supervisor's limit on a run of e2e/run.mjs (e2eLimitMs in
// tools/autodev/lib/checks.mjs; e2e/__tests__/midnight.test.mjs holds the two
// the same).
const LIMIT_SETUP_MS = 10 * 60 * 1000;
const LIMIT_PER_FLOW_MS = 150 * 1000;

/** How long the supervisor lets a run of `flowCount` flows take. */
export function limitMs(flowCount) {
  return LIMIT_SETUP_MS + flowCount * LIMIT_PER_FLOW_MS;
}

/** Until the machine's next midnight, in ms. */
export function untilMidnight(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
}

/**
 * What to do at `now` with `left` flows still to run, the run to end by
 * `deadline` (ms since the epoch): `{ take }` flows now, `{ wait }` ms for
 * midnight, or `{ stop }` — a wait of that many ms would outlast the deadline.
 */
export function nextStep({ now = new Date(), left, deadline = Infinity }) {
  const until = untilMidnight(now);
  const fit = Math.floor(until / FLOW_BOUND_MS);
  if (fit) return { take: Math.min(fit, left) };
  const wait = until + 1000;
  const end = now.getTime() + wait + RESEED_MS + MAESTRO_START_MS + left * LONGEST_FLOW_MS + TEARDOWN_MS;
  return end > deadline ? { stop: wait } : { wait };
}

/**
 * The run's exit code: 0 green, 1 a flow failed or the run broke, 75 the
 * machine not ready. `failed` — a batch already failed; `error` — how the run
 * stopped early: 'machine' (75's, a stop before midnight among them), another
 * truthy value for any other error, null when it ran to its end.
 *
 * A stop for the machine after a batch failed is still 1 (review of T-226): a
 * 75 makes the supervisor take the run as the machine's, keep no red result
 * and register no flake, and a green retry hides the failure.
 */
export function exitCode({ failed, error = null }) {
  if (error === 'machine') return failed ? 1 : 75;
  if (error) return 1;
  return failed ? 1 : 0;
}

/**
 * Maestro puts a folder of its own, named for when it started, under
 * --test-output-dir; with a batch a Maestro the run's folder held one per
 * batch, artifacts/<run>/<batch>/<flow>. The supervisor keeps a red run's
 * failed flows from artifacts/<run>/<flow> (keepFailedRun) — what one Maestro
 * over the whole set made — and found none. So each batch's flows go up into
 * the run's folder. `runDir` is artifacts/<run>.
 */
export function flattenBatches(runDir) {
  if (!fs.existsSync(runDir)) return;
  for (const batch of fs.readdirSync(runDir)) {
    const dir = path.join(runDir, batch);
    if (!/^\d{4}-\d{2}-\d{2}_\d{6}$/.test(batch) || !fs.statSync(dir).isDirectory()) continue;
    for (const entry of fs.readdirSync(dir)) {
      const to = path.join(runDir, entry);
      if (!fs.existsSync(to)) fs.renameSync(path.join(dir, entry), to);
    }
    if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
  }
}

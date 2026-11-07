# T-231 — "Details and the card read one seen mark" (flow 40) flaked on 224a38a

Red run: `rehearsal-calendar-native/e2e/out/failed/full-e2e-224a38a-2026-11-07T10-38-29-889Z/`,
flow 40, `Assertion is false: id: login-submit is visible` (4m 57s).

## What the red run shows

The flow failed in `subflows/sign-in-form.yaml`, at its first step: waiting
60 s for the sign-in screen after `launchApp`. None of flow 40's own steps ran.

- **Screen at the failure** (`screenshots/step-010-assertCondition-login-submit.png`,
  `screen-hierarchy/step-010-…json`): the dev client's red box "Could not
  connect to development server", URL
  `http://localhost:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&lazy=true…`.
  The app never got its JavaScript.
- **Device log** (`logs/device-simulator.log`): at 11:35:31.7 the app asks
  Metro for `/status` (answered); at 11:35:32.09 for the bundle (C2, connected
  on `::1:8081` in 3 ms); at 11:36:32.43 `Task <…>.<1> finished with error
  [-1001] … The request timed out` (iOS's 60 s), then C2 is cancelled.
- **metro.log**: `iOS Bundled 96576ms index.ts (1 module)`: the same
  cached, one-module bundle Metro serves in 150–700 ms all run long. It took
  96 s and finished after the app had given up. Every other mid-run bundle in
  all 37 kept red runs in `e2e/out/failed` took under 14 s. The only
  longer ones are the first, cold bundle that the runner fetches itself
  before the flows (70–220 s).
- **Not the app, not the flow, not a lost tap.** The run's only tap taken again
  (`09:29:04Z`, `login-submit`) was in flow 39, three minutes earlier. Flow
  40 never reached `tap-and-see.yaml`. The red box exists only in a dev build.
  No other kept run shows it.

## Why Metro was that slow: the machine, from 11:08 to 11:37

Every host-side process was slow in that window. The simulator's own daemons
logged without a pause over 0.7 s (`log-gaps.mjs`):

| What | In the window | Normally |
|---|---|---|
| Maestro `Apply configuration` (flow 40) | 36 s | < 1 s |
| Maestro `clearAppState` (flow 40) | 73 s | a few s |
| app install from Maestro (flow 38, 11:10:38 → 11:13:35 / 11:15:43) | 3–5 min | 4 s (11:34:43 → 11:34:47) |
| flow 38's `launchApp` | 10 min, then `CommandFailed: null` | ~10 s |
| flow 39, a sign-in and two taps | 10m 36s | ~1 min |
| Metro, a cached bundle | 96 s | 0.2 s |

After 11:37 the run went back to normal speed: flow 41 took 2m 11s, flow 42 1m 4s, and bundles 0.2–0.4 s.

What ran then: `9d265da` on `claude/systematic-repair`, committed at 11:30:49,
from another session, "Seen on a Release build on the simulator: black screen
… before, the sign-in screen after". That means an iOS Release build, twice,
and a simulator of its own, in the very window. No install of another build
shows in the e2e simulator's log, so it was another device. No other job of
that weight is known for that window. Host-side logs (`log show`, `sysctl
vm.swapusage`, DerivedData) are closed to this session, so the attribution
rests on the commit and the timings. The e2e lock (`/tmp/rehearsly-e2e.lock`)
serialized e2e runs only. Nothing made such a job wait for a run, or a run
for it.

## Red before (`red-before.txt`)

Load on demand cannot get a run as far as the failing step (T-203: full-core
and two-core load stalled the toolchain before the flow). So
`metro-stall.mjs` stalls only the process whose silence the failure shows.
It runs `e2e/run.mjs` with flow 40, and at the app's first bundle request
logged in metro.log it sends SIGSTOP to Metro's process group (from the lock
file) for 75 s, then SIGCONT.

On HEAD (`228c00a`), it gave the same failure at the same step:
`[Failed] Details and the card read one seen mark (1m 52s) (Assertion is false: id: login-submit is visible)`, exit 1.
Device log: the bundle request's connection on `::1:8081` lived from
01:03:02.14 to 01:04:03.98 HST and was cancelled at iOS's 60 s. The screen at
the failure was still the launch's black screen. Maestro's 60 s wait and
iOS's 60 s timeout end within a second of each other, so whether the red box
is up yet is a race. The original run, slower everywhere, caught the red box.

## The fix

The cause is a job beside the run that the lock did not cover. Raising a
wait or adding a retry was not the fix, and neither was reading the red box
as the machine's (exit 75): the failure screen is a race (see above), and a
time rule on Metro's log would judge a one-flow run before Metro reports.
So the fix lets heavy jobs take the same lock:

- `e2e/hold-lock.mjs <command> [args…]` waits for an e2e run that is going,
  holds the lock while the job runs (its process group named in the lock), and
  exits with the job's code. An e2e run started meanwhile waits for it, and its
  log names the job. A holder killed outright leaves its job to the next run,
  which stops it as it stops a dead run's server and Metro.
- `e2e/lock.mjs` exports the lock's path (`LOCK`, which `run.mjs` and
  `hold-lock.mjs` share) and keeps the holder's `what`.
- The rule is in `CLAUDE.md` (End-to-End) and `docs/e2e.md` ("Heavy jobs beside a run").

Tests (`e2e/__tests__/lock.test.mjs`, real processes; `lock-tests.txt`):
a job waits for a live run, runs after it, and gives back its code; a run
waits for a held job and names it; a dead holder's job is stopped by the next
run. On HEAD `hold-lock.mjs` does not exist, so all three fail. In this
session `ps` is denied (`startedAt` returns ""), so both "a dead … is stopped"
tests fail here. One of them is the old, unchanged test, which fails here the
same way. They need `ps`, as on the supervisor.

## The bug flow 40 guards (cause fix 22, DD01)

`npm run e2e -- e2e/flows/40-details-seen-one-model.yaml` on the changed tree
passed in 2m 2s (`green-flow-40.txt`). Details read "1/2" after the tap, her
toggle is selected, and the card reads `1/2`, selected. The bug has not
come back.

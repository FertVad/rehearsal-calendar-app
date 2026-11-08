# T-230 — flow 38 "Switch accounts - a push registration answered late" red on 224a38a

Red run: `rehearsal-calendar-native/e2e/out/failed/full-e2e-224a38a-2026-11-07T10-38-29-889Z/`,
`[Failed] Switch accounts - a push registration answered late (12m 8s)`.

## What the red run shows

Flow 38 failed at its first step, `launchApp` with `clearState`, `clearKeychain`
and `rehearslyPushDevice: 1`, before the app had run a line of its own
(`artifacts/Switch accounts - …/logs/maestro.log`, host time):

| Step | Red run, 07.11 | Normally |
|---|---|---|
| `clearKeychain` | 11:08:30 → 11:08:55, 25 s | under 1 s |
| `clearAppState` | 11:08:55 → 11:15:59, 7 min, then `CommandFailed: null` | a few s |
| failure screenshot | 11:18:00 → 11:18:34, 34 s | under 1 s |

Every step there is Maestro and the simulator (`simctl` erases the app's
container and keychain). No request reached the server or Metro; the launch
argument is read only after the app starts, which it never did.

## Not a commit

That window, 11:08–11:37, is the one T-231 already measured
(`audit/evidence/T-231/README.md`, "Why Metro was that slow"): the whole Mac
was choked while another session ran `xcodebuild` by hand (a Release build
for a simulator, then `archive`, for `9d265da`). In the same run flow 39 took
10m 36s instead of ~1 min, flow 40 failed on a 96 s Metro bundle, an app
install took 3–5 min, and after 11:37 flows went back to normal speed.
T-231's table already lists "flow 38's `launchApp`: 10 min, then
`CommandFailed: null`".

So the range was not bisected: its far end is green.

- **224a38a, quiet machine** (`green-224a38a.txt`): the whole
  `rehearsal-calendar-native` tree (app, server, e2e runner, flows)
  restored from 224a38a, flow 38 alone: `[Passed] … (2m 1s)`, no tap taken
  again. Then restored to HEAD; `git status` clean.
- **HEAD 7296bfc** (`green-head.txt`): `[Passed] … (2m 10s)`.
- Between them flow 38 also passed in T-234's checks (with T-234's
  `tap-and-see.yaml` taps, a separate lost-tap cause).

Nothing in the app, the server, the flow or T-226's runner changes (batches,
midnight wait, JUnit, `flattenBatches`) makes this launch hang: the same
runner and flow pass on 224a38a when nothing heavy runs beside them.

The supervisor's solo rerun after the full run is reported red too; its
logs were not kept (only the full run's folder is in `e2e/out/failed`), so its
time and cause cannot be read. Per T-231 the job beside the run went on to
`archive` after the simulator build, so the rerun may still have fallen in the
choked window. That is an inference from the timeline, not something those logs show.

## The fix

Nothing to change in the app or the flow. The cause, a heavy job beside an
e2e run that the lock did not cover, is fixed by T-231 (`4fc2849`, `8f47559`,
`200b1a2`): heavy jobs (`npm run ios`/`android`, and `xcodebuild` by hand via
`node e2e/hold-lock.mjs …`) take the e2e lock, so a run and such a job no
longer overlap. The rule is in `CLAUDE.md` and `docs/e2e.md` ("Heavy jobs
beside a run"). A hand-run `xcodebuild` is covered only if it goes through
`hold-lock.mjs`; that is the documented rule, not something a lock can enforce.

No red-before on a quiet machine exists: 224a38a's code is green there. The red
is the original run's, kept above. Reproducing a whole-machine choke on demand
stalls the toolchain before any flow (T-203, T-231), so it was not attempted.

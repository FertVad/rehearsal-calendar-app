# T-215: server test membersAvailabilityRange.test.js was flaky

Red run: T-019 checks, commit 48c438f, 01.11.2026 11:09 local (log
`rehearsal-calendar-native/e2e/out/failed/T-019-2026-11-01T08-49-14-736Z/checks.log`,
not in git). One test failed, "says whether they have ever recorded anything",
the file's first, with "Exceeded timeout of 5000 ms for a test". The file took
12.3 s, against about 1 s quiet; the whole `npm test` took 486 s. The test file
there is blob b68f61e, the same as at c353ad1, the base of this fix.

## Cause

`npm test` ran Jest `--runInBand`: all 186 files, frontend and backend, in one
process. Every file leaves its module graph behind in that process, and the
heap grows by about 9 MB a file: 1.5-1.6 GB when the red run reached this file
(`red-order-runs.txt`, A, the red run's own order). A garbage collection of
that heap stops the whole process: in the red order, with nothing else
running, one stopped it for 3.1 s in the file just before this one, and nine
more for 0.3-1.2 s. Under load the pauses grow with the heap: 1.5 s at 1.1 GB
with one busy loop per core (C). Whatever test is running then pays the pause
against its 5 s; on a loaded machine this test's own time is already 1-3 s
(`load-runs.txt`), and a pause of a few seconds on top is the timeout.

Nothing in the test or the route is slow: the first test makes two requests,
the others one, and every request answers in 12-20 ms quiet.

## Fix

`server/scripts/test.mjs` runs Jest with `--maxWorkers=1` instead of
`--runInBand`, and both Jest configs (`jest.config.js`, `server/package.json`)
set `workerIdleMemoryLimit: 512MB`. Files still run one at a time, in one
worker; once a file leaves that worker's heap above 512 MB, Jest replaces the
worker before the next file. No timeout raised, no retry, the test unchanged.
An explicit `--runInBand` or `--maxWorkers` on the command line still wins, as
before; a bare `npx jest` keeps its default workers, now with the same limit.

The limit: the pauses of a second and more were all at 1 GB and above, and
below 600 MB none reached 1 s even under load (the longest, 0.95 s at 331 MB). 512 MB keeps the heap there at the
cost of a few worker restarts a run.

## Red before, green after

The same 178 files in the red run's order (`redOrderSequencer.cjs`), GC traced
(`gc-filter.mjs`), `red-order-runs.txt`:

| | run | heap at this file | pauses >= 300 ms | longest | all GC | time |
|---|---|---|---|---|---|---|
| before | `--runInBand` (A) | 1540 MB | 10 | 3131 ms | 45.4 s | 467 s |
| after | `--maxWorkers=1`, limit (B) | 370 MB | 2 | 354 ms | 19.8 s | 402 s |

Both runs: 2022 passed, 8 failed, all 8 in `runtimeStartup.test.js` (below).

What is not shown: this test itself timing out. On a fresh process it does
not reach 5 s until the load is well beyond the red run's (`load-runs.txt`:
up to 5.1 s at 12 busy loops per core, still passing); it needs the big heap,
and the big heap needs the whole run before it. The red order under load did
not reach the file within the session's 10-minute limit for one command
(C, killed at 540 s, its pauses rising to 1.5 s). The red run's own log is the
red; the measurements above are its mechanism, before and after.

## Checks

- `membersAvailabilityRange.test.js`: 10 of 10 in every run here, quiet and
  loaded, before and after.
- Backend, as `npm test` runs it now (`--maxWorkers=1`, server config):
  72 of 73 files, 1045 of 1053 tests, 101 s (in band, before: 98 s).
- The red order across both projects in one worker: 2022 of 2030 (B).
- `runtimeStartup.test.js` fails in every run of this session, before and
  after: it starts the app in a child process that reads `server/.env`, which
  the OS forbids here. `scripts/__tests__/check-secrets.test.mjs` fails here on
  "forbidden environment and key filenames" for the same reason; neither is
  touched by this change.

## The bug the test guards

The file guards the fix that cuts stored spans into days for the Smart
Planner: a span crossing midnight, a span over several days and one that
began before the window used to read as free; it also guards `hasData` and
that no member's email is handed out. None has come back: all 10 tests pass,
and `routes/native/members.js` still fetches by overlap (`starts_at < end + 2
days AND ends_at >= start - 1 day`), still splits by the requester's timezone,
and still selects no email.

## Files

- `red-order-runs.txt`: runs A, B, C.
- `load-runs.txt`: the test alone under load, and a hypothesis dropped.
- `redOrderSequencer.cjs`: the red run's order, read from its checks.log.
- `gc-filter.mjs`: result lines and GC pauses from a `--trace-gc` run.
- `red-order-repro.mjs`: run C (red order, load, deadline).
- `load-repro.mjs`: a file over and over under load.
- `ab-repro.mjs`: the dropped variant against HEAD's test (load-runs.txt, 4).
- `lazy-requires.mjs`: shows a first supertest request loads no module that
  importing did not.
- `probe.test.js.txt`: the step-timing probe of load-runs.txt, 1.

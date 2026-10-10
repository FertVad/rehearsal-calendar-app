# T-203 — "From the planner to a rehearsal" flaked on T-130 (93f8754)

## What failed

Run `e2e/out/artifacts/2026-10-10_152418`, flow 06, step
`Assert that "Rehearsal created" is visible` (15:30:12).

The app's own log (device-simulator.log of that flow) shows why:

```
15:29:49.911 Task <…>.<15> sent request, body S 124        POST /api/native/projects/1/rehearsals
15:29:59.941 Task <…>.<15> finished with error [-1001] … timed out   transaction_duration_ms=10468
15:29:59.983 '[ERROR] Response Error: Network Error POST /native/projects/1/rehearsals'
15:30:00.000 'Failed to save rehearsal:', [AxiosError: timeout of 10000ms exceeded]
15:30:00.843 RCTAlertController shown (the error alert, not "Rehearsal created")
```

The server did not answer the create within the client's 10 s
(`REQUEST_TIMEOUT_MS`, src/shared/services/api.ts). In every other run the
same POST answered in 55–349 ms:

| run | gap before POST | POST |
|---|---|---|
| 085359 | 8.8 s | 125 ms, 201 |
| 102629 | 8.1 s | 73 ms, 201 |
| 104621 | 5.4 s | 112 ms, 201 |
| 111859 | 8.7 s | 138 ms, 201 |
| 115954 | 9.4 s | 133 ms, 201 |
| 154246 | 8.9 s | 55 ms, 201 |
| 163813 | 8.6 s | 55 ms, 201 |
| **152418** | **11.5 s** | **no answer in 10 s** |
| 165736 (probe, see below) | 22 s | 349 ms, 201 |

Across all 17 runs kept in e2e/out/artifacts, no other app request to the API
took over 1 s; this POST is the only stall.

Signs of a loaded machine at that moment, in the same log: the tap-to-request
time was 2.5 s (0.9 s in passing runs), and opening a loopback connection to
the server took 450 ms (1–3 ms elsewhere).

## Hypotheses tested

1. **Pool idle timeout.** The failing run is the only one whose pause before
   the POST exceeded the pool's `idleTimeoutMillis` (10 s, server/database/db.js),
   so the request needed a fresh PostgreSQL connection. Probe: flow 06 with a
   12 s wait inserted before the submit (reverted). Result: **passed**, POST
   349 ms after a 22 s pause. Refuted.
2. **Push send to Expo held the response.** The route awaits
   `notifyRehearsalCreated`, whose Expo call has its own 10 s deadline. In e2e
   nobody has a push token (seed.mjs registers none; the app never called
   /native/push-tokens or exp.host in that run; server.log reads
   "No valid tokens found"). Refuted for this failure.
3. **Locks.** createRehearsal runs no transaction and takes no row lock beyond
   the foreign keys; nothing else was talking to the server in that window.
   Nothing found.

## What could not be done

- The server log of the failing run is gone: e2e/out/server.log is rewritten
  by every run, and the supervisor's rerun overwrote it. Whether the request
  reached the server, and which step it stopped at, is unknown.
- "Red before" under load: `audit/evidence/T-203/under-load.mjs` (one CPU
  burner per core around a single-flow run) was refused by the session's
  permissions, so the failure was not reproduced.

## Change made

e2e/run.mjs now copies server.log and metro.log into the artifacts folder of
the run that wrote them, on teardown after the server stops. Verified:
run 2026-10-10_210445 holds both logs; flow 06 passed (2m 49s).

The next occurrence will show whether the POST reached the server and where
it stopped.

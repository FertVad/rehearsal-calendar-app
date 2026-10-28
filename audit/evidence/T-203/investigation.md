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

## Second pass

- **Load, run differently.** The same load as one inline foreground command
  (one `for(;;){}` per core around a single run of flow 06). With every core
  busy the run never got going: in 10 minutes Maestro reached only
  `Define variables` (artifacts 2026-10-10_211809), and the command was cut at
  the tool's limit. Full-core load gives no useful repro of a 10 s stall in a
  flow that otherwise passes. No burner outlived the command (checked). The
  server and Metro it left are cleared by the next run's lock (lock.mjs).
- **Request on the wire.** The failing POST went out exactly as in the
  passing runs (`sent request, body S 124` both times). The app was not at
  fault. The request was written to the server's socket and got no answer.
- **The host was not frozen.** Simulator daemons kept logging every second
  through 15:29:47–15:29:59. The stall was in the server or its database, not
  the whole machine.
- **Docker Desktop.** The VM's own log
  (~/Library/Containers/com.docker.docker/Data/log/vm/init.log) shows the VM
  booted at 12:20:58Z, 3.5 minutes before the failing run. It shows the VM
  being paused/unpaused and shut down by Docker Desktop between runs
  (12:38:51Z). Between 12:20:59Z and 12:32:50Z, the failure included, it
  logged nothing at all: no pause, no trim. The host-side backend log that
  would show more rotates every ~15 minutes and no longer covers 12:29Z.
- **Other load on the machine.** Besides the supervisor, the Mac runs other
  agents (a Codex app-server, VS Code's TypeScript servers) whose work is not
  serialized with e2e. The e2e lock covers only e2e runs.

Conclusion: the evidence that would name the stalled component (the server
log of that run, Docker's host log of 12:29Z) no longer exists. Nothing in
the flow, the app or the server's create path explains it. The same request
answers in 55–349 ms in every other run, including after long idle pauses.

## Third pass: under load (2026-10-11, `node` allowed by the owner)

The owner names the load that day: a macOS service (ANECompilerService) held
one core at 100%, alongside Docker, VS Code and an interactive session. The
supervisor itself runs nothing in parallel.

- `node audit/evidence/T-203/under-load.mjs e2e/flows/06-planner-to-rehearsal.yaml 2`
  (two cores busy, closer to that day than every core). Setup alone took
  5 minutes instead of the usual 1.5 (artifacts 2026-10-11_100546: flow
  started 10:10:20, run started 10:05:46). The flow then stopped inside
  Maestro's own `waitForAnimationToEnd` screenshot at 10:10:56, before the
  form was ever opened, and the command was cut at the 10-minute limit.
  e2e/out/server.log of that run holds only the seed's four creates: the
  app's POST never came. Not reproduced: under load the whole toolchain
  slows past the tool's limit before the step that failed.
- The earlier full-core run (2026-10-10_211809) got no further than
  `Define variables`.
- Both cut runs left their server and Metro on ports 3001/8081, and the next
  run stopped at exit 75. They were stopped by
  `node audit/evidence/T-203/stop-leftovers.mjs <server pid> <metro pid>`,
  which touches only processes listening there with this tree as their cwd.
  No CPU burner outlived either command.

What the failing run itself shows about the stall:

- The server was answering again within 40 s. The first requests of the next
  flow ("Sign in", 15:30:39–15:31:03) took 11–930 ms. The stall was short.
- It sat between the app and the server's answer: the request was written to
  the socket (15:29:49.911), simulator daemons kept logging every second, and
  no answer came for 10 s. Loopback connect (450 ms vs 1–3 ms) and
  tap-to-request (2.5 s vs 0.9 s) were slow at the same moment.

## Conclusion of the third pass (withdrawn — see the fourth pass)

This pass named the machine's load as the cause. The review rejected that, and
rightly: neither run under load reached the POST, and a timeout was all that
was shown. Load stays an unconfirmed hypothesis.

- The create path has no wait that reaches 10 s without load. There is no
  transaction and no row lock. No push is sent (nobody in e2e has a token).
  The pool's idle close is harmless: the same POST answers in 349 ms after
  a 22 s pause.
- In 17 kept runs the same POST answers in 55–349 ms, and no other API
  request in any of them takes over 1 s.
- The one failure coincides with measured load on the machine and recovered
  by itself within seconds.

Which process lost the 10 s, the Node server or PostgreSQL in Docker's VM,
cannot be told any more. That run's server log was overwritten, and Docker's
host log for 12:29Z has rotated away. The supervisor now keeps a red run's
logs in e2e/out/failed/, and this task keeps every run's server and Metro
logs with its artifacts. The next occurrence will name the process.

## Change made

e2e/run.mjs now copies server.log and metro.log into the artifacts folder of
the run that wrote them, on teardown after the server stops. Verified:
run 2026-10-10_210445 holds both logs; flow 06 passed (2m 49s).

The next occurrence will show whether the POST reached the server and where
it stopped.

## Fourth pass: another process on port 3001 (after review)

The supertest 401 below has the same root: a socket on the wildcard shares
its port with any later socket on a specific address. The kernel gives each
connection to the more specific socket. e2e's server ran exactly that way:
`HOST: '::'` on 3001, with the app on `localhost`. requireFree() checks the
port only before the run.

- **The kernel side** (`e2e-port-shadow.mjs`). The server listens on `[::]:P`.
  A later process can still bind `::1:P`, `127.0.0.1:P` or `localhost:P`; only
  `0.0.0.0:P` is refused. Each fresh connection to that address then goes to
  the newcomer. If the newcomer accepts and never answers, the client sees
  "connected, request sent, no answer". When it exits, ours answers again.
- **What the T-130 failure shows fits that exactly.** The POST went out on a
  new connection (C14) to `IPv6 … 3001` on lo0, with connect 21 ms. The
  request was sent, no byte came back, and it ended at -1001 after 10 s. The
  next flow's requests were answered: whatever held the address was gone. A
  new connection was certain: the server's keep-alive is 5 s, and the gap
  before the POST was 11.5 s.
- **Red before, up to the request itself** (`interloper.mjs`,
  `interloper-red.txt`). On HEAD, flow 06 ran while another process bound
  `::1:3001` and `127.0.0.1:3001` once the planner had loaded, held for 15 s
  and then left. It received the app's
  `POST /api/native/projects/1/rehearsals` and did not answer. The flow failed
  with the same assertion as on T-130. In the device log, the request,
  connection and timeout match T-130 line for line: task <15>, `body S 124`,
  a new IPv6 connection on lo0, -1001 after 10 014 ms, then
  `Failed to save rehearsal: timeout of 10000ms exceeded`.
- **This machine has such processes.** The 401 below came from another copy of
  this server on 127.0.0.1, at a port this one had been given. Other worktrees
  of this repository run their checks and probes here, and other agents and
  dev servers run alongside them. None of them is serialized with e2e.

What still cannot be shown is which process held 3001 at 15:29:49 on
2026-10-10. Nothing kept a record of sockets back then. So this is not proof
of that one occurrence. It is the one mechanism that reproduces it,
signature included, while load never got a run as far as the POST.

### Fix

e2e/run.mjs starts the server on `127.0.0.1` and gives the app
`http://127.0.0.1:3001/api`. Nothing else on the machine can bind an address
the server itself holds: a later `127.0.0.1:3001` gets EADDRINUSE. A later
`[::]:3001` or `::1:3001` gets none of the app's connections, which go to an
IP address and so never resolve to anything else. Green after
(`interloper-green.txt`): the same interloper got `::1:3001` but EADDRINUSE on
127.0.0.1. The create went out on a new IPv4 connection while the interloper
was up, and flow 06 passed.

Metro on 8081 has the same exposure in principle. It is not changed here.
Expo decides how Metro binds, and the app loads the bundle only at launch, so
a newcomer there would fail a flow at launch, not the way T-130 failed.

If load ever stalls the server, the next red run's server.log (kept by the
supervisor and by keepLogs()) will show it.

## Supervisor's checks on these commits: a valid token answered 401

`npm test` failed once in membersAvailabilityRange.test.js ("splits a span
crossing midnight…"): 401 where 200 was due, with the admin's token from
`generateTokens(adminId, 1)`. The three requests before it and the six after
it in the same file got 200. The commits under check changed no server code.
On 2026-10-10 authorization.test.js had the same failure (401 instead of
403), and five reruns did not repeat it.

### Ruled out

- Only `requireAuth` answers 401 on that route. All four of its reasons are
  fixed within one file: the secret is read once, the token lives for 30 days,
  the user row and token_version 1 never change, and nothing fakes the clock.
  A single 401 in the middle of the file cannot come from any of them.
- Jest workers taking each other's ports: `npm test` runs `--runInBand`. And
  in port-race.mjs, 38,810 supertest-style requests run against three
  processes that keep opening 127.0.0.1:0 servers reached no other process.
  The kernel never hands one automatically picked port to two of them.

### Cause

supertest starts the app with `listen(0)`, which binds the IPv6 wildcard
`[::]`, and then sends to `http://127.0.0.1:P`. On macOS a process can hold
the same P on 127.0.0.1 too, and the more specific socket gets the
connection (port-cross.mjs, part 1). The kernel checks a new wildcard port
against other Node sockets but not against every socket on 127.0.0.1. On
this machine some process listens on 127.0.0.1:59164, inside the ephemeral
range, and answers `ok`. Stock supertest was given port 59164 and so reached
that process: in stale-socket.mjs, 3 of 20,000 requests and 1 of 8,000
(stale-socket-output.txt). When that process is another copy of this
server, such as another worktree's checks or a probe with its own secret and
database, a valid token comes back 401. The request never reaches our app.
Load raises the odds only because a run under load overlaps more of those
other processes.

### Fix

server/__tests__/loopbackSupertest.js: the app listens on 127.0.0.1 itself,
in end() (with a host given, listen is asynchronous). There the kernel gives
out no port someone else holds. Both Jest configs map `supertest` to the
wrapper, so all 32 test files get it without edits, and so will new ones.
Through the wrapper, 8,000 requests had 0 stray answers and 0 failures.
Stock supertest had 1 stray answer and 2 ECONNRESET on the same machine
minutes apart.

A limit of the measurement: at a synthetic 550 requests/s the wrapper used
up 127.0.0.1's ports after about 10,600 requests (EADDRNOTAVAIL), because
the server's and the client's ports now share one table and wait out
TIME_WAIT. The suite makes a couple of thousand requests over about 200 s,
roughly 100 times slower. The full run below did not come near the limit.

Red before: loopbackSupertest.test.js with the old mapping. The server
supertest starts is on `::`/IPv6 (loopback-red.txt). Green after.

membersAvailabilityRange.test.js now asserts its status with the body, as
authorization.test.js does since 7a0d4b4.

Full Jest run in band with the fix: 134 of 135 suites pass, 1698 of 1706
tests. runtimeStartup.test.js fails here (fixture "import-failed") exactly
as on HEAD without the change. That is this sandbox; the supervisor's run of
the same file passed. The scanner's own regressions fail here on their
synthetic `.env` fixtures for the same reason.

The first red run (`page.goto: Timeout 5000ms` in the invite page browser
test) is not this cause. That test's server listens on 127.0.0.1 itself and
the browser connects to it, so nothing can take its port. It stays a
separate instability, in the class T-109 handled.

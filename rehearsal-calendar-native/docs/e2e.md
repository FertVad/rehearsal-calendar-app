# End-to-end flows (Maestro)

The app driven on an iOS simulator against a local server and a throwaway
database — nothing real is reached. `e2e/run.mjs` stands it all up, runs the
flows and takes it down.

```bash
cd rehearsal-calendar-native
npm run e2e                       # every flow in e2e/flows, then teardown
npm run e2e -- e2e/flows/01-login.yaml
npm run e2e:up                    # stay up for Maestro MCP / Studio; Ctrl-C ends it
npm run e2e -- --build            # rebuild the app (after native changes)
```

Needs: Docker Desktop with a local `postgres:15` image, Xcode, Maestro in
`~/.maestro/bin` (2.11.0), Node 22. The first run builds the Debug app into
`e2e/.build` (about 4 GB, ten minutes); later runs reuse it. Logs, the seed,
JUnit and screenshots go to `e2e/out`.

## What it refuses

- **Any database but its own container.** PostgreSQL comes from the local image,
  data on tmpfs, port on 127.0.0.1. The server gets an environment built from
  nothing — no `SERVER_ENV_FILE`, nothing inherited but `PATH`/`HOME` — so
  `server/.env` (production) cannot reach it.
- **Ports 3001 or 8081 already taken.** A server or Metro already running is not
  reused: it could be pointed anywhere. What a dead e2e run left there is not
  that case — see below.
- **A bundle that could reach another API.** This checkout's `.env` sets
  `EXPO_PUBLIC_API_URL=https://rehearsly.me/api`, and in development Expo bundles
  the `.env` files and lets them win over the environment — setting the variable
  for Metro is not enough. Metro runs with `REHEARSLY_E2E=1`, which keeps the
  root `.env*` files out of the bundle (`metro.config.js`). The bundle is then
  searched: no `.env` module, every `EXPO_PUBLIC_API_URL` value the local server.
  After launch the address the app logs at startup is watched; any other one
  closes the app and takes everything down (exit 2).
- **Simulator keyboard following the Mac.** Simulator.app switches a device's
  keyboard to the Mac's input language, and Maestro typing Latin text through a
  Russian layout loses characters. The run requires I/O → Keyboard → "Use the
  Same Keyboard Language as macOS" to be off (`EnableKeyboardSync = 0`; turned
  off by the owner on 2026-10-07).

## A run that died

A run stopped by Ctrl-C or SIGTERM takes everything down itself. One killed
outright — a tool's time limit ended one that way on 2026-10-10 — gets no
teardown, and its server and Metro, each in a process group of its own,
outlive it on 3001 and 8081. So the lock (`/tmp/rehearsly-e2e.lock`,
`e2e/lock.mjs`) names the run and every group it puts in the background, by
leader pid and start time, and the next run to find its holder dead stops
those groups before it takes the lock — only those still led by the process
the dead run started, never whatever has the pid now. Under the lock any
container labelled `rehearsly.e2e` is a dead run's too, and is stopped.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | The flows passed |
| 1 | The change failed: a flow, the server, the seed, the bundle |
| 2 | The app reported an API address other than the local one |
| 75 | The machine was not ready — Docker, a port held by something not ours, the simulator, another run that never finished. Not the change: run it again later |

The autonomous supervisor waits out a 75 instead of sending the task back.

## The simulator

Its own device, "Rehearsly E2E" (iPhone 16, newest runtime), created on the
first run, pinned to English with only the US keyboard. Simulator.app must be
open: the on-screen keyboard Maestro types through only appears with it.

## The seed

`e2e/seed.mjs`. Accounts are inserted with confirmed addresses (registration
needs an emailed code); projects, invites, rosters, rehearsals and busy days go
through the local server's API. Everyone's password is `e2e-local-only`; flows
get `${PASSWORD}`, `${APP_ID}` and `${<KEY>_EMAIL}` for each account in
`PEOPLE` (`DIRECTOR_EMAIL`, `HAMLET_EMAIL`, …). Times are local to the machine,
which is also the simulator's zone.

## Writing flows

- Sign in through `e2e/subflows/sign-in.yaml` (`env: { EMAIL: ... }`). It
  types, checks the text landed and retries: the first keyboard after a cold
  launch is slow, and text typed before it is up goes nowhere. The inputs do not
  report focus, so there is nothing else to wait on. It also dismisses iOS's
  "Save Password?" sheet, which covers the screen.
- Find controls by `testID` (`id:` in Maestro), not by their English label.
- A touchable card is one accessibility element labelled with all of its text:
  match a part of it as a regex, `".*Act I run-through.*"`.
- `EXPO_PUBLIC_E2E=1` (set by the runner) silences the development warning
  toasts, which sit over the tab bar.
- Maestro does not run the flows in file order, and they share one database:
  a flow never relies on what another one created. Find a control relative to
  its own card (`below: ".*Act I run-through.*"`), not by `index`, and set a
  selection explicitly instead of trusting the one on arrival.
- A list item under the tab bar, or still scrolling, takes no tap: bring it
  into view with `scrollUntilVisible` (`centerElement: true`) first.
- Docker Desktop idles its VM; the runner wakes it with a long-timeout call
  before anything else.

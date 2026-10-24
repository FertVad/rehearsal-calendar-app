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
- **Any mail leaving the machine.** The server runs with
  `EMAIL_TRANSPORT=capture-for-tests` and no provider key: a code it mails is
  kept in its own process. `e2e/server-with-mailbox.mjs` imports `server.js`
  unchanged, listens for it, and answers `GET /code?to=<address>` on
  `127.0.0.1:3002` with the code in the latest message to that address; each
  message is also written to `e2e/out/mail`.
- **Ports 3001, 3002 or 8081 already taken.** A server or Metro already running is not
  reused: it could be pointed anywhere. What a dead e2e run left there is not
  that case — see below.
- **Sharing 3001 with a newcomer.** The server holds `127.0.0.1:3001` itself and
  the app is given `http://127.0.0.1:3001/api`. On the wildcard with the app on
  `localhost`, a process that bound `::1:3001` or `127.0.0.1:3001` mid-run got
  the app's new connections and never answered them: a create timed out
  (T-203).
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

The server and Metro are also started through `e2e/watchdog.mjs`, which holds
a pipe from the run and takes its process group down when the pipe closes —
the system closes it when the run dies, SIGKILL included. That does not need
`ps`, which the autonomous developer's sandbox does not let run: there the
lock could not identify a dead run's groups, and a run cut off by a tool's
time limit left both on their ports (T-203, 2026-10-11).

## Exit codes

| Code | Meaning |
|---|---|
| 0 | The flows passed |
| 1 | The change failed: a flow, the server, the seed, the bundle |
| 2 | The app reported an API address other than the local one |
| 75 | The machine was not ready — Docker, a port held by something not ours, the simulator, another run that never finished, Metro not delivering the bundle within 30 minutes. Not the change: run it again later |

The autonomous supervisor waits out a 75 instead of sending the task back.

## The simulator

Its own device, "Rehearsly E2E" (iPhone 16, newest runtime), created on the
first run, pinned to English with only the US keyboard. Simulator.app must be
open: the on-screen keyboard Maestro types through only appears with it.

Its clock is in Pacific/Honolulu (`SIMULATOR_ZONE` in `run.mjs`, set for the
simulator's launchd after boot), and everyone's profile is in the machine's
zone but Chebutykin's, pinned to Asia/Jerusalem (`CHOSEN_ZONE` in `seed.mjs`) so
flow 23 reads the same on any machine. The app shows the zone the person chose, never the device's (cause fix
14), so every flow runs as someone who has flown away from it; with the two
the same, nothing on screen could tell them apart. Honolulu has no summer time
and is not in the profile's list, so the zone picker names it at the top as
the device's (flow 23).

## The seed

`e2e/seed.mjs`. Accounts are inserted with confirmed addresses (registration
needs an emailed code); projects, invites, rosters, rehearsals and busy days go
through the local server's API. Everyone's password is `e2e-local-only`; flows
get `${PASSWORD}`, `${APP_ID}` and `${<KEY>_EMAIL}` for each account in
`PEOPLE` (`DIRECTOR_EMAIL`, `HAMLET_EMAIL`, …) and `${<KEY>_INVITE}` for each
invite code the seed returns (`TWELFTH_INVITE`) — the server's own, as it
issued it — and `${<KEY>_DAY}` for each day it names (`MARK_DAY`, a local
`YYYY-MM-DD`), and `${<KEY>_TIME}` for each time it computes (`WATCH_TOKYO_TIME`,
an `HH:mm`), and `${<KEY>_LABEL}` for each text it computes (`WEEK_CHOSEN_LABEL`,
the planner's week as its header names it). Times are local to the machine,
which is every profile's zone but Chebutykin's, whose are in his; the
simulator's is another (see above).

A create whose answer is lost (flow 13) is made in the seed too: a trigger on
the disposable database makes the first insert of a project named Dunsinane
take 13 seconds, longer than the app's 10-second request timeout, so the app
gives up while the server commits. Only that database has it.

A flow that needs something changed behind the app's back while it runs — what
another device would do — calls the local server from `e2e/scripts` with
`runScript`; `${API_URL}` is its address (flow 10). A code the server
mailed is read the same way: `e2e/scripts/read-code.js` with `MAIL_URL`
(`${MAIL_URL}`), `TO` and `NAME` puts it in `${output.<NAME>}` (flows 11, 12).

A late answer is made the same way: `e2e/scripts/hold-answers.js` with
`MAIL_URL`, `METHOD` and `PATH` (a regular expression on the path) holds the
answers to matching requests until `release-answers.js` — the request is
handled at once, only its answer waits, as on a slow network (flows 16–18,
20). An answer waits nine seconds at most, inside the app's ten; `MS` makes it
longer, and the app then gives up on the request as offline (flow 16). A hold
lapses after a minute, so a flow that fails before its release does not slow
the next. `BEFORE: "1"` holds the request itself instead: the server handles
it only on release, so a change is still on its way and what is read meanwhile
says what was true before it (flow 21). `OPEN: "1"` holds it so too, and keeps
its connection open until release, three minutes at most: the answer begins at
once (200, JSON) and a space follows every two seconds, so the app — whose ten
seconds count from the last byte heard — does not give up while a flow signs
out and back in (flow 22). The server's own status cannot follow, so this is
for a change whose outcome the flow does not read. `revoke-sessions.js` ends every
session of an account, as its other device logging out would (flow 15).

The seed signs in only the people it acts as: the server takes twenty
sign-ins a minute from one address. The twenty are spent, so a newer person
joins a project by the membership row the join writes (flow 22's two).

## A fix seen on screen has a flow

A defect a person can see in the app is fixed together with a flow that
shows it: added to `e2e/flows`, or an existing one extended. Jest proves the
mechanism; the flow proves what someone would actually see, and keeps it that
way. Show it red first: put the files the fix changed back as they were
(`git restore --source=<base> -- <files>`), run only that flow
(`npm run e2e -- e2e/flows/<flow>.yaml`, a few minutes), save the output as
evidence, then `git restore --source=HEAD -- <files>`. A fix with nothing on
screen — the server, a schedule, a log — needs no flow.

Every flow carries `tags:` naming the parts of the app it walks through —
`smoke`, `auth`, `calendar`, `projects`, `rehearsals`, `seen`,
`notifications`, `planner`, and new ones as flows need them (`availability`,
`invite`, `profile`). For now every check runs the whole set: six flows take
about five minutes, and a change in shared code — the API client, the
session, navigation — can break any of them. When a full run grows past ten
or fifteen minutes, a task runs `smoke` and the tags of what it touched, the
whole set runs when shared code changes and every night; the tags are there
so that switch needs no rework.

## Writing flows

- Sign in through `e2e/subflows/sign-in.yaml` (`env: { EMAIL: ... }`). It
  types, checks the text landed and retries: the first keyboard after a cold
  launch is slow, and text typed before it is up goes nowhere. The inputs do not
  report focus, so there is nothing else to wait on. It also dismisses iOS's
  "Save Password?" sheet, which covers the screen. A flow that acts before
  signing in launches the app itself and then runs `sign-in-form.yaml`.
- Open a link through `e2e/subflows/open-link.yaml` (`env: { LINK: ... }`): iOS
  asks 'Open in "Rehearsly"?' first, and it answers.
- Find controls by `testID` (`id:` in Maestro), not by their English label.
- A touchable card is one accessibility element labelled with all of its text:
  match a part of it as a regex, `".*Act I run-through.*"`.
- `EXPO_PUBLIC_E2E=1` (set by the runner) silences the development warning
  toasts, which sit over the tab bar.
- Maestro does not run the flows in file order, and they share one database:
  a flow never relies on what another one created. A flow that asserts on
  slots or busy times gets people of its own in the seed: a rehearsal another
  flow books for a shared person changes their day (flow 07 has its own
  director for that). Find a control relative to
  its own card (`below: ".*Act I run-through.*"`), not by `index`. A project
  opened in the planner arrives with its whole roster selected (DP01, flow
  07); a flow that needs another selection makes it itself.
- A list item under the tab bar, or still scrolling, takes no tap: bring it
  into view with `scrollUntilVisible` (`centerElement: true`) first.
- Docker Desktop idles its VM; the runner wakes it with a long-timeout call
  before anything else.

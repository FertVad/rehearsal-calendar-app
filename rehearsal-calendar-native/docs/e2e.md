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

## A lost tap

The simulator loses about one tap in 250, and Maestro does not notice. For
each tap XCTest makes a virtual digitizer and plays the touch at once; when
backboardd is busy it matches the new device late, the first event gets there
before it, and it ends up with two touch states for one digitizer: the touch
down goes to one, the lift to the other, and the touch is cancelled
(`device-simulator.log`: "we already have a service for senderID", then
"didn't see a previous touch down ... skipping event"). In the logs kept on
25.10.2026: 83 lost taps in 20 606, in 27 flows and a probe, with and without Metro
watching `e2e/out`. Maestro 2.11 said "Something have changed in the UI" after
every one of 9 198 taps, the lost ones too, so its own tap-again never runs
(T-207; `audit/evidence/T-207`, `touch-scan.mjs` counts them in any run's
artifacts). Most were the first tap of sign-in, which types inside `retry`;
flow 30 failed on one at "Apple Calendar", flow 11 at "Change password and
sign in" and, under load, at "Forgot password?" (T-209).

It is below the app, and cannot be made to happen on demand. The rule:

- A tap whose result the flow waits for, where a lost tap has failed or can
  fail a flow, goes through `e2e/subflows/tap-and-see.yaml` with `TAP_ID` (an
  id) or `TAP` (a text), `SEE` (the text it brings on screen) and `WAIT_MS`
  (the wait the flow had anyway). It taps and waits; if `SEE` is not there it
  taps once more - never more - and waits again, and then `SEE` must come.
  No pause, no longer wait.
- Only for a tap that may be taken twice: the second comes when the first left
  no trace on screen, but a first that landed late would be repeated.
- Every second tap is printed at the end of the run - `[e2e] taps taken again
  (tap-and-see.yaml): N` and a line for each (`e2e/scripts/tap-again.js` tells
  the mailbox, which writes `e2e/out/taps-again.log`) - so how often it
  happens stays in sight. Many of them means something else is losing taps.
- Typing is not a tap: the sign-in fields and flows 11-12 type inside `retry`
  because the first keyboard after a cold launch is slow, and that stays.

## A sheet opened twice

React Native's `Modal` presents a view controller from the screen it is on,
and on iOS the second one a screen presents is not in the accessibility tree:
the sheet is drawn, the screenshot shows it, and Maestro finds nothing on the
screen at all, the sheet or what is behind it. A picker opened again, the end
time after the start, the timezone list after one look: each failed every
time, animation or not; the first sheet of another screen was whole (T-208,
probes in `audit/evidence/T-208`). VoiceOver reads the same tree. So no screen
shows `Modal`: every sheet and dialog goes in `AppModal`, which on iOS puts it
in a full-window overlay that presents nothing, and keeps `Modal` on Android
(`modalBackdrops.test.ts` holds it). Flow 26 had met it only when run at
22:xx, the one hour its form needed the end's picker too; it now opens both
at any hour.

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
the planner's week as its header names it), and `${<KEY>_REHEARSAL}` for each
rehearsal's id (`BALL_REHEARSAL`, for a link `rehearsalapp://rehearsal/<id>`,
flow 42). Times are local to the machine,
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
for a change whose outcome the flow does not read, or for a read the server
answers 200: it is asked without `If-None-Match`, so it gets its body back,
never a 304 to the app's cached copy (flow 17).
`ONCE: "1"` holds only the next matching request and lets the ones after it
through: a read on a slow connection, then a change on a good one (flow 36).
A request held `BEFORE` puts the server's status in `server.log` on release
("the server answered 401"), so a flow that needs a real refusal shows it had
one: a sign-out ends the tokens, and a change released after it is refused
(flow 37). From the tap to the release must fit in the app's ten seconds, or
the app gives up first and the failure is a timeout; bring the next controls
into view before the tap.

`EXPECT` on `release-answers.js` is how many answers must have been held: a
flow whose point is a late answer fails when there was none (flow 38).

A simulator cannot receive push: registering ends at `!Device.isDevice`,
before the permission and the server. A flow that needs the server's answer to
a token launches the app as a phone — `launchApp` with `arguments: {
rehearslyPushDevice: "1" }`. In an e2e bundle `metro.config.js` puts
`e2e/device` in place of `expo-device` and `expo-notifications`: the real
modules, and with that argument (iOS puts launch arguments among the user
defaults, which `Settings` reads) a device, the permission granted and a token
made on the spot — Expo's servers are never asked, and the server's
`EXPO_BASE_URL` is a closed local port, so nothing is sent to one. Without it
the app is the simulator it is (flow 23). The app's own code has no hook for
it (flow 38).

An inbox that grows while the app is open: `e2e/scripts/notify.js` with
`MAIL_URL`, `EMAIL`, `COUNT` and `TITLE` records `COUNT` notifications through
the server's own `recordNotifications`, titled "`TITLE` 1" (the oldest) to
"`TITLE` `COUNT`" (flow 33).

An answer held while a flow takes several steps is held `OPEN`: the nine
seconds of a plain hold are a clock the steps race. Flow 17 held its "All
Projects" answer that way through a pull, the filter and a pick; on a slow
simulator the answer went before the pick, the spinner closed and the content
moved up under the tap, which then missed the option (T-206). `revoke-sessions.js` ends every
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

A fix that shows on screen only once the clock has moved — the app left open
for hours, past midnight — is proved by Jest with a mocked clock, red before
and green after. The simulator's clock is the Mac's, and moving it would take
a test hook in the app's code, a mechanism of its own for a rare case (cause
fix 14: "today" after a change of zone hours after the app opened).

Every flow carries `tags:` naming the parts of the app it walks through —
`smoke`, `auth`, `calendar`, `projects`, `rehearsals`, `seen`,
`notifications`, `planner`, and new ones as flows need them (`availability`,
`invite`, `profile`). A task's checks run the flows it touches, not the
whole set — 37 flows took 46 minutes on every check (owner, 27.10.2026): the
flows it changed, those running a subflow or script it changed, and those its
statement names as `e2e/flows/<file>.yaml`; with none of these, the sign-in
flow. The whole set runs every night on the reviewed code and once more when
the queue is done, and a flow red there comes back as a task of its own
(`tools/autodev/lib/nightly.mjs`). A change in shared code — the API client,
the session, navigation — can break any flow, so run the ones it reaches
before handing it in: `npm run e2e -- e2e/flows/<flow>.yaml …`.

The supervisor gives a full run 45 minutes, setup included (about four), and
stops it after them — exit 143, every flow passed or not. At 32 flows the run
took 41 (cause fix 20). A step every flow takes is paid 30 times over: the
subflows wait for nothing they do not need — the sign-in erases a field only
on a second try, and `tap-and-see.yaml` asks whether the result is there, not
whether it has gone, which waited seven seconds every time.

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
- `centerElement` can carry an item past the middle, under what sits above the
  list: clipped, but on screen, so Maestro counts it visible and taps what
  covers it. Which day goes under depends on the date of the run. A day of the
  availability editor is tapped after `e2e/subflows/day-in-reach.yaml`
  (`env: { DAY: ... }`), which waits for the list to rest and draws the day
  down below the legend (`availability-legend`). A day earlier than the one in
  view is looked for `UP` (flow 10).
- A tap the flow then waits on the result of, where a lost tap has failed a
  flow, goes through `e2e/subflows/tap-and-see.yaml` (see "A lost tap"), not
  a `repeat` or `retry` of its own.
- Docker Desktop idles its VM; the runner wakes it with a long-timeout call
  before anything else.

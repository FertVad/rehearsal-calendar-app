# End-to-end flows (Maestro)

The app driven on an iOS simulator against a local server and a throwaway
database — nothing real is reached. `e2e/run.mjs` stands it all up, runs the
flows and takes it down.

```bash
cd rehearsal-calendar-native
npm run e2e                       # e2e/flows on Debug, e2e/release on Release, then teardown
npm run e2e -- e2e/flows/01-login.yaml
npm run e2e -- e2e/release/01-launch.yaml   # only the Release launch check
npm run e2e:up                    # stay up for Maestro MCP / Studio; Ctrl-C ends it
npm run e2e -- --build            # generate the iOS project and build anew anyway
```

Needs: Docker Desktop with a local `postgres:15` image, Xcode, CocoaPods,
Maestro in `~/.maestro/bin` (2.11.0), Node 22. Logs, the seed, JUnit and
screenshots go to `e2e/out`.

## What the app is built from

The app under test is built from an iOS project `expo prebuild` makes of this
tree's `app.json` — as the App Store build is made — never from `ios/`, which
is not in git and in the main checkout is the project releases are built from
(`e2e/native.mjs`, T-227).

- **The project.** `e2e/.native` is a project root of its own: copies of
  `app.json` and `package.json`, links to `assets/`, `locales/` and
  `node_modules/`; prebuild reads nothing else of the tree (no `.env`).
  `expo prebuild --platform ios --clean`, then `pod install`, give
  `e2e/.native/ios`. Both run again whenever their inputs changed: `app.json`,
  `package.json`, `package-lock.json`, `node_modules/.package-lock.json`,
  `locales/`, `assets/` and the recipe itself. Their hash stamps the project
  (`inputs.sha256`) and every app built from it (`Rehearsly.app.inputs`); a
  project or app with another stamp is not used — `E2E_APP`, the main tree's
  app the supervisor names, only when its stamp is this tree's. Measured on the
  8 GB Mac: the hash 40 ms, prebuild 6 s, `pod install` 7 minutes — so the
  project is made only when the inputs change, not on every run.
- **The packages.** Prebuild runs with `--no-install` on the tree's
  `node_modules`, and autolinking links what is there, so before anything is
  hashed or built `node_modules` is checked against `package-lock.json`
  (`installedMismatch`, about 0.4 s): every locked package installed at its
  version (an optional one may be missing — another platform's), and nothing at
  the top of `node_modules` the lock does not have (a native module a commit
  removed). Otherwise the run stops with 75 — the machine's install, not the
  change — and says to run `npm ci`. The supervisor's `node_modules` is not
  reinstalled when a commit changes the lock.
- **Debug**, for `e2e/flows`: built into `e2e/.build` when the project's inputs
  changed and kept until they change again; its JS comes from Metro.
- **Release**, for `e2e/release`: built on every run that has a Release flow —
  the full run, or one named (`npm run e2e -- e2e/release/01-launch.yaml`) —
  since its JS is inside it. The build phase bundles from the tree (the
  project's `.xcode.env.local` sets `PROJECT_ROOT`), with `REHEARSLY_E2E=1`, the
  local address and `EXPO_NO_DOTENV=1`. Before it is installed the JS Metro
  wrote is checked: `envApiUrl` and `PRODUCTION_API_URL` written in as the local
  server, no `process.env.EXPO_PUBLIC_API_URL` left to read at run time, no
  `.env` module; and the Hermes bytecode the app runs carries the local address
  and no `rehearsly.me/api`. The Release flows run first, the app's device log
  streamed to `e2e/out/release-device.log`; a failed start prints its errors
  (`MissingCalendarPListValueException`, `Cannot find native module …`).
- **Builds.** Before the database, the server, Metro and the simulator start,
  under the e2e lock (T-231). `-jobs 4` on 8 GB (eight compilers of React
  Native's C++ fit worse), `ONLY_ACTIVE_ARCH=YES` (Release builds x86_64 too
  otherwise). React Native's codegen rewrites its sources at the start of every
  build, so all that includes them compiles again — about ten minutes here, and
  a build cut off began anew; `CLANG_ENABLE_COMPILE_CACHE=YES` (its cache in
  `e2e/.build`) takes what is unchanged from earlier builds. A Release build
  from nothing took three to four ten-minute tries, the last 5.5 minutes; with
  the cache warm the Release check takes about ten minutes.

What it caught: TestFlight 1.0.0 (1) opened on a black screen. T-040 had taken
the `NSReminders*` keys out of `app.json`; expo-calendar calls `EXFatal`
without them when its module is created, and in Release the other Expo
modules were never registered (9d265da). With `app.json` and `locales/` as
before 9d265da, `e2e/release/01-launch.yaml` fails on a black screen, the
device log saying `ExpoCalendar.MissingCalendarPListValueException` and
`Cannot find native module 'ExpoPushTokenManager'`; on the fix it reaches
sign-in (`audit/evidence/T-227`).

A task that changes `app.json`, `locales/`, `assets/` or the packages makes the
next run generate the project and build Debug from it: some 7 minutes and a
build that does not fit a single flow's limit the first time.

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
- **A public page without its script.** The server's CSP says
  `upgrade-insecure-requests`, which on https changes nothing; on the local
  http server Safari fetched `/legal.js` from `https://127.0.0.1:3001`, and the
  page had no language but English. `server-with-mailbox.mjs` takes only that
  directive out of its answers, so a flow reads `/privacy` in Safari as people
  do and switches its language by the page's buttons (flow 70, T-038).
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

Without `ps` a live holder cannot be told by its start time either, so there
a holder whose pid is alive — `kill(pid, 0)` answers, or refuses with EPERM —
is waited for, not taken over. On 2026-11-12 a check in the sandbox called a
live stand's holder dead while the stand was still building the app, took the
lock, and started its server on 3001 first; the stand's server then died of
EADDRINUSE. A dead holder whose pid another process got meanwhile is waited
for up to the hour, which is slow but never two runs. And a run whose lock
another run holds neither writes its groups over that run's nor removes the
lock on its way out: `record` stops it instead (`e2e/__tests__/lock.test.mjs`).

## Heavy jobs beside a run

The lock serializes e2e runs, and a heavy job on the same Mac is not one
unless it takes the lock too. On 2026-11-07 the full run of 224a38a went on
while an interactive Claude session ran `xcodebuild` by hand: a Release build
for a simulator of its own, then an `archive` (9d265da, committed 11:30:49,
says so; `npm run ios` was not run, and nothing else of that weight is known
to have run then). From 11:08 to 11:37 the machine was
choked: an app install took 3-5 minutes instead of 4 s, Maestro's
`clearAppState` 73 s, `Apply configuration` 36 s, and one flow's launch ten
minutes before it failed. Flow 40 launched at 11:35:31; the app asked Metro
for its bundle, Metro took 96 s over it (`iOS Bundled 96576ms index.ts (1
module)`, every other mid-run bundle in 37 kept red runs under 14 s), and iOS
gave up at 60 s (`NSURLErrorDomain -1001`). The dev client drew "Could not
connect to development server" and the flow failed at `login-submit` before
any step of its own (T-231, `audit/evidence/T-231`). No tap was lost:
`tap-and-see.yaml` was never reached.

So a heavy job goes under the lock. That case — `xcodebuild` called
directly — goes through `e2e/hold-lock.mjs`:

```bash
node e2e/hold-lock.mjs xcodebuild -workspace ios/Rehearsly.xcworkspace -scheme Rehearsly -configuration Release -sdk iphonesimulator ...
node e2e/hold-lock.mjs xcodebuild -workspace ios/Rehearsly.xcworkspace -scheme Rehearsly -configuration Release archive ...
```

`npm run ios` and `npm run android` take the lock themselves (`package.json`
runs expo through `e2e/hold-lock.mjs`), so `npm run ios -- --configuration
Release` does too.

`hold-lock.mjs` waits for a run that is going, runs the job in a group of its
own that the lock names, and exits with its code. An e2e run started
meanwhile waits for the job, its log naming it, as for another run (up to an
hour, then exit 75). The job runs through `watchdog.mjs`, as the server and
Metro do: the command in a group of its own, the watchdog outside it, told of
its holder's life by a pipe on fd 3. When the holder dies, killed outright
too, or the command exits, the watchdog stops the command's whole group —
whatever the command started included — within 5 s, without `ps`, and exits
only once that group is empty. The next run waits for the watchdog's group to
end; if anything of it is still running after 15 s, it does not take the lock
and exits 75, naming the group. Where `ps` runs, it also stops the group
itself. The job keeps the terminal as stdin, so `npm run ios -- --device`
asks for a device and expo's keys work.

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

Being en_US, it is on the 12-hour clock, and the app shows times as the phone
is set (T-017): a flow reads "6:00.PM–9:00.PM", the "." for the narrow space
ICU puts before AM/PM; `WATCH_TOKYO_TIME` and `next-hour.js` give patterns of
that form. A flow that needs the 24-hour clock launches with `arguments: {
AppleICUForce24HourTime: "<true/>" }` — the key Settings writes, read among the
user defaults as a property list: `"YES"` is a string and is ignored (flow 53).

AutoFill Passwords is off (`noPasswordOffer` in `run.mjs`): iOS offers no
"Save Password?" sheet after a sign-in, and no flow waits for one.

## A lost driver

Maestro's iOS driver (2.11.0) is one long XCTest test. When its status-bar
query meets a scene of InputUI, the keyboard's process, just as SpringBoard
takes it down, XCTest fails with `kAXErrorInvalidUIElement` and the test ends,
and with it the driver: every flow after that fails with
`DeviceUnreachableException` (or "Unknown error", its first command failing
with "Device became unreachable"), none of them having run. It was the
password sheet going at flow 66 on 3b38601, and the keyboard going 4.5 s after
it hid, with the sheet off, at flow 54 on d74e9d2 (T-246,
`audit/evidence/T-246/`). It is a race inside Maestro's driver and no flow can
take it out - not with waits and not with repeats. The supervisor runs every
flow that failed after the first lost driver once more, on its own; those are
not unstable flows. Turning the sheet off left it one cause fewer, not none.

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
flow 30 failed on one at "Apple Calendar" and at the profile tab (T-221), flow 11 at "Change password and
sign in" and, under load, at "Forgot password?" (T-209), flow 44 at the
profile tab after a restart (T-212), flow 25 at "Busy" in the availability
editor, whose day then closed unasked with nothing changed (T-218), flow 49 at
the registration form's first "Show password", so the second went to the same
eye and the repeat stayed hidden (T-223), flow 59 at "Sign In", the form left
filled in and the calendar never asked for (T-225), flow 38 at the profile tab
after a restart (T-234), flow 73 at a rehearsal's eye after the move, the mark
never taken back and no request sent (T-247, `audit/evidence/T-247`).

It is below the app, and cannot be made to happen on demand. The rule:

- A tap whose result the flow waits for, where a lost tap has failed or can
  fail a flow, goes through `e2e/subflows/tap-and-see.yaml` with `TAP_ID` (an
  id) or `TAP` (a text), `SEE` (the text it brings on screen) and `WAIT_MS`
  (the wait the flow had anyway). It taps and waits; if `SEE` is not there it
  taps once more - never more - and waits again, and then `SEE` must come.
  No pause, no longer wait. A tap whose result is something leaving the
  screen gives `GONE` (the text that goes) instead of `SEE`: "Cancel" of an
  invitation, `GONE: "Project Invitation"` (flow 43); or `GONE_ID` (its id), for
  a control whose label is in the screen's language: "Sign In"
  (`login-submit`) at every sign-in (T-225). A toggle, whose label is the same
  either way, gives `SELECTED` (`"true"` or `"false"`): the toggle tapped is
  then so and enabled again; with `RIGHT_OF`, the text of its row, when every
  row has one - a rehearsal's eye, `seen-toggle` (flow 73, T-247).
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

### A run past midnight

The seed is made for one day, the machine's today, and the app's today turns
at the machine's midnight. One Maestro over the whole set started at 23:09 ran
every flow after 00:00 against yesterday's seed: `TODAY_DAY` was a day before
the app's, and each flow about today failed at once — seven of them on
T-225 (T-226). So `run.mjs` gives Maestro the flows in batches that end before
midnight — as many as fit at 5 minutes a flow (`FLOW_BOUND_MS` in
`e2e/midnight.mjs`: the longest, flow 70, takes 3 min 20 s, and a Maestro 54 s
to start) — and, when not one fits, waits for midnight. The wait is time the
supervisor's limit does not give (a setup and 2.5 minutes a flow, 12.5 minutes
for one; `e2eLimitMs`), so the runner keeps the same deadline from its start:
a wait it could not end in it — with the new day's seed, a Maestro and the
flows left at the longest's time each — is not begun, and the run stops as not
ready (75), to be taken again after midnight. `e2e/__tests__/midnight.test.mjs`
plays it for any start in the half hour before midnight. Before each batch
it compares the day with the seed's; a day that turned gets a database of its
own in the same container (`rehearsly_e2e_<YYYYMMDD>`), the server restarted
on it and the seed made again, so the next flows get the new day's
`${…_DAY}`, `${…_LABEL}` and ids. Far from midnight the whole set is one batch,
one Maestro. The batches' reports are merged into `e2e/out/junit.xml`
(`e2e/junit.mjs`), rewritten after each, and their screenshots go to one
folder under `e2e/out/artifacts`, a flow's folder in it as from one Maestro —
each batch's Maestro folder is emptied into it, where the supervisor takes a
red run's failed flows from (`artifacts/<run>/<flow>`);
`server.log` and `migrate.log` go on across the days, and `seed.json` is the
last day's.

To see it without waiting for the night, run with `TZ` of a zone where
midnight is a few minutes off: the seed, the profiles and Maestro all take the
runner's zone; the simulator keeps Honolulu.

A flow that needs something changed behind the app's back while it runs — what
another device would do — calls the local server from `e2e/scripts` with
`runScript`; `${API_URL}` is its address (flow 10). A rehearsal moved
by its admin elsewhere: `e2e/scripts/move-rehearsal.js` with `API_URL`,
`EMAIL`, `PASSWORD`, `REHEARSAL` (an id, `${<KEY>_REHEARSAL}`) and `HOURS`
saves it that many hours later, title and place as they were (flow 73). A
person put on a rehearsal there: `e2e/scripts/add-to-rehearsal.js` with the
same and `MEMBER` (an address in its project) saves it as it is, its cast
kept and the member added (flow 79). A code the server
mailed is read the same way: `e2e/scripts/read-code.js` with `MAIL_URL`
(`${MAIL_URL}`), `TO` and `NAME` puts it in `${output.<NAME>}` (flows 11, 12).

A late answer is made the same way: `e2e/scripts/hold-answers.js` with
`MAIL_URL`, `METHOD` and `PATH` (a regular expression on the path) holds the
answers to matching requests until `release-answers.js` — the request is
handled at once, only its answer waits, as on a slow network (flows 16–18,
20). An answer waits nine seconds at most, inside the ten seconds of silence
after which iOS may give up on the request; `MS` makes it longer, for an
answer the flow releases later (below: when `DROP`, when `MS`). A hold
lapses after a minute, so a flow that fails before its release does not slow
the next — and that minute counts from the hold, not from the request it
catches: the hold goes on just before the step that asks, never before steps
whose time the flow does not know. Flow 42 held the projects before its
sign-in; the cold keyboard dropped the email, the typing went in again, the
sign-in asked 68 s after the hold and got its answer at once (T-234). A hold
on what a sign-in asks for goes between `sign-in-fill.yaml` and
`sign-in-submit.yaml`, the two halves of `sign-in-form.yaml`. `BEFORE: "1"` holds the request itself instead: the server handles
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
`DROP: "1"` answers nothing: the server closes the request's connection at
once, as when the network goes, and the app's request fails then and there
(flow 30). A GET whose connection drops iOS sends again by itself (flow 16:
one read in `metro.log`, three drops in `server.log`), so a dropped GET is held
without `ONCE` and the flow releases it when the network should be back (flow
52). With `BEFORE: "1"` too, the request waits and its connection is
closed on release (or when its `MS` lapses), never handed to the server: a
request that fails late, after something else has landed, when the flow says
(flow 36).
`LOSE: "1"` hands the request to the server and closes its connection instead of the answer: the change is made, the app's request fails (flow 13).
`DEAD: "1"` changes the network under the app at the matching request: its
connection and every other one the app has open go silent — read, never
answered, never closed — and a new connection is answered as usual; with
`ONCE` the hold goes after that request. `server.log` names the connection
each request on that path came on ("connection #3, which the network left
behind", "connection #4, a live one"). The phone after LTE→5G (flow 82,
T-240). The app's request fails when iOS gives up on the silence; on the
simulator that came as a network error within the flow's wait.

A request that got no answer (timeout, broken connection, offline) makes the
app flush React Native's connection pool and send a read or a sign-in once
more (`api.ts`, `plugins/connection-renewal`, T-240): a GET held with `DROP`
is asked twice by the app, besides iOS's own repeat, so hold it without
`ONCE` when it must fail. A change — POST, PUT, DELETE other than a sign-in
— is not sent again, and `DROP`/`LOSE` with `ONCE` on one fails as before.

When `DROP`, when `MS`. The app's ten seconds (`REQUEST_TIMEOUT_MS`) are not
the app's: axios hands them to NSURLSession, and iOS gives up after ten seconds
of silence — or does not: in a night run (T-220) the import heard nothing for
40 s and then got its 200 when the hold lapsed. So no flow counts on iOS giving
up.
- The point is a request that fails ("as offline", "does not come at all",
  "goes nowhere"): `DROP`, and the wait for the error has no ten seconds in it
  (flows 10, 16, 30, 34, 52). A failure that must come after something else:
  `DROP` with `BEFORE`, and `release-answers.js` when it should (flow 36).
- The point is a late answer the flow releases after something changed: `MS`
  as long as the flow needs, and no check may depend on whether iOS gave up
  first. Flow 37 needs it not to have given up yet: ten seconds of silence are
  the least iOS waits, so from the tap to the release fits in them (below).
A request held `BEFORE` puts the server's status in `server.log` on release
("the server answered 401"), so a flow that needs a real refusal shows it had
one: a sign-out ends the tokens, and a change released after it is refused
(flow 37). From the tap to the release must fit in iOS's ten seconds of
silence, or iOS may give up first and the failure is a timeout; bring the next controls
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

A push itself can be delivered: `e2e/scripts/push.js` with `MAIL_URL`,
`SIMULATOR`, `APP_ID`, `TYPE` (`role_changed`), `PROJECT` and `ROLE` hands the
simulator what `notifyRoleChanged` sends, its data under `body` as Expo puts
it for iOS, through `xcrun simctl push`; the app's received-push listener
gets it as from a phone (flow 75). A role changed on another device:
`e2e/scripts/set-role.js` with `API_URL`, `EMAIL` (the owner), `PASSWORD`,
`PROJECT` (a name), `MEMBER` (an address) and `ROLE` (flows 75, 76, 77).

An inbox that grows while the app is open: `e2e/scripts/notify.js` with
`MAIL_URL`, `EMAIL`, `COUNT` and `TITLE` records `COUNT` notifications through
the server's own `recordNotifications`, titled "`TITLE` 1" (the oldest) to
"`TITLE` `COUNT`" (flow 33). With `TYPE` it sends one as the server's own code
sends it: `member_joined` with `PROJECT` and `MEMBER` (flow 61),
`admin_appointed` with the same — "New administrator", told to those who run
the project, the role left as it is (flow 88),
`rehearsal_updated` with `REHEARSAL` (a title) and `CHANGE`, `member_response`
with `REHEARSAL` and `MEMBER` (flow 62), `rehearsal_created` and
`added_to_rehearsal` with `REHEARSAL` — a new rehearsal and one the reader was
put on, in the reader's language (flow 86).

How large an icon is drawn: a button that is only an icon is one element,
44 a side, and Maestro sees nothing inside it. `e2e/scripts/icon-size.js` with
`MAIL_URL`, `SHOT` (a `takeScreenshot` the flow took), `COLOUR` (`#rrggbb`),
`LEFT`, `RIGHT`, `TOP`, `BOTTOM` (fractions of the screen) and `MIN_WIDTH` or
`MIN_HEIGHT` (points) fails when the pixels of that colour there make a smaller
box (`e2e/ink.mjs`; flow 62, the inbox's 24-point icons). `e2e/scripts/no-ink.js`
with the same `SHOT`, `COLOUR` and region fails when anything there is drawn in
that colour: an icon that must be gone from inside a card (flow 63, the tick the
projects list no longer draws).

What the server stored from a bug report: `e2e/scripts/bug-report-received.js`
with `MAIL_URL`, `EMAIL`, `MESSAGE` and `SCREEN` fails unless the account has
exactly one report with that text, sent from that screen (flow 47).

Something copied in another app: `e2e/scripts/set-pasteboard.js` with
`MAIL_URL`, `SIMULATOR` (`${SIMULATOR}`, the device's udid) and `TEXT` puts
the text on the simulator's pasteboard (`xcrun simctl pbcopy`). Maestro's
`setClipboard` keeps it to itself, for its own `pasteText`; iOS's paste
control reads the system's (flow 08).

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

A fix that shows on screen only while a Google or Apple sign-in is still
under way — the refusal arrives after the person has left the screen — is
proved by Jest with the real `AuthProvider`, red before and green after. The
stand has no Google or Apple provider, and one that held the request open
would be a test path in the sign-in code, a mechanism of its own for a rare
case (T-224: a late refusal alerted on the registration screen).

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
  report focus, so there is nothing else to wait on. It taps "Sign In"
  through `tap-and-see.yaml` with `GONE_ID: login-submit`: one lost tap on it
  left flow 59 on a filled-in form (T-225). iOS's "Save Password?" sheet
  after a sign-in is off on the e2e simulator: the runner turns AutoFill
  Passwords off at boot (`noPasswordOffer` in `e2e/run.mjs`), so no flow waits
  for it or taps "Not Now" (T-213 did, T-246 took it out). Flow 01 sees that it
  stays away. A flow that acts before
  signing in launches the app itself and then runs `sign-in-form.yaml`.
- Maestro's `launchApp` grants the app every permission unless it is given
  `permissions:`, so the sign-in subflow's launch leaves calendar access
  granted. A flow that needs iOS to ask — and to be answered by the flow —
  launches with `permissions: { all: unset }` and then runs
  `sign-in-form.yaml` (flow 09-onboarding refuses the calendar's prompt).
- Open a link through `e2e/subflows/open-link.yaml` (`env: { LINK: ... }`): iOS
  asks 'Open in "Rehearsly"?' first, and it answers.
- Find controls by `testID` (`id:` in Maestro), not by their English label.
- A touchable card is one accessibility element labelled with all of its text:
  match a part of it as a regex, `".*Act I run-through.*"`.
- A tab is labelled `"<label>, tab, N of M"`, and `text:` must match all of
  it: `id: tab-calendar` with `text: "Календарь, tab.*"`, never `"Календарь"`
  alone (T-001 failed on it; flow 44).
- `EXPO_PUBLIC_E2E=1` (set by the runner) silences the development warning
  toasts, which sit over the tab bar.
- Maestro does not run the flows in file order, and they share one database:
  a flow never relies on what another one created. A flow that asserts on
  slots or busy times gets people of its own in the seed: a rehearsal another
  flow books for a shared person changes their day (flow 07 has its own
  director for that). Find a control by its own card, not by `index` — and
  not by `rightOf`/`below` a card's text either where the list has several
  of it: every row's eye is right of every title, and Maestro took the first
  in the list, a rehearsal another flow had put before it (T-223, flow 04).
  `childOf` the row does not help: Maestro's iOS hierarchy puts the eye
  beside the row, not in it. The control says which card it belongs to — the
  seen eye is labelled `"Mark as seen, <title>"` — and the flow takes it by
  `id:` and that label (`text: ".*Act I run-through"`); a value it shows (the
  count) is read with `copyTextFrom` and `assertTrue`. A project
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
- The availability editor shows "Loading..." and no list until its first read
  is in, every time it is opened. A `scrollUntilVisible` begun then looks at
  "Loading...", and its swipe goes to the list that came meanwhile: the week
  it wanted goes up out of sight, and the scroll goes on down to the spring
  (T-030; flows 27 and 64, T-223). Wait for the day with its status first
  (`extendedWaitUntil`, as `availability-pick-mark-day.yaml`), then scroll —
  for a day in the two weeks the editor opens on.
- A tap the flow then waits on the result of, where a lost tap has failed a
  flow, goes through `e2e/subflows/tap-and-see.yaml` (see "A lost tap"), not
  a `repeat` or `retry` of its own.
- Docker Desktop idles its VM; the runner wakes it with a long-timeout call
  before anything else.

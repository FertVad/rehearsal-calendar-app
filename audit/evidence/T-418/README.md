# T-418 - flow 44 failed on the supervisor's check of T-416 (07b6a76, 26.11.2026)

## The failure, from the red run's logs

`e2e/out/failed/T-416-2026-11-26T01-50-23-464Z` (not in git), flows 44 and 87
run alone. 44 failed at `Assert that ".*support@rehearsly.me.*" is visible`
(03:46:39.631 -> 03:46:58.052) with `MaestroException$AppCrash` thrown from
`IOSDriver.contentDescriptor` - a read of the screen. The screenshot at the
failure shows the support page open in Safari, in Russian, support@rehearsly.me
on it: the app did what the step checks.

The driver's `device-xctest.log`:

```
15:46:39.673737 Detected running apps: ["com.rehearsal.app", "com.apple.mobilesafari"]   (the app read, 0.4 s)
15:46:41.418461 Detected running apps: ["com.apple.mobilesafari"]                        (the app suspended)
15:46:41 - 15:46:49 Find the Application 'com.apple.mobilesafari' (retry 1, retry 2)
15:46:57.923720 Snapshot failure ... "Error getting main window kAXErrorAPIDisabled"
... the same at 15:47:14, and Maestro, its app not running in front, calls it a crash.
```

Safari (pid 36426) had been launched by the tap, at 15:46:38.85, and its
accessibility was off from its start to its end:

```
15:46:41.365531 MobileSafari[36426]: WebContent[0] AXS AccessibilityEnabled: (app ax: 0), ax settings: 1, cached: 1
15:46:41.423878 MobileSafari[36426]: (XCTTargetBootstrap) Got availability notification from test daemon.   <- XCTest asks
15:46:41.538893 MobileSafari[36426]: XCTAS Error: ... Error getting main window kAXErrorAPIDisabled
```

No tap was lost: the tap opened the page. `tap-and-see.yaml` is not the answer.

## The cause (review 1)

The first round's account - "the night run passed because earlier flows had
opened Safari; once the driver has asked Safari, later launches come up on" -
was wrong, as review 1 showed from the night runs: there flow 44's or 107's
Safari was the first the driver met, and it came up on. `first-safari.txt`
lists every Safari process in every device log kept here
(`safari-starts.mjs`):

- Every Safari with "app ax: 0" (5) said at its start, for each preference
  domain it opened, com.apple.Accessibility among them, "Disabling saving
  preferences for { … } because home directory is inaccessible"; none of the
  17 with "app ax: 1" did. Side by side (`ax-lines.mjs`) the off and the on
  Safari of one run differ first there; the XCTest handshake is the same.
- Each of the five was the first Safari to start since the simulator's boot -
  the runner boots it for every run. In runs alone that was 5 of 8 first
  Safaris; no later Safari ever was, the one right after an inaccessible first
  among them, whether the driver had asked that first or not. The night
  runs' first Safari came 28-67 min after the boot and was readable.

So the boot's first Safari can start without its home, and so without
accessibility, and the run alone hands it to a flow. The pause probe
(`probe-pause-then-help.yaml`, one run, the first Safari read after a 4 min
pause) does not settle whether the time since the boot matters; the fix does
not depend on it.

## The fix: in the runner

`firstSafari` (`e2e/safari.mjs`), called by `e2e/run.mjs` right after the boot,
before Maestro: Safari stopped and its tabs removed, launched with `simctl
launch`, its process read in the device log until it says it started, then
stopped; the run's log says whether its home was readable. Every flow's Safari
is then a later one - flows 44 and 107 alike, and any flow after them; no
flow carries a step for it. The first round's steps in flow 44 are gone; the
flow is as at e0e2c9d. docs/e2e.md, "Safari's first launch".

It must have started: in `063411` Maestro's Safari was stopped 0.2 s after its
launch, never logged a line, and the tap's Safari came up as a first,
inaccessible.

## Red before

`red-before.txt`: flow 44 unchanged and the probe of twelve taps on "Help"
(the first round), and flow 107 alone on the runner without the step (review
1): the same failure, its Safari the boot's first, home inaccessible, "app ax:
0", lost.

## Green after

`green-after.txt`: flow 44 five times and flow 107 twice, each alone on its
own boot, with the step: twelve flow Safaris, all readable, none lost. 107
failed once on another race of its own (Safari's alert over an empty address
field after the App Store redirect), not of this task - described there.

## The bugs the flow guards

Flow 44 guards T-005 (the language kept by the account: after a restart and
after signing out, the app cleared and signed in again), T-011 ("Help" opens
the support page), T-039 (the privacy row between Help and the bug report,
its page in Russian) and T-256 ("Start Week On"). All five green runs passed
all of it: none came back.

## Tools

- `safari-starts.mjs` - each Safari in device logs: start, "app ax", home.
- `safari-ax-scan.mjs` - each opening of Safari in a driver log: read or lost.
- `ax-lines.mjs` - one process's accessibility lines, for a side-by-side.
- `ax-prefs.mjs` - the simulator's accessibility preferences (first round).
- `probe-help-from-app.yaml`, `probe-safari-up-first.yaml`,
  `probe-pause-then-help.yaml` - the probes, not flows of the suite.

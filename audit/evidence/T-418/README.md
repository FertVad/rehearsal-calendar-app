# T-418 - flow 44 failed on the supervisor's check of T-416 (07b6a76, 26.11.2026)

## The cause, from the red run's logs

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

Safari (pid 36426) had been launched by the tap, at 15:46:38.85 - the first
Safari since the runner booted the simulator. Its log says why it could not be
read: its accessibility was off from its start and stayed off,

```
15:46:41.365531 MobileSafari[36426]: WebContent[0] AXS AccessibilityEnabled: (app ax: 0), ax settings: 1, cached: 1
15:46:41.423878 MobileSafari[36426]: (XCTTargetBootstrap) Got availability notification from test daemon.   <- XCTest asks
15:46:41.538893 MobileSafari[36426]: XCTAS Error: ... Error getting main window kAXErrorAPIDisabled
... "app ax: 0" in every WebContent process to 15:47:14
```

while on the night run of d82db11, where 44 passed, its Safari logged "app ax: 1"
- Safari had been opened by earlier flows that night. T-416's own green check
had this failure on its first try too (`audit/evidence/T-416/44-green-after.txt`).

No tap was lost: the tap opened the page. `tap-and-see.yaml` is not the answer.

## Red before

`probe-help-from-app.yaml`: signed in, on the profile, flow 44's order twelve
times - `fresh-safari.yaml`, a tap on "Help", the page waited for, the app
back. `safari-ax-scan.mjs` lists each opening of Safari in a
`device-xctest.log` and the ones the driver never read (exit 1 if any).
`red-before.txt`: the first opening lost in both runs of the probe; the other
eleven read, each a launch of its own, each "app ax: 1" from its start, before
XCTest asked it; and flow 44 itself, unchanged, red the same way.

## What turns Safari's accessibility on

Every Safari after the first came up with it on. What the first lacked was
not its being first: two orders were tried (`green-after.txt`, at its end).

- Maestro launching Safari before the tap and leaving it unasked
  (`probe-safari-up-first.yaml`): the probe passed 12 of 12, and flow 44 in
  that order passed once - their first Safari came up "app ax: 1" - and failed
  once, its first Safari "app ax: 0", the tap's link opened in it.
- Maestro launching Safari, `fresh-safari.yaml` stopping it unasked, the tap
  launching it again: the tap's Safari "app ax: 0", lost.

So the first Safari of a run comes up off or on, whoever launches it, and a
later one comes up on once the driver has asked Safari for its screen (the
handshake, "Got availability notification from test daemon") - in the probe
that was the first opening's failed read. In flow 44 run alone, nothing had
asked Safari before the tap.

`ax-prefs.mjs` prints the simulator's accessibility preferences: at rest
`ApplicationAccessibilityEnabled` and `AutomationEnabled` are 0 (XCTest's, for
its session); nothing on the disk the runner could set before the run.

## Green after

Flow 44, before "Help": `fresh-safari.yaml`, Maestro launches Safari, an
optional wait reads until the app is not what is read (the driver reads the
app behind Safari until iOS suspends it, docs/e2e.md "Safari over a running
app"; then Safari, whose read fails when it is off - hence optional: the
asking counts, not the answer), `fresh-safari.yaml` stops it, the app comes
back, the tap. `green-after.txt`: two runs, one whose first Safari came up off
(the wait warned; the tap's and the policy's Safari came up on) and one whose
first came up on (the wait passed at once). docs/e2e.md, "Safari's first
launch".

## The bugs the flow guards

Flow 44 guards T-005 (the language kept by the account: after a restart and
after signing out, the app cleared and signed in again), T-011 ("Help" opens
the support page), T-039 (the privacy row between Help and the bug report,
its page in Russian) and T-256 ("Start Week On"). Both green runs passed all of
it: none came back.

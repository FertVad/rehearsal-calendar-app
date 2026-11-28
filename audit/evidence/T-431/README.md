# T-431 - flow 98 failed on c57a1dc's night run, passed alone

## The failure

`e2e/out/failed/full-e2e-c57a1dc-2026-11-28T16-39-03-505Z` (not in git). Flow
98 failed at its first wait, `".*Rehearsly.*"`, with "App crashed or stopped"
17 s into a 30 s wait. The screenshot shows the invite page loaded and Safari's
question 'Open this page in "Rehearsly"?' over it, so the server and the page
did their part. Maestro never read the screen: every read of Safari was
`kAXErrorAPIDisabled`, and Maestro calls an unreadable app a crash. There is
no crash report, because Safari did not crash.

Safari 56170, launched by the flow's `openLink`, said at its start "Disabling
saving preferences ... because home directory is inaccessible" for every
domain, com.apple.Accessibility among them, and its accessibility was off
("app ax: 0") for its whole life. This is the Safari T-418 found, but it was
not the boot's first. The runner's first launch that night was readable
(99489). 56170 was the boot's fifth, 2 h 40 min after the boot. So the
runner's `firstSafari` cannot cover it, and T-418's "never a later one" is
wrong. `red-before.txt` has the lines.

No tap was involved: the step that failed is a wait. `tap-and-see.yaml` is not
the answer.

## Why iOS does it

Not in the logs. CoreFoundation decides before the process has talked to
cfprefsd (a readable Safari's first lines are cfprefsd and "Loading
Preferences From User Session CFPrefsD"). Its HOME in runningboardd's job is
the same container as every readable Safari's. The binary has three nearby
messages: "home directory is inaccessible", "user home directory is
unavailable" and "Volatilizing domain, because home directory is invalid"
(`cf-strings.mjs`). Only the first is logged, and nothing says why.

What the homeless ones had in common is that no Safari was running before them
("found nothing to terminate"): the boot's firsts, T-416's flow 44 and this
one. Forty Safaris opened one after another, each right after a running one
was stopped, were all readable (`probe-open-invite-40.yaml`). That is a
correlation, not a cause. T-418's green runs had readable Safaris after
"nothing to terminate" too.

## The fix: the Safari a link launches is checked, not assumed

Flows 70 and 98 open their link through `e2e/subflows/open-in-safari.yaml`
(`LINK`), in place of `fresh-safari.yaml` and `openLink`. The runner's helper
(`/open-in-safari`, `openInSafari` in `e2e/safari.mjs`) does three things:

1. It makes Safari fresh, as `fresh-safari.yaml` does.
2. It opens the link with `simctl openurl`, which is what Maestro's `openLink`
   does. The device log shows the same "Opening URL" from CoreSimulatorBridge
   either way.
3. It reads the new Safari's lines in the device log until the process says it
   started.

If that Safari said its home is inaccessible, the helper stops it and opens
the link again in a new process. After three, the flow fails at the subflow.
`run.mjs` prints each replacement after the run ("Safaris replaced, their home
inaccessible"), the way it prints the taps taken again. The detection is
exact: in every log kept here, all Safaris with "home directory is
inaccessible" had "app ax: 0", and all without it that logged an "app ax"
had "app ax: 1" (`safari-starts.mjs`).

Flows 44 and 107 are not changed. Their Safari is launched by the app with a
tap, and a Safari started in front would cover the app.

## A second instability met on the way: the "Cancel" tap

This is not the night's failure; the checks of this task found it. Run alone,
flow 98's first tap - the first of Maestro's session - is "Cancel" of Safari's
question (in the night run it is not), and the simulator loses it. Before the
review this was counted as "four runs of nine, base and T-431 alike". That was
wrong on both counts: the lost ones then were five - 192458, 192940, 193916
(a first version that launched Safari before opening the link) and 200907,
201905 (the final one, link opened by `openurl`) - and none on the base flow,
which had been run alone only once (194415).

So the review's round ran it eight times on each, alternated
(`cancel-series.txt`): the base flow lost "Cancel" once (212542, failed at
"Open in the App Store" as 200907 did), the final one never. Over every run
where "Cancel" was the session's first tap:

| opened as | runs | lost |
| --- | --- | --- |
| base: `fresh-safari.yaml` + `openLink` | 10 | 1 (212542) |
| final: `open-in-safari.yaml` (`simctl openurl`) | 14 | 2 (200907, 201905) |
| dropped: `simctl launch`, then the link into it | 4 | 3 |

The base and the final version lose it at the same rate: the helper's
`launchctl list` and `log show`, done seconds before the tap, do not cause it.
Each lost tap has the T-207 signature in backboardd: "we already have a
service for senderID", then "didn't see a previous touch down ... skipping
event". The first tap of a testmanagerd session always registers its
digitizer twice - 195552, which kept its tap, has "we already have a service"
too - and then the touch's events go to one state or the other; the session's
first tap is what T-207 already found lost most (the first tap of sign-in).
The question stayed up, and the wait for "Open in the App Store" failed
(192458, 200907, 212542).

So "Cancel" now goes through `tap-and-see.yaml` (`GONE: "Open this page
in.*"`), the one shared mechanism for a tap the simulator loses (T-207). The
journal proves the loss; it is not assumed. With it, 192940, 193916 and
201905 passed, each with "tapped "Cancel" again" in the run's output and the
signature in its log (`green-after.txt`).

The first version (Safari launched by `simctl launch` and left running, the
link opened into it) was dropped. Opening the link with `openurl`, as
`openLink` does, keeps Safari's start as it was before this task.

## The bug the flow guards

T-267: the invite page reads "Rehearsly" (not "Rehearsal App") in all four
languages, with both App Store steps. Every green run above passed all of its
assertions in EN, RU, ES and DE, including `assertNotVisible:
".*Rehearsal App.*"`, so the bug has not come back.

## Tools

- `safari-starts.mjs`: each Safari in device logs, with its start, "app ax",
  home, and the terminate and open just before it.
- `window.mjs`: the processes that log in a window of a device log.
- `lines.mjs`: the lines of a device log in a window, matching a pattern.
- `lost-touches.mjs`: the touches backboardd lost, per log, with the flow's
  first tap.
- `cancel-series.txt`: the review's series, base and final, eight runs each.
- `cf-strings.mjs`: the strings of a binary around a pattern (CoreFoundation's
  messages).
- `probe-open-invite-40.yaml`: flow 98's opening, forty times. A probe, not a
  flow of the suite.

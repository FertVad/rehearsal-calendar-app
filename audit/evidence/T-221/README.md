# T-221 — flow 30 lost its tap on the Profile tab

Flow: `rehearsal-calendar-native/e2e/flows/30-sync-import-fails-export-runs.yaml`
("A sync whose import fails still exports").

## The red run (T-048 checks, 05.11.2026 10:52)

```
[Failed] A sync whose import fails still exports (1m 18s) (No visible element found: ".*Calendar Sync.*")
```

Maestro: `tapOnElement id tab-profile` COMPLETED (08:52:12.168Z, 2047 ms), then
`scrollUntilVisible ".*Calendar Sync.*"` FAILED after 21.6 s. Screenshots 046
and 048: the Calendar screen, the Profile tab never opened.

The simulator log of the same run (`e2e/out/artifacts/2026-11-05_103616/A sync
whose import fails still exports/logs/device-simulator.log`, lines 81246-81290)
has the T-207 signature exactly inside that tap:

```
10:52:12.994836 backboardd: [HID] we already have a service for senderID:1036C0E0000C9
10:52:13.007335 backboardd: [TouchEvents] didn't see a previous touch down or range-in event for pathIndex:2; skipping event
... (10 more "skipping event" up to 10:52:13.112106)
```

`node audit/evidence/T-207/touch-scan.mjs rehearsal-calendar-native/e2e/out/artifacts`:

```
2026-11-05_103616  A sync whose import fails still exports: digitizers 17, registered twice 2 (s after the app's last scene change: 3.81s/tap 0 after "unspecified -> foreground", 26.88s/tap 8 after "unspecified -> foreground"), app scene changes 6, taps lost 1
    lost 10:52:13.007 -> Something have changed in the UI judging by view hierarchy. Proceed.
```

`node audit/evidence/T-221/tap-at.mjs "<that flow dir>" 10:52:13.007`:

```
10:52:13.007 lost in tap {"idRegex":"tab-profile","optional":false} (2026-11-05T08:52:12.168Z +2047 ms, COMPLETED)
  next: scrollUntilVisible {"textRegex":".*Calendar Sync.*","optional":false} FAILED - No visible element found: ".*Calendar Sync.*"
```

The tap before it, `Not Now` (optional), was WARNED: no such element, no tap
made. So the one lost touch is the Profile tab's, and Maestro reported it done.
The first "registered twice" (10:51:49.932, sign-in) lost nothing.

## The same failure without that tap (old flow, tap removed)

A lost tap cannot be made on demand (T-207), so the flow was run once with
`tapOn: id tab-profile` deleted — what the app sees when the touch is lost:

```
$ npm run e2e -- e2e/flows/30-sync-import-fails-export-runs.yaml
[Failed] A sync whose import fails still exports (2m 14s) (No visible element found: ".*Calendar Sync.*")
1/1 Flow Failed
[e2e] taps taken again (tap-and-see.yaml): 0
```

Artifacts `2026-11-05_134533`: `scrollUntilVisible ".*Calendar Sync.*"` FAILED
after 22.0 s; screenshot step-054 is the same Calendar screen as the red run's
step-048. Same command, same message, same screen.

## After: the tab through `e2e/subflows/tap-and-see.yaml`

`TAP_ID: tab-profile`, `SEE: ".*Language, English.*"` (the profile's top row,
as flows 44 and 71), `WAIT_MS: 10000`. No new limit, no new retry: the one
shared mechanism of T-207.

```
$ npm run e2e -- e2e/flows/30-sync-import-fails-export-runs.yaml
[Passed] A sync whose import fails still exports (2m 8s)
1/1 Flow Passed in 2m 8s
[e2e] taps taken again (tap-and-see.yaml): 0
```

The bug the flow guards (EO02/EI02, cause fix 17: a failed import skipped the
export) has not come back: in this run the import's request was dropped and
the screen showed "Sync error" with "Exported rehearsals: 1".

Both of these runs also lost one touch each, at sign-in's `login-email`
(13:47:21.952, 13:54:00.749 by `tap-at.mjs`) — the first tap of sign-in, which
types inside `retry` (docs/e2e.md, "A lost tap"); neither failed the flow.

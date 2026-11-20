# T-277 - flows 70 and 98 failed on the night run of 25e2d1d (19.11.2026)

## The cause, from the red run's logs

`e2e/out/failed/full-e2e-25e2d1d-2026-11-19T01-52-58-540Z` (not in git).

Both failures are one step that failed with `CommandFailed: null` after 61 s,
the page on screen in the screenshot:

- flow 70: `Assert that "Privacy Policy" is visible` (extendedWaitUntil, 30 s)
  02:57:53.001 -> 02:58:54.305 FAILED;
- flow 98: `Assert that (Optional) "Cancel" is visible` (5 s)
  03:51:43.371 -> 03:52:44.225 FAILED. Its step before, `.*Rehearsly.*`,
  passed in 0.5 s.

The driver's `device-xctest.log` at those moments:

```
14:57:53.020027 Detected running apps: ["com.rehearsal.app", "com.apple.mobilesafari"]
14:57:53.021410 [Start] View hierarchy snapshot for Application 'com.rehearsal.app'
...                (two more reads of com.rehearsal.app, 0.25 s each)
14:57:53.939633 [Start] View hierarchy snapshot for Application 'com.rehearsal.app'
14:58:54.200872 Snapshot failure, cannot return view hierarchy due to ... "XCTPerformOnMainRunLoop work timed out after 60.0s"
14:58:54.412283 Detected running apps: ["com.apple.mobilesafari"]
14:58:54.861774 [Start] View hierarchy snapshot for Application 'com.apple.mobilesafari'
```

and the same for flow 98 at 15:51:42-15:52:44. The flows before them, 69 and
97, are the app's own and leave it running; 70 and 98 stopped only Safari.
With Rehearsly behind Safari, Maestro's driver read Rehearsly's hierarchy, not
the page (98's `.*Rehearsly.*` was found in the app), until iOS suspended the
app; the read that met the suspension waited 60 s on the app's main run loop
and the step failed. Alone, a flow starts with no app running: it passed.

No tap is involved (the night's one tap taken again was at 00:27 in another
flow), so this is not a lost tap and `tap-and-see.yaml` is not the answer.

## Red before: the night order, over and over

`probe-app-left-running.yaml`: the app brought to the front, then Safari
stopped and flow 98's invite page opened and read - eight times.
`wrong-app-scan.mjs` lists, for each opening of Safari in a `device-xctest.log`,
the reads of another app before Safari's first one (exit 1 if any).

```
$ npm run e2e -- ../audit/evidence/T-277/probe-app-left-running.yaml
[Passed] T-277 probe - Safari opened over the running app (2m 12s)

$ node ../audit/evidence/T-277/wrong-app-scan.mjs ".../T-277 probe - Safari opened over the running app/logs/device-xctest.log"
  Safari opened 8 time(s)
  18:51:31.348859  read another app first: 1
      18:51:35.186850 com.rehearsal.app
  18:51:48.728786  read another app first: 1
      18:51:51.992442 com.rehearsal.app
  18:52:03.753360  read another app first: 2
      18:52:07.093313 com.rehearsal.app
      18:52:07.352508 com.rehearsal.app
  18:52:18.642795  read another app first: 2
      18:52:20.946558 com.rehearsal.app
      18:52:21.168339 com.rehearsal.app      <- this read took 2.3 s
  18:52:32.216346  read another app first: 1
      18:52:34.450591 com.rehearsal.app
  18:52:45.539261  read another app first: 1
      18:52:47.831143 com.rehearsal.app
  18:52:59.452107  read another app first: 1
      18:53:01.580177 com.rehearsal.app
  18:53:12.966556  read another app first: 2
      18:53:15.174156 com.rehearsal.app
      18:53:15.398586 com.rehearsal.app
openings that read another app first: 8; of them hung 60 s: 0
exit 1
```

The wrong read came every time; the 60 s hang is its rare end, when a read
meets the suspension - this probe did not hit it. On the red night's log:

```
$ node ../audit/evidence/T-277/wrong-app-scan.mjs ".../full-e2e-25e2d1d-.../Invite page in Safari .../logs/device-xctest.log"
  Safari opened 3 time(s)
  14:19:24.467499  read another app first: 5     (flow 44: Safari opened from the app, on purpose)
  14:57:50.421588  read another app first: 4  (hung 60 s)     (flow 70)
  15:51:40.422762  read another app first: 4  (hung 60 s)     (flow 98)
openings that read another app first: 3; of them hung 60 s: 2
```

The unchanged flow 70 run after 69 here (2026-11-20 06:39) read the app
first too:

```
  18:41:11.894129  read another app first: 1
      18:41:14.838790 com.rehearsal.app
exit 1
```

## Green: the app stopped first

Flows 70 and 98 begin with `- stopApp: ${APP_ID}`. `probe-app-stopped.yaml` is
the probe with that line:

```
$ npm run e2e -- ../audit/evidence/T-277/probe-app-stopped.yaml
[Passed] T-277 probe - Safari opened with the app stopped (2m 53s)
$ node ../audit/evidence/T-277/wrong-app-scan.mjs ".../T-277 probe - Safari opened with the app stopped/logs/device-xctest.log"
  Safari opened 8 time(s)   - all 8: Safari read first
openings that read another app first: 0; of them hung 60 s: 0
exit 0
```

Safari's question 'Open this page in "Rehearsly"?' came all 8 times in both
probes (8 taps on "Cancel" each): it is asked because the app is installed,
so flow 98 still answers it.

The flows in the night's order:

```
$ npm run e2e -- e2e/flows/97-update-required.yaml e2e/flows/98-invite-page-in-safari.yaml
[Passed] Update required, then not (1m 43s)
[Passed] Invite page in Safari reads Rehearsly and its App Store steps in every language (23s)
2/2 Flows Passed in 2m 6s
  scan: Safari opened 1 time(s) - Safari read first; exit 0

$ npm run e2e -- e2e/flows/69-availability-drag-dont-save.yaml e2e/flows/70-privacy-lists-resend.yaml
  (cut by the session's 10-minute limit in 70's German part; 69 passed, 70 had
  passed its English, Russian and Spanish)
  scan of 70: Safari opened 1 time(s) - Safari read first; exit 0

$ npm run e2e -- e2e/flows/70-privacy-lists-resend.yaml
[Passed] Privacy policy lists Resend in every language (6m 15s)
```

## The bug the flows guard

Flow 70 guards T-038 (Resend named in the policy in four languages), flow 98
T-267 (the invite page's brand and App Store steps). Both read their lines in
every language in the green runs above: neither came back.

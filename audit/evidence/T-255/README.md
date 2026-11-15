# T-255: flow 10 "Availability saves the day it changed", red once on ec914b4

The red run: T-250's checks, 12.11.2026 19:05Z, 17 flows, flow 10 first after
the simulator's boot. `[Failed] ... (1m 49s) (Element not found: Text matching
regex: Mark Busy)`. Logs kept in `rehearsal-calendar-native/e2e/out/failed/T-250-2026-11-12T19-38-17-877Z/`.

## Which "Mark Busy"

Flow 10 taps "Mark Busy" three times (lines 39, 167, 266). The red run's
metro.log, lines 31-39, is flow 10's whole app side: the bundle, `POST
/auth/login`, `GET /native/projects`, `GET /native/notifications/unread-count`,
all 200, and nothing more until line 40, flow 16's launch. Each "Mark Busy"
opens the editor, which asks `GET /native/availability` at once; there is none.
So it was the first one: right after sign-in, `tapOn: id: tab-create` (the
"+"), then "Mark Busy" in the iOS action sheet the "+" opens, not found.

## What cannot be read any more

The run's Maestro folder (`maestro-artifacts.txt`:
`e2e/out/artifacts/2026-11-12_210803`) - screenshots, maestro.log,
device-simulator.log - is gone: the supervisor keeps a red run's pointed folder
for three days (`KEEP_POINTED_MS`, tools/autodev/lib/checks.mjs,
pruneArtifacts), and this task came after them. Without device-simulator.log a
tap the simulator lost (T-207, backboardd's "we already have a service for
senderID" / "skipping event") cannot be shown or excluded for that tap, and
metro.log cannot tell a tap that never reached the app from a sheet that never
came: neither writes a line.

## What was looked at and ruled out

- The cold Metro: the red run's first bundle took 66 s, but that is the run's
  own check of the bundle (`run.mjs` startMetro, before the simulator); the
  app's took 4.5 s, and the flow went past sign-in.
- iOS's "Save Password" controller. With AutoFill's offer off, iOS still
  hosts `SFPasswordSavingRemoteViewController` (SafariViewService) in the app
  right after "Sign In": 1.9 s on the first sign-in after boot, 0.2 s later
  (`password-window.mjs`). An action sheet presented on it would go when it
  goes. The probe below put the "+" inside that window on its first try
  (00:27:16.076, window 00:27:14.938-16.788): the sheet came, "Mark Busy" was
  tapped. Not the cause.
- `CreateActionSheet` (src/shared/components/CreateActionSheet.tsx): the
  effect shows the sheet once per `visible`, resets the guard when `visible`
  goes false; no path leaves a tap without a sheet.

## Runs on auto/main (97c9a65), probes.txt

- flow 10 alone: green, 3m 50s; its "+" 4.7 s after "Sign In".
- probe-sign-in-then-plus.yaml (flow 10's opening five times, the "+" after
  sign-in.yaml): 5/5 "Mark Busy".
- probe-tab-create-at-once.yaml (the "+" as soon as the tab bar is there,
  1.6-2.2 s after "Sign In"): 5/5 "Mark Busy".

## Lost taps on this machine (node audit/evidence/T-207/touch-scan.mjs rehearsal-calendar-native/e2e/out/artifacts)

161 flow logs, 3726 digitizers attached, 18 registered twice, 11 taps lost -
mostly the first taps after a launch; in flow 10's green run above, one: the
first tap on the email field, which `retry` took again. Lost taps happen here,
in the minute after a launch, and flow 10's "+" is the fourth tap after one.

## Where it stands

The rule (task, docs/e2e.md "A lost tap"): the "+" goes through
`e2e/subflows/tap-and-see.yaml` only if the red run's device log shows the tap
lost. That log was deleted before the task began, and the app-side causes
looked for did not reproduce. So no fix is made: one needs either the owner's
word that tap-and-see may go on this tap without the log (as it already does on
the "+" in flows 16, 27, 28, 29, 41, 49, 53, 54, 87, 89, 91), or the next red run of
flow 10 with its Maestro folder kept.

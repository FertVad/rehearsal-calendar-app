# T-253: the planner's tab "did not take" the first tap from Profil, in German

Source: the landing's shots (d3), 12.11.2026 on 6e87de6, and 10.11.

## Cause: the simulator lost those taps (T-207); the app is not changed

d3's own Maestro artifacts (`~/.maestro/tests/2026-11-10_18*`,
`2026-11-12_08*`) are kept in `d3/`: each run's `maestro.log`, its
screenshots, and, for every lost touch, its lines of `device-simulator.log`
verbatim with their line numbers (`lost-touch-<time>.log`). `touches.txt` is
every synthesized touch of those runs, classified by `d3-touches.mjs`;
`d3-extract.mjs` copies the rest.

Every tap on "Planner" that did nothing was lost below the app, with the
T-207 signature (docs/e2e.md, "A lost tap"): XCTest's digitizer registered a
second time (`*** already have a main display digitizer`, `*** unknown
digitizer ... -- initializing now`), ten events skipped (`didn't see a
previous touch down or range-in event for pathIndex:2; skipping event`), and
the touch cancelled while still down (`cancel -- digitizer did disappear`,
`canceling paths contacts: [pathIndex: 2; ... touching`) with no lift
(`presence: none`) before it.

| d3's tap | run | point | backboardd | file |
|---|---|---|---|---|
| 10.11 18:36:27, Planner by id, after the form | 2026-11-10_183616/planner | 274, 802 | lost | `d3/2026-11-10_183616/planner/lost-touch-183627.414.log` |
| 12.11 08:48:04, attempt 1, Planner by id, after the form | 2026-11-12_084753/planner | 274, 802 | lost | `d3/2026-11-12_084753/planner/lost-touch-084804.291.log` (lines 40-188) |
| 12.11 08:50:40, attempt 2, Planner by id, from Kalender-Sync | 2026-11-12_085028/planner | 274, 802 | lost | `d3/2026-11-12_085028/planner/lost-touch-085040.539.log` |
| 12.11 08:51:22, attempt 3, Planner at 70 %, 95 % | 2026-11-12_085110/planner-pt | 275, 809 | lost | `d3/2026-11-12_085110/planner-pt/lost-touch-085122.184.log` |
| 12.11 08:48:26, Profil by id (already shown, so unnoticed) | 2026-11-12_084815/sync | 353, 802 | lost | `d3/2026-11-12_084815/sync/lost-touch-084826.461.log` |
| 12.11 08:52:16, Kalender at 10 %, 95 %; Planner after it | 2026-11-12_085203/probe | 39, 809; 275, 809 | delivered | - |
| 12.11 08:52:54, Profil, then Planner | 2026-11-12_085243/probe2 | 353, 809; 275, 809 | delivered | - |
| 10.11 18:38:42, Planner again | 2026-11-10_183828/planner | 274, 802 | delivered | - |

Each lost touch is the first of its Maestro run; the swipes the same runs made
two seconds later were delivered (the 05b/05c frames moved the Profil list,
as the task saw). Every other touch of those runs was delivered: 189 of 190
in the 18 earlier runs of 12.11, the one lost being the DE sync's above.
With nothing between the app and a cancelled touch, there is no app state to
find: the tab never received a touch. Nothing in the app is changed.

### d3's sequence 2 was answered fully - the earlier conclusion was wrong

The first version of this README (77645b2) said the "removed" alert was left
unanswered and took every tap. d3's `d3/2026-11-12_084850/maestro.log` says
otherwise (lines 102-177):

1. 08:49:03.8 `Tap on ".*Alle exportierten entfernen.*"` - the screen's
   button: the question «Alle Proben aus dem Kalender entfernen?»
   (`de-confirm.png`).
2. 08:49:05.8 `Tap on point (50%,52%)` - the question's «Alle exportierten
   Proben entfernen»: the removal ran (`de-removed.png`, the "removed" alert).
3. 08:49:08.8 `Tap on point (50%,55%)` - the alert's "OK".
4. 08:49:10.5 `calendar-sync-toggle` - off, no alert left (`de-off.png`).

All four were delivered (`touches.txt`). The probe of that commit
(`probe-d3-taps.yaml`) left out step 2, so its 50 %, 55 % confirmed the
removal and the alert after it was never answered: a different case, which
it reproduced 5 of 5 times. That an alert takes every tap until answered is
iOS's behaviour and still true, but it is not what happened to d3. The probe
and its screenshots stay as a record of that mistake; they are not evidence
for d3's taps.

### Sequence 1, the form: not reproduced in the app, 0 of 7 runs

Seven runs with the form closed by "Nicht speichern" (by text, or at 50 %,
50 % as d3 did) opened the planner at the first tap
(`T-253-probe-profile-after-form.png`, `T-253-probe-after-planner-tap-1.png`).
d3's tap there was lost too (table above), so there is nothing left to
reproduce.

## Why only German: not shown; most likely the order of the runs

Nothing ties the lost taps to German. They are lost under the app, before
any text is drawn, and German changes neither the tab bar's points (274, 802
in every language) nor the touch's path. What the logs do show is when:

- 12.11: the languages ran RU 08:32, EN 08:37, ES 08:41, DE 08:45. All 4 lost
  touches fell between 08:48:04 and 08:51:22 - the first touch of four
  runs in a row - and none before or after (08:52:16 on, delivered).
- 10.11: German also ran last; its planner tap at 18:36:27 was lost, the one
  at 18:38:42 delivered.

So German was the language running when the simulator lost the first touch
of each new Maestro run, on both days. Why the simulator did that in those
minutes, the logs do not say. Not proven beyond that.

The stacked buttons of the question, which the task asked about, play no
part: d3's 50 %, 52 % and 50 %, 55 % took the buttons d3 meant, and in
English the question stacks the same way (`T-253-probe-question-en.png`).

## What is in the tree

- `e2e/flows/91-planner-tab-after-form-and-sync-german.yaml`: Polly, in
  German, takes both of d3's ways back to Profil, every dialog answered by its
  button, and opens the planner after each. The planner's tab goes through
  `tap-and-see.yaml` (`SEE: "Woche"`) like every tap whose result is waited
  for (docs/e2e.md, "A lost tap"): a lost first tap is taken once more and
  printed. Green, 2 m 7 s, no tap taken again (`flow-91-green.txt`). No app
  change, so no "red before".
- `e2e/seed.mjs`: Polly, Mackie, Jenny, their project, Mackie's busy hours.

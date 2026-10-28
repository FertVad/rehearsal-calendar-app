# T-208 — flow 26 "A rehearsal made from 23:00 to 01:00 ends the next morning"

Fix: `f9abfc5` (base `d780a18`). Simulator "Rehearsly E2E", Maestro 2.11.0, Node 22.

## What failed, and why only sometimes

Supervisor's red run (T-118, 25.10.2026, 22:46 machine time):
`[Failed] … (Assertion is false: "Select End Time" is visible)`.
Its screenshot shows the end-time picker on screen; its hierarchy dump
(`step-044-assertCondition-Select_End_Time.json`) has no element at all from the
app — only empty full-screen containers and the status bar.

The path depended on the hour. The form starts at the current hour, end two
hours later (`useAddRehearsalForm`). The flow sets the start to 23:00:

| Run starts at | Default | After start → 23:00 | End picker opened? |
|---|---|---|---|
| 22:xx | 22:00–00:00 (overnight) | end kept at 00:00 | yes |
| any other hour | H:00–H+2:00 | end → 01:00 | no |

Over the 145 kept Maestro runs (`e2e/out/artifacts`), the end picker was opened
in two: 2026-10-24 15:46 (an older flow that always opened it) and
2026-10-25 22:46 (the supervisor's). Both failed at the same assertion. Every
run at another hour passed without opening it. Not a lost tap: the tap landed
(`device-simulator.log`, `Sending UIEvent … to window`), the sheet came up.

## Probes (`probes/`, run as `npm run e2e -- <probe>.yaml` from an e2e/ copy)

| Probe | Result |
|---|---|
| start picker → Done → end picker (form) | **fails**: "Select End Time" not visible |
| end picker first → Done → start picker (form) | **fails** on the start picker |
| start picker twice (form) — `same-picker-twice.yaml` | **fails** on the second |
| profile timezone list twice (tab screen) | **fails** on the second |
| the same, `animationType="none"` | **fails** on the second |
| profile timezone list, then the form's first picker — `modal-then-other-screen.yaml` | **passes** |
| `first-open-tree.yaml`: tree of a first sheet, dumped by failing | sheet's texts all in the tree |
| start picker twice, picker in `FullWindowOverlay` | **passes** |

So: on iOS, React Native's `Modal` leaves the second sheet a screen presents
out of the accessibility tree; animation does not matter, another screen's
first sheet is whole. XCTest reads the same accessibility tree as VoiceOver.
`tree.mjs` prints a hierarchy dump; `search.mjs` searched node_modules.

## Fix

`AppModal` shows every sheet and dialog: on iOS in react-native-screens'
`FullWindowOverlay` (presents nothing, content marked modal), the same slide or
fade; Android keeps `Modal`. All 12 sheets moved (`to-app-modal.mjs`, imports
by hand). `modalBackdrops.test.ts` fails on any file but `AppModal.tsx`
importing `Modal` from react-native. Flow 26 now opens both pickers at any hour.

## Red before, green after

- `red-flow26-base.txt` — app files at `d780a18`, new flow 26, run at 03:5x: fails at "Select End Time".
- `green-flow26.txt` — `f9abfc5`, run at 04:03: passes.
- `red-jest-base.txt` — guard test at base: 8 files import Modal.
- `green-checks.txt` — type-check, secrets, frontend Jest, other flows with sheets.

The bug flow 26 guards (DF04, cause fix 15: a 23:00–01:00 form saved ending the
next morning) has not come back: the green run asserts "next day" on the form,
the saved card "23:00 — …, 01:00" and the reopened details; clockRange,
useAddRehearsalForm and useAddRehearsalSubmit Jest: 57/57.

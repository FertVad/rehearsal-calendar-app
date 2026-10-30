# T-010 — participants: one row and a sheet, one component for the form and the planner

Fix: `983a329`. Base: `7f9039d`. Simulator: iPhone 16 (393×852 pt).

## Red before (`src/` put back to `7f9039d`, the flows of the fix kept)

```
git restore --source=7f9039d -- src
npm run e2e -- e2e/flows/07-planner-project-switch.yaml e2e/flows/06-planner-to-rehearsal.yaml
[Failed] Planner follows the project (1m 15s) (Assertion is false: "Participants, \d+ of 3", id: participants-row is visible)
[Failed] From the planner to a rehearsal (52s) (Assertion is false: "Participants, 4 of 4", id: participants-row is visible)
2/2 Flows Failed
git restore --source=HEAD -- src
```

The old screens have no participants row: the planner showed a "Clear"/"Select
All" tick button, "Expand" and a "4 of 4 selected" plate; the form the same
with "Deselect All" and "Selected: 4 of 4".

## Green after (`983a329`)

```
npx jest --selectProjects frontend --silent ParticipantPicker src/features/smart-planner src/features/calendar modalBackdrops src/i18n
Test Suites: 21 passed, 21 total
Tests:       227 passed, 227 total      (+2 in AddRehearsalScreen.test.tsx, run after)
npm run type-check                      clean

npm run e2e -- e2e/flows/07-planner-project-switch.yaml e2e/flows/06-planner-to-rehearsal.yaml e2e/flows/20-save-before-availability.yaml
[Passed] Planner follows the project (1m 47s)
[Passed] From the planner to a rehearsal (1m 1s)
[Passed] Save before the availability is in (57s)
3/3 Flows Passed

npm run e2e -- e2e/flows/26-past-midnight-form.yaml e2e/flows/45-busy-seen-by-director.yaml e2e/flows/40-details-seen-one-model.yaml
[Passed] A rehearsal made from 23:00 to 01:00 ends the next morning (2m 40s)
[Passed] Busy marked by an actor, seen by the director (1m 44s)
[Passed] Details and the card read one seen mark (51s)
3/3 Flows Passed
```

Screenshots (`e2e/out/artifacts/2026-10-30_025413/`):
`07-form-smirnov-busy` — the form's row "Participants 2 of 2 ›" with
"Smirnov busy 10:00–14:00" in orange under it; `07-form-participants-sheet` —
"All participants 2 of 2" ticked, "Olga Stage admin", "Grigory Smirnov
10:00–14:00" on the right; `06-participants-sheet` — "All participants" mixed,
2 of 4.

Flow 20 also read "Selected: 1 of 1" of the old form; it reads the row now.
Flow 40 does not touch the picker and passes unchanged.

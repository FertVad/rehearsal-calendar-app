# T-009 — the main action in a pinned bottom bar

Fix: `2cbb601`. Base: `a795f23`. Simulator: iPhone 16 (393×852 pt).

## Red before (files of the fix put back to `a795f23`)

### Jest — `AvailabilityScreen.tsx`, `availabilityScreenStyles.ts` at base

```
npx jest --selectProjects frontend --silent --runTestsByPath src/features/availability/screens/__tests__/AvailabilitySaveBar.test.tsx

FAIL frontend src/features/availability/screens/__tests__/AvailabilitySaveBar.test.tsx
  ● the bar under Save ends 8 pt above the home indicator
    Expected: 42
    Received: 12
  ● with a day picked and nothing changed, Save is there and off
    Unable to find an element with testID: availability-save
Tests:       2 failed, 1 passed, 3 total
```

### e2e flow 10 — same two files at base

```
npm run e2e -- e2e/flows/10-availability-days.yaml
[Failed] Availability saves the day it changed (1m 40s) (Assertion is false: id: availability-save, disabled is visible)
1/1 Flow Failed
```

### e2e flow 20 — `AddRehearsalScreen.tsx`, `addRehearsalScreenStyles.ts` at base

Only `testID="rehearsal-location"` was added to the old form, so the flow
could find the field; nothing else of the fix.

```
npm run e2e -- e2e/flows/20-save-before-availability.yaml
[Failed] Save before the availability is in (1m 23s) (Assertion is false: ".*availability for this day is still being checked.*" is visible)
1/1 Flow Failed
```

The screenshot `20-create-over-keyboard` of that run
(`e2e/out/artifacts/2026-10-30_005929/`): the location typed, the keyboard
up, Create under it — the tap landed on the keyboard.

## Green after (`2cbb601`)

```
npx jest --selectProjects frontend --silent AvailabilitySaveBar backToTabs
Tests:       8 passed, 8 total

npm run e2e -- e2e/flows/20-save-before-availability.yaml
[Passed] Save before the availability is in (1m 44s)
npm run e2e -- e2e/flows/10-availability-days.yaml
[Passed] Availability saves the day it changed (2m 33s)
npm run e2e -- e2e/flows/03-create-project.yaml e2e/flows/02-create-project-from-rehearsal-form.yaml
[Passed] Create a project (1m 4s)
[Passed] Create a project from the rehearsal form (42s)
```

Screenshots: `20-create-over-keyboard` (`2026-10-30_002958`) — Create sits
8 pt over the keyboard, the location field above it in view;
`10-availability-days` (`2026-10-30_003539`) — Save at about 760–810 pt,
clear of the home-indicator zone (818–852), off with nothing changed.

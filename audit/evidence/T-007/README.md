# T-007 — after creating a project, going back showed the creation form

Cause: CreateProject (a modal of the app stack) opened the project with
`navigate('MainTabs', …)`. React Navigation 7's StackRouter (case 'NAVIGATE')
goes back to a route lower in the stack only with `pop: true`; without it a new
MainTabs was pushed over the form: [MainTabs, CreateProject, MainTabs]. The
same call in the inbox (NotificationsScreen) and on a push tap
(useNotifications, openProject and openProjectsList).

Fix: `{ pop: true }` on every one of them, and `initial: false` next to
`screen: 'ProjectDetail'` so a Projects tab not opened yet starts at its list.
Rule in CLAUDE.md, "11. Navigation is typed".

Other navigates from modal screens to the root stack were checked:
`useAddRehearsalForm` opens CreateProject over the rehearsal form (a modal over
a modal, not a return to the tabs); JoinProject uses `reset`, which builds the
stack itself.

- `jest-red-before.txt` — `src/navigation/__tests__/backToTabs.test.tsx` on the
  old files: 3 of 4 red (the inbox case was already right: it called goBack()
  before navigate). After the fix: 4 of 4 green.
- `e2e-46-red-before-green-after.txt` — flow 46, red on the old files, green
  after.

After the fix, on 2026-10-28:
- `npx tsc --noEmit` clean.
- `npx jest --selectProjects frontend` — 898 of 899; the one red,
  `useAvailabilityDataAllDay.test.ts`, ran out of time under the full run and
  passes alone (12/12); not touched here.
- `npm run e2e -- 46 03` — 2/2 passed; `npm run e2e -- 13 05` — 2/2 passed.

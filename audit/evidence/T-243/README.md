# T-243 — hook dependencies and unused code, to zero

Base `df43622`. Lines are the base's, as the warnings named them. Paths from
`rehearsal-calendar-native/`.

Result: `npm run lint` — 0 errors, 595 warnings; `react-hooks/exhaustive-deps`
and `@typescript-eslint/no-unused-vars` 0 in `src`, both `error` in
`eslint.config.js`. Before: 647 warnings (20 exhaustive-deps, 31 no-unused-vars,
2 unused disable directives).

## The fifteen places in the app's code

| # | Place | What the effect does | Were the left-out value to change | Decision |
|---|---|---|---|---|
| 1 | `src/contexts/ProjectContext.tsx:118` — `fetchProjects` | Loads the projects for each person and session (`[user, session]`). | `fetchProjects` is a new function every render; it reads `user` and the session's setters, both in the list. The call is the render's own, so nothing stale. Listed, it would load on every render. | **Deliberate.** Called through the `latestFetch` ref the file already had for its listeners. |
| 2 | `src/features/auth/screens/LoginScreen.tsx:55` — `handleGoogleSignIn` | Signs in with Google's answer, once per answer (`[response]`). | The handler is new every render and the effect calls the render's own; listed, it would sign in again on every render. | **Deliberate.** Disable comment with the reason, nothing else: sign-in behaviour untouched (owner's decision not needed). |
| 3 | `src/features/availability/hooks/useAvailabilityEditor.ts:86` — `getDayState` | Checked the selected day's slots and kept the answer in state. | `getDayState` reads only `availability`, which was listed: not stale. But state set from an effect is a render behind. | **Deliberate, rewritten.** The check is worked out in render (`validationError` derived); no effect. The hook's `availability` prop only fed that effect, so it went too (screen and two tests). |
| 4 | `useAvailabilityEditor.ts:133` — `setPutAwayDue`, no list | Puts the editor away in the render after a deletion left nothing picked. | Ran after every render, guarded by `putAwayDue`. | **Deliberate.** List `[putAwayDue]` — the same runs; `collapse` (new each render) left out with a comment: the render it fell due in is the one to ask from. |
| 5 | `src/features/calendar/hooks/useAddRehearsalForm.ts:179` — `setSelectedProject` | The route's project, once per route (guarded by the `prefilledFor` ref). | The context's setter was a new arrow every render. | **Deliberate, listed.** `setSelectedProject` is now a `useCallback` in ProjectContext (stable for the session) and in the list; the ref guard makes a rerun a no-op. |
| 6 | `useAddRehearsalForm.ts:203` — `opening`, `timezone` | The route's day and time, once per route. | `opening` is state never set. A new profile zone would put the route's day back over the one chosen since — the defect the comment above it records (T-012 review). The zone changes with the form open only if the profile is changed elsewhere and re-read meanwhile: special coincidence, minor. | **Deliberate.** Disable comment. |
| 7 | `useAddRehearsalForm.ts:217` — `chosenProjectId`, `setSelectedProject` | With nothing chosen, the default project. | `chosenProjectId` only goes from null to an id (nothing in the app sets it null), and the effect does nothing once it is set; the setter is stable (#5). | **Deliberate, listed** — both in the list; reruns are no-ops. |
| 8 | `useAddRehearsalForm.ts:266` — `navigation`, `routeParams`, `startParticipants`, `t`, `timezone` | Loads the edited rehearsal, once per rehearsal id. | A new language or zone would load again and put the saved fields back over the person's edits. `projectId` arrives with the id in one route; `startParticipants` is stable; `navigation`/`t` serve only the failure path. | **Deliberate.** Disable comment. |
| 9 | `src/features/calendar/hooks/useRehearsalAvailability.ts:102` — `dateStr`, `excludeRehearsalId`, `nextDateStr`, `project`, `selectedMemberIds`, `t` | Loads who is busy, per question. | `key` is built from all of them (project id, day, next day, people, excluded rehearsal); `project` and the member array are new objects each render. `t` words only the failure alert. | **Deliberate.** Disable comment. |
| 10 | `src/features/calendar/screens/AddRehearsalScreen.tsx:163` — `membersLoad.error`, `membersLoad.reload`, `t` | Alerts once per failed members load. | `failed` goes false while each load is out (retry or another project) and true on its failure, with its `error` in the same render; `reload` is a stable `useCallback`. A new language is no new failure to alert. | **Deliberate.** Disable comment. |
| 11 | `src/features/projects/screens/JoinProjectScreen.tsx:57` — `checkAndFetchInviteInfo` | Asks about the invite once per link code. | New function each render; listed, it would ask on every render. | **Deliberate.** Disable comment. |
| 12 | `src/features/smart-planner/hooks/useSmartPlanner.ts:142` — `t` | Loads the planner; on failure kept the reason **as text**, translated with the `t` of that moment. | Language switched with the planner open: the reason stayed in the old language under a heading in the new one. Listing `t` would have loaded the planner again for a language change. | **Defect, fixed** (`dd93751`). The failure is kept, put into words in render. Jest at screen level, red before: `red-smart-planner-language.txt`; green after (62/62 planner tests). |
| 13 | `src/shared/hooks/useClock.ts:45` — `instant` conditional changing `useMemo` (line 73) | `useNow`'s clock. | On a render with a new zone `instant` was a fresh `Date`, so the memo's inputs changed; that render is replaced at once by the `setRead` above it. Not stale. | **Deliberate, rewritten.** The choice moved inside the memo; inputs `[timezone, read]`. |
| 14 | `src/shared/hooks/useLeaveGuard.ts:122` — `setSaved`, no list | Lets the held way out go once the save is in and rendered. | Ran after every render, guarded by `saved`. | **Deliberate.** List `[saved]` — the same runs; `hasChanges`, `ask`, `go` are that render's on purpose (comment). |
| 15 | `src/shared/hooks/useNotifications.ts:204` — `handleNotificationNavigation` | Push listeners for the session. | The handler reads only `navigation`, whose `navigate` reaches the same navigator from any render. | **Deliberate.** Disable comment. |

### No flow for #12

The language is changed on the Profile tab. Coming back to the planner tab is
a focus, and the planner loads again on focus (`SmartPlannerScreen`,
`useFocusEffect` → `refetch`), so the old-language text is gone by the time
the person is looking at it: on the old code a flow would be green. Jest at the
screen with a switched `useI18n` is where the defect is seen. The other
fourteen keep what runs and when — refactors and comments — so they have no
flow of their own; the existing flows over the changed screens were run
instead (below).

## Unused

- `CalendarMonth.tsx:27` `availability`: the month reads its days through
  `getDayStatus(date)`, which the screen builds from `availability`; the prop
  was left from before. Removed from the component, `AvailabilityScreen` and
  three tests. Not a defect: the list re-renders through `renderItem`.
- `TimeSlotsEditor.tsx:23` `onSlotChange`: a slot's times change through the
  picker (`onTimePickerOpen`); the prop was never read. Removed from the
  component and its test. The component itself is used only by its test —
  the screen draws the slots inline — which is outside this task.
- `useWeekStart.ts:39` `error`: `catch {}`.
- Tests and mocks (28): unused imports and bindings removed; mocks strip
  props as `_name`. One test asserted nothing (`TodayRehearsals.test.tsx`,
  "should not show admin controls for non-admin projects"): its unused
  binding looked for an "Admin" badge the row no longer draws even for an
  admin (T-036), so asserting it would pass with both swipe actions present
  (review). Removed: "gives an actor no swipe" renders the same rehearsal and
  asserts that neither `rehearsal-swipe-edit` nor `rehearsal-swipe-delete`
  is there.
- Two disable directives for `no-var-requires`, which no longer fires
  (`permissionTexts.test.ts:75`, `syncSession.test.ts:77`): removed.
- Five `exhaustive-deps` in tests and mocks: the four `useFocusEffect` mocks
  that focus once on opening, and the `expo-localization` mock whose `key` is
  the invalidation — disable comments with the reason.

## Checks

- `npm run lint`: 0 errors, 595 warnings.
- `npm run type-check`: clean. `npm run check:dead`: clean.
- `npx jest --selectProjects frontend --silent`: 145 suites, 1434 tests passed.
- e2e on `5caf7d0`: 07-planner-project-switch, 64-availability-collapse-asks,
  77-rehearsal-form-projects-read-again, 68-availability-drag-save, 01-login —
  5/5 passed.

# T-241 — the planner's filters, board C

Base: `4d02578`. Fix: `16e33f6`, `568ee35` (faces' overlap).

## Red before (fix files back at the base, the tests and flows new)

Files put back: `SlotItem.tsx`, `SmartPlannerScreen.tsx`,
`smartPlannerScreenStyles.ts`, `translations/availability.ts`,
`translations/calendar.ts`, `ParticipantPicker.tsx`.

Jest, `npx jest --selectProjects frontend --testPathPatterns SmartPlannerScreen`:

```
✕ drops removed members from selection when the roster reloads   (no planner-period-month: the period was a dropdown)
✕ leaves the segment it was                                       (same)
✕ names the project; with nothing else to run, no chevron and no tap  (the chevron was there)
✕ with another project to run, the name opens the choice, chevron and all  (no role, no label)
✕ changes the period with one tap on its segment, the picked one in sight  (no planner-period-week)
✕ says who takes part by their faces and a count, the words whole  (no "All participants · 3")
✕ gives a slot a "+" that says what it adds, and when             (no role, no label)
✕ dates the list by its days: today gone, from tomorrow          (no "Jan 2 – Jan 7": the title said Jan 1)
✕ opens the project's and the people's choices                    (no planner-period-month)
Tests: 9 failed, 13 passed, 22 total
```

e2e, `npm run e2e -- e2e/flows/59-planner-filters-spanish.yaml` (run 2026-11-10_115249):

```
[Failed] The planner's filters fit in four languages (1m 36s) (Assertion is false: "Semana" is visible)
```

`before/` — the same screen in es, en, ru, de over «Video musical “Fuego
lento”» and «Musikvideo „Nachtschicht“», from a one-off shots flow on the
old code: «Video musical “…» · «Se…» · «Partici…os (8)», «+ Añadir».

## Green after

Jest: 22/22 in `SmartPlannerScreen.test.tsx`; all 1427 frontend tests pass;
`type-check` clean.

e2e on the fix:

```
[Passed] The planner's filters fit in four languages (59)
[Passed] Planner list is dense (58)
[Passed] From the planner to a rehearsal (06)
[Passed] Today selects today (41)
[Passed] Touch targets are 44 pt (49)
[Passed] Busy marked by an actor, seen by the director (45)
[Passed] The participants sheet searches, above the keyboard (48)
[Passed] Dates in Russian, one format (65)
[Passed] Role given by push (75)
[Passed] Role given, seen on return (76)
[Passed] Free time tapped ends the rehearsal where it ends (83)
[Failed] Planner follows the project (07) — No visible element found: "9:00.AM–11:00.PM \(14h\)"
```

07 passes every planner step and fails at step 176, in the rehearsal form:
"Recommended Time" says "Everyone is free all day" since T-238 (`c27c469`)
instead of the tappable "9:00 AM–11:00 PM (14h)" the flow looks for. Not
this task's code; left for its own task.

`after/` — 59's shots in es, en, ru, de and the participants sheet.

`copy-shots.mjs` copies a run's shots here.

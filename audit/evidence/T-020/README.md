# T-020 — Smart Planner, a denser list

Base `cbcfaf9`. Fix `ebb2e7b`.

| Point | What changed | Proved by |
|---|---|---|
| 1 Day header 28 pt, slot row 56 | `DayCard`: no card; a header of 28 (`planner-day-<date>`) and the slots under it. `SlotItem`: a row of 56 (`planner-row-<date>-<start>`), time and status one line each, "+ Add" 44 inside. A day of one slot 170 → 100 pt | `SmartPlannerScreen.test.tsx`; flow 58 (Maestro sizes 28±1, 56±1) |
| 2 Where the recommendations begin | Measured first on `cbcfaf9`: y = 435 of 852 (`measure-before.txt`, `before-58-planner-first-screen.png`). Below 300, so the project, the period and the people are one row of 44 (`planner-filters`): "Three Sisters ▾ · Week ▾ · Participants: all (3) ▾". The project and the period open their choices under it (`planner-project`, `planner-period` → `planner-period-week/month/custom`), the people their sheet (`ParticipantPicker` with `chip`). The period's dates stand beside "Recommendations". After: y = 219 (`measure-after.txt`, `after-58-planner-first-screen.png`) | `SmartPlannerScreen.test.tsx`; flow 58 (44±1, each choice opened) |

The participants' button keeps its label, "Participants, 3 of 3" (flows 06,
07, 45, 48 find it by it); nothing else for VoiceOver (owner, 30.10).
"Participants: all (N)" is new in the four languages
(`rehearsals.participantsAll`). The project's name is the one that gives way
in a narrow row ("Three Sist…" on an iPhone 16).

Flows 41 and 49 picked the period by its buttons; they open `planner-period`
first.

`measure.mjs` reads a column of a screenshot and prints its runs of colour in
points; `keep.mjs` copies a run's screenshot here.

Red before: flow 58 on `cbcfaf9` fails at `planner-filters` 44
(`e2e-red-before.txt`); Jest with the six source files at `cbcfaf9` and the
tests of T-020: 5 of 11 fail (`jest-red-before.txt`). Green after:
`green-after.txt` — flows 58, 41, 49, 07, 23, 06, 45, 48 and all of Jest.

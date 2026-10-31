# T-016 — the rehearsal card and its details: Edit and Delete

Base `2a52a16`. Fix `f8e617d`, flow 51 `1d24584`.

| Point | What changed | Proved by |
|---|---|---|
| 1 Card | Bin and pencil gone from `RehearsalCard`; an admin swipes the card left (`Swipeable`, as in the inbox) for Edit and Delete (red). An actor's card has no swipe. `rightThreshold` 40: with two actions the default (half their width) needed a swipe across half the screen, and Maestro's swipe from the card's centre did not open it | `TodayRehearsals.test.tsx`, flow 51 |
| 2 Details | An admin gets Edit at the top (opens the form over the sheet; the sheet reads the rehearsal again when the form saves) and Delete as a red row at the foot; after a delete the sheet closes. The calendar, the project's page and the sheet reload on `emitDataChanged('rehearsals')`, sent after a delete and after a save in the form | `RehearsalDetailsScreen.test.tsx`, flow 51 |
| 3 One confirmation | `useDeleteRehearsal` for both: title `Delete “Court scene”, Mon Nov 2, 15:00?` / `Удалить «Table read», сб 31 окт, 15:00?`; line `Participants (2) will be notified`: the roster from `/responses` without the one deleting, the server's own rule (`routes/native/rehearsals.js`); no line when it is 0 or could not be read; Cancel and Delete (destructive) | both test files, flow 51 |
| 4 Facts | Date, time, project and place: 44 pt rows of text, no box or border; place is plain text | screenshot `51-details-admin` |
| 5 Cross | `IconButton`, 47 in the sheet (T-014) — unchanged | — |

Not changed: the "0/2" chip and the actor's eye (owner); no VoiceOver work.

Also changed: the success alert after a delete ("Rehearsal deleted") is gone,
since the card disappearing or the sheet closing shows it; a failed delete said
"Error creating rehearsal" (`createError`) and now says `deleteError`.

Seed: Claudius (admin of Elsinore Court) and Gertrude (member), with
"Court scene" and "Play within" of their own, so the deleted rehearsal is no
other flow's.

## Red before, green after

On the way to red, `git restore --source=2a52a16` was run on the source files
before the fix had been committed, which erased the working copy; the tree was
then exactly the base, the red runs were taken on it, and the fix was
re-applied and committed (`f8e617d`). The green runs are on that commit.

- `e2e-red-before.txt`: flow 51 on the base fails at
  `id: rehearsal-swipe-delete is visible` — no swipe.
- `jest-red-before.txt`: the details' four T-016 tests fail on the base.
  `TodayRehearsals.test.tsx` does not compile against the base card (the
  `onDeleteRehearsal` prop it no longer passes was required), so its red is
  shown by flow 51 instead.
- `e2e-green-after.txt`, `jest-green-after.txt`.

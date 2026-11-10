# T-244 — a sheet's buttons are whole beside a long title

Found in the landing's shots (10.11): the rehearsal's sheet in Russian,
«Закрыть · Прогон всей программы · Измен…».

**Cause.** `ScreenHeader`'s `kind="modal"` gave both ends of the bar equal
shares of the row (`flexGrow: 1, flexBasis: 0`) beside a title of up to half
of it (`maxWidth: '50%'`). On a 393 pt phone a share is about 93 pt; «Изменить»
at 17 pt semibold with its padding is wider, and so is "Bearbeiten".

**Fix** (`src/shared/components/ScreenHeader.tsx`, `ModalBar`). Each end is as
wide as its button's words, measured where it stands, and never shrinks; both
ends are then as wide as the wider, so the title stays in the middle. The title
takes what is left and wraps, two lines on every sheet, cut only at the end of
the second. The font is unchanged (17 pt). Pushed screens (`stack`) are as
T-239 left them.

## Red before, green after

- `jest-screenHeaders.txt` — the new tests in `screenHeaders.test.tsx`: three
  red on the old `ScreenHeader.tsx` (the end a share of the row, `flexBasis: 0`;
  the title `maxWidth: '50%'`; one line), green on the fix.
- Flow `e2e/flows/85-sheet-header-buttons-whole.yaml` on the old
  `ScreenHeader.tsx` (`git restore --source=3f2c4d2`): failed at step 96, the
  "…" looked for over the right end of the bar — `red-flow85-details-ru.png`
  shows «Измен…», `red-flow85-step-096-runScript.png` the step it stopped at.
  On the fix: passed (3 m 14 s), taps taken again 0.

## Shots, before and after (simulator 393 pt, e2e stand)

Before: `one-off-shots-flow.yaml` (flow 85's way, shots only, nothing
checked) on the old `ScreenHeader.tsx`. After: flow 85 on the fix.

| | before | after |
|---|---|---|
| ru, «Прогон всей программы» | `before-details-ru.png` — «Измен…» | `after-details-ru.png` — «Изменить» |
| ru, «Генеральный прогон всей программы с оркестром и светом» | `before-details-ru-longer.png` | `after-details-ru-longer.png` |
| ru, the form from there | `before-form-ru.png` | `after-form-ru.png` |
| de, «Прогон всей программы» | `before-details-de.png` | `after-details-de.png` |
| de, the longer one | `before-details-de-longer.png` — "Bearbei…" | `after-details-de-longer.png` — "Bearbeiten", the title cut at the end of its second line |
| de, the form | `before-form-de.png` | `after-form-de.png` |

## Flows passed on the fix

85 (new), 51 (swipe and details), 52 (edit and delete from the details),
66 (screen headers), 63 (a new rehearsal's form from a project).

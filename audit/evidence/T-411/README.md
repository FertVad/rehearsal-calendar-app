# T-411 — evidence

The weekend's hint in the availability editor (`availability-weekend-default`)
had `marginHorizontal: 20` of its own, so its text began at 40 pt where the mode
buttons and the "busy this day" plate begin at 20, and no margin under it: its
last line sat on the plate, 20 pt away from the buttons it explains.

Fix: the hint is `importedNote` + `weekendDefaultNote` (marginBottom 20, no side
margin); with the hint shown the mode selector has `modeSelectorWithNote`
(marginBottom 8 instead of 20). So: the buttons' edges, 8 pt under them, 20 pt
to the plate or to the "From calendar" section; no negative margin. A working
day (no hint) keeps 20 pt under the buttons; `importedNote` itself is unchanged.
Texts not touched.

## Red before (base d84294b)

- `red-before-jest.txt` — `AvailabilityWeekendNote.test.tsx`: 4 of 7 fail (side
  margin 20; no margin under the hint; with "From calendar" the same). The 3 that
  pass are what must stay as it was (working day, the calendar note's style).
- e2e 105 on the base's app: failed at the new check —
  `nothing in #7d8590 on 105-weekend-default-in-editor-ru there` (no hint text at
  0–31 pt from the left). Screenshot: `red-105-weekend-default-in-editor-ru.png`.
- `before/` — 105 on the base's app with that check widened to the whole width
  (only to get the screenshots, then put back): the weekend day and the working
  day in ru and de.

## Green after

- Jest: availability screens 8 suites, 55 tests pass; `tsc --noEmit` clean;
  lint 0 errors; knip clean.
- e2e 105 Passed: the hint's ink found at 0–31 pt — ru 11 × 41.7 pt, de 11 × 39.7 pt.
- e2e 104 Passed.
- `after/`: `105-weekend-default-in-editor-{ru,de}.png` (edges with the buttons and
  the plate, footnote under the buttons, room before the plate),
  `105-weekday-in-editor-{ru,de}.png` (same as `before/`),
  `104-weekend-default-in-editor.png` (en).

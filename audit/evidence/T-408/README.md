# T-408 — evidence

Fix commit: `d0a0e9e` (base `00519dd`).

## Red before

- `red-before-jest.txt` — Jest, client and server, on the base's code: 32 client
  and 35 server tests fail (the strings, П1–П3, М1–М6, no-break spaces, the
  iOS form "Пт", the title's lines).
- e2e 60 on the base's app (translations, dateFormat, weekends, OnboardingStep,
  WeekendsScreen, AvailabilityScreen restored from `00519dd`): failed at the
  question — `red-60-onboarding-weekends-ru.png`: one line squeezed to ~14.5 pt,
  «(Пт и Сб)» with capitals, «Профиль → / Выходные заняты» broken.
- e2e 105 on the base's app: failed at the ru editor hint (old text).
- e2e 105 with **only** `dateFormat.ts` from the base (everything else the fix):
  the new hint passes, and it fails at `"(?-i)Ваши выходные: пт и сб"` —
  `red-105-switch-ru-only-dateFormat-at-base.png` shows «Ваши выходные: Пт и Сб».
  This is how the case is proved on the phone: Maestro matches text whatever its
  case (60 passed with «пт и сб» before), so the checks of the days are asked
  with the inline flag `(?-i)`, which turns that off; this run shows the flag
  works and that the cause is `midSentence`.

## Green after (on `d0a0e9e`)

- Jest: frontend 163 suites, 1744 tests (one run had ProviderSignInLanguage fail
  under load; alone it passes 3/3, not touched by T-408); server privacy 52/52;
  `tsc --noEmit` clean; knip clean.
- e2e, one by one: 60, 105, 09, 104, 09-invite-during-onboarding, 23, 32, 100 —
  all Passed.
- Screenshots in `green/`:
  - the weekends' step: `09-onboarding-weekends.png` (en),
    `60-60-onboarding-weekends-{ru,es,de}.png`;
  - the switch's row: `104-switch-on.png` (en), `105-switch-{ru,es,de}.png`;
  - the editor's hint: `104-weekend-default-in-editor.png` (en),
    `105-weekend-default-in-editor-{ru,es,de}.png`;
  - the Skip window: `09-invite-skip-en.png`, `60-60-onboarding-skip-{ru,es,de}.png`.
- The steps also check, on the phone: the title's height 60–120 pt (two or three
  lines at ~32; one line was 17–21), and no "…" on the screen (no-ellipsis.js).

## 375 pt (iPhone SE, mini) — measured

The stand is one simulator at 393 pt; the title has 345 pt there, 327 at 375.
Measured on the green screenshots (1178 px = 393 pt), the question at 32 pt:

| | lines at 393 | widest line | at 375 |
|---|---|---|---|
| ru | 3 | «выходные (пт и сб)» ≈ 296 pt | fits 327, same 3 lines, 32 pt |
| es | 3 | «¿Marcar todos los fines de» ≈ 340 pt | rewraps; the three lines sum ≈ 805 pt of 981 — three lines, at most a little smaller |
| en | 2 | «(Fri and Sat) as busy?» ≈ 318 pt | fits 327, same 2 lines, 32 pt |
| de | 3 | «(Fr und Sa) als belegt» ≈ 313 pt | fits 327, same 3 lines, 32 pt |

Past three lines the title is made smaller (adjustsFontSizeToFit), never cut:
no ellipsis on any width.

# T-022, review 1 — red before, green after

Fix `f6a3c3c`, flow `35942d1` (60-onboarding-russian.yaml, seed person `nina`,
"Нина Новикова", locale ru, not onboarded).

## P2 — the Russian greeting wrapped

The step's title is one line, `adjustsFontSizeToFit`, `minimumFontScale` 0.5,
id `onboarding-title` (`OnboardingStep.tsx`). Flow 60 asserts its height is
one line's (35 ± 9 pt).

Red — the title with its id, without the one-line props:

```
[Failed] Onboarding in Russian, the greeting on one line (1m 29s) (Assertion is false: "Добро пожаловать, Нина!", id: onboarding-title, Size: nullx35(tolerance: 9) is visible)
1/1 Flow Failed
```

Hierarchy of that run: `"bounds" : "[24,151][369,227]"` — 76 pt, two lines.
After the fix: `[24,151][369,183]`, 32 pt, one line; screenshot
`60-onboarding-welcome-ru.png` shows "Добро пожаловать, Нина!" on one line.

Jest, `WelcomeScreen.test.tsx` against `f6a3c3c~1`:

```
  ✕ keeps the greeting on one line, made smaller to fit
    Unable to find an element with testID: onboarding-title
```

## P2 — the service strings in another language, on screen

Red — `OnboardingStep.tsx` as on the base `78065ae` (literal "Skip"):

```
[Failed] Onboarding in Russian, the greeting on one line (1m 29s) (Assertion is false: "Пропустить", id: onboarding-skip is visible)
1/1 Flow Failed
```

The refusal's alert said "Calendar access is required to sync rehearsals" in
every language — the same rule as the two strings of point 3, on the same
step; it is `calendarSync.permissionDeniedMessage` now, and "no writable
calendar" and the failed setup's fallback use `calendarSync` too.
Red — `CalendarSyncScreen.tsx` as at `f6a3c3c~1`:

```
[Failed] Onboarding in Russian, the greeting on one line (2m 24s) (Assertion is false: "Для использования этой функции необходим доступ к календарю" is visible)
1/1 Flow Failed
```

Jest, `CalendarSyncScreen.test.tsx` against `f6a3c3c~1`:

```
    Expected: "Требуется разрешение", "Для использования этой функции необходим доступ к календарю"
    Received: "Требуется разрешение", "Calendar access is required to sync rehearsals"
Tests:       2 failed, 10 passed, 12 total
```

"No calendars found" and "Setting up calendar sync…" are not in flow 60: the
simulator always has its own calendar, and the choice is saved on the phone at
once (AsyncStorage, no request to hold), so neither state can be brought on
screen without a hook in the app's code, which docs/e2e.md rules out. Jest
says them in Russian and German (`CalendarSyncScreen.test.tsx`, "says 'no
calendars'…", "says it is setting the calendar up…"); against the base each
fails (`jest-red-before.txt`).

## Green after (HEAD `35942d1`)

```
[Passed] Onboarding in Russian, the greeting on one line (1m 32s)
[Passed] Onboarding to the end, nothing granted (1m 53s)
[Passed] Onboarding shows the calendar that was saved (54s)
3/3 Flows Passed in 4m 19s
[e2e] taps taken again (tap-and-see.yaml): 0
```

Jest `onboarding`: 6 suites, 26 tests passed; the whole frontend project:
118 suites, 1064 tests passed. `npm run type-check`: no errors.

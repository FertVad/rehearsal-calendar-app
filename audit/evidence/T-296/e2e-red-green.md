# T-296 — flow 70: the Resend line, reached at any length of the policy

## Cause (the Claude monitor's, 24.11)

The line was on the page and visible; the flow ran out of time. It scrolled
from the top of `/privacy` with `scrollUntilVisible` (~4.3 s a swipe). T-293
(cd0d613) and T-295 (986b3e8) made the policy longer: the English line showed
after the 13th swipe at 96 % of the 100 % needed, and the 14th ended at 61.5 s
of the 60 s. T-294/T-298 made the page longer still. Every new paragraph above
the providers' list would bring this back.

## Fix

- `server/public/privacy.html`: the providers' list in each language has an id,
  `processors-en`, `-ru`, `-es`, `-de` (on the `<ul>`, so the tests that split
  the policy on `<h2>` stay as they are). Text unchanged.
- `e2e/flows/70-privacy-lists-resend.yaml`: each language is opened by its own
  link, `/privacy?lang=xx#processors-xx`, and its line is read there. The same
  four lines, matched by the same words; `scrollUntilVisible` timeouts are
  30 s, down from 60 s. The language buttons are no longer how the flow gets
  to a language. The old note, "a second link left the page in English", was
  from before T-038's CSP fix, when legal.js did not load over http. The ru/es/de
  screenshots of the green run show the page in each language.

## Red: the flow and page before the fix (HEAD~1 = 987e304, the page as on 477ea2f and longer)

```
git restore --source=HEAD~1 -- server/public/privacy.html e2e/flows/70-privacy-lists-resend.yaml
npm run e2e -- e2e/flows/70-privacy-lists-resend.yaml

[Failed] Privacy policy lists Resend in every language (1m 20s) (No visible element found: ".*sends our emails: your codes for signing up.*Ireland.*")
1/1 Flow Failed
[e2e] taps taken again (tap-and-see.yaml): 0

git restore --source=HEAD -- server/public/privacy.html e2e/flows/70-privacy-lists-resend.yaml
```

This is the same failure as the night run on 477ea2f.

## Green: as committed (c079e73)

```
npm run e2e -- e2e/flows/70-privacy-lists-resend.yaml

[Passed] Privacy policy lists Resend in every language (37s)
1/1 Flow Passed in 37s
[e2e] taps taken again (tap-and-see.yaml): 0
```

Screenshots 70-privacy-{en,ru,es,de}: each page opens at its list, in its
language, with the Resend line whole on screen.

## Policy tests

```
cd server && NODE_OPTIONS=--experimental-vm-modules npx jest __tests__/routes/privacyPage.test.js __tests__/utils/privacyProcessors.test.js __tests__/utils/legalPageLanguage.test.js
Test Suites: 3 passed, 3 total
Tests:       147 passed, 147 total
```

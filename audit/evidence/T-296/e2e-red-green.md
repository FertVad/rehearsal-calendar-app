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
  30 s, down from 60 s. (This alone raced Safari — see Red 2 / Fix 2.) The language buttons are no longer how the flow gets
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

This green run won a race; the supervisor's check of c079e73 lost it (below).

## Red 2: c079e73 in the supervisor's check — the flow did not wait for the page

Run `e2e/out/failed/T-296-2026-11-24T09-17-51-567Z/` (working tree, not in
git), its `artifacts/.../logs/maestro.log` and `device-simulator.log`:

```
11:16:58.822  maestro.Maestro.openLink: Opening link http://127.0.0.1:3001/privacy?lang=en#processors-en
11:17:02.874  CoreSimulatorBridge: Opening URL (...#processors-en) with com.apple.mobilesafari
11:17:04.594  Open .../privacy?lang=en#processors-en COMPLETED          <- openLink returns
11:17:08.987  WebPageProxy::didCommitLoadForFrame ... isMainFrame=1     <- Safari commits the page, 4.4 s later
11:17:09.372  WebPageProxy::didFinishLoadForFrame ... isMainFrame=1
11:17:10.694  scrollUntilVisible: Element not found: .*sends our emails...Ireland.*   <- first look
11:17:10.715  Swiping UP from center                                    <- first swipe (of 6)
11:17:15.810 / 19.998 / 24.740 / 28.871 / 32.935  Swiping UP from center
11:17:37.711  Scrolling DOWN until ".*sends our emails...Ireland.*" ... timeout 30000 ms FAILED
```

(device-simulator.log stamps Safari in -1000: 23:17:08.987 there is 11:17:08.987
in +0200.)

The first look's screen was taken while the page was not there yet; the swipes
then ran on the page at its anchor. Screen offset at the failure
(`screen-hierarchy/step-006-...json`): "How long we keep it", the vertical scroll
bar at 84 % of 20 pages, ≈10 928 pt. At ~488 pt a swipe (14 swipes = 6 830 pt on
477ea2f), six swipes from the top reach only ≈2 928 pt, so they started at the
anchor (≈8 000 pt), where the Resend line was whole on screen (y ≈70–233). The
first swipe DOWN put it above the screen, and scrolling down never brings it
back. The old flow had `extendedWaitUntil: visible: "Privacy Policy"` after
`openLink`; c079e73 dropped it (the heading is not on screen at the anchor) and
put nothing in its place.

## Fix 2

After each `openLink`, before any look or swipe, the flow waits
(`extendedWaitUntil`, 30 s — the old wait's own timeout) for that language's own
Resend line: on screen at its anchor, on no other language's page. The
`scrollUntilVisible` after it is the same check as before (100 % visible,
30 s); at the anchor the line is whole, so it swipes nothing. Same four regexes,
same screenshots, no retries, no timeout raised. The header comment of the flow
now says this instead of "on screen or one swipe away".

## Green 2: three runs in a row (flow as committed)

```
npm run e2e -- e2e/flows/70-privacy-lists-resend.yaml
[Passed] Privacy policy lists Resend in every language (51s)
1/1 Flow Passed in 51s

npm run e2e -- e2e/flows/70-privacy-lists-resend.yaml
[Passed] Privacy policy lists Resend in every language (51s)
1/1 Flow Passed in 52s

npm run e2e -- e2e/flows/70-privacy-lists-resend.yaml
[Passed] Privacy policy lists Resend in every language (45s)
1/1 Flow Passed in 45s
```

maestro.log of each (e2e/out/artifacts/2026-11-24_114211, _114715, _115246):
for every language `Open ...#processors-xx COMPLETED`, `Assert that "<line>" is
visible COMPLETED`, `Scrolling DOWN until "<line>" ... COMPLETED`,
`Take screenshot 70-privacy-xx COMPLETED`; not one "Swiping" line and not one
"Element not found" in any of the three runs.

## Policy tests

```
cd server && NODE_OPTIONS=--experimental-vm-modules npx jest __tests__/routes/privacyPage.test.js __tests__/utils/privacyProcessors.test.js __tests__/utils/legalPageLanguage.test.js
Test Suites: 3 passed, 3 total
Tests:       147 passed, 147 total
```

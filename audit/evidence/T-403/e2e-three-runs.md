# T-403 — flaky "Privacy policy lists Resend in every language" (flow 70)

## Cause

The same race that T-296 fixed. After `openLink` the flow did not wait for the
page: the first look ran before Safari had the page, and the swipe down carried
the Resend line above the screen. The rerun passed only because Safari was
faster than the first look. Full analysis, red before and the fix:
audit/evidence/T-296/e2e-red-green.md.

Red before: e2e/out/failed/T-296-2026-11-24T09-17-51-567Z (on 2626526, before
6eb0820), analysed in that T-296 file.

## Fix on auto/main

6eb0820 (T-296): after each `openLink` the flow waits (`extendedWaitUntil`,
30 s) for that language's own Resend line before any look or swipe. No code is
changed by T-403.

## Green: three runs in a row on auto/main (6eb0820)

```
npm run e2e -- e2e/flows/70-privacy-lists-resend.yaml
[Passed] Privacy policy lists Resend in every language (45s)
1/1 Flow Passed in 45s
[e2e] taps taken again (tap-and-see.yaml): 0

npm run e2e -- e2e/flows/70-privacy-lists-resend.yaml
[Passed] Privacy policy lists Resend in every language (47s)
1/1 Flow Passed in 47s
[e2e] taps taken again (tap-and-see.yaml): 0

npm run e2e -- e2e/flows/70-privacy-lists-resend.yaml
[Passed] Privacy policy lists Resend in every language (44s)
1/1 Flow Passed in 45s
[e2e] taps taken again (tap-and-see.yaml): 0
```

maestro.log of each (e2e/out/artifacts/2026-11-24_122006, _122526, _123024):
0 lines matching "Swiping" or "Element not found" — every language's line was
on screen at its anchor after the wait, with no swipe.

The guarded bug (T-038: the policy did not name Resend) has not returned: the
line is found in all four languages in all three runs.

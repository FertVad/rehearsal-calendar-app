# T-005 — flow 44, the profile's language

## Why T-001 failed (08.10.2026)

T-001's flow (`auto/skipped/T-001`, `e2e/flows/07-language.yaml`) failed three
times, on `"Календарь", id: tab-calendar is visible` and on `id: language-en
is visible`. Neither was a defect of the app.

1. **The tab's label.** A bottom tab is one accessibility element; on iOS
   React Navigation labels it `"<label>, tab, N of M"`. Maestro matches `text:`
   against the whole label as a regular expression, so `"Календарь"` alone
   never matches the tab, Russian or not. T-001 then put a `Text` with its own
   testID inside the tab and rebuilt the accessibility label by hand — changes
   to the app for the flow's sake. Flow 44 matches `"Календарь, tab.*"`, as
   flow 23 taps `"Planner, tab.*"`.

   Probe (`probe-t001-tab-label.yaml` below, run 28.10.2026 on HEAD with the
   testIDs of this task): after choosing Russian, `"Календарь, tab.*"` on
   `tab-calendar` was visible, and `"Календарь"` on the same element was not —
   T-001's own message:

   ```
   [Failed] probe T-001 tab label (1m 32s) (Assertion is false: "Календарь", id: tab-calendar is visible)
   ```

2. **The picker opened a second time.** T-001 opened the language sheet,
   chose Russian, and opened it again on the same screen to choose English.
   The sheet was then React Native's `Modal`, and the second `Modal` a screen
   presents is not in iOS's accessibility tree: drawn, but Maestro finds
   nothing (T-208, `audit/evidence/T-208`). T-001 took it for the row being
   below the fold and added a scroll; it failed the same way. Since f9abfc5
   (T-208, 26.10.2026) every sheet is an `AppModal`, and that is gone.

What the app does — the choice saved on the phone and in the account, the
account's language applied at sign-in — was right; flow 44 passed on its
first run. No fix to the app, so no red-before: the change to the app is two
testIDs (`profile-language`, `language-<code>`) for the flow to find the row
and the options.

## Green

```
npm run e2e -- e2e/flows/44-profile-language.yaml   (28.10.2026)
[Passed] The profile's language, kept by the account (2m 2s)
1/1 Flow Passed in 2m 2s
[e2e] taps taken again (tap-and-see.yaml): 0
```

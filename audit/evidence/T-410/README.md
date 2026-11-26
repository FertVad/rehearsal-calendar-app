# T-410 — asking for a rating

Source commits: bb33dff (client), ea92ff5 and 5f6a338 (flow 107). Base for
"red before": a06e6f3.

## Jest

- Red before: `jest-red-before.txt` — app files as at a06e6f3, tests as at
  5f6a338: 3 suites fail, `reviewPrompt.test.ts` 9 of 9.
- Green after (5f6a338): the same three suites, 3 passed, 53 tests passed.
  `reviewPrompt.test.ts` takes each condition alone (two days of use, in
  the onboarding, the first launch, asked already in this version, a new
  version 13 days after the last ask): no request; all of them: one; two
  saves in a row: one.

## e2e, flow 107 (`e2e/flows/107-rate-the-app.yaml`)

Red before — app files as at a06e6f3, the flow, seed and stand-in as at
5f6a338:

    [Failed] iOS's rating window after a save, once a version; Rate Rehearsly in the profile (1m 50s) (Assertion is false: "Not Now" is visible)
    1/1 Flow Failed

`red-before-no-window.png`: the editor after the save, no window.

Green after (5f6a338):

    [Passed] iOS's rating window after a save, once a version; Rate Rehearsly in the profile (3m 25s)
    1/1 Flow Passed in 3m 26s
    [e2e] taps taken again (tap-and-see.yaml): 0
    [e2e] Safari launches: 1, tabs restored: 0 (fresh-safari.yaml)
    server.log: [e2e] links the app opened: https://apps.apple.com/app/id6830809401?action=write-review

- `green-107-apple-rating-window.png` — Apple's window after the first save.
- `green-107-second-save-no-window.png` — the second save, same version: none.
- `green-107-profile-rate-row.png` — "Rate Rehearsly" under "Report a Bug".
- `green-107-app-store-review-page.png` — Safari after the tap. apps.apple.com
  sends it on to the App Store (`itms-appss://`), which a simulator does not
  have, so Safari says "cannot open the page"; on a phone the App Store opens.
  The address the app opened is read from SpringBoard's log
  (`e2e/scripts/opened-url.js`), not from the screen.

A first green run (13:01) passed with a check on `.*apps\.apple\.com.*` alone,
which the screenshot showed proved too little; the exact address check was
added (5f6a338).

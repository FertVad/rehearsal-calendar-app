# T-414 — the rating window once "Mark Busy" is closed; "Rate Rehearsly" after the native speakers

Base for "red before": bdadcf0. Client fix: 57a6006.

## Jest

- Red before: `jest-red-before.txt` — app files as at bdadcf0, tests as in
  57a6006: 5 failed of 30 in `AvailabilityLeave.test.tsx` and
  `ProfileScreen.about.test.tsx`. "Mark Busy" asked at the save, the screen
  still open (once per save: two saves, two asks; a save and then the close
  question's Save, two asks); "Rate Rehearsly" left iOS's refusal unhandled.
- Green after (57a6006): the availability, profile, reviewPrompt, i18n and
  add-rehearsal suites, 40 passed, 425 tests passed. "Mark Busy": a save with
  the screen open, no ask; closed after a save, one; closed without a save or
  after a failed one, none; two saves then closed, one; a save then the close
  question's Save, one; the close question's Save alone, one, once the screen
  is gone.

## e2e, flow 107 (`e2e/flows/107-rate-the-app.yaml`)

Red before — app files as at bdadcf0, the flow as in this task:

    [Failed] iOS's rating window after a save, once a version; Rate Rehearsly in the profile (1m 57s) (Assertion is false: "Not Now" is not visible)
    1/1 Flow Failed

`red-before-window-over-open-screen.png`: Apple's window over the open
"Availability" screen, "Cancel" still in its header, within the six seconds
after the save.

Green after:

    [Passed] iOS's rating window after a save, once a version; Rate Rehearsly in the profile (2m 49s)
    1/1 Flow Passed in 2m 49s
    [e2e] taps taken again (tap-and-see.yaml): 0
    [e2e] Safari launches: 1, tabs restored: 0 (fresh-safari.yaml)
    server.log: [e2e] links the app opened: https://apps.apple.com/app/id6830809401?action=write-review

- `green-107-saved-screen-open-no-window.png` — six seconds after the save,
  the screen open, no window.
- `green-107-apple-rating-window-over-calendar.png` — after "Cancel": Apple's
  window over the calendar tab.
- `green-107-second-visit-no-window.png` — "Mark Busy" opened again, the day
  saved busy, closed: in the same version, no window.
- `green-107-profile-rate-row.png`, `green-107-app-store-review-page.png` —
  the profile's row and the review page, as in T-410.

A first green run failed on `assertVisible: tab-calendar` while Apple's window
was up: the screenshot showed the window over the calendar, but iOS hides the
app from the tree Maestro reads while a system window is up. The calendar is
now read after "Not Now".

## Native speakers

`natives.md` — the monitor's table and the four editors' reports, as passed
on. es becomes "Calificar Rehearsly"; ru, en, de stay; the T-410 notes above
`rateApp` are gone in all four.

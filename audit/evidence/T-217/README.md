# T-217: flow 43 "Invite link at a cold start, turned down" was flaky

## Cause

The simulator lost the tap on "Close" (docs/e2e.md, "A lost tap"; T-207).
backboardd registered XCTest's digitizer for that tap twice and dropped the
touch ("we already have a service for senderID", then "didn't see a previous
touch down ... skipping event", 07:02:41.33). Maestro reported the tap done.
The invitation stayed, and the flow failed waiting for the calendar. The app
never got the touch: no goBack() ran and nothing was logged. T-207's
`touch-scan.mjs` counts exactly one lost tap in the run, and it is this one.
The cause is below the app, not in the app or the flow's waits, so no timeout
was changed.

## Fix

The owner's rule from T-207: a tap whose result the flow waits for goes through
`e2e/subflows/tap-and-see.yaml`. It taps once more, at most, and only when the
first tap left no trace. Every second tap is printed at the end of the run.
Flow 43 had four bare taps it then waits on, and each one now goes through
that subflow:

- "Cancel" on the invitation - `GONE: "Project Invitation"`
- `tab-profile` - `SEE: ".*Week starts on.*"` (as in flow 09)
- `profile-logout` - `GONE: "Log out"`
- "Close" on "Invitation not found" - `GONE: "Invitation not found"`

The flow's own checks stay after them: calendar-today, then join-project-name
or "Invitation not found" not visible.

## Files

- `red-before.txt` - the red run: Maestro's and backboardd's lines at the
  tap, the scanner's count, and the attempt to make it happen again.
- `green-after.txt` - flow 43 after the change, and the check that T-003's bug
  has not come back.

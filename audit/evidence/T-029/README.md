# T-029 — screen headers: one style

Base e44c2f4, fix 00c9242. Screenshots: `before/` on e44c2f4, `after/` on
00c9242, the same screens by the same probe (Olga, `headers-probe-after.yaml`;
the before run left by the old controls — "Back", the crosses' ids). The probe
is not kept among the flows.

## The headers before (e44c2f4)

Each screen drew its own bar inside its own scroll view or safe area. Four styles:

| Style | What it was | Screens (screenshot) |
|---|---|---|
| A. Large title, cross on the right | 24 pt bold title on the left, × on the right (`rehearsal-close`, `availability-close`); bar scrolls with the form | Add/Edit Rehearsal (`hdr-add-rehearsal`), Busy (`hdr-busy`); the details sheet: 18 pt bold name, "Edit", × (`hdr-details`) |
| B. Small centred title between a chevron and an empty box | 18 pt semibold, "‹" on the left, a 44 pt spacer on the right, a line under it | Create Project (`hdr-create-project`, plus Cancel and Create in the bottom bar); Edit Profile and Change Address (← arrow instead of ‹, grey bar, `hdr-edit-profile`, `hdr-change-email`) |
| C. Large title after an arrow | 24 pt bold title after a ← arrow on the left | a project (`hdr-project-detail`, the arrow and the shield), Calendar Sync (`hdr-calendar-sync`), the inbox (`hdr-inbox`, ✓✓ and 🗑 on the right) |
| D. Large title alone | 24 pt bold, scrolls with the content | My Projects with "+" (`hdr-projects`), Profile (`hdr-profile`); the calendar had no title (`hdr-calendar`); Join with a code had no bar at all, its title in the body and a Cancel button under Join (`hdr-join`) |

The planner (`hdr-planner`, ← and "Smart Planner") is outside the task: the
owner has not decided on its arrow. Sign-in and onboarding are forms with no
bar and are not touched.

## The screens by kind, after (00c9242)

`src/shared/components/ScreenHeader.tsx` — sizes, gaps and type only there
(17 pt bar text and buttons, 34 pt large title, 44 pt targets, 47 in the
details sheet where iOS draws it smaller).

- **modal** — Cancel on the left, title in the middle, action on the right:
  Add/Edit Rehearsal (Create stays in the bottom bar, T-009), Create Project
  (Create in the bottom bar; its second Cancel there is gone), Join with a code
  (Join stays with the invitation; its Cancel buttons in the body are gone,
  the error's "Close" stays), Busy (spinner on the right while saving; Save in
  the panel), the inbox ("Close" — nothing to cancel; ✓✓ and 🗑 on the right),
  the rehearsal's details ("Close", the name on two lines, "Edit"), Edit Profile
  ("Save" on the right, the button under the form gone; now presented as a
  sheet), Change Address (sheet; its steps stay in the body).
- **stack** — "‹ <the screen under it>" then the title: a project
  ("‹ My Projects"), Calendar Sync ("‹ Profile").
- **root** — large title: Calendar, My Projects ("+" on the right), Profile.

The details sheet's bar is a row inside its one ScrollView (CLAUDE.md: no
nested `flex: 1` in a formSheet); the bar's grow is along the row only. No
`Modal` added. Cancel leaves by `goBack`, which `useLeaveGuard` holds and asks
about, as it did the cross (T-013): tested below.

## Red before, green after

App files of the fix put back with `git restore --source=e44c2f4 -- <24 files
under src, tests excluded>`; ScreenHeader.tsx (new), the tests and the flows
kept; then `git restore --source=HEAD -- src`.

### Jest
`npx jest --selectProjects frontend --testPathPatterns "screenHeaders|AddRehearsalScreen|AvailabilityLeave|EditProfileScreen" --verbose`

-- before (e44c2f4 app code) --
```
FAIL EditProfileScreen.test.tsx   (Save is in the header: profile-save)
  ✕ clears a last name with an empty string and never sends the address (HP02, HP01)
  ✕ says a refused name and a lost connection in the app language, not the server English
FAIL screenHeaders.test.tsx
  ✕ AddRehearsalScreen: modal        ✕ RehearsalDetailsScreen: modal
  ✕ CreateProjectScreen: modal       ✕ JoinProjectScreen: modal
  ✕ AvailabilityScreen: modal        ✕ NotificationsScreen: modal
  ✕ EditProfileScreen: modal         ✕ ChangeEmailScreen: modal
  ✕ ProjectDetailScreen: stack       ✕ CalendarSyncSettingsScreen: stack
  ✕ CalendarScreen: root             ✕ ProjectsScreen: root
  ✕ ProfileScreen: root
  ✕ no screen draws its own back arrow or chevron
FAIL AvailabilityLeave.test.tsx
  ✕ Cancel in the header is that way out: goBack, held and asked about
FAIL AddRehearsalScreen.test.tsx
  ✕ Cancel in the header is that way out: goBack, held and asked about
Tests:       18 failed, 45 passed, 63 total
```
-- after (00c9242) --
```
Tests:       63 passed, 63 total
```
Full frontend Jest: 126 suites, 1187 tests passed. `npx tsc --noEmit`: clean.

### e2e
`npm run e2e -- e2e/flows/66-screen-headers.yaml`

-- before (e44c2f4 app code) --
```
[Failed] Screen headers, one style (1m 45s) (Assertion is false: id: screen-header-root is visible)
1/1 Flow Failed
```
-- after (00c9242) --
```
[Passed] Screen headers, one style (1m 29s)
[Passed] Touch targets are 44 pt (1m 37s)
2/2 Flows Passed in 3m 7s
```

Flows changed for the new controls, each run green on the fix: 07 (the
calendar's filter tapped at 18% under the new title, was 12%), 10-availability-days,
10-calendar-sync, 19, 20, 22, 25, 27, 37, 44 (the profile scrolled up before
its language row: a row clipped under the title that stays put is "visible"
to Maestro and the tap lands on the title), 45, 46, 49 (header buttons are
measured by height: a text button's width is its word), 55, 56,
64-availability-collapse-asks, 64-main-button-fill, 66 (new). Also run green,
unchanged: 02, 03, 08, 12, 13, 18, 23, 40, 41, 43, 47, 52, 54, 57, 61-profile-layout,
62, 63.

Not done (out of the task): no new VoiceOver labels. The "‹" button reads
", My Projects" (the icon's empty glyph and the title); flow 66 matches it as
`.*My Projects`.

# T-024 — the profile: delete account, the sheets' bottom, the zone search, a line on sync

Fix: `f857d05`. Base: `e67fd0d`. Simulator: iPhone 16 (393×852 pt, home
indicator zone from 818 pt).

| Owner's decision (02.11) | What changed | Shown by |
|---|---|---|
| 1 "Delete account" last, as a project's delete | `DeleteButton` (shared/components/buttons), used by the project's page (`project-delete`) and the profile (`profile-delete-account`), after Sign Out. Help and Report a Bug stay where they were; the deletion, its confirmation and request are untouched | flow 61; `ProfileScreen.layout` |
| 2 Language and timezone sheets above the home indicator | The profile's sheets pad their bottom by `useSafeAreaInsets().bottom`, as `BottomActionBar` does (T-009). The week-start sheet is the same sheet style and gets it too; the delete confirmation was left as it was (decision 1: not to change it) | flow 61 (a tap at 96 %, 818 pt); `ProfileScreen.layout` |
| 3 A search over the zones | `searchTimezones` (shared/constants/timezones.ts): city in either language, or the IANA name ("pacific", "new_york"); "Nothing found"; the search is cleared when the sheet closes; the sheet rises over the keyboard and a row is taken with it up | flow 61; `ProfileScreen.layout` |
| 4 Calendar Sync | Compared with the current screen (screenshot 45 of the audit is not in the repository): the last sync time (`formatLastSync`, "Synced 5 min ago") and the Synchronize button were already there. Added only the line at the top: rehearsals go into the phone's calendar, only busy hours come back, never what the events are, as onboarding says | `CalendarSyncSettingsScreen.test` |

Texts in all four languages (`profile.ts`, `calendarSync.ts`).

## Red before

Jest: `jest-red-before.txt`. 8 failed of 13.

e2e: the four screen files put back to `e67fd0d` (`ProfileScreen.tsx`,
`profileScreenStyles.ts`, `CalendarSyncSettingsScreen.tsx`,
`calendarSyncSettingsScreenStyles.ts`), the seed and flow as in `f857d05`.
A flow stops at its first failure, so the second and third parts were each
run from a temporary copy that started where they do. The copies were deleted
afterwards.

```
npm run e2e -- e2e/flows/61-profile-layout.yaml
[Failed] The profile's last button, its sheets' bottom and the zone search (1m 42s) (Assertion is false: ".*Delete Account.*", Below id: profile-logout is visible)

# flow 61 from the language sheet on
[Failed] T-024 red, the language sheet (1m 50s) (Assertion is false: id: language-de is visible)
```
The tap on the zone's top edge (818 pt) chose Deutsch: the failure
screenshot (`e2e/out/artifacts/2026-11-02_225248`) is the profile in German,
"Sprache: Deutsch".

```
# flow 61's zone search
[Failed] T-024 red, the zone search (1m 26s) (Element not found: Id matching regex: timezone-search)
```

## Green after (`f857d05`)

```
npx jest --selectProjects frontend --silent
Test Suites: 119 passed, 119 total
Tests:       1072 passed, 1072 total
npm run type-check     (clean)

npm run e2e -- e2e/flows/61-profile-layout.yaml e2e/flows/19-chosen-project-deleted.yaml
[Passed] The profile's last button, its sheets' bottom and the zone search (1m 25s)
[Passed] Chosen project deleted (52s)
npm run e2e -- e2e/flows/23-profile-timezone.yaml e2e/flows/44-profile-language.yaml
[Passed] The profile's timezone, not the device's (2m 17s)
[Passed] The profile's language, kept by the account (2m 7s)
taps taken again (tap-and-see.yaml): 0
```

The fixed language sheet (`e2e/out/artifacts/2026-11-02_222635`): its last
row, Deutsch, ends at about 792 pt, above the zone.

## Review 1: the sync line in e2e

Flow 61 does not open Calendar Sync, and no flow looked at the new line, so
its removal went unseen by e2e. Flow 10 (`calendar`, `profile`), the one that
opens the screen, now checks the line by its id and English text without
calendar access, and its id with access.

Red: `CalendarSyncSettingsScreen.tsx` put back to `e67fd0d`, flow 10 as now.

```
npm run e2e -- e2e/flows/10-calendar-sync.yaml
[Failed] Calendar sync settings, with and without calendar access (1m 52s) (Assertion is false: ".*only the hours you are busy come back from it, never what the events are.*", id: calendar-sync-explanation is visible)
1/1 Flow Failed
taps taken again (tap-and-see.yaml): 0
```

Green: the screen back to `HEAD` (`f857d05`'s).

```
npm run e2e -- e2e/flows/10-calendar-sync.yaml
[Passed] Calendar sync settings, with and without calendar access (2m 15s)
1/1 Flow Passed in 2m 15s
taps taken again (tap-and-see.yaml): 0
```

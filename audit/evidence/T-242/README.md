# T-242 — the app carries only what it uses

## Red before

`src/__tests__/bundleContents.test.ts` on the old sources (only the test file
added): 3 of 3 red — 29 imports of `@expo/vector-icons`' entry file, 3 of
`react-native-calendars`' entry file, and the old server address and the dev
server's in `linking.ts`' prefixes. Output: `red-before-jest.txt`. Green after.

## Export, before and after

`node e2e/hold-lock.mjs npx expo export --platform ios --source-maps --output-dir /tmp/t242-{before,after}`
(production `.env`; the export calls nobody), measured by
`node ../audit/evidence/T-242/measure.mjs <dir> <report>` from
`rehearsal-calendar-native`. Reports: `export-before.txt`, `export-after.txt`.

|                                   | before            | after            |
|-----------------------------------|-------------------|------------------|
| icon fonts                        | 19, 4.08 MB       | 1 (Ionicons.ttf), 0.39 MB |
| `.hbc`                            | 3,394,736 bytes   | 2,763,608 bytes (−0.63 MB) |
| source text in the map            | 7.76 MB, 2105 modules | 6.68 MB, 1968 modules |
| `lodash/lodash.js`, `moment`, `recyclerlistview` | in | gone |
| calendars' agenda/, expandableCalendar/, timeline/, timeline-list/, calendar-list/, infinite-list/, index | in | gone |
| `@expo/vector-icons` IconsLazy (all sets) | in | gone |
| `server-fertvads-projects.vercel.app`, `http://localhost:3001` in the `.hbc` | in | gone |

react-native-calendars after: 23 files, all under `calendar/` plus what it
requires (dateutils, interface, services, day-state-manager, componentUpdater,
hooks, style, commons/constants). Per-function lodash modules (`lodash/isEmpty`
and the like) stay: the month grid requires them.

## LocaleConfig without the entry file

The library's `LocaleConfig` is `xdate`'s XDate, re-exported only by the entry
file. `profileCalendar.tsx` takes it as the constructor of a date the library's
own `interface.js` makes (`parseDate('2000-01-01').constructor`): the very XDate
the month grid reads its words from, and no `xdate` in package.json — knip
would refuse an import of a package that is not listed. Held by
`DayCalendar.locales.test.tsx`, which now draws the real grid with that
LocaleConfig in all four languages, and by e2e flow 56.

## e2e

Each alone (`npm run e2e -- e2e/flows/<file>.yaml`), all passed:

- `41-today-selects-today.yaml` — planner's period picker (`date-range-calendar`), 2m 26s
- `55-rehearsal-form-calendar.yaml` — the form's day (`rehearsal-date-calendar`), 1m 27s
- `56-rehearsal-form-calendar-language.yaml` — the form's month in Spanish and German (LocaleConfig), 2m 32s
- `10-availability-days.yaml` — the availability calendar (`day-…`, `mode-busy`, `availability-save`), 3m 26s

The change shows nothing new on screen, so no new flow: the flows above are
what must not change.

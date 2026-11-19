# App Store screenshots (T-274)

Eight screenshots of the real app, taken on the local e2e stand and made into
the App Store's pictures: a two-line caption at the top, the screenshot under
it with rounded corners, on the landing's dark background. Nothing real is
reached: the database, the server and Metro are the e2e runner's own
(`docs/e2e.md`).

## For a new version

```bash
cd rehearsal-calendar-native
node e2e/store/shoot.mjs ru           # one page; about six minutes
node e2e/store/shoot.mjs              # every page in captions.json, one after another
node e2e/store/compose.mjs            # only the pictures again, from the last shots
node e2e/store/compose.mjs --preview=../audit/evidence/<task>   # and a small preview of each set
```

Run them in the day of the page's country (9:00–21:00 there: New York for
en-US, London, Moscow, Madrid, Berlin): the Planner's first card is today's,
and late at night it has no hours left.

Then look at every picture before it is uploaded.

What comes out, outside git (`.gitignore`):

- `e2e/store/out/<locale>/01.png…08.png` — 1320×2868, the 6.9" display;
- `e2e/store/out/<locale>-6.3/01.png…08.png` — 1206×2622, the 6.3";
- `e2e/store/out/shots/<locale>/` — the screenshots as the simulator took them.

The pages are `en-US`, `en-GB`, `ru`, `es-ES` (uploaded for es-MX too) and
`de-DE`. PNG without alpha, which App Store Connect refuses.

## What does what

- `captions.json` — the captions as the native editors approved them (version
  2, 17.11.2026), `screenshots` for these pictures, `video` for the preview
  video (T-275). A line break is where the caption breaks; the composer adds
  none and takes none away. Change a caption here and run `compose.mjs`.
- `shoot.mjs` — for each locale runs `node e2e/run.mjs --store=<locale>
  e2e/store/shots.yaml`, which stands up the e2e stand under the e2e lock (never
  beside an e2e run) on its own simulator, "Rehearsly Store" (iPhone 17 Pro Max,
  created on the first run), with the status bar at 9:41, the battery full and
  full signal. Then copies the shots and calls the composer.
- `seed.mjs` — each page's world: people with names of that language, a play in
  the public domain (Shakespeare, Chekhov, Lorca, Kleist), a concert and a
  music video; busy times for four weeks, so the Planner's first card shows all
  four levels; a rehearsal 5 of 8 have seen (frame 5); a rehearsal of all 12,
  nobody's mark on it yet, for the video (`EVERYONE_REHEARSAL`); everyone in
  the country's zone. Accounts are inserted as in `e2e/seed.mjs`, the rest goes
  through the API.
- `shots.yaml` — the Maestro flow: signs in as the director, then each frame
  from a fresh launch with the country's language, region and clock (12-hour
  for en-US, 24-hour elsewhere).
- `compose.mjs` and `compose.swift` — the pictures: SF Pro from
  `/System/Library/Fonts/SFNS.ttf`, the colours read from
  `server/public/styles.css`. When a caption is too wide, the type gets smaller
  for the whole language. The Swift is compiled once into `out/.bin`; the app's
  packages are not touched. Test: `node --test e2e/__tests__/store-compose.test.mjs`
  (in `npm test`).

## The frames

1. The Planner, its windows at every level — 2. the director's month of busy
times — 3. the form, naming who is busy — 4. Calendar Sync on — 5. a
rehearsal's details, 5/8 seen — 6. the calendar with every project — 7. the
play's page with its link and code — 8. the profile: language and time zone.

Known: frame 7 taps "Show Code", because the page reads the code from the
wrong field of the server's answer and never shows it up front (reported with
T-274). Frame 4 shows the simulator's one calendar, "Calendar".

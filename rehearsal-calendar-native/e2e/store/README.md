# App Store screenshots (T-274) and preview video (T-275)

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

Shoot a page before 20:00 in its country (New York for en-US, London, Moscow,
Madrid, Berlin). The Planner's first card is today's, and its three busy levels
take an hour each from the next full hour to 23:00: from 20:00 there is no room
for the third. The seed refuses then, and `shoot.mjs` refuses up front any page
that would be seeded that late, counting about seven minutes a page before it.

All five pages in one command (en-US, en-GB, ru, es-ES, de-DE, in that order)
need New York and Moscow both before 20:00: start between midnight and about
11:30 in New York in winter, 12:30 in summer (Moscow is seeded third, about 15
minutes in, and its 20:00 is 17:00 UTC). In UTC that is about 05:00–16:30 in
winter and 04:00–16:30 in summer. Outside it, shoot the pages one by one.

Then look at every picture before it is uploaded.

What comes out, outside git (`.gitignore`):

- `e2e/store/out/<locale>/01.png…08.png` — 1320×2868, the 6.9" display;
- `e2e/store/out/<locale>-6.3/01.png…08.png` — 1206×2622, the 6.3";
- `e2e/store/out/shots/<locale>/` — the screenshots as the simulator took them.

The pages are `en-US`, `en-GB`, `ru`, `es-ES` (uploaded for es-MX too) and
`de-DE`. PNG without alpha, which App Store Connect refuses.

## The preview video (T-275)

```bash
cd rehearsal-calendar-native
node e2e/store/record.mjs ru          # one page; about eight minutes
node e2e/store/record.mjs             # every page, one after another
node e2e/store/montage.mjs            # only the cut again, from the last recordings
node e2e/store/record.mjs ru --preview=../audit/evidence/<task>   # and a preview frame sheet of it
```

The same stand, simulator and hours as the screenshots (seeded before 20:00 in
the page's country; record.mjs refuses up front as shoot.mjs does). Needs
ffmpeg (`brew install ffmpeg`). Then watch every video before it is uploaded.

What comes out, outside git: `e2e/store/out/video/<locale>.mp4` — 886×1920, 30
fps, H.264 High at 10 Mb/s, a silent stereo AAC track at 48 kHz (App Store
Connect refuses a preview without sound), 29.8 s; and the recordings it was
cut from, `e2e/store/out/clips/<locale>/01.mov…07.mov`, each with the flow's
pauses beside it (`01.json`). Upload es-ES's for es-MX too.

- `video.yaml` — the storyboard, played at a person's pace: 1 the Planner
  filling (the cover; set the poster frame to it in App Store Connect), 2 two
  days marked busy, 3 Calendar Sync on, 4 three people picked in the Planner,
  5 the form naming who is busy and its save asking about it, 6 the seen count
  to 12 of 12 (seven of the cast mark it through the API while it is on
  screen, `scripts/seen.js`), 7 the week, then the landing's mark and name.
  Each shot is recorded on its own (`xcrun simctl io <udid> recordVideo
  --codec=h264`), started and stopped by the flow through record.mjs's
  recorder on 127.0.0.1:3003 (`scripts/recorder.js`), which also holds the
  flow's pauses: Maestro has no command for one.
- `record.mjs` — runs `node e2e/run.mjs --store=<locale> e2e/store/video.yaml`
  (the e2e lock, the store's simulator) with the recorder listening, then the cut.
- `montage.mjs` — the cut, with ffmpeg: each shot as long as the storyboard
  gives it (`SLOTS`), in the screenshots' look (compose.swift `card`: the
  caption as captions.json's `video` breaks it, SF Pro, one size for the
  language; the recording in the window under it). The screen standing still
  while Maestro finds its next tap is cut to 0.2 s, the flow's own pauses kept;
  a shot still longer is played faster, up to 2×, and beyond that refused. Test:
  `node --test e2e/__tests__/store-video.test.mjs` (in `npm test`).

Only the app's own screen and the captions: no device frame, hands, prices or
reminders. The availability legend's "Free" (and its translations) is the
app's word for a free hour, not a price.

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

Known: on the en-GB page the dates are in the American order ("Friday,
November 20, 2026" in frames 3 and 5): the app formats every `en` date as
en-US (`src/shared/utils/locale.ts`), whatever the phone's region. The tool
cannot change that; it is the app's, for a task of its own.

Known: a play's name is the header of frame 7 and is cut after about twenty
letters, so the plays in `seed.mjs` are short ones.

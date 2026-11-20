# App Store screenshots (T-274) and preview video (T-275, T-285)

Eight screenshots of the real app, taken on the local e2e stand and made into
the App Store's pictures: a two-line caption at the top, the screenshot under
it with rounded corners, on the landing's dark background. Nothing real is
reached: the database, the server and Metro are the e2e runner's own
(`docs/e2e.md`).

## The captions' look: «Пьеса» (T-288)

The owner's choice of 20.11.2026: the captions set as the text of a printed
play, the screenshots and the video in one type and one style (the video from
T-289; until then it keeps its own, below).

- **Type.** Literata at weight 600, its optical size (`opsz`) the type's size,
  72 at most. One size for a language — the largest at which its widest line
  fits the window's width, 104 px at most — and lines 1.1 of it apart.
- **The main word.** One word, or two or three in a row, in each caption is set
  in Literata's italic, also 600, the same size, in the app's lilac `#C084FC`;
  the rest upright in the landing's text colour. In captions.json it stands in
  square brackets: `"Planner\nпоказывает [окна]"`. One pair a caption at most,
  within one line; the brackets are never printed. Where the italic word meets
  upright type with no space between (es «el *martes*?»), the italic's
  overhang is given back as space, so the "?" never runs into it.
- **Place.** Flush left: each line's first letter's ink on the window's left
  edge (x 127 of 1320). The block centred in the band above the window, as
  before; the background, the glow, the window and its corners as before.
- **Fonts, in the repository.** `fonts/` — Literata (upright and italic,
  variable, axes `opsz` and `wght`), Caveat (the video's handwritten finale,
  T-289) and Inter Tight (the video's closing card, T-289; its captions until
  then), from github.com/google/fonts (`ofl/literata`, `ofl/caveat`,
  `ofl/intertight`), each family's `OFL.txt` beside it. The SIL Open Font
  License lets them be kept here and set in pictures and videos. compose.swift
  takes fonts from here only; no picture of the store uses a font of the
  system's (SF Pro) any more.
- **The words.** captions.json is the native editors' ready blocks of T-288
  (`audit/evidence/T-288/T-288-natives-*.md`): `screenshots`, `hook`,
  `hookByDay` (the hook for each day of the week, `mon`…`sun`, for the day
  the video is shot), `video`, `finale` (the line the video's pencil strikes
  through, the struck part and the word written over it) and `signIn`. es
  keeps the "?" of its hook outside the brackets — the pair «¿…?» upright, as
  the RAE has it. `video[6]`, the old slogan, stays until T-289: today's
  video reads it.

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

## The preview video (T-275, made anew by T-285)

```bash
cd rehearsal-calendar-native
node e2e/store/montage.mjs            # the cut, from the last recordings; every page
node e2e/store/montage.mjs ru --preview=../audit/evidence/<task>   # one page, and three frames of it
node e2e/store/record.mjs ru          # record a page again; about eight minutes
node e2e/store/record.mjs             # every page, one after another
```

Run by hand, never in the ordinary e2e run. Recording takes the same stand,
simulator and hours as the screenshots (seeded before 20:00 in the page's
country; record.mjs refuses up front as shoot.mjs does). Needs ffmpeg (`brew
install ffmpeg`). Then watch every video before it is uploaded.

What comes out, outside git: `e2e/store/out/video/<locale>.mp4` — 886×1920, 30
fps, H.264 High at 10 Mb/s, 27.2 s, and a silent stereo AAC track at 48 kHz;
and the recordings it was cut from, `e2e/store/out/clips/<locale>/01.mov…07.mov`,
each with the flow's pauses and marks beside it (`01.json`). Upload es-ES's for es-MX too,
and set each preview's poster frame (`previewFrameTimeCode`) to **00:00:02:15**:
montage.mjs prints it.

### The preview video's rules

Apple's (developer.apple.com/app-store/app-previews; App Review 2.3.4), and
what App Review has refused previews for ("Includes device images and/or
device frames", "Includes framing around the video screen capture of the
app"). Keep to them whatever the next storyboard is:

1. **The whole frame is the app.** The recording fills all 886×1920: scaled
   down to it and no more (no zoom), the simulator's hair of extra height cut
   evenly off the top and the bottom. No device frame, no rounded window, no
   landing background, no band above the recording, no border, no shadow.
   Shots are joined by a cut, or by a dissolve to the closing card.
2. **Captions over the recording.** Bold Inter Tight in white (until T-289
   sets them as the screenshots are; the main word's brackets taken out, not
   printed), one size for the
   language (its widest line sets it), lines broken only where captions.json
   breaks them — never by the composer. Under the lines a soft dark band, only
   as tall as the text: solid enough under them that white reads at 4.5:1 or
   more over anything, fading out above and below. Each caption on screen at
   least 2 s. Its place, the top or the bottom, is chosen for each shot so the
   band does not cover what the caption is about (below).
3. **Sign-in, said.** Rehearsly does nothing without signing in, and Apple
   asks an app that needs it to say so in the preview. The closing card says
   it (captions.json `signIn`) under the mark and the name for the whole card,
   about 3 s, at 40 px or more; broken where captions.json breaks it (en, es,
   de after the colon, T-288), and one not broken there breaks after its
   colon when one line would be smaller (ru after «Нужен вход» if it has none).
4. **The poster frame** is the end of the hook's shot: the Planner's windows
   lit, the hook still on. Its time code goes to App Store Connect.
5. **Never the app loading.** A preview plays by itself from its first frame,
   and the Planner loading says "Loading…" and that the project has no members.
   The hook's shot starts on the Planner with its windows already there: the
   flow marks the moment (`mark ready`, in `01.json`'s `marks`) and montage.mjs
   starts from the frame on screen then (`readyAt`); a recording 01 without the
   mark is refused (T-286).
6. **No sound** but a silent track: App Store Connect refuses a preview with
   no audio track at all.

**Why the video does not look like the screenshots.** A screenshot may be a
picture about the app — a caption band, the screen in a rounded window on the
landing's background (T-274). A preview may not: it must show the app as it
will be on the whole screen. So the screenshots keep their frame, and the
video has its own look: the full screen, captions on it. The type and the
style of the captions are the same in both (T-288, «Пьеса»; the video's from
T-289).

### The storyboard

Eight shots from video.yaml's seven recordings (`SHOTS` in montage.mjs), the
captions captions.json's `hook` and `video`:

| shot | on screen | caption | where | why there |
|---|---|---|---|---|
| 0 | the Planner with its windows, darkened; after 1.5 s the darkness lifts | `hook` | bottom | the title and first windows stay clear; the poster frame |
| 1 | the Planner's windows | `video[0]` | bottom | the same |
| 2 | two days marked busy | `video[1]` | top | the days are mid-screen, the sheet and Save at the bottom |
| 3 | Calendar Sync on | `video[2]` | bottom | the whole screen is in its top half |
| 4 | three picked, the windows weighed again | `video[3]` | bottom | "3 of 12" is in the upper third |
| 5 | the form's conflict alert | `video[4]` | bottom | the alert's title and who cannot are mid-screen |
| 6 | the seen count to 12 of 12 — its caption only once it is there | `video[5]` | bottom | the count is under the week strip |
| 7 | the week, then the mark, "Rehearsly", the sign-in line | `video[6]` | bottom | the week strip is at the top |

The recordings are cut to their action: any stillness — Maestro finding its
next tap, the flow's own pauses — is cut to 0.2 s. A recording still longer
than its shot is played faster, up to 2× (`MAX_SPEEDUP`); beyond that
montage.mjs refuses it: shoot that scene again with less in it, under the e2e
lock (record.mjs), rather than race it.

- `video.yaml` — the scenes, played at a person's pace: 1 the Planner
  filling, 2 two days marked busy, 3 Calendar Sync on, 4 three people picked
  in the Planner, 5 the form naming who is busy and its save asking about it,
  6 the seen count to 12 of 12 (seven of the cast mark it through the API
  while it is on screen, `scripts/seen.js`; the recording stops once it reads
  12/12, so the caption comes when the recording has played out), 7 the week.
  Each is recorded on its own (`xcrun simctl io <udid> recordVideo
  --codec=h264`), started and stopped by the flow through record.mjs's
  recorder on 127.0.0.1:3003 (`scripts/recorder.js`), which also holds the
  flow's pauses: Maestro has no command for one.
- `record.mjs` — runs `node e2e/run.mjs --store=<locale> e2e/store/video.yaml`
  (the e2e lock, the store's simulator) with the recorder listening, then the cut.
- `montage.mjs` — the cut, with ffmpeg; the captions, the hook's darkness and
  the closing card drawn by compose.swift `video`. Test:
  `node --test e2e/__tests__/store-video.test.mjs` (in `npm test`).

Only the app's own screen and the captions: no device frame, hands, prices or
reminders. The availability legend's "Free" (and its translations) is the
app's word for a free hour, not a price. No touch marks are drawn: Maestro
does not say where on the screen its taps land, and they are not guessed.

## What does what

- `captions.json` — the captions as the native editors approved them (version
  2, 17.11.2026), `screenshots` for these pictures; for the preview video
  `hook`, `video` and `signIn`, as the native editors read them on 20.11.2026
  (T-285, `audit/evidence/T-285/`); their main words in [brackets], and
  `hookByDay` and `finale`, by the native editors of T-288
  (`audit/evidence/T-288/`). A line break is where the caption breaks;
  the composer adds none and takes none away. "12 of 12" and its translations
  hold together with no-break spaces. Change a caption here and run
  `compose.mjs`, or `montage.mjs` for the video.
- `shoot.mjs` — for each locale runs `node e2e/run.mjs --store=<locale>
  e2e/store/shots.yaml`, which stands up the e2e stand under the e2e lock (never
  beside an e2e run) on its own simulator, "Rehearsly Store" (iPhone 17 Pro Max,
  created on the first run), with the status bar at 9:41, the battery full and
  full signal. Then copies the shots and calls the composer.
- `seed.mjs` — each page's world: people with names of that language, a play in
  the public domain (Shakespeare, Chekhov, Lorca, Kleist), a concert and a
  music video; busy times for four weeks, so the Planner's first card shows all
  four levels; a rehearsal 5 of 8 have seen (frame 5); a rehearsal of all 12,
  nobody's mark on it yet, for the video (`EVERYONE_REHEARSAL`); every other
  rehearsal seen by some of its cast and not all (`seenBy`: 4/7, 2/4, 3/4…);
  everyone in the country's zone. Accounts are inserted as in `e2e/seed.mjs`,
  the rest goes through the API, the "seen" marks as the phones send them.

  **Changed after the screenshots.** The screenshots (T-274) were taken and
  approved on the seed before T-286, where no rehearsal but frame 5's had a
  "seen" mark. Since T-286 (20.11.2026) every rehearsal but the one of all
  twelve has some, so the video's calendar does not show "0/7" under "12 of
  12". Shot again now, frame 6 (the calendar) would read 2/4, 2/4 and 3/4
  where the approved one reads 0/4 three times (the band rehearsal, the
  choreography, shoot day 1); its 5/8 and the 0/12 of all twelve stay, and so
  does every other frame. The approved pictures were not shot again.
- `shots.yaml` — the Maestro flow: signs in as the director, then each frame
  from a fresh launch with the country's language, region and clock (12-hour
  for en-US, 24-hour elsewhere).
- `compose.mjs` and `compose.swift` — the pictures: the fonts from `fonts/`
  (above, «Пьеса»), the colours read from `server/public/styles.css`, the
  main word's lilac `#C084FC`. When a caption is too wide, the type gets smaller
  for the whole language.
- `fonts/` — Literata, Caveat, Inter Tight and their `OFL.txt` (above). The Swift is compiled once into `out/.bin`; the app's
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

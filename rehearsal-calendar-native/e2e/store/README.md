# App Store screenshots (T-274) and preview video (T-275, T-289)

Eight screenshots of the real app, taken on the local e2e stand and made into
the App Store's pictures: a two-line caption at the top, the screenshot under
it with rounded corners, on the landing's dark background. Nothing real is
reached: the database, the server and Metro are the e2e runner's own
(`docs/e2e.md`).

## The captions' look: «Пьеса» (T-288)

The owner's choice of 20.11.2026: the captions set as the text of a printed
play, the screenshots and the video in one type and one style (the video's
since T-289, below).

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
  variable, axes `opsz` and `wght`), Caveat (the video's handwritten finale)
  and Inter Tight (the video's closing card), from github.com/google/fonts (`ofl/literata`, `ofl/caveat`,
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
  the RAE has it. The old slogan, `video[6]`, went with T-289: the finale says
  it. `hook` is the editors' Tuesday; the video reads `hookByDay`.

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

## The preview video (T-275; the storyboard «Свет на главном», T-289)

```bash
cd rehearsal-calendar-native
node e2e/store/montage.mjs            # the cut, from the last recordings; every page
node e2e/store/montage.mjs ru --preview=../audit/evidence/<task>   # one page, and six frames of it
node e2e/store/record.mjs ru          # record a page again; about six minutes
node e2e/store/record.mjs             # every page, one after another
```

Run by hand, never in the ordinary e2e run. Recording takes the same stand,
simulator and hours as the screenshots (seeded before 20:00 in the page's
country; record.mjs refuses up front as shoot.mjs does). Needs ffmpeg (`brew
install ffmpeg`). Then watch every video before it is uploaded.

What comes out, outside git: `e2e/store/out/video/<locale>.mp4` — 886×1920, 30
fps, H.264 High at 10 Mb/s, 29.0 s, and a silent stereo AAC track at 48 kHz;
and the recordings it was cut from, `e2e/store/out/clips/<locale>/01.mov…07.mov`,
each with its log beside it (`01.json`: when and where it was shot, the
flow's pauses, marks and cuts, the light's holes, the touches). Upload es-ES's
for es-MX too, and set each preview's poster frame (`previewFrameTimeCode`) to
**00:00:02:14**, the hook's last frame: montage.mjs prints it.

### The preview video's rules

Apple's (developer.apple.com/app-store/app-previews; App Review 2.3.4), and
what App Review has refused previews for ("Includes device images and/or
device frames", "Includes framing around the video screen capture of the
app"). Keep to them whatever the next storyboard is:

1. **The whole frame is the app.** The recording fills all 886×1920: scaled
   down to it and no more (no zoom), the simulator's hair of extra height cut
   evenly off the top and the bottom. No device frame, no rounded window, no
   landing background, no border. The shade and its light are over the app's
   own screen, edge to edge. Shots are joined by a cut, and one dissolve goes
   to the closing card.
2. **Captions over the recording**, each on screen 2 s or more (below).
3. **Sign-in, said.** Rehearsly does nothing without signing in, and Apple
   asks an app that needs it to say so in the preview. The closing card says
   it (captions.json `signIn`): one small line at its foot.
4. **The poster frame** is the hook's last frame: the answer lit, the hook
   typed. Its time code goes to App Store Connect.
5. **Never the app loading.** A preview plays by itself from its first frame,
   and the Planner loading says "Loading…" and that the project has no members.
   The hook's shot starts on the Planner with its windows already there: the
   flow marks the moment (`mark ready`) and montage.mjs starts from the frame
   on screen then; a recording 01 without the mark is refused (T-286).
6. **No sound** but a silent track: App Store Connect refuses a preview with
   no audio track at all. No music (the owner, 20.11.2026).

**Why the video does not look like the screenshots.** A screenshot may be a
picture about the app — a caption band, the screen in a rounded window on the
landing's background (T-274). A preview may not: it must show the app as it
will be on the whole screen. So the screenshots keep their frame, and the
video has its own look: the full screen, the light, captions on it. The type
and the style of the captions are the same in both («Пьеса»).

### The storyboard «Свет на главном» (T-289)

The owner's of 20.11.2026, version 3 (`AUTODEV/notes/T-288-storyboard`). Nine
shots, 29 s (`SHOTS` in montage.mjs), from video.yaml's seven recordings:

| # | s | on screen | light | touch marks | caption, its centre |
|---|---|---|---|---|---|
| 1 | 0–2.5 | the Planner (01, from `ready`), shade 0.86 | at 1.6 s today's first window, everyone free (`planner-row-<today>-…`), shade 0.64 | — | the hook, typed, 24 % |
| 2 | 2.5–5 | the Planner | today's card (`planner-card-<today>`) | — | `video[0]`, 79 % |
| 3 | 5–8 | the month (02): two days, Busy | the two days (`day-…`); then the modes (`mode-selector`) | day A, day B, Busy | `video[1]`, 13 % |
| 4 | 8–10.5 | Calendar Sync (03) | the iPhone's calendar (`calendar-provider-apple`); then with Auto Sync (`calendar-sync-row`) | the calendar (Auto Sync switches itself on when a calendar is chosen: no touch, no mark) | `video[2]`, 63 % |
| 5 | 10.5–14 | the picker (04): three, Done; a cut to the Planner weighed again | All participants and the three (`participants-all`, `participant-<id>`); then Done; after the cut the first two windows | three names, Done | `video[3]`, 82 % |
| 6 | 14–17.5 | the form (05): Save, the conflict alert | Save (`rehearsal-submit`), shade 0.82; the alert, shade 0.6 | Save | `video[4]`, 80 % |
| 7 | 17.5–22.5 | the rehearsal of all twelve (06): 4 → 7 → 9 → 11 → 12 | its row (`rehearsal-item-<id>`) | the eye | `video[5]` on the frame 12/12 came in, 74 % |
| 8 | 22.5–25.5 | the week (07), shade 0.8 | — | — | the finale, 47 % |
| 9 | 25.5–29 | the closing card, dissolving in over 0.5 s | — | — | — |

**The light.** A shade of `#04030A` over the whole screen, 0.62 dense unless a
shot says otherwise, with up to two rounded holes, their edges soft (20 px
either side at 886 wide); a hole moves to its next place in 0.3 s, a cut puts
it there at once. Where a hole is is never placed by eye: the flow asks the
recorder (`light`, scripts/recorder.js) and the recorder reads the screen's
hierarchy at that moment from Maestro's own iOS driver (`POST /viewHierarchy`
on the port it listens on) — the frames of the elements named by testID, or
iOS's alert by its type, which has no testID. The app got the testIDs it
lacked for it (`planner-card-<date>`, `mode-selector`,
`calendar-provider-apple`, `calendar-sync-row`, `rehearsal-item-<id>`). An
element not on screen fails the recording. The alert is read 0.45 s after the
finger lifts off Save (`AFTER: up`): the button's spinner keeps the screen
moving under it, and Maestro sees the alert seconds later; the form's
recording ends a second after it was read.

- **A hole follows its element** as long as it is lit. After every tap in a
  lit scene, once the screen stands (`waitForAnimationToEnd`), the flow reads
  the lit elements again under the same name: the month's day panel pushes the
  month down some 62 points, the picker's rows, Auto Sync, the list after a
  pull. A reading in the same place again changes nothing; one somewhere else
  is an element that moved, and *when and how* it moved is taken from the
  recording itself, not from when it was read (the screen has stood still a
  while by then): montage.mjs decodes the recording's frames from the reading
  before to this one (grey, halved, only round the two places), takes the
  element's picture from the last of them, where it was read, and seeks it in
  each frame along its way from the old place to the new, a pixel at a time —
  the patch nearest to the picture (`track`; a light's holes together, so the
  month's two days go as one). The hole goes there on that very frame of the
  video, at once — the app's own move, not an easing of ours: the month glides
  down over some 0.27 s, the modes' row jumps in one frame as the sheet lays
  itself out again (T-290). A frame where the element is not to be told — the
  day just tapped still fading to chosen — keeps the place before it.
  Matching, not the frames' difference: a difference says that something
  changed (the day's panel opening changes as much as the month moving), not
  where the element is.
- **No video with a light behind its element.** From the frame a followed
  element sets off in to half a second after it comes to rest (or the light
  goes on to the next element), its hole's centre is within 8 px (the hole's
  room round it) of the element's, as the recording shows it, or montage.mjs
  refuses the video when it is off for more than two frames in a row
  (`lightLags`), naming the light and the frames.
- **The light on an element comes no later than the tap on it.** The cut keeps
  the order of the recording: a moment later in it is never earlier in the
  video (`keeping`). A move ends by the first tap in its holes — moved earlier
  if need be, but not before the tap before it, nor the previous move, nor a
  cut it was read after.
- **No video with a touch mark outside the light.** In this storyboard every
  tap is on a lit element; a mark outside every hole of the light that has
  begun by then (`touchesOutside`) is a light left behind or come late, and
  montage.mjs refuses to make the video, naming the recording and the touch.

**The touch marks.** A mark is where and when a real touch was, taken from
the recording itself, not guessed and not from the storyboard: *when* from
the app, *where* from Maestro's driver.

- The app tells the recorder each touch as it happens: launched with
  `rehearslyStoreTouches: "http://127.0.0.1:3003"`, an e2e bundle's app sits
  in a view that only listens in the capture phase (e2e/device/App.js; Metro
  hands it to index.ts only when e2e/run.mjs sets `REHEARSLY_E2E`, so no
  production bundle has it, and without the argument the e2e app is the real
  one as it is — `e2e/__tests__/store-touches.test.mjs`). Its time is the
  touch's own, on the Mac's clock.
- The app's point is in its root view's points, and on a sheet iOS presents
  (the month, the form) that root starts some 60 points below the window's
  top. So the place is the tap Maestro's driver logged as it made it
  ("Tapping x, y", in the window's points; the run's `xctest_runner_*.log`):
  record.mjs gives each touch the driver's tap that began just before the app
  felt it, at the same x (montage.mjs `placeTouches`). A touch with no such
  tap gets no place, and montage.mjs refuses to draw it.
- A finger that moved more than 10 points (a list pulled to refresh) is no
  tap and gets no mark; what the flow cut out gets none either.
- The mark, at 886 wide: a circle 88 px across, white at 30 % with a white
  edge at 95 %, 5 px, a thin dark ring outside it so it shows on white;
  pressed in 0.09 s (scaled 1.3 → 0.94), held 0.15 s, let go with a ripple
  out to about 150 px, gone in 0.38 s.

**The captions, «Пьеса».** As the screenshots' (above): Literata 600, the
main word in its italic in `#C084FC`, the rest white; flush left, each line's
ink from x 42 of 886, the app's margin; lines broken only where captions.json
breaks them. One size for a language, the largest up to 70 px at which every
caption fits; the hook and the finale up to 88 px. No band, but no word of
the app beside or between the lines either: round the lines' rectangle (and
16 px more above and below, 40 px to either side) the shade itself is 0.97
dense, so the app's white comes through no brighter than 20 of 255 — as under
the hook at 0.86 with its old shadow — and from there it eases back to the
shot's shade (0.62, 0.8, 0.86…) over 80 px up and down and 180 px to the
sides, where the app's rows run on past a short line; no edge to see. And on
each line's own height the 0.97 runs on 300 px past its last letter before it
eases the same way: the app's words never read as the line going on
(«Все в курсе:» once did as «Все в курсе: …онный зал», T-290). compose.swift
measures it — on each line's ink height, from its last letter 300 px on,
outside the holes, the white comes through no brighter than 25 of 255
(`beside`, printed by montage.mjs beside `under`), or it refuses. It is the shade's, so a hole is never darkened by it;
elsewhere the shade is the storyboard's. White and the lilac read at 4.5:1 or
more over a white recording where it is weakest, with the light as it is
there; compose.swift works it out and refuses otherwise, and says how bright
the white comes through (`under`; montage.mjs prints the worst). Each line comes in
from below, fading, 0.14 s after the one before; its main word 0.22 s after
its line. A caption comes 0.12 s into its shot and stays to its end.

**The hook** is captions.json's `hookByDay` for the day recording 01 was shot
on in the page's country (`recordedAt` and `zone` in 01.json) — the day of the
Planner's first card, which is that country's today. Typed letter by letter
from 0.15 s, in about 0.95 s, a lilac caret blinking after it.

**The seen count.** Four of the cast mark the rehearsal of all twelve seen
before the shot; in it three, two and two more through the API
(scripts/seen.js), the list pulled after each — the pull between the flow's
`cut` and `resume`, taken out, so the number changes in place: 7, 9, 11. The
twelfth is the director's own eye. The caption comes on the frame 12/12 came
in: the last frame recorded before the flow saw it (`mark counted`). The
recording's stillness is kept 0.5 s here, so each number stays a moment.

**The finale.** captions.json `finale`: its `line` in Literata 600 at up to
88 px; at 0.8 s a pencil stroke in `#C084FC`, uneven, drawn in 0.45 s through
the `struck` part; then `insert` over it in Caveat 700, tilted −5°, in 0.3 s,
and the struck part fades to 45 %. No light, the shade at 0.8, denser round
the line and the word over it as round a caption.

**The closing card.** Dissolves in over 0.5 s and stays 3 s more. The
landing's background and glow; the mark (`server/public/assets/mark.png`) and
"Rehearsly" in Inter Tight 700, centred a little above the middle; at its foot
`signIn` in Inter Tight 500, 40 px — never smaller — in the text's colour at
72 %. ru in one line; en, es and de broken after the colon, as their editors
broke it in captions.json.

**The cut.** The recordings are cut to their action: any stillness — Maestro
finding its next tap, the flow's own pauses — is cut to 0.2 s; what the flow
marked between `cut` and `resume` is taken out, but the frame on screen at
`resume`. A recording still longer than its shot is played faster, up to 2×
(`MAX_SPEEDUP`); beyond that montage.mjs refuses it: shoot that scene again,
under the e2e lock (record.mjs), rather than race it. compose.swift draws the
layer over the recording — the shade, the marks, the captions, the finale, the
card — frame by frame, straight-alpha RGBA piped into ffmpeg (a straight blend
in YUV is the RGB one; a premultiplied one made the shade denser).

- `video.yaml` — the scenes, played at a person's pace, each recorded on its
  own (`xcrun simctl io <udid> recordVideo --codec=h264`), started and stopped
  by the flow through record.mjs's recorder on 127.0.0.1:3003
  (`scripts/recorder.js`), which also holds the flow's pauses, marks its
  moments and reads the light.
- `record.mjs` — runs `node e2e/run.mjs --store=<locale>
  e2e/store/video.yaml` (the e2e lock, the store's simulator) with the
  recorder listening, places the touches from the driver's log, then the cut.
- `montage.mjs` — the cut, with ffmpeg; the layer drawn by compose.swift
  `video`. Tests: `node --test e2e/__tests__/store-video.test.mjs
  e2e/__tests__/store-touches.test.mjs` (in `npm test`).

Only the app's own screen, the light, the touch marks and the captions: no
device frame, hands, prices or reminders. The availability legend's "Free"
(and its translations) is the app's word for a free hour, not a price.

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

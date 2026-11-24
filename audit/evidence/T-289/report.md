# T-289 — the preview by the storyboard «Свет на главном»

## The addendum of 21.11 and the review (fd47eb6, c57236a)

Recorded again under the e2e lock, 21.11.2026 09:23–10:35 Israel time, one
page a run (`node e2e/store/record.mjs <locale>`; each run's cut was then made
by `node e2e/store/montage.mjs <locales> --preview=../audit/evidence/T-289/frames`,
as a record run with its cut is longer than one command may take). All five
shot on Saturday in their countries.

**The light follows its element — the choice.** After each tap in a lit scene,
once the screen stands (`waitForAnimationToEnd`), video.yaml reads the lit
elements again from Maestro's driver under the same name: the month's two days
after day A (the panel pushes the month down 62 pt), the modes after Busy, the
picks after each pick, the calendar and Auto Sync after sync came on, the
rehearsal's row before each cut of a pull ends. montage.mjs takes every
reading as a move there. Why this and not polling: the hierarchy is the
driver's, one request at a time and ~0.3–1 s each; asked only while the flow
waits, it never races Maestro's own commands, and the reads fall in stillness
the cut takes out anyway. What makes it safe: the rule below refuses a video
whose light was left behind.

**The light before the tap.** The cause of Done lit after its tap (ru 11.69
against 11.64 s): the cut mapped a moment in a still gap by its distance to
the nearer frame — a light read early in a long gap went to the gap's end,
past the tap that ended it. Now a moment goes no further than the gap's
middle, so the recording's order holds (`keeping`). And a move is whole by the
first tap in its holes (moved up to LIGHT_MOVE earlier, never before the tap
before it, the previous move, or a cut it was read after). ru now: day B lit
5.91 s, pressed 6.21 s; Done lit 11.36 s, pressed 11.66 s.

**The rule.** `touchesOutside`: a touch mark outside every hole of the last
light begun by its time refuses the video, naming the recording and the touch.
On 393a076's ru recording it refuses day 30 (02.json, 4.90 s); Done passes
there only because of the order fix above (red-before-21.11.txt). On the five
new recordings: none.

**The darkness round the captions.** compose.swift's caption shadow (an image
over the shade, 0.55, σ 28) is gone: the shade itself is 0.97 dense round the
lines' rectangle (16 px above and below, 40 px to the sides) and eases back to
the shot's shade over 80 px up and down, 180 px to the sides. Being the
shade's, a hole is never darkened. The app's white in the rectangle outside
the holes: at most 17.4 of 255 on every page (compose.swift's `under`); the
contrast of the captions themselves: text 19.64:1, lilac 7.43:1 at worst. The
wider sides came from looking: with 40 px of fade, "…онный зал" still read
beside «Все в курсе:» outside the rectangle.

**Also.** README shot 4: one touch, the calendar (Auto Sync switches itself
on). The unused `calendar-provider-google` testID is removed: the app has the
five testIDs the README names.

### ffprobe, poster

```
en-US.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
en-GB.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
ru.mp4:    29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
es-ES.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
de-DE.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
```

Poster frame, every page: **00:00:02:14** (2.467 s). Hooks: en-US/en-GB «Who
can make Saturday?», ru «Кто может в субботу?», es «¿Quién puede el sábado?»,
de «Wer kann am Samstag?». Finale 66 / 66 / 88 / 79 / 76 px.

### Shots (ru; the others within 0.4 s, montage.mjs prints each)

| # | s | light (time: what) | touch marks (s: x, y px) | caption from |
|---|---|---|---|---|
| 1 | 0–2.5 | 0: none, 0.86 · 1.60: answer, 0.64 | — | 0.00 (typed) |
| 2 | 2.5–5 | 2.50: today's card | — | 2.62 |
| 3 | 5–8 | 5.00: the two days · 5.91: the two days where the panel pushed them · 6.48: modes · 7.37: modes again | 5.14 (743, 473) · 6.21 (93, 714) · 6.78 (717, 1139) | 5.12 |
| 4 | 8–10.5 | 8.00: the iPhone's calendar · 9.32: and Auto Sync (read twice) | 8.12 (443, 682) | 8.12 |
| 5 | 10.5–14 | 10.50 / 10.65 / 10.96: All + the three · 11.36: All + Done · 12.12: first two windows | 10.60, 10.91, 11.23 (443, 815/912/1008) · 11.66 (797, 527) | 10.62 |
| 6 | 14–17.5 | 14.00: Save, 0.82 · 14.71: the alert, 0.6 | 14.12 (443, 1788) | 14.12 |
| 7 | 17.5–22.5 | 17.50 / 18.20 / 18.67 / 19.14: the rehearsal's row | 19.35 (793, 873), the eye | 20.50, on 12/12 |
| 8 | 22.5–25.5 | none, 0.8 | — | 22.62 (finale) |
| 9 | 25.5–29 | — | — | — |

### Frames

`frames/<locale>/`, 960 px tall, named by time: 1.00 hook · 2.47 poster ·
first month tap + 0.12 · **second-day** (the second tap + 0.15, before the
modes are lit: the pressed days lit) · **caption-2…6** (each 0.25 s before its
shot ends) · counted (12/12) · 24.50 finale · 27.00 card. `frames/<locale>.png`:
all side by side. Looked at before the owner: ru's every frame and sheet;
the posters of en-US and es-ES, de-DE's second day, en-US's shot 4 caption and
finale. Not looked at yet: the videos played through, en-GB's frames.

---

The first cut (393a076), as reported then:

Recorded under the e2e lock with `node e2e/store/record.mjs <locale>`, one
page at a time, 21.11.2026 (Israel time 00:40–02:10): en-US on Friday in New
York, en-GB, ru, es-ES, de-DE on Saturday in their countries. Then cut with
`node e2e/store/montage.mjs <locales> --preview=../audit/evidence/T-289/frames`.
The videos themselves are not here (e2e/store/out/video, outside git).

## Where the coordinates come from (the choice)

- **The light's holes: Maestro's own iOS driver.** While the flow waits on the
  recorder, the recorder asks the driver for the screen's hierarchy (`POST
  /viewHierarchy` on the port its XCTest runner listens on, found with lsof)
  and takes the frames of the elements by testID. The driver sees everything
  on screen — iOS's own conflict alert too, which is not in React's tree and
  has no testID (taken by its type). The app got five testIDs it lacked.
- **A touch's time: the app.** An e2e bundle launched with
  `rehearslyStoreTouches` puts the real App in a view that listens in the
  capture phase and tells the recorder each touch down and up at once
  (e2e/device/App.js; Metro maps index.ts's ./App to it only under
  REHEARSLY_E2E — no production bundle has it, store-touches.test.mjs).
- **A touch's place: Maestro's driver's log.** The app's points are its root
  view's, and on a sheet iOS presents (the month, the form) that root starts
  ~62 points below the window's top: the first en-US cut had the marks there
  that far above the lit days and the Save button. The driver logs every tap
  it makes in the window's points ("Tapping x, y"); record.mjs gives each
  touch the tap that began just before the app felt it, at the same x. A
  touch without one gets no mark (montage.mjs refuses to draw it).
- Why not the driver alone for touches: it says where it tapped, not when the
  finger was down; the app says when to the millisecond. Why not the app
  alone: wrong y on sheets, and no alert.

## ffprobe

```
en-US.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
en-GB.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
ru.mp4:    29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
es-ES.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
de-DE.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
```

Poster frame, every page: **00:00:02:14** (2.467 s, the hook's last frame).

| page | shot on | hook | captions | hook | finale | sign-in | worst contrast over white (text / lilac) |
|---|---|---|---|---|---|---|---|
| en-US | fri | Who can make Friday? | 70 px | 88 px | 66 px | 40 px, 2 lines | 11.91 / 4.51 |
| en-GB | sat | Who can make Saturday? | 70 px | 88 px | 66 px | 40 px, 2 lines | 11.91 / 4.51 |
| ru | sat | Кто может в субботу? | 70 px | 88 px | 88 px | 40 px, 1 line | 11.91 / 4.51 |
| es-ES | sat | ¿Quién puede el sábado? | 70 px | 88 px | 79 px | 40 px, 2 lines | 11.91 / 4.51 |
| de-DE | sat | Wer kann am Samstag? | 70 px | 88 px | 76 px | 40 px, 2 lines | 11.92 / 4.51 |

The day in each hook is the Planner's first card's (frames `*-poster.png`).

## Shots (ru; the others within 0.3 s, montage.mjs prints each)

| # | s | light (time: holes, shade) | touch marks (s: x, y px) | caption from |
|---|---|---|---|---|
| 1 | 0–2.5 | 0: none, 0.86 · 1.60: today's first window, 0.64 | — | 0.00 (typed) |
| 2 | 2.5–5 | 2.50: today's card, 0.62 | — | 2.62 |
| 3 | 5–8 | 5.00: the two days · 6.56: the modes | 5.14 (743, 473) · 6.14 (93, 714) · 6.72 (717, 1139) | 5.12 |
| 4 | 8–10.5 | 8.00: the iPhone's calendar · 9.36: and Auto Sync | 8.16 (443, 682) | 8.12 |
| 5 | 10.5–14 | 10.50: All + the three · 11.69: All + Done · 12.12 (after the cut): first two windows | 10.52, 10.87, 11.23 (443, 815/912/1008) · 11.64 (797, 527) | 10.62 |
| 6 | 14–17.5 | 14.00: Save, 0.82 · 14.72: the alert, 0.6 | 14.15 (443, 1788) | 14.12 |
| 7 | 17.5–22.5 | 17.50: the rehearsal's row | 19.48 (793, 873), the eye | 20.26, on 12/12 |
| 8 | 22.5–25.5 | none, 0.8 | — | 22.62 (finale) |
| 9 | 25.5–29 | — | — | — (card from 25.5, dissolve 0.5 s) |

No shot played faster than recorded (×1.00 everywhere).

## Frames

`frames/<locale>/` — each frame at 960 px tall, named by its time:
1.00 s (the hook typing), 2.47 s (the poster), the first touch in the month
plus 0.12 s (5.25–5.29 s; the task's 5.8 s was the storyboard's guess — the
real first touch is at 5.13–5.17 s), 12/12 with its caption (21.0–21.1 s; the
task's 20.2 s is when it comes in, the frame taken 0.8 s later so the caption
has risen), 24.50 s (the finale), 27.00 s (the card); `frames/<locale>.png`, all six side by side.

## Watched before the owner

Every shot of en-US and ru frame by frame (light on the right element, marks
on the tapped element, counts 4 → 7 → 9 → 11 → 12 in place, caption on 12/12,
pencil and "a minute"/«минуту», the card); es-ES and de-DE by the six frames.
Found and fixed on the way: the marks 62 points high on sheets (above); the
form's shot played ×1.84 with the alert lit at 2.4 s, because the spinner
under the alert keeps the screen moving and Maestro saw the alert 4.3 s after
the tap — the alert is now read 0.45 s after the finger lifts, and the shot
ends a second later (lit at 0.5–0.7 s); two days in different rows of the
month made one wide hole over both rows — each day is its own hole now.

Known: the captions at 13 % (shot 3) sit over the month's first row, and the
hook at 24 % over the Planner's project and filter rows — where the storyboard
puts them; the lit elements are clear of them.

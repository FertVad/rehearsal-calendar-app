# T-289 — the preview by the storyboard «Свет на главном»

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

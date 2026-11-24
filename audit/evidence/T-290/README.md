# T-290 — the light goes with its element; «Все в курсе:» with no words of the app beside it

Fix: 57a7fe6 (`e2e/store/montage.mjs`, `e2e/store/compose.swift`, README, tests).
Red before on e23d16a: `red-before.md` (the tests), `rule-before.txt` (the
montage's rule on the five real recordings: 5 of 5 red, green now).
The recordings are T-289's (`e2e/store/out/clips`, not shot again); the five
previews were made again from them by `node e2e/store/montage.mjs`.

## 1. The light behind its element

Cause: a light read again elsewhere became a keyframe at the time it was read
(the screen had stood still for a while by then), moved earlier by LIGHT_MOVE
at most; the montage never knew when the element really moved.

Now (`follow`, `track`): the recording's own frames between the two readings,
grey, halved, cut round the old and new places, are searched for the element's
picture as the frame it was read in shows it, along its way from the old place
to the new, a pixel at a time; a light's holes together. On each frame of the
recording it moved in, the hole is there at once, on the video's frame that
shows that recording frame (no easing of ours: the app's own move).

Why matching and not the frames' difference: a difference says something
changed, not where — the day's panel opening under the month changes the frame
as much as the month moving, and the modes' header changes as the row jumps.
Matching gives the element's place in every frame; on a one-dimensional way the
nearest patch is the element itself (the chosen day 29 against the unchosen 22
above it). What it showed, on all five: the month glides down over about
0.27 s (16 recording frames at 60 a second); the modes' row does not glide at
all — it jumps in one frame as the sheet lays itself out again, and the light
now jumps on that frame. Frames where the element is not to be told (day 29
fading to chosen just after the tap: difference ~35 of 255) keep the place
before.

Rule (`lightLags`): from the frame a followed element sets off in until half a
second after it rests or the light goes to the next element, its centre is
within 8 px (the hole's room) of its hole's; off for more than two frames in a
row and montage.mjs refuses the video.

Strips (frames one after another, left to right, 12 a row; the number in the
name is the first frame's; the month cut to y 300–900, the modes to 900–1400):

- `<locale>-days-<n>.png` — from the tap on day A to the tap on day B;
- `<locale>-modes-<n>.png` — from the tap on Busy, 0.6 s on.

ru: days 154–186, Busy 203–221; en-US 155–185, 203–221; en-GB 154–184,
208–226; es-ES 154–185, 203–221; de-DE 161–191, 208–226. In every frame the
chosen days and the modes' row are in the light.

## 2. «Все в курсе: …онный зал»

Cause: the darkness round a caption was its lines' rectangle (as wide as the
longer line) + 40 px, then the feather; past a short line the card's text
beside it came through at 53–62 of 255.

Now each line's own height is dark 300 px past its last letter, easing after it
as before (soft, no band). compose.swift measures it as `beside` (next to
`under`) and refuses over 25 of 255; montage.mjs prints it. On all five:
`under` 17.4, `beside` 17.4 of 255.

ru frame 667 (22.23 s), x 470–660, y 1380–1410: brightest channel 13 of 255
(was 53–62) — `ru-22_23s.png`.

## The five previews (ffprobe)

    ru.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
    en-US.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
    en-GB.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
    es-ES.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
    de-DE.mp4: 29.00 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch

Their frames to look at (hook, poster, taps, captions, 12 of 12, finale, card):
`frames/`. Poster 00:00:02:14 on all five.

## Checks

    node --test e2e/__tests__/store-video.test.mjs e2e/__tests__/store-touches.test.mjs   → 40 of 40
    node audit/evidence/T-290/rule.mjs        → rule-before.txt
    node audit/evidence/T-290/strips.mjs      → the strips, ru-22_23s.png

No app code changed: no e2e flow changes (video.yaml is as it was).

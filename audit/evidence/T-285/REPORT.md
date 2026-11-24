# T-285 — the App Store preview, made anew

`node e2e/store/montage.mjs --preview=../audit/evidence/T-285` on the recordings
of T-275 (`e2e/store/out/clips/<locale>/`, 19.11). No new recording was
needed: with the stillness and the flow's pauses cut, every scene fits its shot
at 1.98× or less (`MAX_SPEEDUP` 2). The videos themselves are outside git
(`e2e/store/out/video/<locale>.mp4`).

## ffprobe

```
en-US.mp4: 27.20 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
en-GB.mp4: 27.20 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
ru.mp4:    27.20 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
es-ES.mp4: 27.20 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
de-DE.mp4: 27.20 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
```

The audio track is silent (the test reads it with volumedetect: max_volume -inf / ≤ -90 dB).

## Shot → where its caption goes

| shot | on screen | caption | place | s (all pages) | speed (en-US / en-GB / ru / es-ES / de-DE) |
|---|---|---|---|---|---|
| 0 | Planner darkened 1.5 s, then the windows come | hook | bottom | 0.00–2.60 | 1.00 everywhere |
| 1 | Planner's windows | video[0] | bottom | 2.60–5.00 | 1.00 |
| 2 | two days marked busy | video[1] | **top** — the days mid-screen, the sheet and Save at the bottom | 5.00–8.00 | 1.06 / 1.14 / 1.04 / 1.06 / 1.05 |
| 3 | Calendar Sync on | video[2] | bottom — the screen is all in its top half | 8.00–10.40 | 1.00 |
| 4 | three picked | video[3] | bottom — "3 of 12" in the upper third | 10.40–13.80 | 1.00 / 1.00 / 1.13 / 1.00 / 1.00 |
| 5 | the form's conflict alert | video[4] | bottom — the alert's title and who cannot are mid-screen | 13.80–17.50 | 1.92 / 1.98 / 1.94 / 1.92 / 1.02 |
| 6 | seen count to 12 of 12 | video[5] | bottom — the count is under the week strip; **caption from 19.70 s**, once it reads 12/12 | 17.50–21.90 | 1.75 / 1.57 / 1.63 / 1.67 / 1.64 |
| 7 | the week, then mark, "Rehearsly", sign-in line | video[6] | bottom — the week strip is at the top | 21.90–27.20 (card from 23.90) | 1.00 |

Each caption is on screen 2.2 s or more (the seen count's 2.2 s, the slogan 5.3 s).
Type: en 69 px, ru 71, es 68, de 72 (886 wide). The sign-in line: en 43 px in
one line; ru, es, de 46 px in two (ru after «Нужен вход», es and de after the colon).
Band under the captions: black at 0.85 under the lines; the test makes a
white recording, reads the band's pixel beside the text and checks white on
it is ≥ 4.5:1.

## Poster frame

**previewFrameTimeCode `00:00:02:15`** (2.5 s at 30 fps) for every page: the
end of shot 0, the Planner's windows come, the hook still on (left frame of each sheet).

## Frames

`<locale>.png`: shot 0 at the poster frame, shot 5 at its end (the conflict
alert), shot 7 at its end (the closing card). `T-285-natives-{en,ru,es,de}.md`:
the native editors' reports of 20.11, copied from AUTODEV/notes.

## Watched

Claude watched every page's video frame by frame across each shot and transition
(ffmpeg frame sheets): the recording fills the frame in every shot with
nothing round it; the hook's darkness lifts and the windows are lit by 2.0 s; in
shot 6 the count reads 12/12 before its caption comes; the week is on screen
about 1.3 s before the card dissolves in; the slogan stays in place through the
dissolve, without its band on the card.

Not done: touch marks. Maestro does not say where on the screen its taps land,
and the task asks for them from the flow, not guessed.

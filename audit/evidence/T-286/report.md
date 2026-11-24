# T-286 — the App Store preview: no loading screen under the hook, no "0/…" under "12 of 12"

## 1. Shot 0 starts on the Planner with its windows

Cause: montage.mjs started the hook's shot on recording 01's first change —
the tap on the Planner's tab — and held that frame darkened for 1.5 s. That
frame is the Planner loading: "Loading…", "No members in this project",
"Analyzing availability…", readable under the darkness in every language.

Chosen: the hook over the Planner already loaded, darkened; the darkness lifts
after 1.5 s (HOOK_DARK, unchanged). How the moment is known: not guessed from
the picture and not taken from a pause that happens to follow it, but marked
by the flow — video.yaml calls the recorder's new `mark ready` right after
planner-tab.yaml has seen `planner-row-*` (the windows), record.mjs keeps it in
01.json `marks.ready`, in seconds of the recording. montage.mjs (`readyAt`)
starts the shot on the frame on screen then: the last frame recorded at or
before the mark (the simulator records a frame only when the screen changes),
taken a frame later than its own time so the fps filter cannot put the frame
before it in its place. A recording 01 without the mark is refused.

Measured on the new recordings (ready mark → the recording's last change, the
loaded Planner): en-US, ru, de-DE, es-ES, en-GB all had their last change before
the mark (en-GB: the spinner turned from 3.5 s to 10.0 s, mark at 19.25 s).

### The test's threshold

The test (store-video.test.mjs, "the hook's shot shows no frame of the Planner
loading") makes recording 01 blue (the loading) for 0.8 s, then white (the
windows), marked ready at 1.0 s, and reads the middle pixels of every one of
shot 0's 78 frames. A frame is the loading one when blue exceeds red by more
than 12 of 255. White, darkened by any amount, stays grey (blue − red within
the H.264 noise of about ±3); blue, darkened, keeps blue − red = 255 × (1 − d),
above 12 for any darkness d below 95 %. So no darkness the cut could put on the
loading screen hides it from the test: it asks for none of those frames at
all, not for them dark enough, so no "dark enough" level needed defending.

Red before (montage.mjs of d788455): 69 of shot 0's 78 frames the loading one,
and the unmarked recording not refused — red-before-montage.txt. Green after:
24 of 24.

## 2. The rehearsals ahead are seen by some

Cause: seed.mjs marked only frame 5's rehearsal (5 of 8). Every other one
read 0/n in the calendar — under "Seen by everyone: 12 of 12" in shot 6
("0/7", "0/4", "0/6") and in shot 7's week ("0/4").

Now every rehearsal of the world but the one of all twelve is marked seen by
part of its cast through the API, `POST /native/rehearsals/:id/respond
{ response: 'yes' }`, each with that person's own token, as their phone would:
`seenBy` — about half to two thirds, never none, never all, never the
director: 4/7, 2/4, 3/4, 4/6… The rehearsal of all twelve has none before shot 6
(video.yaml's seen.js marks 4, then 7 in the shot, then the director's tap: 12/12).

Test (store-seed.test.mjs): seedStore against a stand-in database and server;
each of the 15 rehearsals other than the two has ≥ 1 mark and fewer than its
cast; the one of all twelve 0; frame 5's still 5. Red before: "Репетиция
ансамбля (136): 0/4" — red-before-seed.txt.

The screenshots (T-274) are not shot again; README says what changed since.

Seen in shot 7's week, and left: "0/3" on the rehearsal the director made in
shot 5 a few seconds earlier ("Not on this rehearsal") — just made, nobody has
had it yet; it is not under "12 of 12", and the seed cannot mark what the flow
makes. Not in this task's list (0/7, 0/4, 0/6).

## Recorded and cut (record.mjs under the e2e lock, 20.11.2026)

All seven scenes again for every page (record.mjs records the whole flow).
en-US and es-ES each needed a second take: scene 05's save spinner kept the
screen moving while Maestro took ~5 s over its next tap, and montage.mjs
refused 7.6 s for 3.7 s (> 2×), as T-285 made it. en-GB's run was cut off by the
command's 10-minute limit during the stand's teardown, after all seven
recordings were whole; it was cut with `montage.mjs en-GB`.

    en-US.mp4: 27.20 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
    en-GB.mp4: 27.20 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
    ru.mp4: 27.20 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
    es-ES.mp4: 27.20 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch
    de-DE.mp4: 27.20 s; video h264 High 886×1920 30/1 fps yuv420p; audio aac 48000 Hz 2 ch

Every page: shot 0 0.00–2.60, shot 6 17.50–21.90 with its caption from 2.20 s
in; length, captions, their places, the sign-in line and the silent track as T-285.

**Poster frame (previewFrameTimeCode), every page: 00:00:02:15 (2.500 s)** —
the Planner's windows lit, the hook on.

## The pictures

`<locale>.png`, three frames each: 0.5 s (the loaded Planner under the
darkness), the poster frame 2.5 s, shot 6 at 20.3 s (its caption on; under
12/12: 4/7, 2/4). Looked at, all five, before they are shown to the owner.

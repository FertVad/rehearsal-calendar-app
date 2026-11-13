# T-253: the planner's tab "did not take" the first tap from Profil, in German

Source: the landing's shots (d3), 12.11.2026 on 6e87de6, and 10.11. d3's own
Maestro logs (`~/.maestro/tests/2026-11-12_08*`) are outside this tree and
could not be read from this session; what d3 did is taken from the task.

Reproduced on 9c16251 (HEAD at the start of this task) with Polly Peachum, a
German account (seed: `polly`, «Die Dreigroschenoper» with Mackie and Jenny,
Mackie busy today 12:00-14:00 so the form recommends times).
`probe-d3-taps.yaml` plays both of d3's sequences with d3's own answers to
the dialogs: the form's "unsaved changes" sheet by a tap at 50 %, 50 %, the
"remove all" question by a tap at 50 %, 55 %, the alert after it left
unanswered, then the planner by id, by 70 %, 95 %, and "Kalender" at 10 %, 95 %.

## Sequence 2 (Profil → Kalender-Sync): reproduced, 5 of 5 runs - not the app

| Run | 50 %, 55 % confirmed the removal | Planner by id | Planner at 70 %, 95 % | Kalender at 10 %, 95 % | lost-tap signature at those taps |
|---|---|---|---|---|---|
| 065731 | yes | nothing | - | - | none in the run |
| 070554 | yes | nothing | nothing | nothing | none at those taps |
| 071417 | yes | nothing | nothing | nothing | one lost tap at 07:16:38, the sign-in; none at those taps |
| 072222 | yes | nothing | nothing | nothing | none in the run |
| 075207 (`probe-d3-taps.*`) | yes | nothing | nothing | nothing | none in the run (0 "didn't see a previous touch down") |

What happens (`T-253-probe-remove-all-question.png`,
`T-253-probe-remove-all-tapped.png`, `repro-065731-*.png`):

1. The question «Alle Proben aus dem Kalender entfernen?» has its two buttons
   one over the other: «Alle exportierten Proben entfernen» at about 49-55 % of
   the screen's height, «Abbrechen» under it. d3's tap at 50 %, 55 % lands on
   the first, and the removal runs.
2. The removal ends with the app's alert «Alle Proben aus dem Kalender
   entfernt» and its "OK" (`CalendarSyncSettingsScreen.handleRemoveAll`). d3's
   script did not answer it.
3. An iOS alert takes every touch outside its button until it is answered:
   the switch `calendar-sync-toggle` (d3, 08:49:11.8), the planner by id
   (08:50:41.1) and by its place (08:51:22.8) - and in these runs "Kalender"
   at 10 %, 95 % too. The app is doing what iOS does with an alert. The
   screenshot under it shows the sync screen and the "Profil" tab selected,
   which is what d3 read as "nothing happened".

So it is neither a layer the app left over the tabs, nor a `tabPress` or
`beforeRemove` listener (the tabs have one, `hapticLight`; the only
`usePreventRemove` is the form's, which is gone with it), nor a scroll, nor a
lost simulator tap: the T-207 signature is absent at all those taps.

d3 says "Kalender" opened at once at 08:52:16, unlike here. Something between
08:51:22 and 08:52:16 answered the alert in d3's session; which, only d3's
logs can say.

## Sequence 1 (the form over Profil): not reproduced, 0 of 7 runs

Runs 065020 and 065731 ("Nicht speichern" by its text), 070554, 071417,
072222 and 075207 (d3's tap at 50 %, 50 %, which also takes "Nicht
speichern"; 072222 and 075207 with a recommended time taken as d3 did), and
the green run of flow 91: the form closed, the profile showed with "Profil" selected
(`T-253-probe-profile-after-form.png`), and the planner opened at the first
tap within a second (`T-253-probe-after-planner-tap-1.png`). Seven tries, not
once. d3's frame before that tap (`AUTODEV/notes/T-253-de-05.png`) shows no
alert or sheet; its cause is not found, and no guess is made.

## Why only German: not shown

The stacked buttons are not German alone. In English the question stacks the
same way, and the same tap at 50 %, 55 % confirms "Remove All Exported" and
brings "All rehearsals removed from the calendar"
(`T-253-probe-question-en.png`, `T-253-probe-after-tap-en.png`; run 073655 of
`probe-remove-all-alert-languages.yaml`, which went no further than English:
its own step back to the language row failed, a probe defect). The German
words of that alert have not changed since eaf2005 (June). What made d3's
English, Russian and Spanish runs answer the alert and the German one not is
in d3's script and logs, not in the app.

## What is in the tree

- `e2e/flows/91-planner-tab-after-form-and-sync-german.yaml`: both ways, each
  dialog answered by its button, the planner's tab tapped once after each.
  Green on HEAD (2 m 27 s). Nothing in the app was changed, so there is no
  "red before".
- `e2e/seed.mjs`: Polly, Mackie, Jenny, their project, Mackie's busy hours.

# App screenshots

Source images for the landing page. iPhone 16 simulator, iOS 26, 1178×2556,
dark theme, the status bar pinned at 9:41. `screens/build-assets.py` turns
them into `server/public/assets/{en,ru,es,de}/`.

## Four worlds, not one translated

Each language has its own demo account and its own company, cast, productions
and places, seeded through the API of a local e2e stand — never production:

| | Choreographer | Own company | A play | Music video | TV |
|---|---|---|---|---|---|
| RU | Марина Белова, Moscow | Шоу-балет «Пульс» | «Чайка» | Клип «Огни» | Новогодний эфир |
| EN | Hannah Clarke, London | Pulse Dance Company | Twelfth Night | “Neon” music video | New Year’s Eve Live |
| ES | Valentina Ríos, Mexico City | Compañía Pulso | Bodas de sangre | Video musical “Fuego lento” | Especial de Año Nuevo |
| DE | Lena Hoffmann, Berlin | Tanzkompanie Puls | Kabale und Liebe | Musikvideo „Nachtschicht“ | Silvestergala |

## The clock is the reader's own

The app writes times on the phone's 12 or 24 hours, which come from the
region. Each language is shot in its native one: `ru_RU`, `en_US` (12 hours),
`es_ES`, `de_DE` (24). A Spanish or German keyboard is switched on for those
two, or the English one underlines the place typed in the form in red.

## Naming

`{lang}-{NN}-{screen}.png` — `lang` is one of `en`, `ru`, `es`, `de`.

Only finished shots live here. Verification captures go to the session
scratchpad instead, so this folder stays a clean deliverable.

## Frames per scrollable screen

The build stitches the frames of one screen into a strip, so a screen that
scrolls gets `NN` (at the top) and `NNb`, `NNc` (scrolled). **Consecutive
frames must overlap** — one shared block of content is what the stitch aligns
on. Scroll by roughly two thirds of a screen, never a full one.

| NN | Screen | Notes |
|----|--------|-------|
| 01, 01b | calendar | today and the upcoming list |
| 02 | rehearsal-card | the run-through, seen by 5 of 8 |
| 03 | availability | the demo's own busy slots on day 3 |
| 04, 04b | create-rehearsal | day 4, the first recommendation tapped, a place typed |
| 04c | participants | everyone's busy hours on day 4 |
| 05, 05b, 05c | smart-planner | the week, filters on top |
| 06 | projects | owner, admin, member |
| 07, 07b | project-detail | upcoming rehearsals, the cast |
| 08 | invite | the invite code shown |
| 09 | calendar-sync | Auto Sync on, just synced; exported events removed after |
| 10, 10b | profile | the simulator's push warning is cut by the build |

## Shot after T-249

All four languages were reshot on 2026-11-12 from code with T-249 (6e87de6):
- the planner reads "Planner" in every language;
- the calendar has no large title, so its filter row scrolls with the list. `build-assets.py` treats it as an unpinned screen: the shared status bar on top, the rest in the strip.

The simulator sometimes loses a tap (T-207), and Maestro reports it as done. That is why `05` came out as Profile in German on 2026-11-10 and 2026-11-12. Neither the language nor the screen was the cause (T-253, `audit/evidence/T-253`). The lost taps were each the first of their Maestro run, and German was shot last on both days.

A tap whose result the shoot waits for — a tab, a sheet — goes through `e2e/subflows/tap-and-see.yaml`. Give it `TAP_ID` or `TAP`, plus `SEE` and `WAIT_MS`. It taps once more, never twice, if the expected screen did not come, and reports the retry to the stand through `MAIL_URL`. See docs/e2e.md, "A lost tap".

# App screenshots

Source images for the landing page redesign. iPhone 16 Pro Max simulator,
1320×2868, dark theme, demo account (`demo@rehearsly.me`).

The Test Flight banner is disabled while shooting — `BetaBanner` is commented
out in `src/navigation/index.tsx` and must be restored afterwards.

## Naming

`{lang}-{NN}-{screen}.png` — `lang` is one of `en`, `ru`, `es`, `de`.

Only finished shots live here. Verification captures go to the session
scratchpad instead, so this folder stays a clean deliverable.

## Two frames per scrollable screen

The landing stitches each pair into a scrolling animation, so a screen that
scrolls gets `NN` (at the top) and `NN b` (scrolled). **The two must overlap** —
one shared block of content is what the stitch aligns on. Scroll by roughly two
thirds of a screen, never a full one.

Screens whose content fits without scrolling need only the single `NN` frame.

## The ten screens

| NN | Screen | en | ru | es | de |
|----|--------|----|----|----|----|
| 01 | calendar | ✅ | | | |
| 01b | calendar-upcoming | ✅ | | | |
| 02 | rehearsal-card | ✅ | | | |
| 03 | availability | ⚠️ | | | |
| 04 | create-rehearsal | ✅ | | | |
| 04b | create-rehearsal | ✅ | | | |
| 05 | smart-planner | ✅ | | | |
| 05b | smart-planner | ✅ | | | |
| 05c | smart-planner | ✅ | | | |
| 06 | projects | ✅ | | | |
| 07 | project-detail | ✅ | | | |
| 07b | project-detail | ✅ | | | |
| 08 | invite | ✅ | | | |
| 09 | calendar-sync | ✅ | | | |
| 09b | calendar-sync | ✅ | | | |
| 10 | profile | ✅ | | | |
| 10b | profile | ✅ | | | |

⚠️ `en-03` is usable but the sheet looks half-empty with a single slot, and the
month heading behind it is clipped. Reshoot with two or three slots.

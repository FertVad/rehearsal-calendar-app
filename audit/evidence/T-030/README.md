# T-030: the editor's handle drags the editor down, not the screen

Fix: 60460db. Base: a978e40.

**Cause.** The Busy editor (`bottomPanel` in `AvailabilityScreen.tsx`) drew a
handle but had no gesture. A swipe down on it went to the MarkBusy modal's
sheet. That closed the screen, or asked the screen's own close question
(useLeaveGuard's `usePreventRemove`), and "Save" there saved and left.

**Fix.** `useSheetDrag` is a gesture-handler pan on the handle and the header.
It moves down only. Pulled 80 pt or flicked at 800 pt/s, it calls
`editor.collapse`, the arrow's path through `guard.leave`. Short of that the
sheet springs back. A swipe on the handle or header no longer reaches the
modal. On the simulator the inner pan wins over the iOS sheet's own swipe
(flows 67-69 green). Cancel in the header and the swipe elsewhere still close
the screen with the T-013 question; that code is unchanged.

## Red before, green after

The files of the fix were put back as at the base: `AvailabilityScreen.tsx`,
and for e2e also the hooks index (`useSheetDrag.ts`, new, then unused). Flows,
subflows, seed and mocks are as in the fix.

| Check | Before | After |
|---|---|---|
| 67: swipe down, nothing changed | red: legend gone, Calendar tab on screen (`red-before-67.txt`) | green |
| 68: day changed, swipe, Save | red: no "Saved" toast, Calendar tab: saved and closed the screen (`red-before-68-69.txt`) | green, day Free after reopening |
| 69: day changed, swipe, Don't Save | red: legend gone, the screen closed | green, day still Busy |
| Jest `AvailabilityDrag.test.tsx`, 6 tests | 6 failed: the screen had no drag | 6 passed |

Green, on 60460db: `npm run e2e -- e2e/flows/67-… 68-… 69-…` gave 3/3 Passed
(4m 52s, 0 taps taken again). Flow 64 (the same editor's arrow) gave 1/1
Passed. The frontend Jest suites for availability, notifications, navigation
and calendar components gave 28 suites, 258 tests passed. `npm run type-check`
is clean. `npm run check:secrets` passed.

## What the runs showed along the way

- A swipe made with Maestro's `swipe: from: id` was too short and too slow. On
  the old code the iOS sheet sprang back, and flow 67 failed for the wrong
  reason: the screen stayed open with the editor up. A flick from the header
  row (64%) to the bottom edge in 120 ms closes the old screen, as the owner's
  finger did. It is in `e2e/subflows/availability-pull-editor-down.yaml`.
  Flows 68 and 69 asked the screen's question either way: a held sheet asks as
  soon as the drag starts.
- One green run failed flows 67 and 69 before the swipe. `scrollUntilVisible`
  started before the days read "Busy" and scrolled on to May. The subflow now
  waits for the day's status first. MARK_DAY is three days on, so it is on the
  week the list opens on.

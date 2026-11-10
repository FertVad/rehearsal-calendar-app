# Flow 07 after T-238: the form offers no 09:00–23:00 window

Supervisor's check on b08c25c, red:

```
[Failed] Planner follows the project (1m 58s) (No visible element found: "9:00.AM–11:00.PM \(14h\)")
[e2e] failed: e2e/flows/07-planner-project-switch.yaml — No visible element found: "9:00.AM–11:00.PM \(14h\)"
```

Cause: not the planner. T-238 (c27c469) made the form's "Recommended Time"
say "Everyone is free all day" for a day nobody picked is busy in, instead of
offering the working day 09:00–23:00 as a window to tap (flow 83 checks it).
Flow 07 still looked for that window; T-238 left it as it was. The failing
step's shot shows the form as T-238 meant it: "Everyone is free all day",
09:00–10:30 prefilled from the planner's "+".

Fix: flow 07 finds the line (`recommendations-note`, "Everyone is free all
day"), checks no "… 11:00 PM (14h)" window is offered, and keeps its checks
of the 09:00–10:30 the "+" gave. The app is unchanged.

Green, `npm run e2e -- e2e/flows/07-planner-project-switch.yaml`:

```
[Passed] Planner follows the project (2m 25s)

1/1 Flow Passed in 2m 25s

[e2e] taps taken again (tap-and-see.yaml): 0
```

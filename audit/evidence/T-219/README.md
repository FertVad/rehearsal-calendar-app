# T-219 — flow 58 "Planner list is dense" red in the full run of d9200ac

## No commit in 8f8a610..d9200ac broke it

The range touches no client code: the server's Node, the docs, flow 25
(`git diff --stat 8f8a610 d9200ac -- rehearsal-calendar-native ':!rehearsal-calendar-native/server'`).
Flow 58 at d9200ac, run on its own the same evening, passed (red-before.txt).
So nothing in the range broke the flow. It had a fault of its own since T-020 (ebb2e7b),
and the failure only shows when iOS builds the screen's tree one particular way.

## The cause

The planner's choice of project (and of period) draws the picked option with
an Ionicons checkmark. The option had no `accessibilityLabel`, so iOS built
its name from its children: "Three Sisters, " followed by the icon's glyph
from the private-use range. That is also what VoiceOver reads. Flow 58's
second `tapOn: "Three Sisters"` matches a whole name. It found one only when
iOS also showed the option's inner text as an element of its own: in the
green run the tap landed on that text, [29,246][118,263]. In the failed run
the hierarchy had only "Three Sisters, " and the tap failed.

## The fix

`SmartPlannerScreen.renderOption`: `accessibilityLabel={label}`. An option is
named by its name. That it is picked stays in `accessibilityState.selected`,
as in ParticipantPicker, which already labels its rows itself.

Flow 58 now taps the picked project as a whole option:
`tapOn: { text: "Three Sisters", selected: true }`. The inner text is never
selected, so the tap can't land on it, and on the old code it is red every
time. The check is stricter than before, not looser. The Jest test "opens each filter's own choice
from the row" finds the picked project by its label, selected.

Red before, green after: red-before.txt, green-after.txt.

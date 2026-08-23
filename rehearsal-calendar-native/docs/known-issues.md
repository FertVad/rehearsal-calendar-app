# Known Issues

Defects found and deliberately **not** fixed yet, so they are not lost. Each
entry says where it is, what the user sees, and why it was left alone.

Fix one → delete its entry. Anything urgent belongs in a branch, not here.

---

## 1. Today's rehearsal appears twice on the Calendar screen

**Seen as:** the same card under **Today** and again as the first entry of
**Upcoming Events**.

**Where:** the Calendar tab — [CalendarScreen.tsx](../src/features/calendar/screens/CalendarScreen.tsx)
and [TodayRehearsals.tsx](../src/features/calendar/components/TodayRehearsals.tsx).

**Fix:** decide what "upcoming" means and apply it in one place — most likely
"strictly after today", since today already has its own section.

**Deferred because:** it is a product decision, not a defect in the code, and
the owner has not made the call yet.

---

## 2. Availability editor sheet is a fixed height

**Seen as:** with one time slot the sheet is over half empty; the month heading
behind it is clipped mid-word.

**Where:** `PANEL_HEIGHT` in
[availabilityConstants.ts](../src/features/availability/constants/availabilityConstants.ts) —
55% of screen height, clamped to 320–620.

**Fix:** size the sheet to its content, the way the rehearsal sheet already
does, and keep the clamp only as an upper bound.

**Deferred because:** the current value is a deliberate improvement over the
previous flat `320`, and content-sizing is a larger change to the animation
that drives the same constant.

---

## 3. Rehearsal card markup is duplicated

**Where:** [TodayRehearsals.tsx](../src/features/calendar/components/TodayRehearsals.tsx)
and an inlined copy inside
[CalendarScreen.tsx](../src/features/calendar/screens/CalendarScreen.tsx).

**Why it matters:** every change to the card has to be made twice. The rehearsal
title feature had to be added in both, and missing one is how it silently would
not have shown.

**Fix:** extract one `RehearsalCard` and use it in both places.

**Deferred because:** pure refactor with no user-visible effect; not worth the
regression risk right before submission.

---

## 4. Content Security Policy is disabled for the whole server

**Where:** [server.js](../server/server.js) — `contentSecurityPolicy: false`
in the helmet options.

**Why it matters:** it was switched off so the AllPay iframe on the checkout
page would load, but it is off for every route, so the reflected-XSS fixes in
the checkout and invite templates have no defence in depth behind them.

**Fix:** enable helmet's CSP globally and relax `frame-src` only for the
checkout page.

**Deferred because:** enabling it can break the admin dashboard and the AllPay
iframe, both of which need testing against the live payment flow. Escaping was
shipped on its own rather than pairing it with a policy that only looks like
protection.

---

## 5. Calendar Sync screen keeps no record of having synced

**Seen as:** the screen is a toggle, one calendar row and a button — two thirds
of it is empty. After syncing, the counts appear in a one-shot alert and are
gone; nothing on screen says the sync ever happened or when.

**Where:** [CalendarSyncSettingsScreen.tsx:351](../src/features/profile/screens/CalendarSyncSettingsScreen.tsx#L351)
reports the result via `Alert.alert` only.

**Why it matters:** the user cannot tell whether sync is working without
running it again. The Availability screen already displays a `lastSyncTime`, so
the data exists — this screen just does not show it.

**Fix:** persist the last sync time and counts, and show them under the button.

**Deferred because:** noticed while shooting the screenshot; it is a missing
feature rather than a break, and nothing depends on it before submission.

---

## 6. Three component tests assert markup that has moved on

**Seen as:** `npm test` in `rehearsal-calendar-native` reports 3 failures, all
in `TodayRehearsals.test.tsx`.

They look for a `disabled` prop on an element that no longer carries one, and
for a seen count rendered as "5/15" when the component now formats it
differently. Nothing is broken — the tests describe an older version of the
component.

**Fix:** read the component as it stands and rewrite the three assertions, or
drop them: what they cover (a disabled prop, a string format) is thin next to
what they cost to keep.

**Deferred because:** ten other failures in this suite were worth fixing —
they were one-line rot, and two of them guarded behaviour we were changing.
These three need the component read line by line for very little in return.

**Do not let this entry hide a new failure** — three is the number to watch.

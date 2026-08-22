# Known Issues

Defects found and deliberately **not** fixed yet, so they are not lost. Each
entry says where it is, what the user sees, and why it was left alone.

Fix one → delete its entry. Anything urgent belongs in a branch, not here.

---

## 1. Plural forms are wrong in every language

**Seen as:** `1 slots` on a Smart Planner day card that has a single slot.

**Where:** [DayCard.tsx:58](../src/features/smart-planner/components/DayCard.tsx#L58)
renders `{slots.length} {t.smartPlanner.slots}`, and `slots` is a plain string
per locale ([availability.ts](../src/i18n/translations/availability.ts) —
`'слотов'`, `'slots'`, `'franjas'`, `'Slots'`).

**Why it is wrong:** a fixed noun cannot agree with a count. English needs
`1 slot` / `2 slots`; Russian needs three forms — `1 слот`, `2 слота`,
`5 слотов`; Spanish and German need two each.

**Fix:** replace the string with a function `slotsCount(n)` in all four locales,
following the existing pattern of dynamic translations such as
`t.rehearsals.selectedCount(a, b)`. The Russian rule is the only fiddly one
(`n % 10 === 1 && n % 100 !== 11` → singular; `2–4` excluding `12–14` → few;
otherwise many).

**Deferred because:** found mid-screenshot-session; a four-locale change is
worth doing on its own. Not visible in the captures — a date range where every
day has several slots avoids it.

---

## 2. Today's rehearsal appears twice on the Calendar screen

**Seen as:** the same card under **Today** and again as the first entry of
**Upcoming Events**.

**Where:** the Calendar tab — [CalendarScreen.tsx](../src/features/calendar/screens/CalendarScreen.tsx)
and [TodayRehearsals.tsx](../src/features/calendar/components/TodayRehearsals.tsx).

**Fix:** decide what "upcoming" means and apply it in one place — most likely
"strictly after today", since today already has its own section.

**Deferred because:** it is a product decision, not a defect in the code, and
the owner has not made the call yet.

---

## 3. Availability editor sheet is a fixed height

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

## 4. Rehearsal card markup is duplicated

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

## 5. Content Security Policy is disabled for the whole server

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

## 6. An invite can only be accepted by following the link

**Seen as:** there is no way to join a project by entering a code. The Project
Invitation screen is reachable only from a deep link — the `+` sheet offers
rehearsal, availability and project, and nothing else leads there.

**Where:** `JoinProject` is navigated to only from the link handlers in
[navigation/index.tsx:313](../src/navigation/index.tsx#L313) and
[:339](../src/navigation/index.tsx#L339).

**Why it matters:** the link is the only path in, so anything that breaks it
strands the invitee — Universal Links not yet verified on a device, an invite
opened on a desktop, a link mangled by a messenger. The screen already accepts
a code as a route param, so a "paste your invite code" entry point is small.

**Fix:** add a "Join by code" item to the create sheet that opens `JoinProject`
with an empty code and a text field.

**Deferred because:** found while shooting screenshots; invite links do work
once `BASE_URL` points at the real domain, so this is a fallback rather than
the main path.

---

## 7. Calendar Sync screen keeps no record of having synced

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

## 8. Thirteen frontend tests are stale

**Seen as:** `npm test` in `rehearsal-calendar-native` reports 13 failures that
predate the current work.

**Fix:** update them against the screens as they now are, or delete the ones
whose behaviour no longer exists.

**Deferred because:** they fail on assertions about old markup, not on real
regressions, and rewriting them was never the task at hand. **Do not let this
entry hide a new failure** — the count is the thing to watch.

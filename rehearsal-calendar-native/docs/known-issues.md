# Known Issues

Defects found and deliberately **not** fixed yet, so they are not lost. Each
entry says where it is, what the user sees, and why it was left alone.

Fix one → delete its entry. Anything urgent belongs in a branch, not here.

**Read the verification status before acting on anything below.** The candidate
list came out of a six-way automated sweep on 2026-09-01. Twenty-one claims have
been verified since; all twenty-one were real, though three were narrower than
reported and one sub-claim was refuted outright. That is twenty-one, not
forty-two — everything in the unverified tables is a lead, not a fact. Confirm
one against the code before fixing it, and correct or delete the entry if it
turns out wrong.

Verifying in batches of three or four works; batches of seven run out of budget
partway and report nothing.

Thirteen were fixed on 2026-09-03 and their entries deleted. Six from the
register: the planner booking the whole company for every rehearsal, a push
token staying with the account that no longer held it, the secret scanner
reporting its own pattern list, a deleted project leaving its busy hours on
everyone forever, an account deletion telling nobody, and a recurring calendar
event blocking one occurrence.

Seven more came out of a two-agent audit of the Smart Planner run the same day,
all of them the same failure — **the planner saying free when the person is
busy**, which is the one thing this feature cannot afford:

- Busy time was sampled at :00 and :30 and asked "is anyone busy *at* this
  instant", so a 10:05–10:25 call blocked nothing and the day read Perfect.
- The last slot of the day was closed with the previous half-hour's busy set,
  so anyone who became busy after 22:30 was dropped from it.
- A span crossing local midnight came back as 22:00–02:00 and the client
  discarded it outright, so the whole evening read free.
- A multi-day span was filed under its start date only, leaving the rest Perfect,
  and one that began before the requested window was never fetched at all.
- A whole-day calendar event took both ends from its start, so a fortnight's
  holiday blocked one day.
- One calendar failing to open was read as "the user deleted these", wiping
  every slot imported from it.
- A tap on the eye put an admin on a rehearsal with no busy time booked.

Plus two range bugs that hid days rather than busy time: the day walk lost the
last day of any range containing an autumn clock change, and its first repair
broke Santiago and Havana, where the clocks change at midnight. Both loops walk
UTC now, verified under six timezones.

The planner had **no tests at all** before this — it could not have had any,
since Jest never defined `__DEV__` and any module guarding on it threw. It has
28 now, and the availability endpoint has its first 8.

---

## Confirmed, not yet fixed

### Decided against: a silent push to update the calendar without opening the app

Asked and answered on 2026-09-05, recorded so it is not re-litigated by
accident.

The calendar is written by the app, running on that device. If the reader never
opens it, nothing changes there — a rehearsal cancelled or moved by someone else
stays wrong in their calendar indefinitely. That is a real gap for anyone who
checks their calendar rather than the app, which is a normal habit.

A silent push (`content-available`) would wake the app in the background long
enough to write. It costs a background mode in the config, a task handler, a
justification at App Review, and it is throttled by iOS — usually prompt, never
guaranteed.

**Not doing it**, on the owner's decision: the intent is for people to live in
the app rather than in their calendar. Revisit only if that intent changes.


### A tapped notification opens a sheet over the availability screen, and back leads to the calendar as a modal

Reported from the device on 2026-09-05, deliberately left for later.

With the app open on the availability screen, tapping a push opens the rehearsal
sheet over it — and the back gesture then shows the **calendar** presented as a
modal rather than returning where the reader was. So the stack after a
notification is not the stack they left.

Not investigated. It belongs to the same family as the stranded-layer bug in
CLAUDE.md — the one that cost a day — so treat it as a navigation-stack question
rather than a notification one, and start from what `RehearsalDetails` is pushed
onto when the availability screen is itself a modal (`MarkBusy`).

Nothing is lost and nothing is wrong in the data; it is the reader being put
somewhere they did not ask to be.

### Calendar sync — all twenty findings closed

Reviewed 2026-09-04 by three agents, one per half plus the failure paths, and
finished on 2026-09-05. Twenty findings, two of them critical; every one is
fixed and its row deleted.

**The privacy promise holds**, and now has a test rather than resting on
everyone remembering: given an event with a real title, notes, location and
URL, none of them appear in what is posted.

This was the part of the app with no tests at all. It has thirty now, and the
reason there were none turned out to be mechanical rather than anyone's neglect:
the module would not load under test. The shared mocks were missing `AppState`,
`getEventAsync` and two expo-calendar enums, and the AsyncStorage mock lacked
`__esModule`, so the interop handed back a wrapper and any module touching
storage threw on import. Anyone who tried hit that wall and gave up.

Two things worth carrying forward. Three of the twenty were found on the device
by the owner and not by any agent or test — a dead link, a wrong time, and a
pull-to-refresh that had to be repeated. And the last fix failed its own test at
first, because the exclusion it changed existed in three copies and the one it
touched only fed a log line.

### The lint has 595 warnings, none of them about hooks or unused code

`npm run lint` on 2026-11-10, after T-243: 0 errors, 595 warnings.

| Rule | Count |
|---|---|
| `no-explicit-any` | 469 |
| `no-non-null-assertion` | 80 |
| `no-inline-styles` | 36 |
| `display-name` | 10 |
| `exhaustive-deps` | 0 — an error since T-243 |
| `no-unused-vars` | 0 — an error since T-243 |

The two rules that point at defects were brought to zero and made errors, so
they cannot pile up again: a missing dependency is how a screen ends up showing
what it loaded under other conditions (CLAUDE.md 11), and a prop passed and
never read can be the bug itself. Each place was read, not silenced wholesale —
[audit/evidence/T-243/README.md](../../audit/evidence/T-243/README.md); an
effect whose list is short on purpose says why beside it. The rest is mostly
API responses typed as `any`.

Nothing here blocks a release.

### Two route suites fail intermittently in a full run

Seen twice on 2026-09-02, on different tests:

- `rehearsalById.test.js` → "gives it to an admin who is not on it"
- `rehearsalNotifications.test.js` → "tells the roster when the rehearsal changes"

Both pass on their own, repeatedly, and both passed on the next full run. So
nothing is broken — but a suite that fails one run in five stops being read, and
the next real failure gets waved through as "the flaky one".

One of the two candidates is gone. `rehearsalNotifications.test.js` built its
timestamps with `Date.now()` at each call, so two "identical" times taken a
millisecond apart differed — which the change-diff rightly reports as a move.
The suite is anchored to a fixed instant now, which removes the question rather
than answering it.

What remains: cross-suite state inside a Jest worker, which would explain
`rehearsalById.test.js` too and which nothing has yet demonstrated.

A third suite joined on 2026-09-26: `signInMethods.test.js` failed once in a
full server run, then passed on its own and in the two full runs after it
(938 of 938). Same shape, same verdict — note it, do not chase it blind.

Nineteen consecutive full runs across 2026-09-03 and 2026-09-05 were clean, so
it is rare rather than gone. Leave the entry until something explains it, and do
not chase it blind — that is how an afternoon disappears.

Two of the fixed-since claims below were also settled by hand: the schema file
now creates `native_notifications` and every other live table, and
`character_name` is in it.

### One day edited on two devices at once: the last save wins

The availability editor saves only the days changed on this device
(`PUT /availability/days`, R6), so an untouched day is never overwritten by an
old copy of it. But if the same day is edited on two devices from two different
loads, each save replaces the whole day, and the one saved last is what stays.
The other edit has to be made again.

Left alone on purpose, on the review's agreement (REVIEW_R6): it needs the same
person to edit the same day on two devices without reloading, and it costs
their own edit, which they can see. Fixing it takes a revision per day and a
conflict answer the editor would have to show.

### An inbox page can skip a row written with microseconds by something other than the server

The inbox is paged by the place the last row holds, `(created_at, id)` (cause
fix 21). The cursor carries `created_at` to the millisecond, as JavaScript
reads it; PostgreSQL keeps microseconds. The server writes every notification
with a millisecond time, so for its rows the two are the same. A row inserted
by hand with `NOW()`, in the same millisecond as others, could fall between two
pages and not be shown. Left alone: nothing in the app writes such rows, and a
cursor with microseconds would need the database to hand the time back as text.

### The admin statistics read whole tables into memory (T-293)

The admin dashboard computes its figures in the server from whole lists, not
in SQL. The inbox section reads every `native_notifications` row of the period
— for "all time", every row — to take a median time to read
([analytics.js](../server/services/admin/analytics.js), `notifications`). The
list of people is read in full by each of the three routes on one opening of
the page (stats, users, analytics). With a dozen accounts this costs nothing; it
becomes noticeable at tens of thousands of notifications, only while the owner
has the dashboard open, and only to the owner. When it does, take the median in
PostgreSQL (`percentile_cont`) and share one read of the people per request.

### Migration 013 needs the push-token keys under their original names

The migrator recognises a schema from before 013 by what its push-token keys do
— unique on (user_id, device_token), a plain index on the token — not by what
they are called, so `--adopt` passes even if someone has renamed them by hand.
Migration 013 then drops them by name
([013-push-token-owner.sql](../server/migrations/013-push-token-owner.sql):
`native_push_tokens_user_id_device_token_key`, `idx_push_tokens_token`), and
`--apply` fails on the missing name and rolls the whole run back. Nothing is
half-applied; the run just stops.

Left alone on the review's agreement: no known database has renamed them, and
the failure is loud and complete. If it happens, rename the two objects back to
those names and run `--apply` again.

### Calendar sync needs an installation id before Android ships

Imported rows and export mappings belong to the device's calendars (R7): a
calendar id is the device's own, so what is recorded under it is that device's.
On iOS that holds — the id is a UUID of that device. On Android it is the row
number of the calendar (1, 2, 3…), the same on two phones of one person, so
their imports would replace each other and their mappings merge again. Android
is not released, so nobody is affected yet. Before it is, an installation id
has to join the scope — in the imported key and in the calendar connection —
alongside IC01 below.

The same id would also settle a rarer iOS case: a full iCloud resync gives the
calendars new ids, and rows imported under the old ones stay until "remove all
imported" is pressed. It needs signing out of iCloud and back in, and costs
extra busy hours the person can see and clear.

### Deleting the account without calendar access counts only this install's exports (T-409)

Before DELETE /me the app removes what it exported to this iPhone's calendar
and says how many events stayed (`removeExportedBeforeDeletion`,
services/calendarSync.ts). Without calendar access it can neither remove nor
look, so it counts what this phone's own record says it exported. That record
goes when the app is deleted, and iOS takes the calendar access with it: events
exported by an earlier install, on a phone whose new install was never given
the calendar, are not counted, and the alert says nothing of them. It needs a
reinstall plus a refusal of the calendar, and costs events the person can
delete in Calendar; the policy says other devices keep theirs the same way.
Special case, minor: a line here.

### Deleting the account forgets that iOS's rating window was asked for (T-410, T-414)

What the rating request counts — the days of use and the version and time of
the last ask (`reviewPrompt.ts`) — lives in AsyncStorage, and `deleteAccount`
(contexts/AuthContext.tsx) clears AsyncStorage whole. A new account on the same
phone, used on three days, can therefore be asked a second time in the same
version. It costs at most one more of Apple's windows, which iOS itself shows
no more than three times in 365 days, and needs an account deleted and another
made on one phone. Keeping these keys through the clear would carry one
person's traces past the deletion of their account, which is worse than the
repeat. Special case, minor: a line here.

### The rating window can follow Availability closed by something other than the person (T-414, T-415)

On Availability the rating request is tied to the screen's unmount after a
save went through (`visit`, features/availability/screens/AvailabilityScreen.tsx).
But the screen is also unmounted when the stack is reset from outside while it
is open and the person never closed it: a tapped notification takes the stack
back to the tabs, or the session ends and sign-in is shown. Apple's window then
comes a second later over whatever is on the screen by then, and at the end of
a session it is asked with the `onboardingCompleted` the user had before. It
needs three things at once: a save in this visit, the rule for asking holding
(`reviewDue`, shared/services/reviewPrompt.ts), and an outside reset of the
stack while the screen is open. It costs one of Apple's windows out of place,
which "Not Now" closes and which iOS shows no more than three times a year
anyway. A fix would ask only when the person left on their own — `beforeRemove`
with a back or modal-dismiss action, the close question's Save included —
which the unmount cannot tell apart. Special case, minor: a line here.

### Android App Links wait for an Android release (IC01)

`assetlinks.json` carries a placeholder where the app's signing fingerprint
belongs. Android is not released, so nobody is affected yet. Add the fingerprint
when it is released. This is audit finding IC01, deferred in
`audit/TRIAGE_R4_R9.md`. The other R4–R9 findings are being fixed at their
cause rather than listed here.

### The install postback cannot be seen in the simulator or in e2e (T-424)

`RehearslyAttribution.m` (CLAUDE.md, «Реклама установок: SKAdNetwork») calls
SKAdNetwork on every launch. Nothing appears on screen, and iOS reports
success even when no ad led to the install. The tests check what the
generated project compiles, and `e2e/release/01-launch.yaml` checks that the
app still starts. Whether Apple actually sends a postback to Meta can only be
checked on a phone and in Meta. The steps follow Apple's pages, read by the
monitor on 28.11.2026; the texts are in `audit/evidence/T-429/` (one file per
page, `SOURCES.md` lists the page addresses) and, for the AdAttributionKit
profile page, `audit/evidence/T-430/`.

**On a phone with current iOS (18 and later), a real Meta ad is checked only
in Meta's report, days later.** Apple has two ways to shorten the wait, and
which one exists depends on the iOS version:

- **iOS 18 and later: Developer Mode only.** The testing profile does not work
  there: "In iOS 18 and later, the testing profile no longer works in
  AdAttributionKit or SKAdNetwork, so you need to use the AdAttributionKit
  Developer Mode"
  ([Testing ad attributions with a downloaded profile](https://developer.apple.com/documentation/adattributionkit/testing-ad-attributions-with-a-downloaded-profile),
  AdAttributionKit). And Developer Mode does not shorten a real ad's wait:
  "Developer Mode only affects the time-windows of development postbacks.
  Postbacks that the system generates from production impressions use the full
  time-windows"
  ([Testing ad attributions with Developer Mode](https://developer.apple.com/documentation/adattributionkit/testing-adattributionkit-with-developer-mode)).
  A development impression is one the ad network signs with "a source App
  Store identifier of `0`" (same page). The ad network does this, not the app.
  An impression from a real Meta ad is a production one, so it has the full
  windows.
- **Before iOS 18: the testing profile.** "You can only use the
  AdAttributionKit testing profile for devices running OS versions earlier
  than iOS 18"; it installs on "iOS or iPadOS 17.4 or later" (AdAttributionKit
  profile page; the older StoreKit page with the same title says "iOS or
  iPadOS 14 or later" and sends you to the AdAttributionKit one for the
  download). "Using this profile reduces the conversion value update and
  postback window from 24–48 hours to 5–10 minutes." The page sets no
  condition about development impressions, unlike the Developer Mode page, so
  the profile may well shorten a real ad's wait too. Apple does not say so
  outright; not tried here. "This testing profile expires 2 weeks after you
  install it on the device."

1. Phone: a production Apple Account. "SKAdNetwork doesn't support Sandbox
   Apple Accounts"
   ([Testing ad attributions with a downloaded profile](https://developer.apple.com/documentation/storekit/testing-ad-attributions-with-a-downloaded-profile)).
2. Install build 1.0.2 from an ad in a Meta app-install campaign, then open the
   app once. That launch makes the call. With the phone connected to a Mac,
   Console.app shows the app's line only if the call failed:
   `[WARN] [Attribution] …`. Success is `logger.debug`, which Release drops.
3. Wait. "The first conversion window spans days 0 to 2" from "when the user
   first launches the app". Then "the random delay is 24–48 hours for the first
   postback"
   ([Receiving postbacks in multiple conversion windows](https://developer.apple.com/documentation/storekit/receiving-postbacks-in-multiple-conversion-windows)).
   The window stays open because the app calls with `lockWindow:NO`. So the
   first postback reaches Meta about 3–4 days after the first launch, plus
   whatever time Meta itself takes.
4. Meta: Events Manager → the app → SKAdNetwork, or the campaign's results in
   Ads Manager. Meta gets no per-person data. The postback data tier decides
   what arrives: at Tier 0 only the two-digit `source-identifier`, with no
   value at all (same page).

**The fast paths, by iOS version.**

- *iOS 18 and later* — needs a development impression from an ad network, so
  it does not check a Meta campaign. Turn on Developer Mode, then "access the
  developer settings in Settings on your test device. Then scroll down to the
  Ad Attribution Testing section and enable the AdAttributionKit Developer
  Mode switch". "This setting automatically turns off after two weeks." The
  windows then become 0–3, 3–6 and 6–9 minutes, and the postback delay becomes
  5 to 10 minutes (Developer Mode page).
- *iOS 17.4 to 17.x* — the switch is not there ("For devices running OS
  versions earlier than iOS 18, use the AdAttributionKit testing profile",
  Developer Mode page). Download the AdAttributionKit profile from the Apple
  Developer account and install it; the app then "has 5 minutes to update the
  conversion value after initially registering", and the postback goes
  "within another 5 minutes". With a Wi-Fi HTTP proxy set on the phone
  (Settings → Wi-Fi → the network → Configure Proxy), "the AdAttributionKit
  postbacks that the device sends go through the proxy" (AdAttributionKit
  profile page). Only on such a phone could a real Meta ad perhaps be seen
  in minutes, as said above.

**Second and third postbacks.** Apple: "The advertised app needs to call …
to update the conversion values during each conversion window", and the
windows are days 0–2, 3–7 and 8–35 (multiple conversion windows page). The app
makes the call only on a cold start: `App.tsx` calls `registerInstall()` at its
top level, and `RehearslyAttribution.m` wraps the call in `dispatch_once`, so
each process makes it once. Coming back from the background does not call
again. Therefore:

- the second postback goes only if the app was cold-started in days 3–7, and
  the third only if it was cold-started in days 8–35;
- both carry only the coarse value, `low`: "For ads in Tier 1, Tier 2, and
  Tier 3, the second and third postbacks contain … `source-identifier` …
  with two digits, `coarse-conversion-value`";
- at Tier 0 neither is sent: "For ads in Tier 0, the system doesn't send a
  second or third postback";
- ads signed with SKAdNetwork 3 or earlier get one postback only.

This is how the code works now, and it stays as it is (T-429).

**What is checked.** The iOS SDK's own header says (`StoreKit/SKAdNetwork.h`,
Xcode's iPhoneOS SDK, read 28.11.2026), quoted:

- `registerAppForAdNetworkAttribution`: "Participating apps should call this
  on launch to complete the install+open action associated with a product
  view", `API_DEPRECATED("Use updatePostbackConversionValue:completionHandler:
  instead.", ios(11.3, 15.4))`.
- `updatePostbackConversionValue:completionHandler:` — `API_AVAILABLE(ios(15.4))`;
  `updatePostbackConversionValue:coarseValue:lockWindow:completionHandler:` and
  `SKAdNetworkCoarseConversionValueLow` — `API_AVAILABLE(ios(16.1))`.
- `startImpression`/`endImpression` are under "Source apps should call these
  methods" — the side that shows ads, which with `SKAdNetworkItems` is not ours.

Apple's pages confirm the three claims the code rests on (T-429; texts in
`audit/evidence/T-429/`):

1. *Repeating the same value on every launch is harmless*, so there is no
   first-launch flag.
   - The method's page asks for exactly this: "Call this method when the user
     first launches an app to register the app installation, and again to
     update conversion values as the user engages with the app"
     ([updatePostbackConversionValue(_:coarseValue:lockWindow:completionHandler:)](https://developer.apple.com/documentation/storekit/skadnetwork/updatepostbackconversionvalue(_:coarsevalue:lockwindow:completionhandler:))).
   - SKAdNetwork 3 and earlier: "The 24-hour timer restarts each time the app
     calls this method with a valid conversion value greater than the previous
     value" (same page). An equal value does not restart it.
   - SKAdNetwork 4: the windows are fixed from the first launch (days 0–2,
     3–7, 8–35, multiple conversion windows page). A repeated call does not
     move them. With `lockWindow` `false`, the system "continues updating the
     conversion value throughout the conversion window" (method page).
2. *Coarse `low` fits "installed, nothing more".* "These constants have no
   special meaning. The app or ad network can define their meaning"
   ([SKAdNetwork.CoarseConversionValue](https://developer.apple.com/documentation/storekit/skadnetwork/coarseconversionvalue)).
3. *AdAttributionKit (iOS 17.4+) takes the value set through SKAdNetwork*, so
   there is no AdAttributionKit code. "SKAdNetwork bridges the conversion
   values between the two frameworks by mirroring the call into
   AdAttributionKit"
   ([Understanding AdAttributionKit and SKAdNetwork interoperability](https://developer.apple.com/documentation/adattributionkit/adattributionkit-skadnetwork-interoperability)).
   The same page says what happens to installs that no ad led to: "If your app
   doesn't have any pending postbacks … the system ignores calls to both
   AdAttributionKit and SKAdNetwork."

The new architecture part is verified: a Debug e2e build with
`newArchEnabled: true` logged `[WARN] [Attribution] the install conversion
value was not taken: … SKANErrorDomain error 10` — the error is SKAdNetwork's,
raised inside `RehearslyAttribution`, so the module was there and the call
reached StoreKit (`audit/evidence/T-424/metro-debug-launch.txt`). The
simulator refuses the value. Code 10 is `SKANErrorUnknown`, in the public
header: `SKANErrorUnknown = 10` in `StoreKit.framework/Headers/SKANError.h`
of the iPhoneOS SDK (Xcode 26.6).

---

## Candidates from the 2026-09-01 sweep — **not verified**

Six agents read the subsystems with no test coverage; a verification pass
confirmed the four critical findings and six others, then ran out of budget. The
rest are listed as found, in the reporter's words, with nothing checked. Roughly
half of such claims usually fall over on inspection.

### High

Empty: three were verified on 2026-09-03 and moved above, and two were fixed the
same day — the orphaned busy slots after a project delete, and the planner's
range being built through UTC.

### Medium

Empty: all five have been fixed since and their rows deleted — a session
revoked mid-use now signs the app out, changing the export calendar moves the
rehearsals to the new one, the cached connection id is reset when the account
on the device changes, email lookups go through the normalised address, and the
client sends a short invite code in capitals, as issued (T-025).

### Low

| Where | Claim |
|---|---|
| [auth.js:73](../server/routes/auth.js#L73) | Registration confirms whether an email already has an account (409 `EMAIL_TAKEN`), while login is deliberately generic |
| [AuthContext.tsx:297](../src/contexts/AuthContext.tsx#L297) | A failed first timezone sync is never retried (`hasTimezoneSynced` is set before the request), so an OAuth signup can store rehearsal times as UTC wall-clock |

---

## Known and left alone on purpose — not defects

- The usage statistics (T-294) are approximate in known ways. A day of use is
  any request the app makes in a session: opening the app counts, whatever
  the person then does, and a session refresh alone does not. A link preview
  is recognised by its user agent; one that calls itself an ordinary browser
  counts as a person opening the page. The page is counted after it is sent:
  on Vercel through the platform's `waitUntil` hook, and where that is absent a
  count may be lost if the function is frozen first — never the page. Each
  server instance writes a person's day once; several instances write it once
  each, onto the same row.

- Push delivery is not shown to anyone: Expo's ticket says the message was
  accepted, and `sent` means accepted. The receipts are read by the reminder
  cron (`checkPushReceipts`) only to drop tokens of devices no longer
  registered.
- The app's request timeout is iOS's timer of silence, not the app's own:
  `REQUEST_TIMEOUT_MS` (10 s, [api.ts](../src/shared/services/api.ts)) is
  handed by axios to NSURLSession as `timeoutInterval`, which iOS counts from
  the last byte heard. In one e2e night run (T-220, on the simulator under
  load) it did not fire in 40 s of silence: the request waited and got its
  answer. The app sets no total limit of its own on purpose: it would count
  the whole request, not the silence, and cut off a slow upload or read that
  is still coming in, which today goes through. The e2e flows do not count on
  iOS giving up (docs/e2e.md, `DROP`).

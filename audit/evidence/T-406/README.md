# T-406 — weekends busy by default, each by the country of their time zone

Commits: `deda857` (server: migration 017 as schema version 3, the defaults,
the switch's routes, the table and its build), `d584775` (privacy policy, four
languages), `5ab19a2` (app: the profile's switch, the onboarding step, the
editor's note; e2e). Base for red-before: `b8722df`.
Node 26.13.0, PostgreSQL 15.13, iOS simulator (iOS 26.5).

[red-before.txt](red-before.txt), [green.txt](green.txt),
[editors-brief.md](editors-brief.md) (every new string, for the native
speakers), [extract-fixture.mjs](extract-fixture.mjs) (how
`__tests__/postgres/fixtures/migrator-b8722df` was made).

## How it works

- **Whose weekends.** `shared/contracts/weekends.json`, built by
  `scripts/weekend-table.mjs`: zone → country from tzdata 2026c `zone.tab`
  (418 zones, plus ICU's 19 other names for them, e.g. Asia/Calcutta), country
  → weekend from CLDR 48.0 weekData as Node's ICU 78.3 carries it; a zone
  without a country (UTC, Etc/…, unknown) takes "001", Sat and Sun. 18
  countries differ from "001": Fri–Sat in IL, SA, BH, DZ, EG, IQ, JO, KW, LY,
  OM, QA, SD, SY, YE; one day in IN and UG (Sun) and IR (Fri); Thu–Fri in AF.
  (AE is Sat–Sun in CLDR 48.) The server and the app read the same file. The weekday is the
  date's own (`isoWeekday`), with no zone.
- **The rows.** Real `busy`, all-day rows, `T00:00:00.000Z`–`T23:59:59.999Z`,
  `source = 'weekend'`, `external_event_id = 'weekend:<date>'`, unique on
  `(user_id, external_event_id, source)` with `ON CONFLICT DO NOTHING`: two
  requests at once cannot write a day twice (Jest; on PostgreSQL six reads and
  three planners at once, T406_UPGRADE). Only on a weekend day without a mark
  of the person's own (manual rows, by deleteManualDay's rule: an all-day row
  by its UTC date, a timed one by its date in the person's zone). Imports and
  rehearsals neither stop nor replace them; "Delete imported" deletes only
  calendar sources.
- **Who lays them out, and when.** The server does not wake up and the crons
  are off, so the reads do it: `GET /availability` (the person's own screen)
  and `GET /:projectId/members/availability` (every planner, for each member it
  shows, after authorization and the budget) call `ensureWeekendDefaults`.
  Anyone a planner can see is laid out before the planner reads them, so a
  member who has not opened the app since the release is busy on their
  weekends all the same (Jest and PG). A read with nothing to do costs one
  SELECT of the members' rows. Work is one transaction per person under their
  row lock (`FOR NO KEY UPDATE`, the lock every save of theirs takes).
- **A year ahead, and what the person emptied stays empty.**
  `native_users.weekends_through` is the last date laid out; later days are
  added only after it. A weekend day the person took over (their save replaces
  the default) and emptied is below it and is never laid out again (Jest: a
  month of reads later). `weekends_days` is the weekdays it was laid out for: a
  change of zone to another country moves the rows from today on at the next
  read — the old country's days go, the new ones come where nothing of the
  person's is, days that are weekend in both stay as they are. `PUT /auth/me`
  (authorization's file) is not touched.
- **The switch** (`native_users.weekends_busy`, `NOT NULL DEFAULT TRUE`: on for
  everyone, the registered included). `PUT /availability/weekends {enabled}`:
  off deletes the defaults from the person's today on (by source and date; past
  days stay, own marks stay); on lays them out again from today on, on every
  weekend day without an own mark — including one the person had emptied: "on"
  is an answer about all weekends. `GET` answers `{ enabled, days }`.
- **Saves.** `PUT /days`, and the older app's `/bulk` and `DELETE /:date`, go
  through `clearOwnDay`: the day's manual rows and its default go, in the same
  transaction, by date.
- **Readers unchanged.** The planner reads the rows as any busy all-day row.
  One exception, deliberate: its `hasData` ("has this member entered anything")
  no longer counts `weekend` rows — otherwise everyone would read as having
  entered something, and the planner's warning about members who have entered
  nothing (free on every weekday) would go. The admin counts only manual and
  calendar marks (`MARK_SOURCES`, unchanged; Jest checks it).
- **App.** `src/shared/utils/weekends.ts` (same table; day names from
  `dateFormat.ts`, T-028). Profile: the switch right under "Start Week On",
  "Your weekend: Fri and Sat" under its label, read on focus, no tap while a
  change is on its way. Onboarding: five steps, the new one after the
  greeting: "Mark all weekends (Fri and Sat) as busy?", where to change it
  ("Profile → Weekends Busy", the Profile's own labels), Yes / No saved before
  the next step; Skip leaves the server's default, on. Editor: a `weekend` row
  makes the day `busy` with `weekendDefault`, and the note "Weekend: busy by
  default…"; any edit drops the flag, the save replaces the default.
- **Policy.** Three places in each language (editors-brief.md); revised
  25.11.2026.

## Migration 017

`server/migrations/017-weekend-defaults.sql`: three `ALTER TABLE native_users
ADD COLUMN`, no data. Schema version 3 on new paths
(`init-native-schema-v3.sql`, `schema/catalog-v3.json`, `schema/inspect-v3.mjs`,
profile `rehearsly-pg-current-v3`), as 016 was version 2: v1 and v2 files byte
for byte, their identities pinned (`schemaHistoryIdentity.test.js` now pins v2
and 016 too, as b8722df's loader computes them). The step's roots are the
three v1 profiles and v2; group 017 is columns, not a table (like 013, a key).
`catalog-v3.json` is v2's plus the three columns; R2_SCHEMA checks it equals a
real `--fresh` on PostgreSQL 15.

PostgreSQL proof (T406_UPGRADE): a database made by 477ea2f's own `--fresh`
(production's root), then 016 by b8722df's own migrator (what production gets
016 with); this tree's `--dry` plans `017-weekend-defaults` alone, `--apply`
applies it after the untouched rows, the next `--dry` is empty, the catalog
equals a fresh v3.

## For the owner: release

Order: **017 → server → build 1.0.1**, server and build close together.

1. Production: `npm run migrate -- --dry` → `state: managed`, `rootId:
   rehearsly-pg-current-v1`, `stepIds: ["017-weekend-defaults"]` if 016 is
   applied, `["016-usage-statistics", "017-weekend-defaults"]` if not. Then
   `--apply`. Only the owner applies it.
2. The server. Without 017 it works as before: lays nothing out, logs once
   "Migration 017 is not applied", `GET/PUT /availability/weekends` answer 503
   (1.0.1's switch then stays disabled; its onboarding answer fails with an
   alert, Skip goes on).
3. 1.0.1.

**1.0.0 with the new server.** Its weekends come red: it reads a `weekend` row
as an event from the phone's calendar, all day. Tapping such a day shows an
all-day row labelled as coming from the phone's calendar among the read-only
rows, with the note to delete the event in the phone's calendar to free it —
not true for these, and 1.0.0 cannot say better. The day can still be changed: picking
Free, hours or Busy and saving sends `PUT /days`, which replaces the default
with what was saved (and `/bulk`, `DELETE /:date` the same); after the save's
reload the day shows what was saved. Until the save, the buttons keep drawing
it busy (an all-day read-only row wins the drawing in 1.0.0). 1.0.0 has no
switch and no onboarding step: everyone is on until 1.0.1.

## Open

- **CLDR, checked against ICU only.** The weekends come from Node's ICU
  78.3, which says it carries CLDR 48.0, and the Jest test pins the table to
  what ICU answers for every country. A comparison with CLDR's own
  `supplementalData.xml` was not possible here: the sandbox has no network.
  The script does it: download `common/supplemental/supplementalData.xml` of
  unicode-org/cldr tag `release-48` and run
  `node scripts/weekend-table.mjs --cldr <file>` (rehearsal-calendar-native/);
  it fails on the first country that differs.
- **The native speakers' reading** of every new string and of the policy's
  three places (editors-brief.md) — the monitor's, after acceptance.
- The app finds a zone's country by the names in the table (zone.tab's and
  ICU's); the server also resolves older aliases ("Israel", "W-SU") through
  Intl. A profile holding such an alias — the picker and the phones give
  canonical names — would read "Sat and Sun" under the switch while the server
  lays out the right days.
- e2e: the seed turns the switch off for the people of the flows written
  before T-406 (their days count on free weekends), and keeps the default for
  those still to go through onboarding and for flow 104's.
- Simulator: several first tries ended in `DeviceUnreachableException`
  (XCUITest `kAXErrorAPIDisabled`) before the flow reached the app; each passed
  on the next run (green.txt).

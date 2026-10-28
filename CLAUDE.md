# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rehearsal Calendar** is a React Native mobile app for theatrical rehearsal planning with availability management, smart time recommendations, and multi-project support. It consists of a React Native frontend and Express.js backend.

## Common Development Commands

### Frontend (React Native)
```bash
cd rehearsal-calendar-native

# Development
npm start                    # Start Expo dev server
npm run ios                  # Run iOS simulator (requires Xcode)
npm run android              # Run Android emulator (not configured yet)

# Code Quality
npm run lint                 # Run ESLint
npm run lint:fix             # Fix ESLint errors
npm run type-check           # TypeScript type checking
npm test                     # Run Jest tests
npm run test:watch           # Run tests in watch mode
npm run check                # Run all checks (secrets, type-check, tests)

# Security
npm run check:secrets        # Check for exposed secrets/API keys
```

### Backend (Express.js)
```bash
cd rehearsal-calendar-native/server

# Development: explicitly provide an isolated PostgreSQL target first.
# server/.env is not loaded automatically; it contains production credentials.
npm start                    # Start the HTTP listener; DB initializes on demand
npm run dev                  # Same contract, with --watch

# Database
npm run migrate              # Apply pending migrations (see Database section)
npm run migrate -- --dry     # Show what would be applied, change nothing

# Testing
npm test                     # Run Jest tests
npm run test:watch           # Run tests in watch mode
npm run test:coverage        # Run tests with coverage report
```

### Running Both Servers (Typical Workflow)
```bash
# Terminal 1: Backend
cd rehearsal-calendar-native/server && npm run dev

# Terminal 2: Frontend
cd rehearsal-calendar-native && npm start

# Terminal 3: iOS Simulator (optional)
# Open ios/Rehearsly.xcworkspace in Xcode and press ⌘R
```

## Architecture Overview

### Frontend Structure (Feature-Based)
```
src/
├── features/              # Feature modules (auth, calendar, projects, etc.)
│   ├── auth/             # Authentication screens & logic
│   ├── calendar/         # Rehearsals, calendar display
│   ├── projects/         # Project management
│   ├── availability/     # User availability management
│   └── profile/          # User profile & settings
├── navigation/           # React Navigation setup
├── contexts/             # React Context providers (Auth, I18n, Project, Seen, Unread)
├── shared/
│   ├── components/       # Reusable UI components
│   ├── services/         # API client, calendar sync
│   ├── utils/           # Helper functions
│   └── types/           # TypeScript types
└── i18n/                # Translations (Russian/English)
```

### Backend Structure
```
server/
├── routes/              # API routes
│   ├── auth.js         # Authentication endpoints
│   ├── admin.js        # Admin dashboard API (stats, users, bug reports)
│   ├── admin/          # Admin page HTML generator (dashboardPage.js)
│   └── native/         # Native app endpoints (projects, rehearsals, availability, bug reports)
├── services/           # Business logic layer (rehearsals, notifications)
├── database/           # Database setup & migrations
├── middleware/         # Auth middleware, timezone conversion, admin auth
├── utils/              # Timezone utilities, HTML escaping, helpers
└── constants/          # Shared constants (availability types, etc.)
```

### Public Web Pages
Served by the Express server as static files, so that the landing page, the API
and `/invite/*` all share one origin. That is a requirement, not a preference:
`apple-app-site-association` must be hosted on the same domain the invite links
use, or Universal Links will not work.

```
server/public/
├── index.html           # Landing — all four locales in the markup
├── styles.css           # Landing design system (dark theme, glass morphism)
├── i18n.js              # Language toggle, reveals, and the phone scroll
├── privacy.html         # Privacy Policy — EN/RU/ES/DE
├── support.html         # Support — EN/RU/ES/DE
├── legal.css            # Shared styling for the two pages above
├── legal.js             # Their language toggle (4 locales, shared storage key)
└── assets/              # Phone frames and screen strips (WebP), logo, favicons
```
- **Stack**: Pure HTML/CSS/JS, no build tools, no third-party scripts
- **Routes**: `/` → landing, `/privacy`, `/support` (the `extensions: ['html']`
  option on `express.static` is what makes the extensionless paths work)
- **i18n**: every language ships in the markup and one is hidden, so the pages
  stay readable without JavaScript — all four on every page. Each language is
  written on its own terms rather than translated slot by slot, which is why
  there is no dictionary in `i18n.js`. The choice is stored under
  `rehearsly-lang`, shared with `legal.js`; `?lang=de` overrides it for a link.
- **Phone mock-ups**: a frame pins to the middle of the viewport (CSS `sticky`)
  while its screenshot scrolls inside, so a whole app screen can be read
  without leaving the section. `assets/` is generated from the raw simulator
  shots by `screens/build-assets.py`, which lifts the status bar, tab bar and
  the planner's own pinned header out of the images and stitches the frames of
  one screen into a single strip by matching row signatures. Reshoot a screen
  and rerun it.
- **To preview**: run the server and open `http://localhost:3001/`
- **Deployment gotcha**: `vercel.json` needs `includeFiles: "public/**"` —
  `express.static` resolves paths at runtime, so the bundler cannot infer the
  folder is needed and would otherwise omit it.

### Database
- **Server runtime, development and production**: PostgreSQL only. There is no SQLite fallback.
- **SQLite**: isolated test fixtures only; they do not prove PostgreSQL behavior.
- **Canonical schema**: twenty-three `native_*` application tables: thirteen domain
  tables, six shared-budget tables, two for email address proof (group 010),
  one for push tickets awaiting their receipts (group 011) and one for the
  idempotency keys of creates (group 012).
  Migration history is separate. Retired
  payment/activity/participant tables are not created by fresh provisioning.
  Actual production catalog and migration history have not been inspected here.
- **Schema**: [rehearsal-calendar-native/server/database/init-native-schema.sql](rehearsal-calendar-native/server/database/init-native-schema.sql)
- **Note**: runtime SQL uses PostgreSQL types and constraints; fixture SQL conversion is test-only.
- **Runtime/lifecycle and safe local startup**: [server runtime contract](rehearsal-calendar-native/docs/server-runtime.md).
- **Provisioning**: [explicit schema/migration contract](rehearsal-calendar-native/docs/server-migrations.md); no automatic startup/deployment migrations.

## Critical Patterns & Conventions

### 1. Authentication Middleware
```javascript
// ✅ CORRECT - Use req.userId
router.get('/endpoint', requireAuth, async (req, res) => {
  const userId = req.userId;  // Set by requireAuth middleware
});

// ❌ WRONG - Don't use req.user
const userId = req.user.id;  // req.user is undefined!
```

### 2. Database Query Syntax
```javascript
// ✅ RECOMMENDED - PostgreSQL parameterized queries
await db.all('SELECT * FROM users WHERE id = $1 AND status = $2', [userId, 'active']);

// Legacy question-mark placeholders are translated by the PostgreSQL adapter
await db.all('SELECT * FROM users WHERE id = ? AND status = ?', [userId, 'active']);
```

### 3. Timezone Handling (CRITICAL)
All dates/times use **ISO 8601 with timezone** (TIMESTAMPTZ in PostgreSQL):

```javascript
// Frontend → Backend: Send ISO 8601 strings with timezone
{
  startsAt: '2025-12-13T08:00:00+02:00',
  endsAt: '2025-12-13T16:00:00+02:00'
}

// Backend storage: PostgreSQL automatically converts to UTC
// Backend → Frontend: Return ISO 8601 strings (client handles display in local time)

// All-day events: MUST use UTC with .000Z suffix
{
  startsAt: '2025-12-13T00:00:00.000Z',
  endsAt: '2025-12-13T23:59:59.999Z',
  isAllDay: true
}
```

**Common Timezone Errors:**
- ❌ Using `+02:00` for all-day events → violates DB constraints
- ❌ Forgetting to convert between local and UTC
- ❌ Using wrong Date format (must be ISO 8601)

**A date-only value must never be given a timezone.** All-day rows store
`T00:00:00.000Z` to mean a calendar date, not an instant, so
`DATE(starts_at AT TIME ZONE $tz)` lands on the previous day at every negative
offset — saving one day deletes its neighbour and leaves the original standing.
Read all-day rows in UTC and timed rows in the user's zone, in the same query if
it comes to that — `deleteManualDay` in `server/services/availability/manualDays.js`
is the one place the server picks a day's rows. The client version of the
mistake is `new Date('2026-09-10')`, which prints as 9 September in New York; use
`parseDateString` from `shared/utils/time.ts`. And "today" is never
`new Date().toISOString().split('T')[0]` — that is the UTC date; use `useToday`
or `useNow` from `shared/hooks/useClock.ts`, which also move on at midnight and
when the app returns to the foreground.

### 4. Availability Types & Sources
```javascript
// Use constants from server/constants/timezone.js
AVAILABILITY_TYPES = {
  AVAILABLE: 'available',   // User is free
  BUSY: 'busy',            // User is occupied (custom mode + rehearsals)
  TENTATIVE: 'tentative'   // Imported calendar events
}

AVAILABILITY_SOURCES = {
  MANUAL: 'manual',              // User-created
  REHEARSAL: 'rehearsal',        // Auto-created from rehearsals
  GOOGLE: 'google_calendar',     // Imported from Google
  APPLE: 'apple_calendar'        // Imported from Apple Calendar
}
```

### 5. Seen System (Rehearsal Responses)
Binary "I've seen this" toggle using eye icon. No 'maybe' status.

**Two different value sets — don't confuse them:**

```javascript
// ON THE WIRE: always 'yes' or 'no' — never null.
// POST /api/native/rehearsals/:id/respond
{ response: 'yes' }  // Mark as seen
{ response: 'no' }   // Mark as unseen

// IN FRONTEND STATE (RSVPStatus): 'yes' (seen) or null (unseen)
```

`useRSVP` translates between the two — `null` in UI state maps to `'no'` on the wire:
```typescript
const newStatus = currentStatus === 'yes' ? null : 'yes';   // UI state
const serverStatus = currentStatus === 'yes' ? 'no' : 'yes'; // wire value
```

The backend **updates** the caller's existing row and never creates or deletes
one: answering is not a way onto a rehearsal. Someone not on it gets 404 (or
403 `NOT_ON_REHEARSAL` for an admin, who can see it); anything other than
`'yes'`/`'no'` is a 400.

**Having a row at all is what puts you on the rehearsal** — a row of someone who
is still an active member of the project. Who is on a rehearsal is decided in
one place, [roster.js](rehearsal-calendar-native/server/services/rehearsals/roster.js):
every read joins the row to the membership, so a leftover row puts nobody in
announcements, reminders or busy slots, and a test fails if anything else in
the server names `native_rehearsal_responses`. `'no'` means invited and not yet
seen — not declined. So editing a rehearsal must keep existing
answers and add newcomers as `'no'`; wiping the rows and reinserting everyone as
`'yes'` marks the whole cast as having seen a rehearsal at the exact moment it
changed, and dropping a `'no'` row removes that person from the call.

**Order matters when updating.** `bookRehearsalSlots` reads the roster out of
`native_rehearsal_responses`, so participants must be settled *before* the
availability is rebuilt. The other way round books whoever was on the rehearsal
before the edit.

**`invited` is the people on that rehearsal**, not the size of the project.
Three places report this counter — the list, the participants screen, and the
response to tapping the eye — and they have to agree, or the number jumps on
the tap and snaps back on the next refresh.
See [rsvpService.js](rehearsal-calendar-native/server/services/rehearsals/rsvpService.js).

### 6. API Response Format
```javascript
// Success
res.json({
  success: true,
  data: result
});

// Error
res.status(400).json({
  error: 'Error message',
  details: 'Additional info'
});
```

### 7. Internationalization (i18n)
```typescript
// Access translations via I18nContext
const { t, language, changeLanguage } = useI18n();

// Static strings
<Text>{t.common.save}</Text>

// Dynamic strings (functions)
<Text>{t.rehearsals.selectedCount(3, 10)}</Text>  // "Selected: 3 of 10"

// Localized dates — all four languages, from one place
date.toLocaleDateString(getDateLocale(language))   // shared/utils/locale.ts
```

### 8. Authorize the ids, not only the caller

A membership check answers "may this person touch this project". It does not
answer "may they touch *these* ids". Every id arriving in a body or a query —
`participant_ids`, `userIds`, `memberIds` — is intersected with what the caller
can actually reach, before it is used.

```javascript
// ❌ WRONG - membership checked, then the body is trusted
await requireProjectAdmin(userId, projectId);
for (const id of req.body.participant_ids) {
  await db.run('INSERT INTO native_rehearsal_responses ...', [rehearsalId, id]);
}

// ✅ CORRECT - intersect first, refuse the difference
const allowed = await activeMemberIds(projectId);
const unknown = participantIds.filter((id) => !allowed.includes(id));
if (unknown.length) return res.status(400).json({ error: 'Not project members' });
```

This is the shape of the `?userIds=` IDOR fixed in `d8b6660`. The roster had it
in two more places — a project admin could write busy slots into a stranger's
personal calendar, and an ordinary member could put themselves on a rehearsal by
calling `respond` — closed in R4 by `checkParticipants` and `answer` in
[roster.js](rehearsal-calendar-native/server/services/rehearsals/roster.js).

**Authorize before the work, not after.** A range that comes from a request gets
an explicit cap before anything is expanded from it. `GET
/:projectId/members/availability` builds one row per day with no bound and the
membership lookup behind it, so `0001-01-01..9999-12-31` blocks the event loop
for about three seconds before the request is refused.

### 9. More than one write means a transaction

A handler that issues two or more writes goes through `db.transaction(fn)` and
uses the `tx` it hands back for every statement inside. Never `db.run('BEGIN')`
— the pool returns that connection to somebody else with the transaction still
open, and the rollback fires on their write.

Removing a member is three DELETEs; creating a project is the row and then its
owner; saving a rehearsal is the row, the roster, then the busy slots. Every one
of them can stop halfway, and halfway is the damaging state: a project with no
owner, a rehearsal nobody can see, hours blocked for a call that no longer
exists.

### 10. An error is not an empty result

A `catch` must not return a value that success could also return. `[]`, `false`,
`0` and `null` leave the caller unable to tell *nothing* from *could not find
out* — and the caller then acts on the difference, deleting what it failed to
read or duplicating what it failed to find.

```javascript
// ❌ WRONG - "no events" and "the calendar refused us" become one value
try { return await Calendar.getEventsAsync(...); } catch { return []; }
```

The same rule on the way out: a success flag or timestamp — `lastSyncAt`,
`sent`, a read receipt — is written only on a path where nothing failed. Partial
success is not success, and a screen that says "done" over a failed request
teaches people to trust it.

### 11. An async result belongs to the state that asked for it

Capture what you are loading *for* before the `await` — the user id, the selected
project, a request counter — and check it again before writing to state. If it
changed, drop the result.

```typescript
// ❌ WRONG - nothing between the await and the write knows the world moved
setRehearsals(await api.getRehearsals(projectId));

// ✅ CORRECT
const generation = ++loadGeneration.current;
const data = await api.getRehearsals(projectId);
if (generation !== loadGeneration.current) return;
setRehearsals(data);
```

Switching accounts is the severe case, and it is not a display bug: a calendar
sync that began under one account finishes its writes under the next one's
token, so one person's private hours land in another person's availability.

The mechanism is `src/shared/services/session.ts` (cause fix 12). Only the
AuthContext changes the owner (`changeOwner`), and every change ends the
session: provider state is held with `useSessionState` (the next person starts
empty, a write from an earlier session is dropped), an answer goes through
`useLatestRequest` (only the newest question of the live session lands), state
that is both read and changed goes through `useRequestOrder` (a change is on
its way from send to answer, and a read that answers in that time or began
before it ended does not land), and work that writes in the person's name — the
calendar sync — runs as `sessionWork`, which the change of owner waits for
before writing the next tokens and which calls `assertSession` before each
write. Only the server's refusal of the refresh token ends a session from the
API client; no network keeps it.

### 12. "Not in my list" is not a reason to delete

A client sees one device, one page, one cached snapshot. The server holds all of
them. Replacement and deletion are scoped by a key both sides name — the day,
the device connection, an explicit set of ids — never by absence from whatever
the client happens to be holding.

Save used to post the whole availability snapshot, so a day loaded an hour ago
overwrote the edit somebody made since; it now names the days it changed
(`PUT /availability/days`, R6). Calendar import diffed the phone's events
against *every* imported row of the user, so syncing on the second phone
deleted what the first one had imported; it now names the device's calendars
and the server reconciles inside them (`POST /availability/imported/sync`, R7).

## Key Features & Implementation

### Smart Planner
**Location**: `src/features/smart-planner/`

Analyzes member availability and recommends optimal rehearsal times:
- Loads availability for all project members in a date range
- Categorizes slots: Perfect (100% free), Good (80%+), Possible (50%+), Difficult (<50%)
- Supports filtering by specific members
- Uses batch API endpoint for performance

### Calendar Sync
**Location**: `src/shared/services/calendar/`, `src/shared/hooks/useAutoCalendarSync.ts`

Bi-directional sync with iOS/Google Calendar:
- **Export**: Rehearsals → device calendar events (batch processing, 10 parallel)
- **Import**: Calendar events → user availability, one request per sync,
  reconciled on the server (`POST /availability/imported/sync`,
  `server/services/availability/importScope.js`)
- Mappings live on the server (`/native/calendar-sync/mappings`), one per
  device calendar, with AsyncStorage as a local cache

**Everything is scoped to this device's calendars.** A calendar id is the
device's own, so an imported row or an export mapping recorded under one
belongs to the device that has it — the list comes from `deviceCalendars.ts`.
A sync names every calendar on the device, the ones it read and the ones it
could not; the server replaces rows only inside the calendars read, in one
transaction, keeps the unreadable ones, and never touches calendars it was not
told about, which are other devices'. The scope is in the key the server
composes, `cal:<calendar>|<event>`. The window read carries its instants and
the local dates they cover, and `readBy` in `importScope.js` is the one rule
for what it covers: a whole day by its dates, never by the instants; what the
read had to return goes when missing, what only touches an edge stays. Export mappings are read and deleted the
same way, newest per rehearsal. On Android calendar ids are row numbers shared
between phones, so an installation id has to join the scope before Android
ships (known-issues).

**Auto Sync runs both ways.** Saving a rehearsal exports that one immediately,
but only on the device that saved it — so without the export half of the
automatic sync, being added to someone else's rehearsal put it on nobody's
calendar but the organiser's. The export runs on foreground alongside the
import, on its own ten-minute timer because each rehearsal costs a mapping
lookup; pull-to-refresh ignores that timer.

**Import skips what we exported.** Rehearsal events are excluded by the
`rehearsalapp://rehearsal/` link the export puts on them, and by this device's
mapping ids for events written before the link existed; otherwise a rehearsal
would count as busy twice — once as itself and once as an imported event.

**Deleting the event in the phone's calendar does not stick.** The next sync
sees the mapping has no event and recreates it: the rehearsal is the source of
truth, the calendar a mirror. The only ways out are deleting the rehearsal or
"remove all exported" on the sync screen.

**Only hours cross over, never what the events are.** The app sends each
event's key and times and nothing else; the server titles the rows
generically — `IMPORTED_TITLE` in `importScope.js`. A calendar's id crosses
over as an opaque scope. The onboarding and the landing both promise this.

### Payments

There are none, on either side. The app never had a paid tier, and the AllPay
integration that used to back one — client, subscription service, checkout
page, webhook, `requireSubscription`, the recurring-billing cron and the
frontend screen — has been deleted rather than disabled.

Two App Store guidelines drove it. 3.1.1 forbids sending customers to any
checkout but Apple's, and a WebView onto an external payment page is exactly
that; 2.3.1 covers dormant features a server flag could switch on, which is
what a merely hidden subscription flow would have been.

If money is ever taken it goes through App Store in-app purchase, which shares
no code with what was removed — receipt verification on the server and App
Store Server Notifications for cancellations. See
[app-store-release.md](rehearsal-calendar-native/docs/app-store-release.md).
The deleted code is in git history, but do not restore it: the WebView checkout
is the part Apple rejects.

The four `native_subscription_*` / `native_payment_*` / `native_allpay_*`
tables were dropped from production on 2026-09-05, along with two dead ones.
Nothing read any of them; their rows were dumped first.

### Rehearsal Reminders
**Location**: `server/services/notifications/reminderScheduler.js`, `server/routes/cron.js`

Push reminders for rehearsals starting soon. `checkUpcomingRehearsals()` finds
them and sends via Expo; `GET /api/cron/reminders` is what actually calls it.

**Nothing inside the deployment can drive it.** The in-process scheduler that
used to exist never ran on Vercel — a function is not resident between requests
— and worse, it fired on local boots against the production database, sending
real pushes from a laptop. It is gone. A `crons` entry cannot replace it either:
Hobby allows one run per day, and an entry asking for more fails the whole
deployment before it builds.

So the trigger lives outside, and there are **two of them**, both every 15
minutes and both sending `Authorization: Bearer $CRON_SECRET`:

- **cron-job.org** — the primary. Free, accurate to the minute. Note it does
  not follow redirects, so the job URL must be exactly
  `https://rehearsly.me/api/cron/reminders` — no `http://`, no `www.`
- **[.github/workflows/rehearsal-reminders.yml](.github/workflows/rehearsal-reminders.yml)** —
  the backup, using a `CRON_SECRET` repository secret. GitHub drifts 5–20
  minutes and skips runs under load, and disables scheduled workflows after 60
  days without repository activity. Free here only because the repo is public.

Running both is safe, and that is by design — see the claim below.

**Both are switched off since 2026-09-12**, so no reminders go out: a ping every
fifteen minutes kept the Neon compute awake and ran through its allowance (see
the workflow's header). Turning one back on is the owner's decision, and after
R8 it needs migration 011 (`native_push_tickets`) applied first.

**The windows are deliberately wide** — 12–24h ahead for the day-before
reminder, 0–1h for the hour-before — because no free scheduler is punctual.
They used to be narrow bands (23–24h, 50–70min) that only worked under a
metronome: one missed run and a rehearsal crossed the band and was never
announced. Widening is free because each send is *claimed* in
`native_push_reminders` (unique on `rehearsal_id, user_id, reminder_type`), so
overlapping schedulers cannot double-send.

**Each rehearsal is reminded in one transaction** (R8,
`remindRehearsal`): the rehearsal is locked `FOR SHARE` provided it is still due
for this reminder — the same window the run found it in, never the start time
the run read, which comes back through JavaScript to the millisecond while
PostgreSQL keeps microseconds — the people not yet told are claimed in one statement, the
push goes out, and whoever no device took — Expo down, every device refusing —
has their claim and inbox row removed before the commit. A run that stops
half-way commits nothing, so nobody is left claimed and untold; a move of the
rehearsal waits for a send in flight or makes the run skip it; a second
scheduler waits on the first one's claim. Someone with no device at all counts
as told — the inbox row is the delivery.

**Nothing waits on Expo without a deadline.** Every send and receipts request
goes through `expoTransport` — `node:http` with no connection pool, because
fetch's pool reconnected behind the caller's back after an abort — whose
deadline covers the whole exchange and destroys the connection; a send that
runs out of time releases its people for the next run. A run stops starting rehearsals after its budget, and each reminder
transaction sets `idle_in_transaction_session_timeout`, so a stalled process
cannot keep the rehearsal locked: PostgreSQL ends the transaction itself.

**A reminder says when the rehearsal starts**, not "tomorrow" or "in 1
hour": today, tomorrow or the date, and the time, in each reader's own zone
and language (`reminderText.js`, R8 GR04), from the row the transaction holds.
The windows are wide, so fixed words were false whenever a run was late. A
reader whose zone is UTC — never synced — or not a real zone sees "UTC" next to
the time.

**A failed run answers 500**, with the counts and what failed: due rehearsals
that could not be read, a rehearsal whose transaction failed, people whose
devices all refused, receipts that could not be read or tickets not kept. A
quiet night and a broken query used to both answer 200 with zeros. Both
schedulers alarm on the status.

**Receipts are read at the start of every run.** Each accepted push leaves its
Expo ticket in `native_push_tickets`; fifteen minutes on its receipt is read,
and one saying the device is not registered removes that token — unless it was
registered again after the send. A ticket whose receipt Expo no longer holds
(about a day) is dropped.

Auth is fail-closed — without `CRON_SECRET` the endpoint answers 503 rather than
running unauthenticated.

### The Notification Inbox

**Location**: `server/services/notifications/notificationStore.js`,
`server/routes/native/notifications.js`,
`src/features/notifications/screens/NotificationsScreen.tsx`.

Every notification is written to `native_notifications` before it is sent — one
row per intended recipient, including recipients with no device registered, who
would otherwise never learn what happened. Reached from the bell beside the
project filter on the calendar.

Before this a push was a single moment: only the two reminder types left any
trace, in `native_push_reminders`, and that only records that a reminder was
*issued*. Everything else vanished the moment Expo accepted it, and there was
nowhere in the app to re-read what you were told.

Each push carries the id of that recipient's own row, so tapping one marks
exactly that notification read rather than guessing.

**Accepted is not delivered.** `sendPushNotification` answers per person —
`delivered` (Expo accepted it for one of their devices), `undelivered` (they
have devices and none took it), `unreachable` (no device: the inbox row is the
delivery) — and throws when the database fails rather than answer "nobody".
Whether the phone then got it is in the receipt, read by the reminder cron
(above) and used only to drop dead tokens; nothing shows a person their
delivery state.

### The Rehearsal Details Sheet

**Location**: `src/features/calendar/screens/RehearsalDetailsScreen.tsx`, registered
in the root stack in `src/navigation/index.tsx`.

A **route**, not a `Modal` rendered inside a screen, and reached by
`navigate('RehearsalDetails', { rehearsalId })` from anywhere: the calendar, the
list of today's rehearsals, the project screen, a tapped push, the inbox. It
loads the rehearsal itself through `GET /api/native/rehearsals/:id`, so no caller
needs to be holding one.

Both of those were learned the hard way, over a day of chasing the same bug.

**Mixing React Native's `Modal` with the navigator's own modal screens strands a
layer.** Present a sheet over one iOS has not finished dismissing and the screen
underneath stays visible and stops answering touch — force-quitting is the only
way out. There were two `RehearsalDetailsModal`s on the calendar, one inside
TodayRehearsals with its own state, so a sheet opened from the "today" list was
invisible to the code opening one for a notification. As a route, presentation
and dismissal belong to one system and cannot collide. **Do not add another
`Modal` to a screen that can host this sheet.**

**Do not nest `flex: 1` containers inside a `formSheet`.** The sheet does not
hand its children a resolved height, so such a container collapses to nothing
and its children are laid from the same origin — the header behind, the rows
over it. This screen is a single `ScrollView` with `flexGrow: 1` on its content
for that reason.

### Shared State: Seen and Unread

Two contexts exist because the same mistake was made twice with per-screen
copies of the same number.

**`SeenContext`** — who has marked which rehearsal seen, plus the toggle. It was
threaded through props from `useRehearsals` to CalendarScreen to TodayRehearsals
to each card, 39 references across three files, and any screen wanting to show a
card had to be handed its own copy. Cards read it directly now.

The wire and the UI disagree on purpose here: `'no'` means invited and not yet
seen, and having a row at all is what puts you on a rehearsal, so unmarking
sends `'no'` rather than deleting. In state that same thing is `null`.

**`UnreadContext`** — how many notifications are unread, for the bell on the
calendar, the app icon badge and the inbox alike. Four places used to keep their
own answer, so a push arriving while the calendar was open lit the icon and left
the bell at zero.

Two rules it exists to enforce:
- **The badge follows the count**; it is never set beside it. Six call sites used
  to write it, which is six chances to disagree with the bell.
- **A failed request keeps the last known count.** The count is stored on the
  device and read back before the server is asked, and the badge is not written
  until a real number is in hand — otherwise every launch clears it before the
  server answers, which offline is not a flicker but the final answer.

### Admin Dashboard
**Location**: `server/routes/admin.js`, `server/routes/admin/dashboardPage.js`

Password-protected web admin panel at `/admin`. Uses JWT auth via `ADMIN_PASSWORD` env var.

**Features**:
- User stats (total, new this week/month, not signed in for 30 days — sign-ins, not use: a session renews without one)
- Users table with pagination
- Transactions table with pagination
- Bug reports table with inline status management

**Auth**: `server/middleware/adminAuth.js` — bcrypt password login → JWT token (24h expiry)
- Set `ADMIN_PASSWORD_HASH` (bcrypt hash, recommended) or `ADMIN_PASSWORD` (plaintext, legacy)
- Generate hash: `node -e "import('bcrypt').then(b => b.default.hash('yourpassword', 10).then(console.log))"`
- JWT secret uses `ADMIN_JWT_SECRET` or falls back to `JWT_SECRET`

**API Endpoints**:
- `POST /admin/api/login` — authenticate with password
- `GET /admin/api/stats` — aggregate stats: `users`, `signIns` (`notInLast30Days`, `rate`; a never-signed-in user counts from registration), `usage`
- `GET /admin/api/users` — paginated user list
- `GET /admin/api/bug-reports` — paginated bug reports (sorted: new → in_progress → fixed)
- `PATCH /admin/api/bug-reports/:id/status` — update bug report status (new/in_progress/fixed)

### Beta Testing: Bug Reports
**Location**: `src/shared/components/BetaBanner.tsx`, `server/routes/native/bugReports.js`

Global "Test Flight" banner visible on all tab screens during beta testing.

**Frontend**:
- `BetaBanner` component mounted in `TabNavigator` (navigation/index.tsx)
- Shows rocket icon + "Тестовый полёт" / "Test Flight" with "Bug Report" button
- Opens modal with text input, submits to backend
- Automatically captures current screen name via `useNavigationState`

**Backend**:
- `POST /api/native/bug-reports` — create report (requireAuth, body: `{ message, screen }`)
- Table: `native_bug_reports` (id, user_id, message, screen, status, created_at)
- Status values: `new` (default), `in_progress`, `fixed`

**Admin view**: Bug reports appear in admin dashboard at `/admin` with clickable status buttons.

**Removing after beta**: Delete `<BetaBanner />` from `TabNavigator` in `src/navigation/index.tsx` and remove the import.

### Logging Convention
Use `logger` utility instead of `console.log` — automatically suppressed in production:

```typescript
// Frontend: src/shared/utils/logger.ts
import { logger } from '../../../shared/utils/logger';
logger.debug('Loading data:', result);  // hidden in production
logger.warn('Permission denied');       // always shown
logger.error('Request failed:', err);   // always shown

// Backend: server/utils/logger.js
import { logger } from '../utils/logger.js';
logger.debug(`[ServiceName] Step completed`);
```

❌ Never use `console.log` directly in production code — it leaks debug info and can expose sensitive data.

### Security Architecture
Key security measures in place (as of 2026-04-11):

- **Rate limiting**: 20 req/min on `/api/auth/*`, 5 attempts/15 min on `/admin/api/login`
- **Helmet**: Security headers (X-Frame-Options, HSTS, X-Content-Type-Options, etc.)
- **CORS**: Whitelisted origins only (via `BASE_URL` env). Requests without origin (mobile app, Vercel Cron) are allowed through.
- **Cron**: Fail-closed — returns 503 if `CRON_SECRET` not configured
- **Admin password**: bcrypt hash (`ADMIN_PASSWORD_HASH`) with plaintext fallback (`ADMIN_PASSWORD`)
- **Error responses**: Never expose `err.message` or stack traces to clients in production

### Batch API Endpoints
Optimize N+1 queries by loading data in batches:
```javascript
// ✅ Good - Single batch request
GET /api/native/rehearsals/batch?projectIds=1,2,3

// ❌ Bad - Multiple sequential requests
for (const projectId of projectIds) {
  await GET /api/native/projects/${projectId}/rehearsals
}
```

## Common Pitfalls

### 1. Authentication
❌ **Problem**: `Cannot read properties of undefined (reading 'id')`
✅ **Fix**: Change `req.user.id` → `req.userId`

### 2. Database Constraints
❌ **Problem**: `violates check constraint chk_availability_time_order`
✅ **Fix**: Use UTC (`.000Z`) for all-day events, not `+02:00`

### 3. PostgreSQL Boolean Comparison
❌ **Problem**: `operator does not exist: boolean = integer`
✅ **Fix**: Use `TRUE`/`FALSE` for PostgreSQL boolean comparisons, not `1`/`0`

```javascript
// ❌ WRONG - Works in SQLite, fails in PostgreSQL
await db.all('SELECT * FROM plans WHERE is_active = 1');

// ✅ CORRECT - Works in both SQLite and PostgreSQL
await db.all('SELECT * FROM plans WHERE is_active = TRUE');
```

### 4. API URL Configuration
The app auto-detects API URL based on environment:
- **iOS Simulator**: `http://localhost:3001/api`
- **Android Emulator**: `http://10.0.2.2:3001/api`
- **Physical Device**: Auto-detects from Expo debuggerHost
- **Override**: Set `EXPO_PUBLIC_API_URL` in `.env`

Server must listen on `0.0.0.0:3001` (not `127.0.0.1`) for physical device access.

### 5. Xcode Build Configuration
Ensure Xcode scheme uses **Debug** build configuration (not Release):
- File: `ios/Rehearsly.xcodeproj/xcshareddata/xcschemes/Rehearsly.xcscheme`
- Check: `LaunchAction` should have `buildConfiguration = "Debug"`
- Symptom if wrong: `__DEV__` returns false, app connects to production server

### 6. OAuth Implementation (Google & Apple Sign-In)

**Implemented OAuth Providers:**
- ✅ **Google Sign-In** - Fully configured and working
- ✅ **Apple Sign-In** - Implementation ready (requires paid Apple Developer account)

**Architecture:**
- **Frontend**: `src/shared/services/googleAuth.ts` - OAuth flow using `expo-auth-session`
- **Backend**: `server/utils/oauthVerification.js` - Token verification using Google/Apple APIs
- **Account Linking**: `server/utils/accountLinking.js` - Merges OAuth accounts with existing email accounts

**Key Points:**
- OAuth tokens are verified server-side to prevent forgery
- An account is joined or created only through an address the provider says it
  verified, trimmed and lower-cased (`signInWithProvider` in `accountLinking.js`)
- That proof for an account whose address nobody had proven — a pending
  registration, or one from before email confirmation, linked now or long ago —
  confirms the address and revokes every session, live code and push device,
  password or not, and removes a password if there is one (`passwordRevoked:
  true`): otherwise whoever registered someone else's address first keeps a way
  into the owner's account
- A password reset (`/auth/password-reset/*`, emailed code) is the same kind of
  proof: it revokes every session, live code and push device, verifies the
  address and sets the new password. The request answers 202 alike with and
  without an account
- Changing the sign-in address (`/auth/me/email/change`, then `/confirm`) needs a
  code to the current address and a code to the new one, and the password when
  there is one. A password alone is not proof: a session can set a first one and
  unlink Google/Apple. `PUT /me` refuses a new email
- In the app: `ResetPasswordScreen` (from sign-in and from a taken address at
  registration) and `ChangeEmailScreen` (from the profile, where the address is
  read only). Both write a session only through `startSession` in
  `AuthContext`; the address and password rules are in
  `features/auth/utils/accountRules.ts`, counted as the server counts them
- A pending account gets no session: login, refresh, Google/Apple and the auth
  middleware all refuse it
- The middleware checks the session version before the handler, outside any
  lock. A handler that changes credentials or the account (`PUT /me`,
  `DELETE /me`, logout, unlink, push-device registration) checks again with
  `lockSession` under the user row lock, or a request admitted just before a
  revocation acts after it. `lockSession` takes `FOR NO KEY UPDATE`, so foreign
  keys pointing at the user do not wait for it — `FOR UPDATE` deadlocked
  account deletion against rehearsal slot rebuilds
- Check `native_auth_providers` table for account linking status
- Supports multiple providers per user (can link both Google and Apple to same account)

### 7. Push Notifications on iOS Simulator
❌ **Problem**: `Invariant Violation: new NativeEventEmitter() requires a non-null argument`
✅ **Fix**: Wrap notification setup in try-catch blocks

**Root Cause**: iOS Simulator doesn't support push notifications, causing crashes when initializing Expo Notifications module.

**Solution**: All notification-related code is wrapped in try-catch blocks:
```javascript
// In notifications.ts
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ ... }),
  });
} catch (error) {
  console.log('[Notifications] Setup failed (expected on simulator):', error);
}

// In useNotifications.ts
try {
  notificationListener.current = addNotificationReceivedListener(...);
  responseListener.current = addNotificationResponseReceivedListener(...);
} catch (error) {
  console.log('[useNotifications] Listener setup failed (expected on simulator):', error);
}
```

**Files with try-catch protection**:
- `src/shared/services/notifications.ts` - Handler setup
- `src/shared/hooks/useNotifications.ts` - Listener registration and cleanup

### 8. PostgreSQL Timezone Comparisons in Cron Jobs
❌ **Problem**: A scheduled query finds 0 rows even though the timestamps are clearly in the past
✅ **Fix**: Pin the session timezone to UTC and convert explicitly

**Root Cause**: a `timestamp without time zone` column stores no offset, so PostgreSQL
reads it in the session's zone. A server running in Jerusalem (UTC+2) compares
UTC-stored values against local `CURRENT_TIMESTAMP` and silently misses a two-hour band.

```javascript
// 1. Set the session timezone before the query (guard with isPostgres — SQLite rejects it)
if (isPostgres) await db.run("SET timezone = 'UTC'");

// 2. Convert explicitly when writing
await db.run(`UPDATE t SET due_at = ($1::timestamptz AT TIME ZONE 'UTC')::timestamp WHERE id = $2`,
  [date.toISOString(), id]);

// 3. Derive new times from the current instant, not from the stored value
const next = new Date(now);          // ✅
next.setUTCMinutes(next.getUTCMinutes() + 15);
```

**Where it matters now**: `GET /api/cron/reminders` (Vercel Cron, every 15 min) —
it selects rehearsals due soon. An in-process `node-cron` schedule cannot replace
it: Vercel functions do not stay resident, so the schedule never fires.

### 9. `loading` in AuthContext Unmounts the Whole Navigator
❌ **Problem**: a sign-in form's request bounces the person back to Login, or a
screen reached after it (the email code) never appears
✅ **Fix**: forms use `busy` from `useAuth()`; `loading` is only the session
restore at start

While `loading` is true, `RootNavigator` renders a spinner instead of the
`NavigationContainer`, so a request that toggles it unmounts the auth stack
and remounts it at its first route. Logout and account deletion still use it —
they end signed out anyway.

### 10. A date or time picker goes through `PickerModal`
❌ **Problem**: Cancel in a picker keeps the value the wheel was turned to
✅ **Fix**: `PickerModal` (with `usePickerDraft`) holds a draft and calls
`onConfirm` on Done only; Cancel, a tap outside and back leave the owner's value

Every turn of the wheel used to reach the owner, so Cancel was Done (HC02).
Do not put a `DateTimePicker` in a screen directly — there is one picker, and
the rehearsal form and the availability editor both use it.

### 12. A sheet in a `Modal` goes through `ModalSheet`
❌ **Problem**: VoiceOver reads a whole sheet as one button, and a tap on the
sheet's title closes it
✅ **Fix**: `<ModalSheet overlayStyle={…} onClose={…}>` directly inside the
`Modal`; it puts the closing area *behind* the sheet

A touchable wrapped around a sheet makes iOS present everything in it as a
single element — six sheets were built that way, and neither VoiceOver nor the
e2e flows could reach a project, a member action or a picker's Done.
`modalBackdrops.test.ts` refuses a touchable as the first child of a `Modal`.

### 13. Every control can be found without looking at it
- **An icon-only button has an `accessibilityLabel`** (and
  `accessibilityRole="button"`): VoiceOver reads nothing on it otherwise, and a
  flow can only tap it by screen position. `iconButtonLabels.test.ts`.
- **A ScrollView on a screen with a text input sets
  `keyboardShouldPersistTaps="handled"`**: without it the first tap with the
  keyboard up only hides the keyboard — "Create" did nothing on the new-project
  form. `keyboardTaps.test.ts`.
- What a flow needs to find carries a `testID` (`id:` in Maestro); see
  [e2e.md](rehearsal-calendar-native/docs/e2e.md).

### 11. Navigation is typed; a route is never cast
❌ **Problem**: a button navigates to a route that is not there and nothing
happens — no error, no screen
✅ **Fix**: `useNavigation<…>()` with a type from `navigation/types.ts`, never
`<any>`, `as any` or a `@ts-ignore` above a `navigate()`

The nesting — app stack, tabs, a stack per tab — is written down there with
`NavigatorScreenParams`, and screens that leave their own stack have composite
types (`CalendarScreenNavigation`, `ProjectDetailNavigation`, `AppNavigation`).
"Create project" in the rehearsal form asked the Projects tab for a screen it
does not have, behind a `useNavigation<any>()` (R9-03). `typedNavigation.test.ts`
refuses any cast in navigation; `registeredRoutes.test.tsx` requires each
navigator to register exactly what its param list declares — add a screen to
both or the tests fail.

**Leaving a modal screen for the tabs goes back to the `MainTabs` under it,
never to a copy.** In React Navigation 7 `navigate` to a route lower in the
stack but not on top pushes a new one unless told `{ pop: true }`: "Create" on
the new-project form opened the project in a second `MainTabs` presented over
the form, going back showed the form again, and "Create" made a second project
(T-007). So every `navigate('MainTabs', …)` from a modal screen or a push tap
passes `{ pop: true }` (or uses `popTo`); the tabs open the screen named in the
changed params themselves. A screen deep in a tab's stack gets `initial: false`
next to its `screen`, so a tab not opened yet starts at its list and back is
the list. `backToTabs.test.tsx` holds it against the real stack router.

## Environment Setup

### Required Environment Variables

**Process environment** (Backend). Optional local files must be explicitly selected
with an absolute `SERVER_ENV_FILE` path. Do not select this repository's
`server/.env` for development: it contains the production database target.
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...   # Explicit target; use isolated PostgreSQL locally
JWT_SECRET=<generate-with-openssl-rand-base64-32>  # REQUIRED in production

# OAuth Configuration (Google Sign-In)
GOOGLE_CLIENT_ID_IOS=your-ios-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=your-android-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_ID_WEB=your-web-client-id.apps.googleusercontent.com

# OAuth Configuration (Apple Sign-In)
APPLE_CLIENT_ID=com.rehearsal.app
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY=  # Contents of .p8 file or path to file

# Admin Dashboard
ADMIN_PASSWORD_HASH=  # bcrypt hash (recommended). Generate: see Admin Dashboard section above
ADMIN_PASSWORD=       # plaintext fallback (legacy, avoid in production)
ADMIN_JWT_SECRET=     # optional, falls back to JWT_SECRET

# Cron Job (Vercel Cron Jobs)
# CRITICAL: endpoint returns 503 if not set (fail-closed)
CRON_SECRET=<generate-with-openssl-rand-base64-32>

# Server URL (invite links, universal links)
BASE_URL=https://your-app.vercel.app  # required in production
HOST=0.0.0.0  # required for physical device access
```

**.env** (Frontend - Optional)
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001/api  # Override API URL if needed
```

### Database Initialization

PostgreSQL is the only server database. Use the explicit migration CLI described
in [server migrations](rehearsal-calendar-native/docs/server-migrations.md).
It does not discover `.env`; supply process settings or an explicitly selected
absolute `SERVER_ENV_FILE`. `DATABASE_URL` / `POSTGRES_URL` must target the
intended database; `MIGRATION_SCHEMA` selects an existing application schema
(default `public`). The local `server/.env` is production and is not a test input.

```bash
cd rehearsal-calendar-native/server
npm run migrate -- --help       # no environment loading or database access
npm run migrate -- --dry        # read-only inspection, including absent history
npm run migrate -- --fresh      # reviewed canonical snapshot, EMPTY schema only
npm run migrate -- --adopt rehearsly-pg-domain13-v1
npm run migrate -- --apply      # only approved steps from verified history
```

Choose the applicable operation after reviewing dry output. `--adopt` records a
checked existing schema; it does not run business SQL. `--apply` is a separate
operation. `--baseline` is rejected: marking every historical file as executed
would hide missing constraints. Historical SQL files are not auto-discovered or
executed in filename order. Their old ledger remains untouched evidence. Never
run those files by hand: the date conversions cast in the session zone and the
OAuth backfill duplicates on rerun (see `server/migrations/README.md`).

Every write invocation uses one PostgreSQL transaction for schema changes,
postconditions and the new `native_schema_history`, a transaction advisory lock
and bounded target-table locks. A failure before COMMIT rolls back that batch;
an uncertain COMMIT outcome requires inspection, not automatic replay.
Unsupported legacy shapes and duplicate imported keys fail without deleting data.
Fresh and supported upgrades are verified on disposable PostgreSQL by required CI.

Migrations are **not wired into startup or deployment**. Production inspection,
adoption, migration and deployment require the owner's separate decision under
[the access rules](audit/PRODUCTION_ACCESS.md). Actual production schema/history
cannot be inferred from a local fixture or an old claim that baseline ran.

## Testing

**Both suites are green.** `npm test` from `rehearsal-calendar-native` runs the
frontend and the server together: 650 tests across 47 suites, zero failures.
Anything red is new. (The three long-standing failures in
`TodayRehearsals.test.tsx` are gone as of 2026-09-01.)

Route-level and service-level tests are the ones that catch things. Several
older suites drive SQL directly or assert against rows they wrote themselves,
which is why bugs in the layer above them — the order of two calls inside a
service, what a handler returns — stayed invisible for months. Prefer going
through the function under test.

Two defects found in one week were invisible to every SQL-level test and
obvious the moment a request went through the router: the calendar import
deleting hand-entered availability, and a removed member keeping access to a
project's rehearsals. Both live in what the handler *decides*, not in what the
SQL does.

**Jest runs in `America/New_York`** (`jest.config.js`). A date-only value read
as an instant — `new Date('2026-09-10')` — is the day before only west of UTC;
east of it (this machine) and in UTC CI the mistake passes every test.

The SQLite harness in `__tests__/integration/setup.js` translates the
PostgreSQL dialect the routes are written in. It covers only the constructs
actually used; anything else surfaces as a `SqliteError`, which is the signal to
extend it rather than to work around it in the test.

### Frontend Tests
```bash
cd rehearsal-calendar-native
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run type-check          # TypeScript validation
npm run lint                # ESLint
```

### Backend Tests
```bash
cd rehearsal-calendar-native/server
npm test                    # Run all tests
npm run test:coverage       # With coverage
```

### End-to-End (Maestro)
```bash
cd rehearsal-calendar-native
npm run e2e                 # flows in e2e/flows on the "Rehearsly E2E" simulator
npm run e2e:up              # stay up for Maestro MCP / Studio until Ctrl-C
```
Everything is local and thrown away: a PostgreSQL container, the server with an
environment built from nothing, its own Metro, a Debug build, a seed made
through the API. See [e2e.md](rehearsal-calendar-native/docs/e2e.md).

**Setting `EXPO_PUBLIC_API_URL` does not decide where a dev build talks.** In
development Expo bundles the project's `.env` files and lets them win over the
environment, and this checkout's `.env` names production. The runner keeps
`.env*` out of its bundle (`REHEARSLY_E2E=1` in `metro.config.js`), refuses a
bundle carrying any other address, and stops everything if the app reports
one. Never point the simulator app at a Metro the runner did not start.

## Autonomous Development

`tools/autodev/supervisor.mjs` runs Claude Code (developer) and Codex ("Astra",
reviewer) through the owner's queue in `AUTODEV/TASKS.md`: develop → guard →
checks → review (≤ 2 rounds) → push of `auto/main`, in its own worktrees
(`../reh_app-auto`, `../reh_app-auto-review`). It waits out subscription limits
and continues the same session; it pauses the whole queue for the owner on
migrations, auth, `.env`, production, keys, red checks after three attempts or
no agreement after two rounds. Reports, one per task, and `STATUS.md` are in
`AUTODEV/` (not in git). See [tools/autodev/README.md](tools/autodev/README.md).
Codex gets no model or reasoning flags; Claude a whitelist with `dontAsk`.

## Documentation

Key documentation files:
- [rehearsal-calendar-native/docs/README.md](rehearsal-calendar-native/docs/README.md) - Documentation index
- [rehearsal-calendar-native/docs/quick-reference.md](rehearsal-calendar-native/docs/quick-reference.md) - Quick reference for common errors
- [rehearsal-calendar-native/docs/known-issues.md](rehearsal-calendar-native/docs/known-issues.md) - Defects found and deliberately left for later
- [rehearsal-calendar-native/docs/api-documentation.md](rehearsal-calendar-native/docs/api-documentation.md) - Complete API reference
- [rehearsal-calendar-native/docs/api-standards.md](rehearsal-calendar-native/docs/api-standards.md) - API conventions

## Tech Stack

**Frontend**: React Native 0.81.5, Expo SDK 54, TypeScript, React Navigation 7.x
**Backend**: Node.js 18+, Express.js 4.21.2, JWT authentication
**Database**: PostgreSQL server runtime; SQLite isolated test fixtures only
**Testing**: Jest, @testing-library/react-native
**Languages**: Russian, English, Spanish, German (full i18n support). A new key goes into the interface and all four locale blocks in `src/i18n/translations/` — the type will not compile otherwise.

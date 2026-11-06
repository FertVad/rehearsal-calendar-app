# T-045: outdated descriptions in docs/ and root .md files

Scope: `rehearsal-calendar-native/docs/*.md`, `CLAUDE.md`, `AGENTS.md`
(not `audit/`). Every claim below was checked against the code before the
change.

## How it was searched

Four throwaway Node scripts (outside the repo) over the documents:

1. Markdown links → the file must exist (relative to the document).
2. Backticked repo paths (`server/…`, `src/…`, `e2e/…`, …) → must exist.
3. `UPPER_CASE_NAMES` → must occur in code; backticked `camelCase` /
   `PascalCase` identifiers and `…Screen/Context/Provider/Navigator/Modal/Sheet`
   names → must occur in non-test code.
4. `METHOD /path` → a router with that method whose path is a suffix of it.
5. `npm run <script>` → a script in the app's or the server's package.json.

The hits were then read by hand; the rest of the documents were read where
they describe behaviour (CSP, receipts, RSVP, tech debt, admin, planner).

## Fixed

| Document | Was | Now / why |
|---|---|---|
| docs/services.md | `RESEND_API_KEY`, `MAIL_FROM` — "письма молча не уходят" | `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `EMAIL_FROM` → 503 (`services/email/transport.js`); added `EMAIL_CODE_SECRET` (`services/email/codes.js`, falls back to `JWT_SECRET`) |
| docs/services.md | Neon: "Четырнадцать таблиц" | 23 `native_*` tables in `init-native-schema.sql` |
| docs/services.md | `APPLE_CLIENT_ID` read in `utils/oauthVerification.js` | read in `config/appleAuth.js`, used by `oauthVerification.js` |
| docs/services.md (×2), docs/known-issues.md | push receipts "never fetched" | `checkPushReceipts` reads them at the start of every reminder run and drops dead tokens (`reminderScheduler.js`) |
| docs/known-issues.md | "/admin runs under a relaxed CSP … inline onclick" | removed: one strict policy (`middleware/securityHeaders.js`, `script-src-attr 'none'`), no `onclick` in `dashboardPage.js`, held by `adminHttp.test.js` |
| docs/known-issues.md | 9 unverified candidates already fixed | removed: DST day walk (intro says fixed), import deleting on a failed calendar (intro), launch tap replay (`handledLaunchResponse`), availability `today` (`useToday`), unread badge across users (session state, NI03), "Rehearsal tomorrow" (`reminderText.js`), failed run reported 200 (`cron.js` answers 500), project notifications navigate nowhere (`projectId` fallback), failed inbox load shown as empty (`loadError` state) |
| docs/app-store-release.md | 0.1 "Сейчас плагин лежит в `_disabled_plugins`" + JSON to paste | `expo-notifications` is in `plugins` (app.json); kept the `prebuild --clean` note |
| docs/app-store-release.md | tech-debt list: admin CSP relaxation; route tests only for members/projects; ESLint 9 not running; check-secrets flags itself; better-sqlite3 on Node 20 | section removed: strict CSP (above); 36 suites in `server/__tests__/routes/`; `eslint.config.js`; `check:secrets` passes; Node 26 and the suite runs |
| docs/api-standards.md | "All async routes MUST have try-catch" | every async route goes through `middleware/asyncHandler.js` (all 16 route files; `asyncBoundary.test.js`) |
| docs/api-standards.md | "All route files now use `$N` syntax consistently" | not so (`routes/native/pushTokens.js` uses `?`) |
| docs/api-standards.md | logging with `console.log('[RouteName] …')` | `logger` from `server/utils/logger.js`, as CLAUDE.md's Logging Convention says |
| docs/api-documentation.md | Seen: `response: "yes" \| null`, "No 'no'", "Sending null deletes the response record" | `'yes' \| 'no'`; rows are never created or deleted by answering; anything else is `400 RESPONSE_INVALID` (`rsvpService.js`) |
| docs/README.md | empty "Setup Guides" table; e2e.md, server-runtime.md, server-migrations.md not listed | the three listed; no broken links |
| CLAUDE.md | `useRSVP` translates null ↔ 'no' | no such hook: `toggleSeen` in `src/contexts/SeenContext.tsx` |
| CLAUDE.md | `RootNavigator` renders a spinner | the root `Navigation` in `src/navigation/index.tsx` |
| CLAUDE.md | env block with `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`; no email variables | the server reads only `APPLE_CLIENT_ID`; added `EMAIL_TRANSPORT`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_CODE_SECRET` |
| CLAUDE.md | admin "Transactions table with pagination" | payments are gone; no such table or route |
| CLAUDE.md | planner categories Perfect/Good/Possible/Difficult with 100/80/50 % | `perfect`/`good`/`ok`/`bad`: 0, ≤25 %, ≤50 %, >50 % busy (`categorizeSlot`) |
| CLAUDE.md | i18n "(Russian/English)" | four languages |
| CLAUDE.md | "650 tests across 47 suites" | count dropped (frontend alone is 1294 tests in 134 suites today) |

## Hits left as they are (checked)

- `requireSubscription`, `RehearsalDetailsModal`, `SqliteError` — named as
  removed/historical, or the harness's error class from better-sqlite3.
- `appleId`, `ascAppId`, `appleTeamId`, `installCommand`, `timeoutInterval`,
  `LaunchAction`, `buildConfiguration`, `NativeEventEmitter`, `DEVELOPMENT_TEAM`,
  `TARGETED_DEVICE_FAMILY` — keys of eas.json/Vercel/Xcode/iOS, not our code.
- `APPLE_TEAM_ID` etc. in services.md / app-store-release.md — mentioned as
  *not needed*, which is right.
- `server/.env`, `e2e/out`, `e2e/.build` — git-ignored, exist locally only.
- Routes `GET /native/projects`, `POST /native/bug-reports`, … — routers on
  `'/'`; `GET /code` is the e2e mailbox.

# Public and admin rendering regressions (H01/H02)

The required `npm test` command in both application and server packages includes
admin, invite and persisted-content browser suites. The application's `npm run check` runs secret scanning,
TypeScript checking and that same full test command. Jest filename matching does
not control the browser stage: `server/scripts/test.mjs` explicitly executes it.

From a fresh checkout, use Node **22.16.0** (pinned in the repository `.nvmrc`
and CI) for both dependency installation and test execution. `better-sqlite3`
is a native module and cannot load a binding built for another Node ABI.
The earlier H01 evidence used Node 20.19.2; that historical runtime is not the
clean-install requirement. Locked React Native/Metro dependencies require at
least Node 20.19.4, and Node 22.16.0 satisfies all declared Node engines in both
lockfiles. Reinstall dependencies after switching Node major versions.

```sh
cd rehearsal-calendar-native
nvm use
npm ci
npm ci --prefix server
npm run check
```

The first run automatically installs the Chromium version required by the
locked Playwright dependency. Later runs reuse it. The initial download needs
network access; an installation error, absent executable or failed launch makes
the command fail. Browser checks are never silently skipped. On a fresh Linux
machine, install the OS libraries before running the check:

```sh
npm --prefix server run test:browser:install -- --with-deps
```

The `Application checks` GitHub Actions workflow runs on pushes and pull
requests, installs both lockfiles plus Chromium/Linux libraries on Ubuntu 24.04,
then executes the same `npm run check`. It does not require repository secrets.
Making this job a required merge check is a repository branch-protection setting.

For targeted diagnosis, run from `rehearsal-calendar-native/server`:

```sh
npm run test:admin-browser
npm run test:invite-browser
npm run test:admin-stored-browser
```

Both targeted commands also prepare Chromium automatically. An existing
Chrome/Chromium can be selected explicitly without downloading a browser:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm test
```

An invalid or empty override is an error; the runner does not silently switch
to another browser. CI uses Playwright's pinned Chromium rather than an override.
`npm test -- --selectProjects backend` at the application level forwards the
selection only to the initial Jest stage; **all browser suites still run**.
Jest runs serially by default to bound memory use; explicit Jest worker flags
override that default. `npm run test:unit -- <Jest arguments>` is the explicit
faster Jest-only command in either package and does not certify the browser
regression. Existing watch/coverage commands are also development-only checks.

`test:admin-browser` checks the actual page/assets using controlled API responses:
literal rendering **without CSP**, then the production security middleware,
asset MIME types, nonce behavior and normal login/pagination/status/logout flows.
Outbound browser requests are blocked. A missing browser or launch failure fails
the suite; it is not silently skipped.

`test:invite-browser` serves the real `createApp` invite route and assets without
initializing a database. It refuses inherited `DATABASE_URL`/`POSTGRES_URL`.
Under the real CSP it checks styling, automatic-attempt fallback, trusted mouse
and keyboard anchor activation, exact short/legacy codes, RU/EN, Expo targets,
hostile inputs, and a usable manual link without JavaScript or its asset.
The fixture suppresses manual custom-scheme navigation after recording the
trusted anchor action; delivery to an installed app is not a desktop assertion.
The physical Safari/messenger scenario is tracked separately in DEV-15.

`test:admin-stored-browser` also checks authenticated profile/report writes,
SQLite persistence and real admin handlers before opening those stored values
in Chrome under the production CSP. Its fixture replaces the database adapter
with SQLite `:memory:` and fails on external OAuth/push calls. It does not test
the production PostgreSQL adapter or a deployed server.

The first Jest stage checks persistence without launching a browser. The
required browser stage then reruns those cases with `ADMIN_BROWSER_CHECK=1`,
set by the runner regardless of the caller's environment. Both suites use
temporary loopback listeners, synthetic credentials and isolated browser
profiles. They never import the application entry point or load `.env`.
Neither suite needs a phone or real admin credentials. Before a release, also
check the deployed admin page's CSP and that both assets return 200; a local
fixture cannot verify deployment packaging, CDN headers or caches.

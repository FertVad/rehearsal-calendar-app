# Admin rendering regression (H01)

Run from `rehearsal-calendar-native/server` with Node 20 or newer. These tests
never import the application entry point or load `.env`. They use temporary
loopback HTTP listeners, synthetic credentials and isolated browser profiles.
Use the same Node major version for installing dependencies and running tests:
`better-sqlite3` is a native module. This checkout was verified with Node
20.19.2; an installation built for it cannot be loaded by a different Node ABI.

Install dev dependencies with `npm ci`, then install a test browser once:

```sh
npx playwright install chromium
npm run test:admin-browser
npm run test:admin-stored-browser
```

An existing Chrome/Chromium can be used without downloading another browser:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:admin-browser
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:admin-stored-browser
```

`test:admin-browser` checks the actual page/assets using controlled API responses:
literal rendering **without CSP**, then the production security middleware,
asset MIME types, nonce behavior and normal login/pagination/status/logout flows.
Outbound browser requests are blocked. A missing browser or launch failure fails
the suite; it is not silently skipped.

`test:admin-stored-browser` also checks authenticated profile/report writes,
SQLite persistence and real admin handlers before opening those stored values
in Chrome under the production CSP. Its fixture replaces the database adapter
with SQLite `:memory:` and fails on external OAuth/push calls. It does not test
the production PostgreSQL adapter or a deployed server.

The same persistence tests run during ordinary Jest runs without launching a
browser; `ADMIN_BROWSER_CHECK=1` explicitly enables their browser assertions.
Neither suite needs a phone or real admin credentials. Before a release, also
check the deployed admin page's CSP and that both assets return 200; a local
fixture cannot verify deployment packaging, CDN headers or caches.

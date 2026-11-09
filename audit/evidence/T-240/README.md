# T-240 — a request after a change of network stays on a dead connection

Base: `f03caad`. Fix: `4b71985` (+ the follow-up commit with the `+load` fix of
`RehearslyConnections.m`, these notes and docs/e2e.md).

## Mechanism (phone log, `AUTODEV/notes/T-240-phone-log.txt`)

- 18:53:02 `POST /auth/google` on connection 7 (`reused=1, reused_after_ms=15357`),
  opened on LTE before the switch to 5G (`pdp_ip0[endc_sub6]`); no byte back,
  `-1001` after 10.005 s.
- 18:53:33 the second try on the same connection 7 (`reused_after_ms=20711`);
  TCP gives up at 18:53:40 (`[1:60]` ETIMEDOUT), `can retry(N)`: iOS does not
  send a POST again.
- 18:53:51 Apple sign-in on a **new** connection 13: success.

React Native sends every request through one NSURLSession (made privately by
`RCTHTTPRequestHandler`, `node_modules/react-native/Libraries/Network`). Its
pool kept connection 7 as ready after the change; nothing in the app could
tell it otherwise.

## Options checked

1. **HTTP/3 (`assumesHTTP3Capable`) — not taken.** To rehearsly.me iOS opened
   h2 both times (C7, C13) while to Google it used h3: iOS goes to h3 once a
   server advertises it (Alt-Svc / HTTPS record), and after many requests to
   rehearsly.me it never did. So the domain does not offer h3 to the app, and
   forcing the attempt gains nothing — QUIC migration needs the server's side.
   Vercel's documentation could not be read from this session (no web access);
   no request was made to rehearsly.me. If Vercel later serves h3, nothing here
   stands in the way.
2. **Flush the pool + repeat what is safe — taken.**
   `-[NSURLSession flushWithCompletionHandler:]` "ensures that future requests
   occur on a new TCP connection", leaves requests in flight and keeps cookies
   (unlike `reset`). `plugins/connection-renewal/RehearslyConnections.m` notes
   React Native's session as it is made (its delegate is
   `RCTHTTPRequestHandler`) and flushes it on every `NWPathMonitor` path change
   (before a request meets a dead connection) and on `RehearslyConnections.renew()`.
   `api.ts`: a request with no answer (`gotNoAnswer`: timeout / ERR_NETWORK)
   flushes, then sends a GET or a sign-in (login, Google, Apple — the server keeps
   no one-time use of provider tokens) again once. Changes are not repeated; the
   person's next tap takes a new connection. `/auth/refresh` is not repeated (the
   pair rotates) but flushes.

Retry is on any no-answer, not only timeouts: on the simulator the silent
connection ended as `Network Error`, not as a timeout (metro.log below).

## Jest — red on base, green on the fix

Files of the fix put back to `f03caad` (`api.ts`, `authErrors.ts`,
`requestError.ts`), the new tests kept:

```
FAIL frontend src/shared/utils/__tests__/requestError.test.ts
  ✕ does not call a failure that got through "no connection"
FAIL frontend src/features/auth/utils/__tests__/authErrors.test.ts
    ✕ does not call a failure that got through "no connection" in ru / en / es / de
FAIL frontend src/shared/services/__tests__/api.deadConnection.test.ts
  ✓ an answer, even a refusal, is not a dead connection: nothing is flushed or sent again
    ✕ a Google sign-in that heard nothing is sent again, on a new connection, and goes through   (×2: ECONNABORTED, ERR_NETWORK)
    ✕ so are a sign-in with a password, with Apple, and a read                                   (×2)
    ✕ a change is not sent again by the app, and the next try goes down a new connection        (×2)
    ✕ a sign-in is sent again only once: no answer twice is the network                          (×2)
FAIL frontend src/features/auth/screens/__tests__/LoginFlow.test.tsx
  ✕ a session that ended is said under the fields, once
Tests:       14 failed, 35 passed, 49 total
```

On the fix: `Tests: 49 passed, 49 total`; the whole frontend project
`142 suites, 1393 tests passed`; `tsc --noEmit` clean; `knip` clean.

## e2e — flow 82, red on base, green on the fix

`e2e/flows/82-sign-in-after-network-change.yaml`, hold-answers `DEAD` + `ONCE`
on `POST /api/auth/login` (the network changes: open connections go silent).

**Red** — run before any change of the app (base code, native and JS),
artifacts `e2e/out/artifacts/2026-11-09_222239`:

```
[Failed] A sign-in on a connection the network left behind goes through (2m 13s) (Assertion is false: id: login-submit is not visible)
server.log: [e2e] the network changed: POST /api/auth/login on connection #3 and 0 other connection(s) went silent
metro.log:  Request: POST /auth/login
            Response Error: Network Error POST /auth/login
```
The screen at the failure: the sign-in form with "No connection to the server.
Check the internet and try again" (`screenshots/step-033-assertCondition-login-submit.png`).

**Green** — on the fix, artifacts `e2e/out/artifacts/2026-11-09_233427`:

```
[Passed] A sign-in on a connection the network left behind goes through (1m 26s)
server.log: [e2e] the network changed: POST /api/auth/login on connection #3 and 0 other connection(s) went silent
            [e2e] POST /api/auth/login on connection #4, a live one
metro.log:  Request: POST /auth/login
            Response Error: Network Error POST /auth/login
            [Network] connections renewed (flushed: true)
            No answer to POST /auth/login; sending it again on a new connection
            Request: POST /auth/login
            Response: 200 POST /auth/login
```
`flushed: true` is the native module, linked into the app, having found React
Native's session and flushed it. Screenshot `82-signed-in-after-network-change.png`
in that run: the calendar.

What the simulator cannot show: its server is HTTP/1.1 on 127.0.0.1, where a
request iOS gives up on closes its connection anyway, so the flush and the
plain repeat are not told apart there; on HTTP/2 (production) the flush is what
keeps the repeat off the shared dead connection. The path monitor's flush needs
a real change of network (device).

## Other flows run on the fix (hold-answers.js changed; GET now repeated)

```
[Passed] An admin edits and deletes from the details (52)
[Passed] Inbox load and read fail (34)
[Passed] Switch accounts - count and language (16)
[Passed] A create tapped again after its answer was lost makes one project (13)
[Passed] An invite with no network says so in the account's language (80)
[Passed] Availability saves the day it changed (10)
[Passed] A sync whose import fails still exports (30)
```

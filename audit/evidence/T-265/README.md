# T-265: the server can require a newer app build

Base: `ca69bc2`. Fix: `f5af6da` (server), `71769a1` (app), then the e2e flow
and docs commit.

## Jest, red before and green after

Server, `server/__tests__/routes/appBuild.test.js`, through the real app and
its mounts (`createApp` with a database runtime whose every call is watched):

- on `app.js` of `ca69bc2` (`git restore --source=ca69bc2 -- server/app.js`):
  `Tests: 14 failed, 12 passed, 26 total` — every 426 case, the version check
  and the unset/0/not-a-number cases fail; the "not the app's" routes pass, as
  they must on both.
- on HEAD: `Tests: 26 passed, 26 total`.

App, `src/navigation/__tests__/updateRequired.test.tsx` (the real API client's
interceptors and the real navigation root):

- on `api.ts` and `navigation/index.tsx` of `ca69bc2`:
  `Tests: 6 failed, 1 passed, 7 total` (the one passing: other refusals leave
  the app as it is).
- on HEAD: `Tests: 7 passed, 7 total`.

Whole frontend project: `Tests: 1603 passed, 1603 total`. Whole server project:
`1170 passed, 8 failed`, the 8 all in `startup/runtimeStartup.test.js`, which
fails the same 8 on the base `app.js` here: its fixture writes a `.env` into a
temporary folder and this sandbox refuses every read of a `.env`
("Unable to load the explicitly selected server environment file").

## e2e, flow 97

`e2e/flows/97-update-required.yaml` on the real app on the simulator, against
the local server, whose minimum the flow raises above the app's build (5 → 6)
through the mailbox (`/min-build`, read by the server's own middleware).

- On the app files of `ca69bc2` (`src/shared/services/api.ts`,
  `src/navigation/index.tsx`), the server new:
  `[Failed] Update required, then not (1m 24s) (Assertion is false: id: update-required is visible)`
- On HEAD: `[Passed] Update required, then not (2m 16s)`; server.log:
  `[e2e] MIN_IOS_BUILD=6: the app's build 5 is refused`, then
  `[e2e] MIN_IOS_BUILD unset: every build is answered`.
- Shared code touched (API client, navigation root): flows 01 and 15 passed
  (`2/2 Flows Passed in 1m 59s`).

Screenshots from the passing run:

- `97-update-required.png` — on return to the foreground with the minimum raised
- `97-update-required-on-launch.png` — on a cold launch, the same
- `97-signed-in-after-the-update.png` — minimum lowered, next return: the
  calendar, still signed in

## Review 1

**An invite opened under the update screen was lost.** The root counted the
app stack as mounted while the update screen stood in its place: the queued
invite's timer found no navigator, and when the screen came down nothing tried
again — the calendar opened instead of the invitation. "Mounted" is now what
the render mounts: not under the update screen and not under the spinner
(`src/navigation/index.tsx`).

- Jest, `updateRequired.test.tsx`, new case "an invite opened while it is up
  waits, and opens once it comes down" (the mocked container's ref is set while
  mounted and empty once not, as the real one): on `index.tsx` of HEAD
  `Tests: 1 failed, 7 passed, 8 total` (the new case: `JoinProject` never
  navigated to); fixed: `8 passed`. All navigation suites: `48 passed`.
- e2e, flow 97 extended (tag `invite`): with the update screen up, the
  Twelfth Night invite link is opened; the screen stays; the minimum lowered,
  the return opens the invitation.
  - on `index.tsx` of HEAD: `[Failed] Update required, then not (2m 47s)
    (Assertion is false: "Twelfth Night", id: join-project-name is visible)`
  - fixed: `[Passed] Update required, then not (2m 12s)`
  - `97-invite-after-the-update.png` — the invitation, opened after the update
    screen came down.

**The texts read language by language:** `proofreading.md`. No string changed;
there it is also said how they were read (in this session, not by separate
agents).

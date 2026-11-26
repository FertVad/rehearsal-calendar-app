# T-420 - flow 107's wait after "Rate Rehearsly"

Flow 107, run alone, failed at "Rate Rehearsly" in one run of two (T-418's
082731 and 084243): `Assertion is false: ".*apps\.apple\.com.*" is visible`.
The app was right; the wait was for a state the page leaves by itself.

## The cause, from the logs

`order.mjs` puts side by side, for each link the app handed to iOS:
SpringBoard's "Handling OpenURL from Rehearsly", Safari's main-frame load
(`didStartProvisionalLoadForFrame`), apps.apple.com's hand-over to the App
Store (WebKit Networking: `Unable to convert "itms-appss" to port`), the load's
end (`didFailProvisionalLoadForFrame ... code=102`), and every read of the
screen by Maestro's driver (`xctest_runner_*.log`: which app's tree, start and
done). Run 082731 (`red-082731/`, copied from the monitor's
`AUTODEV/notes/T-420-red`), host time +02:00:

- 08:31:22.8 the tap; 08:31:24.4 SpringBoard hands the link to Safari.
- 08:31:26.1 the wait begins. Safari is still starting: its WebContent,
  Networking and GPU processes took 1.3 s to launch (to 27.8), the Launch
  Services database came at 28.1.
- 08:31:29.420 Safari starts loading apps.apple.com - 5.0 s after the link.
- 08:31:29.637 apps.apple.com answers with the hand-over to itms-appss://,
  0.2 s into the load; 08:31:30.059 the load ends with no page committed
  (code 102, frame load interrupted), and Safari says "Safari cannot open the
  page because the address is invalid." over an empty field (step-133).
- No page of apps.apple.com was ever shown. The site's name was in the
  address field only while the load ran: 0.64 s.

Why the first 3.5 s of the wait (26.1-29.6) never saw the site: there was
nothing to see - Safari had not begun the load - and Maestro was not reading
Safari. With Rehearsly still counted as running ("Detected running apps:
[com.rehearsal.app, com.apple.mobilesafari]") the driver read Rehearsly's
tree, five times; the last of these sat 2.26 s in "Fetch status bar
hierarchy" (27.39-29.64). The first read of Safari began at 30.113, 0.05 s
after the load had failed; all 116 reads of Safari were after the leap.

At 084243 one read of Safari (08:46:45.344-45.607) fell inside the 0.41 s
load, the field named the site, and the flow passed. Same page, same leap:
which came first, a read or Apple's answer, decided the run. Every kept run
shows it: the load lasted 0.2-0.6 s and no page ever committed (`red-before.txt`,
`green-after.txt`).

## The change

`e2e/subflows/safari-from-app.yaml`, run by flow 107 after the tap: wait for
Safari's address field (`id: TabBarItemTitle`, 20 s as before), then "Return to
Rehearsly" (`id: breadcrumb`). The field is in Safari's tree while Safari
starts, while the page loads and under the alert after the leap, and only in
Safari's - so the wait passes once Maestro reads Safari, not the app behind
it, whatever the page is doing. The breadcrumb says Rehearsly opened it. The
address is still checked exactly by `opened-url.js` from SpringBoard's log.
The steps before the tap are unchanged; no limit raised, nothing retried. The
flow's last screenshot is `107-safari-from-rate-row` (what it shows depends on
the order, so it is not named for a page). `docs/e2e.md`, "A link to an app the
simulator does not have".

## The same class elsewhere

The other Safari flows (44, 70, 98) wait for pages of our own server:
- 44: the support page (".*support@rehearsly.me.*") and `/privacy?lang=ru`
  ("Политика конфиденциальности") - static pages; nothing in them navigates.
- 70: `/privacy` in four languages at their anchors - the same static page.
- 98: `/invite/<code>`. Its script (`server/public/invite-page/invite.js`) does
  try to leave, `location.assign(rehearsly://...)`, but Safari asks first
  ('Open this page in "Rehearsly"?') and the flow answers Cancel; the page
  stays, and after 2-2.5 s shows the steps for good (`showManual`). The flow
  waits for ".*Rehearsly.*" (the page's title or the question - both stay
  until answered) and then "Open in the App Store", which, once shown, stays.
  Its App Store button is seen, not followed.
The only other `location`-changing script among the server's pages is that
one (grep of `server/src` and `server/public`). So none waits for a state its
page leaves by itself; flow 107 was the only one, and the subflow is the one
mechanism for such a link.

## Checks

- `red-before.txt` - the probe `probe-leap-then-wait.yaml` (waits for the
  alert after the leap, then the wait under test) with the subflow holding the
  old wait (`old-wait.yaml`): red, every time by construction; screen in
  `probe-red-104908/` - step-091 is the failed wait; step-083 (the repeat)
  and step-089 (the subflow) are the same screen, which Maestro saves again
  for each step the failure ended; step-018 is the empty sign-in form at the
  optional check of the email field in sign-in-form.yaml. Kept as the runner
  wrote them.
  The monitor's 082731 and 084243 timed.
- `green-after.txt` - the same probe with the new wait: green, two taps;
  flow 107 alone five times, each its own boot: five green, both orders
  among them (111648 read Safari only after the leap; 110229 during the
  load; three before the load began), T-410 and T-414 held.
- `grep-logs.mjs` - prints matching lines of plain or .gz logs.
- `copy-evidence.mjs` - how the files here were copied.

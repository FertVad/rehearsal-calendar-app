# T-038 — flow 70: Resend on the privacy page, as Safari shows it

`e2e/flows/70-privacy-lists-resend.yaml` opens the local server's `/privacy` in
the simulator's Safari and checks the Resend line in English. It then switches
to Русский, Español and Deutsch with the page's own buttons and checks the line
in each language, with screenshots `70-privacy-{en,ru,es,de}`.

## Why the e2e server changed

On the first runs the page stayed in English: `?lang=ru` and the language buttons
did nothing. The server's CSP has `upgrade-insecure-requests`. On the local
http server, Safari therefore fetched `/legal.js` from
`https://127.0.0.1:3001`, which is not there, and the page had no script.
Production runs on https, where the directive changes nothing.
`e2e/server-with-mailbox.mjs` now takes out only that directive from the
answers the local server gives. `server/` is unchanged. With that change the
same flow passed with no taps taken again, which confirms the cause.

## Red: the page before the fix

```
git restore --source=f9789f9^ -- server/public/privacy.html
npm run e2e -- e2e/flows/70-privacy-lists-resend.yaml

[e2e] running the flows
Waiting for flows to complete...
[Failed] Privacy policy lists Resend in every language (1m 24s) (No visible element found: ".*sends the emails with your codes.*Ireland.*")

1/1 Flow Failed
```

A flow stops at its first failure, which here is English. The red for each of
the four languages separately is in `jest-red-green.md` (12/12).

## Green: the page as committed

```
git restore --source=HEAD -- server/public/privacy.html
npm run e2e -- e2e/flows/70-privacy-lists-resend.yaml

[e2e] running the flows
Waiting for flows to complete...
[Passed] Privacy policy lists Resend in every language (3m 44s)

1/1 Flow Passed in 3m 44s

[e2e] taps taken again (tap-and-see.yaml): 0
```

## The changed e2e server, under the sign-in flow

```
npm run e2e -- e2e/flows/01-login.yaml
[Passed] Sign in (1m 34s)
1/1 Flow Passed in 1m 34s
```

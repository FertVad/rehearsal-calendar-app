# T-291 — first launch in the phone's language; an Apple/Google account gets the language shown

Fix: `43f9510`. Base for red-before: `32ca8f0` (the seven source files are the
same at `32ca8f0` and at `ffc81af`, the HEAD the fix went on). Node 22,
run in `rehearsal-calendar-native`.

Source files of the change: `src/shared/utils/storage.ts`,
`src/contexts/I18nContext.tsx`, `src/shared/services/api.ts`,
`src/contexts/AuthContext.tsx`, `src/features/auth/screens/LoginScreen.tsx`,
`server/routes/auth.js`, `server/utils/accountLinking.js`.

## Red before (32ca8f0)

Those files restored with `git restore --source=32ca8f0 -- …`, the new tests
and flow kept, then `git restore --source=HEAD -- …`.

Client Jest (`npx jest --selectProjects frontend --testPathPatterns
'I18nContext|ProviderSignInLanguage'`): 8 failed, 5 passed of 13.

- `I18nContext.test.tsx`, "the first launch": phone [he, ru] → got en, not ru;
  [es-MX] → en, not es; [de-AT, ru] → en, not de; "signing into an account in
  English" — the start was en, not ru; `appLanguage()` for the calendar export
  → en, not es. Passed already, as guards: [he] → en, no answer → en, a stored
  de over a phone in ru, and the two HC01 tests.
- `ProviderSignInLanguage.test.tsx` (real I18nProvider, LoginScreen,
  AuthProvider and API client; network stand-in): Apple on a Russian phone —
  the app was en; Google — the request had no `locale`; a stored de — the
  request's `locale` undefined.

Server Jest (`server`: `NODE_OPTIONS=--experimental-vm-modules npx jest
__tests__/routes/providerSignIn.test.js`): 2 failed, 23 passed —
"google/apple creates the account in the language the app sent" (got en).
The English defaults ('xx', none, an object, 'RU') and "an existing account,
signed into or linked by its address, keeps de" passed already: they guard
that the fix changes only new accounts.

e2e (`npm run e2e -- e2e/flows/100-first-launch-phone-language.yaml`):

```
[Failed] First launch in the phone's language (50s) (Assertion is false: "Войти" is visible)
1/1 Flow Failed
```

## Green (43f9510)

- Same client tests 13/13; whole frontend Jest 159 suites, 1699/1699.
- `providerSignIn.test.js` 25/25; whole server Jest 1445 passed, 8 failed —
  `runtimeStartup.test.js`, the same 8 as on the base: its fixture writes a
  `.env` and this sandbox forbids reading `.env` files (see T-293).
- `npm test` stops at its first step, `check-secrets.test.mjs`: the synthetic
  git fixture gets exit 128 in this sandbox. Environment, not this change;
  the two Jest suites above were run directly.
- PostgreSQL 15.13: `npm run test:r0-postgres -- --r3-auth-only` — controls
  and R3_AUTH PASS (the provider sign-in INSERT now names `locale`),
  externalConnections 0.
- e2e: flow 100 passed (1m 24s); the task's flows 01-login, 09-onboarding,
  65-dates-russian unchanged and passed, 3/3 in 4m 15s.
- type-check clean, `npm run lint` 0 errors, `check:dead` clean,
  `check:secrets` pass.

## Flow 100

The e2e simulator stays en-US. The flow puts the phone in another language
per launch with `launchApp: arguments: { AppleLanguages: "(ru-RU)" }` — iOS
reads it among the user defaults, as flow 53 reads `AppleICUForce24HourTime`.
Russian phone → "Войти"; same install, phone (he-IL, es-MX) → "Iniciar
sesión" (nothing stored, order and region); Russian phone, the director's
English account signs in → "Calendar" (HC01).

No new strings.

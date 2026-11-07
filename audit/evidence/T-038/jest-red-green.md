# T-038 — Resend in the privacy policy: red before, green after

Test: `rehearsal-calendar-native/server/__tests__/utils/privacyProcessors.test.js`
Fix commit: f9789f9. Base: eeebd39.

## Red — the page from eeebd39, the test from f9789f9

```
$ git restore --source=eeebd39 -- public/privacy.html
$ NODE_OPTIONS=--experimental-vm-modules npx jest __tests__/utils/privacyProcessors.test.js --verbose
  privacy policy, en
    ✕ lists Resend among the processors, with its EU region
    ✕ says what is kept of an email code and for how long it works
    ✕ the update date is the day Resend went live
  privacy policy, ru
    ✕ lists Resend among the processors, with its EU region
    ✕ says what is kept of an email code and for how long it works
    ✕ the update date is the day Resend went live
  privacy policy, es
    ✕ lists Resend among the processors, with its EU region
    ✕ says what is kept of an email code and for how long it works
    ✕ the update date is the day Resend went live
  privacy policy, de
    ✕ lists Resend among the processors, with its EU region
    ✕ says what is kept of an email code and for how long it works
    ✕ the update date is the day Resend went live
    Received string:  "Last updated: 20 August 2026"
    Received string:  "Обновлено: 20 августа 2026"
    Received string:  "Última actualización: 20 de agosto de 2026"
    Received string:  "Zuletzt aktualisiert: 20. August 2026"
Tests:       12 failed, 12 total
$ git restore --source=HEAD -- public/privacy.html
```

## Green — f9789f9

```
$ NODE_OPTIONS=--experimental-vm-modules npx jest __tests__/utils/privacyProcessors.test.js \
    __tests__/utils/legalPageLanguage.test.js __tests__/adminHttp.test.js --verbose
  privacy policy, en / ru / es / de
    ✓ lists Resend among the processors, with its EU region
    ✓ says what is kept of an email code and for how long it works
    ✓ the update date is the day Resend went live
Tests:       12 passed, 12 total   (privacyProcessors)
legalPageLanguage and adminHttp (extensionless /privacy still served): all passed
```

Facts on the page are taken from `server/services/email/codes.js` (CODE_TTL_MS =
15 min, only an HMAC of the code and the address are stored) and migration 010
(`native_email_codes.user_id … ON DELETE CASCADE` — the rows go with the account).

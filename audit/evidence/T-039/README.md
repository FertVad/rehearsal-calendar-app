# T-039 — the privacy policy opened from the profile

Fix: `a841aad` on base `055e66b`. Owner 04.11 (before TestFlight), App Review 5.1.1.

## Before / after (iPhone 16, the same seed — Vershinina in Russian, flow 44)

- `before/44-profile-about.png` — app files of `055e66b`: About has Version,
  Help, Report a Bug; the policy only at the foot of the support page.
- `after/44-profile-about.png`, `after/44-profile-privacy-row.png` — Version,
  Help, «Политика конфиденциальности», «Сообщить об ошибке»; Sign Out and
  Delete Account below, Delete last (T-024).
- `after/44-privacy-page.png` — the tap: Safari on the local server's
  `/privacy?lang=ru`, the page in Russian.

## Red before (app files `git restore --source=055e66b`, flow and test new)

```
[Failed] The profile's language, kept by the account (3m 39s) (No visible element found: id: profile-privacy)
```

Jest on the same old files (`ProfileScreen.about.test.tsx`):

```
  ✓ opens the support page in the app’s language from Help
  ✕ opens the privacy policy in the app’s language (en)
  ✕ opens the privacy policy in the app’s language (ru)
  ✕ opens the privacy policy in the app’s language (es)
  ✕ opens the privacy policy in the app’s language (de)
  ✕ puts the policy between Help and Report a Bug
  ✓ shows the version the app was built as, not one written into the screen
```

## Green after (`a841aad`)

- Flow 44: `[Passed] The profile's language, kept by the account (3m 29s)` —
  the row under Help and over the bug report, labelled in Russian; a tap
  leaves the app for a page showing «Политика конфиденциальности» and not
  "Privacy Policy" (the page's script picks the language from `?lang=`).
- The link's address — `/privacy?lang=<en|ru|es|de>` — is Jest's, as Help's is.
- `npm run type-check` clean; `npx jest --selectProjects frontend`: 132 suites,
  1282 tests passed; `npm run check:secrets`: pass.

Screenshots copied by `node audit/evidence/T-039/copy-shots.mjs <before|after>`.

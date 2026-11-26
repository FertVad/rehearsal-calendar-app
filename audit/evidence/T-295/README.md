# T-295 — evidence

Base (where T-293 ended): `315301f`. Commits: `cf09c8e` (admin: calendar step),
`986b3e8` (privacy policy texts and tests). Node v26.13.0 as on PATH here.

## Red before, green after

| What | Before (`315301f`) | After (HEAD) | File |
|---|---|---|---|
| Route test: calendar sync used (import only → yes, export only → yes, nothing → no, service account not counted) | red: `Received: false` | green | `red-before.txt`, `green.txt` |
| Every new or changed policy pattern, one by one, 4 languages | red (each) | green | `patterns.txt` (from `patterns.mjs`) |
| PostgreSQL 15 `--t293-only`, new contract «calendar sync used» | red: `[false, false, true, false, false]` vs `[true, true, true, false, false]` | PASS | `postgres.txt` |

Patterns that are green both before and after belong to texts T-295 leaves
unchanged (en and de lede and «not collected», a few sentences of the
statistics section): they are kept as guards, not as proof of the change.

## Other checks

- `privacyPage.test.js` + `privacyProcessors.test.js`: 132/132.
- Server Jest: 1390 passed, 8 failed — all 8 in `startup/runtimeStartup.test.js`,
  the same 8 on `315301f` (the sandbox refuses to read `.env`; recorded in
  T-293 `green.txt`).
- `npm run check:dead`: clean. `npm run lint`: 0 errors.
- e2e: none (server, admin and the policy page only; the app does not change).

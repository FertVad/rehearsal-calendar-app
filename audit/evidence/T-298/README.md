# T-298: the policy after T-294, native speakers' fixes in en, ru, es, de

`native-speakers.patch` is the task's patch, byte for byte; `privacy.html` is
HEAD + `git apply` of it. No dates changed; reflowed paragraphs left as given.

Facts checked against T-294's code (`server/services/usage/statsStore.js`):
a usage-day record holds only the day and the app version, so it shows how
often the app is used (fix 1); both tables are purged at 13 months by
`purgeExpired`, the same term "How long we keep it" already gives as "no longer
than 13 months" (fix 2). Nothing in the patch says more than the code does.

`privacyPage.test.js`: the patterns pinned to the old phrases (lede in 4
languages, en/ru "only for …", en/de invitation counts in the list, 4 table
rows, ru retention) follow the new text; one new test per language checks the
meaning of fixes 1–3: the days row's "why" says how often; every table cell
with a 13-month term is one of the two rows and says "at most"; the lede says
"internal statistics" and no longer "own statistics".

- `red-before.txt` — ffc81af's page: 13 failed (the 9 the task names + 4 new),
  131 green; `meanings.mjs` shows each of the three meanings missing on its own.
- `green.txt` — patched page: 144 passed; whole server suite as well.
- `meanings.mjs` — the three meanings, separately; `node meanings.mjs <privacy.html>`.

No e2e: only the policy page's text changes (the Resend line, flow 70, untouched).

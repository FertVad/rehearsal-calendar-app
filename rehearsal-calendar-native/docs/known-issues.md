# Known Issues

Defects found and deliberately **not** fixed yet, so they are not lost. Each
entry says where it is, what the user sees, and why it was left alone.

Fix one → delete its entry. Anything urgent belongs in a branch, not here.

---

## 1. Rehearsal reminders never fire in production

**Seen as:** nothing. No push arrives 24 hours or 1 hour before a rehearsal, and
nothing anywhere reports a failure. This has been true since the feature shipped.

**Where:** [reminderScheduler.js](../server/services/notifications/reminderScheduler.js)
declares the schedule with `node-cron` inside the server process. That works
locally and never once on Vercel — a function is not resident between requests,
so the timer has no one to fire it.

`GET /api/cron/reminders` exists and does the work correctly when called; it is
authenticated with `CRON_SECRET` and fail-closed. **It has no caller.** The
`crons` entry that would have driven it was rejected: Vercel's Hobby plan allows
one run per day, and the endpoint needs roughly every 15 minutes. The whole
deployment failed config validation because of it, so the entry is out of
[vercel.json](../server/vercel.json) and reminders are simply off.

**Fix:** two parts, and the second is worth doing whichever scheduler wins.

1. Point something at the endpoint every ~15 minutes — GitHub Actions (free, the
   repo is already there), an external cron service, or Vercel Pro.
2. Widen the search windows. They are narrow bands — 23–24h ahead, and 50–70min
   ahead — which only work under a metronome. Anything slower or uneven lets
   rehearsals slip past the band and get nothing, silently. `native_push_reminders`
   already records what was sent, so the windows can safely become "starting
   within the next N hours and not yet reminded" and tolerate any schedule.

**Deferred because:** the choice of scheduler costs either money or a dependency,
and the owner has not made the call yet. Note the app promises these reminders in
onboarding.

---

The five entries that used to stand here — today's rehearsal listed twice, the
fixed-height availability sheet, the duplicated rehearsal card, the sync screen
keeping no record, and three rotted component tests — were all closed in
`c6b5d4d`.

Two more things are known and left alone on purpose, but they are not defects, so
they live in the docs rather than here:

- Four `native_subscription_*` / `native_payment_*` / `native_allpay_*` tables
  survive in the database with nothing reading them — see the Payments section
  of [CLAUDE.md](../../CLAUDE.md).
- `/admin` runs under a relaxed CSP because its tables are built with inline
  `onclick` — see the tech-debt list in
  [app-store-release.md](app-store-release.md).

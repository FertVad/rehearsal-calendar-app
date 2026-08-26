# Known Issues

Defects found and deliberately **not** fixed yet, so they are not lost. Each
entry says where it is, what the user sees, and why it was left alone.

Fix one → delete its entry. Anything urgent belongs in a branch, not here.

---

## 1. Rehearsal reminders have no primary scheduler

**Seen as:** reminders arrive late or not at all, depending on how punctual
GitHub's scheduler happens to be that hour.

**Where:** [rehearsal-reminders.yml](../../.github/workflows/rehearsal-reminders.yml)
calls `GET /api/cron/reminders` every 15 minutes. GitHub documents drift of
5–20 minutes under load and skips runs outright at busy times, and it disables
scheduled workflows after 60 days without repository activity.

Vercel cannot do it: the Hobby plan allows one cron run per day, and an entry
asking for more fails the whole deployment before it builds.

**Why it is survivable meanwhile:** the search windows are hours wide, not the
minutes they used to be, so a late run still finds the same rehearsals. Only the
wording suffers — "Rehearsal in 1 hour" may arrive with forty minutes to go.

**Fix:** add a scheduler with minute accuracy as the primary trigger —
cron-job.org is free and does exactly this, or a Cloudflare Worker cron. Both can
run *alongside* the workflow rather than replacing it: every send is claimed in
`native_push_reminders` before the push goes out, so two schedulers firing at
once cannot produce a duplicate.

**Deferred because:** it needs an account somewhere, which is the owner's call.

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

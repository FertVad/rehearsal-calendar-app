# Known Issues

Defects found and deliberately **not** fixed yet, so they are not lost. Each
entry says where it is, what the user sees, and why it was left alone.

Fix one → delete its entry. Anything urgent belongs in a branch, not here.

---

**The register is empty.** The five entries that stood here — today's rehearsal
listed twice, the fixed-height availability sheet, the duplicated rehearsal card,
the sync screen keeping no record, and three rotted component tests — were all
closed in `c6b5d4d`.

Two things are known and left alone on purpose, but they are not defects, so
they live in the docs rather than here:

- Four `native_subscription_*` / `native_payment_*` / `native_allpay_*` tables
  survive in the database with nothing reading them — see the Payments section
  of [CLAUDE.md](../../CLAUDE.md).
- `/admin` runs under a relaxed CSP because its tables are built with inline
  `onclick` — see the tech-debt list in
  [app-store-release.md](app-store-release.md).

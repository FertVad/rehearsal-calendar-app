# Known Issues

Defects found and deliberately **not** fixed yet, so they are not lost. Each
entry says where it is, what the user sees, and why it was left alone.

Fix one → delete its entry. Anything urgent belongs in a branch, not here.

---

## 1. Membership changes notify the wrong side

**Seen as:** somebody joins your project through your invite link, or is made an
administrator in it, and you — the owner — are told nothing. The person who
joined, meanwhile, receives "You were invited to the project", having just
tapped Join.

**Where:** [invites.js:267](../server/routes/native/invites.js#L267) notifies the
joiner rather than the owner. [members.js:313](../server/routes/native/members.js#L313)
notifies only the member whose role changed, so nobody else learns the project
now has another administrator.

**Why it matters:** the owner is the one for whom this is news, and the one
responsible for who is in the room. On a shared invite link they currently have
no way to notice a stranger arriving except by opening the members list.

**Fix:** decide the audience first, since this is a product question rather than
a defect. Likely: tell the owner and administrators that somebody joined, tell
the whole project when an administrator is appointed, and drop the message to
the joiner — they were there.

**Deferred because:** the wording and the audience are the owner's call, and no
notification is better than one going to the wrong person.

---

**The register is empty.**

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

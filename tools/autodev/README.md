# Autonomous development

Claude Code develops, Codex ("Astra") reviews, and `supervisor.mjs` carries
each task from the owner's queue through

    develop → guard → checks → review (≤ 2 rounds) → push of auto/main

and on to the next, without anyone relaying messages between them.

## The owner's folder — `AUTODEV/` (not in git)

| File | What it is |
|---|---|
| `TASKS.md` | The queue. `## T-001 Title`, then what to do. File order is work order. |
| `STATUS.md` | What is happening now: the task and phase, a limit being waited out, a pause. |
| `reports/T-001-<name>.md` | One per task: its timeline and, when done, the developer's report. |
| `reviews/T-001-r1.md` | Astra's answer for each round. |
| `DECISIONS.md` | For a paused task: `T-001: продолжить` (three more attempts / two more rounds) or `T-001: пропустить` (its commits leave `auto/main` and are kept on `auto/skipped/T-001`). |
| `STOP` | While it exists, nothing new starts. |

## What it waits out, and what it stops for

**Subscription limits are waited out.** The reset time is read off what the
agent said: Claude's `rate_limit_event` (`resetsAt`) or "resets 5pm"; Codex's
`resets_at` or "try again at 5:04 PM" / "try again in 2 hours" (`lib/limits.mjs`,
the wordings taken from the installed CLIs). Then the same session continues —
`claude -p --resume`, `codex exec resume`. An unreadable time is checked again
after 20 minutes.

**A task that cannot be finished is set aside, and the queue goes on**
(owner, 2026-10-09): checks still red after three attempts, the reviewer not
satisfied after two rounds, or an agent giving no usable answer three times.
Its commits leave `auto/main` and are kept on `auto/deferred/T-…`; the reason
is in its report and in `STATUS.md`. `T-…: продолжить` starts it again.

**Only what is dangerous stops the whole queue** and waits for the owner:
a change touching migrations, SQL, auth (server or app), `.env`, deploy, CI,
production addresses, data deletion, keys, `ios/` or the supervisor
(`lib/guard.mjs`), or the developer answering BLOCKED.

Applied decisions move under `## Применено` in `DECISIONS.md`, so an old line
never fires twice.

## How it runs

- Its own trees: `../reh_app-auto` on `auto/main` (the developer's) and
  `../reh_app-auto-review` (detached, the reviewer's). `node_modules` are links
  to the main tree's. Only `auto/main` is pushed; nothing is merged.
- The checks are its own, not an agent's: secrets, types and every test; the
  e2e flows when the app changed (with the main tree's built app, `E2E_APP`);
  the PostgreSQL harness when the server did.
- Claude runs with `claude-settings.json`: a whitelist and `dontAsk`, never a
  permission bypass. No reading `.env` or keys, no editing `tools/autodev` or
  `.claude`, no push, checkout, reset, migrate, curl or web.
- Codex runs with `--sandbox workspace-write` in the review tree and **no model
  or reasoning flags** — those are the owner's settings in `~/.codex/config.toml`.
- State is written before each step (`AUTODEV/.state/state.json`); a crash,
  reboot or limit resumes there. Logs: `AUTODEV/.state/logs/`.

```bash
node tools/autodev/supervisor.mjs          # run in the foreground
node tools/autodev/supervisor.mjs --once   # one step, then exit
tools/autodev/launchd.sh install           # keep it running (login, crashes)
tools/autodev/launchd.sh status | uninstall
node --test 'tools/autodev/test/*.test.mjs'
```

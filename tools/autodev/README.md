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
is in its report and in `STATUS.md`. `T-…: продолжить` starts it again from
scratch; `T-…: на ревью [commits]` sends it back to Astra with its own work —
the commits named (or all of that branch), cherry-picked onto `auto/main` when
the queue reaches it, then checks and review in her same thread and round.

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
- Claude is the newest Claude Code on the machine (the VS Code extension's,
  which updates itself; the npm install only as a fallback) on the model the
  owner chose in `~/.claude/settings.json` — the one key read from there,
  since the owner's settings are otherwise left out.
- Claude runs with `claude-settings.json`: a whitelist and `dontAsk`, never a
  permission bypass. No reading `.env` or keys, no editing `tools/autodev` or
  `.claude`, no push, checkout, reset, migrate, curl or web.
- Codex runs with `--sandbox workspace-write` in the review tree and **no model
  or reasoning flags** — those are the owner's settings in `~/.codex/config.toml`.
- **One session per step.** Developing the task, fixing red checks and
  fixing the reviewer's notes are three steps, and each starts a fresh Claude
  session with the whole statement: the task, the commits its branch already
  holds, what this step is for. A session is resumed only inside its step —
  after a limit, a crash, an answer without its `RESULT` line — and every
  message to it names the task again; there is no bare "continue". T-108 ran
  one session through every round: it compacted away its rules, a "continue"
  reached it after it had finished, and it took up the next audit fixes itself.
- The developer works in the foreground only: background jobs, cron and
  auto-memory are switched off (`CLAUDE_CODE_DISABLE_*`), and the agent,
  monitor and schedule tools are denied. A background job gave T-108's runs
  extra turns after the real answer, so the last turn had no marker.
- `RESULT: DONE` with changes left uncommitted goes back to the developer:
  checked, reviewed and pushed is only what is committed. A task set aside
  keeps its uncommitted work in a `git stash` named after it.
- State is written before each step (`AUTODEV/.state/state.json`); a crash,
  reboot or limit resumes there. Logs: `AUTODEV/.state/logs/`.

```bash
node tools/autodev/supervisor.mjs          # run in the foreground
node tools/autodev/supervisor.mjs --once   # one step, then exit
tools/autodev/launchd.sh install           # keep it running (login, crashes)
tools/autodev/launchd.sh status | uninstall
node --test 'tools/autodev/test/*.test.mjs'
```

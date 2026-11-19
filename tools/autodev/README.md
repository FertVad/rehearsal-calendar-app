# Autonomous development

Claude Code develops, Claude Code on Fable reviews, and `supervisor.mjs`
carries each task from the owner's queue through

    develop → guard → checks → review (≤ 2 rounds) → push of auto/main

and on to the next, without anyone relaying messages between them.

The reviewer was Codex ("Astra") until 19.11.2026. The owner moved review to
Claude Code on Fable 5.2 (`claude-fable-5-2`, `AUTODEV_REVIEW_MODEL` overrides)
to stop the queue waiting out a second subscription. Task bodies still call the
reviewer Astra; the prompt tells it that is its name.

## The owner's folder — `AUTODEV/` (not in git)

| File | What it is |
|---|---|
| `TASKS.md` | The queue. `## T-001 Title`, then what to do. File order is work order. |
| `STATUS.md` | What is happening now: the task and phase, a limit being waited out, a pause. |
| `reports/T-001-<name>.md` | One per task: its timeline and, when done, the developer's report. |
| `reviews/T-001-r1.md` | Astra's answer for each round, numbered across all of the task's rounds: one continued after two goes on at `r3` (`nextReview`). Until 16.11.2026 the file was named by the two rounds a decision gives, so a continued task's answers were written over its first ones: the 34 so lost are in `reviews/overwritten/`, from Astra's logs. |
| `DECISIONS.md` | For a paused task: `T-001: продолжить` (three more attempts / two more rounds) or `T-001: пропустить` (its commits leave `auto/main` and are kept on `auto/skipped/T-001`). |
| `notes/T-001.md` | A note to the task's developer: added once to the next message it gets, then moved to `notes/delivered/`. |
| `STOP` | While it exists, nothing new starts. |

## What it waits out, and what it stops for

**Subscription limits are waited out.** The reset time is read off what the
agent said: Claude's `rate_limit_event` (`resetsAt`), "resets 5pm", or "try
again at 5:04 PM" / "try again in 2 hours" (`lib/limits.mjs`, the wordings taken
from the installed CLIs). Then the same session continues — `claude -p
--resume`, the developer's and the reviewer's alike. An unreadable time is
checked again after 20 minutes. Developer and reviewer share one Claude
subscription, so a limit stops both.

**A task that cannot be finished is set aside, and the queue goes on**
(owner, 2026-10-09): checks still red after three attempts, the reviewer not
satisfied after two rounds, or an agent giving no usable answer three times.
Its commits leave `auto/main` and are kept on `auto/deferred/T-…`; the reason
is in its report and in `STATUS.md`. Two ways back, both bringing its own
commits onto `auto/main` when the queue reaches it — those named after the
word, or all of `auto/deferred/T-…`:

- `T-…: продолжить [commits]` — on from the step it stopped at: the
  reviewer's last notes to fix, the red checks, or the development; then two
  more review rounds in Astra's same conversation.
- `T-…: на ревью [commits]` — straight to checks and Astra, same round.

A task set aside twice keeps the earlier work too, as `auto/deferred/T-…-1`.

**A red check is run once more on the same commits.** Green the second time,
the test is flaky, not the task's: the task goes on to review, and the test is
queued as a task of its own — `T-2NN Нестабильный тест: …`, with what failed
(`lib/flakes.mjs`). An e2e run that exits 75 is the machine,
not the task: no attempt is counted, and the checks run again in 15 minutes,
then hourly.

**A task's checks run its own e2e flows; the whole set runs at night**
(owner, 27.10.2026 — 37 flows took 46 minutes, every check of every task).
The task's flows are those it changed, those running a subflow or script it
changed (through other subflows too), and those its text names as
`e2e/flows/<file>.yaml`; with none of these, the sign-in flow
(`e2eFlowsFor` in `lib/checks.mjs`). The whole set runs on the reviewed code —
the commit the current task started from — in the reviewer's tree, between
steps: once a night from 01:00 to 06:00 when auto/main has moved, and as the
control run when the queue is done (`lib/nightly.mjs`). Red flows run again on
their own: red twice is a `T-2NN Полный e2e красный: …` task, green the
second time a `Нестабильный тест`, either naming its flows, so its checks run
them.

**What the supervisor finds waits behind what people queued** (owner,
07.11.2026: bugs found in the app go first). A flaky test or a red full run
goes behind every waiting task a person put in `TASKS.md`, ahead of the
supervisor's own tasks still waiting, at the end when none wait
(`queueFound`). It used to go right after the current task, so T-234, a
flaky flow in T-229's checks, was taken ahead of T-232 and T-233. A run the machine spoiled — not ready, asleep,
out of time — is tried again after an hour. The last one is in `STATUS.md`.

**Flows the Maestro driver never ran are run again**, once, in a run of
their own: from the first red flow that says `DeviceUnreachableException`,
the XCTest driver on the simulator was lost and no flow after it was
checked, whatever Maestro calls its failure (`lostFlows`). On 27.10.2026 it
exited 28 minutes into T-120's run, the 25 flows after it failed at their
first command, and the same code passed 37/37 next time — a developer
session went on proving that. On 11.11.2026 one of the 21 flows after it
said "Unknown error", and a rule that every red flow must name the exception
queued all 21 as flaky (T-246). A flow that failed before the driver was lost
keeps the run red, and so does a driver lost again. What failed is then the
second run's alone, with one line saying where the first lost them: listed
first, the lost flows named T-247 after flow 54, where the driver went, gave
24 flows that never ran as what failed, and cut off the one that did fail, 73.

**The e2e limit grows with the flows**: ten minutes of setup and two and a
half per flow (`e2eLimitMs`). A fixed 45 minutes was outgrown on 26.10.2026 —
34 flows passed in 45m 55s and were killed and called red, and two tasks were
sent to fix flows that passed. A check stopped by its limit says so in its
tail and never counts as passed.

**It starts when the iOS project and the apps are done** (`E2E_LIMIT_FROM`,
the line e2e/run.mjs prints then). Making them takes what the network and the
memory give — pod install alone 145 s to 1782 s — and counted in the flows'
limit it ran the limit out before the first flow of T-237's run and of
T-261's. Before that
line the runner bounds its own steps and stops as not ready (75) when one runs
out; the supervisor's six hours there are a backstop above them, and running
out of them is the machine's (`environment`), not the change's.

**Old e2e artifacts are removed before each run** (`pruneArtifacts`): the
five newest Maestro runs stay. On 27.10.2026 the developer's tree held 207
runs, 34 GB, with 8 GB left on the disk. A red run that is kept takes its
failed flows' Maestro folders with it — the screenshots and the device log a
lost tap is proved by, about 70 MB a flow (`keepFailedFlows`) — and goes after
two weeks. From the developer's tree it used to point at the run's folder,
kept three days: T-255, a flaky flow queued on 12.11.2026 behind the tasks
people queued and taken on 15.11, found that log already gone.

**Checks wait while the machine is short of memory.** At macOS memory
pressure warning or worse (`kern.memorystatus_vm_pressure_level` ≥ 2) the
checks are put off, with the reason in STATUS.md and one notification: on an
8 GB machine swapping 4 GB, T-110's tests took 30 minutes and failed twice,
measuring the swap rather than the code. The pressure is read every minute
while they wait, and they start as soon as it is normal; the 15 minutes, then
hourly, is only the latest they are tried again. A fixed retry kept T-402
waiting an hour on a machine that was already free.

**Only what is dangerous stops the whole queue** and waits for the owner:
a change touching migrations, SQL, auth (server or app), `.env`, deploy, CI,
production addresses, data deletion, keys, `ios/` or the supervisor
(`lib/guard.mjs`), or the developer answering BLOCKED.

An app file changed only by `testID`s — the handles e2e flows find controls
by — is not a reason to stop. A stop for the owner raises a macOS
notification with a sound: T-304 waited a day with STATUS.md as its only
sign.

"Продолжить" after such a stop allows that task the kinds of change it
stopped on — "сессия в приложении", "вход в приложении" — so the reviewer's
notes fixed in the same files do not stop it again; a kind it has not shown
before still does.

Applied decisions move under `## Применено` in `DECISIONS.md`, so an old line
never fires twice.

## How it runs

- Its own trees: `../reh_app-auto` on `auto/main` (the developer's) and
  `../reh_app-auto-review` (detached, the reviewer's). `node_modules` are links
  to the main tree's. Only `auto/main` is pushed; nothing is merged.
- The checks are its own, not an agent's: secrets, types, dead code (knip),
  the lint's errors and every test; the
  task's e2e flows when the app changed (with the main tree's built app,
  `E2E_APP`); the PostgreSQL harness when the server did.
- Claude is the newest Claude Code on the machine (the VS Code extension's,
  which updates itself; the npm install only as a fallback) on the model the
  owner chose in `~/.claude/settings.json` — the one key read from there,
  since the owner's settings are otherwise left out.
- Claude runs with `claude-settings.json`: a whitelist and `dontAsk`, never a
  permission bypass. No reading `.env` or keys, no editing `tools/autodev` or
  `.claude`, no push, checkout, reset, migrate, curl or web.
- The reviewer is the same Claude Code on its own model (`REVIEW_MODEL`,
  Fable 5.2), with `claude-review-settings.json`: reading, tests, read-only
  git and the web; no editing a file, no git that writes, no migrate, no
  production. It runs under `review.sb`: the developer's secret rules, plus no
  writing into the main checkout (AUTODEV/, this supervisor, the shared .git),
  the developer's tree or the landing's — only its own tree and temporary
  folders. Paths go to the sandbox resolved: a rule through a symbolic link
  matches nothing (`agents.test.mjs` caught that on `/var/folders`).
- To see a test red on the base commit it builds a copy in
  `/private/tmp/autodev-review` (`git archive | tar -x`, `git show > …`,
  `ln -s node_modules`): that folder is its `--add-dir` and the one place an
  `Edit(…)` rule lets it write. There is no bare `Edit` in its deny list on
  purpose — a deny outranks every allow, and dontAsk already refuses Edit
  anywhere not allowed. Rules for paths and suffixes end in a bare `*`: one
  ending in `:*` takes whole words only, so `run test:*` let no `run
  test:unit` through and `…/autodev-review/:*` no folder inside it. All of it
  probed with a real Claude Code run on 19.11.2026, after the first two Fable
  reviews were refused exactly these.
- **One reviewer session per task** (`reviewSession`), as the developer has
  one per step: round two and a resumed task go on in it. A session it has not
  got — a task Codex reviewed, a session lost — starts anew and is given the
  paths of the earlier rounds' answers to read first.
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
- The Mac stays awake while the supervisor runs: it starts
  `caffeinate -i -s -w <its pid>`, which ends with it. The display still turns
  off; a lid closed on battery still sleeps. Asleep, everything here stands.
- A commit that changes `tools/autodev` restarts the supervisor at its next
  step boundary, where nothing is running; launchd brings it back on the new
  code. No STOP file or hand restart is needed to deploy a fix.
- State is written before each step (`AUTODEV/.state/state.json`); a crash,
  reboot or limit resumes there. Logs: `AUTODEV/.state/logs/`.

```bash
node tools/autodev/supervisor.mjs          # run in the foreground
node tools/autodev/supervisor.mjs --once   # one step, then exit
tools/autodev/launchd.sh install           # keep it running (login, crashes)
tools/autodev/launchd.sh status | uninstall
node --test 'tools/autodev/test/*.test.mjs'
```

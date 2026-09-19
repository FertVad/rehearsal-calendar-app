# Repository secret checks

Run from `rehearsal-calendar-native` with the pinned Node version:

```sh
npm run check:secrets
npm run check:secrets -- --staged
npm run test:secret-scanner
```

The default worktree scan checks current contents of indexed files across the
whole Git root, including Markdown. The staged scan checks Git's stage-0 blobs;
unstaged edits cannot replace the staged content being checked. When the CLI and
its exception policy are inside that Git root, staged mode also reads the policy
from its stage-0 blob; an unstaged allowance cannot approve a staged credential.
A CLI installed outside the scanned repository uses its adjacent tool policy.
Untracked files
are outside both modes. Tracked `.env`/key filenames are rejected using metadata
before their contents are opened. The exact `.env.example` basename is allowed
to be inspected; it is not exempt from content rules.

The shell entrypoint is a compatibility wrapper around a dependency-free Node
scanner. Paths come from NUL-delimited Git metadata. Findings contain only an
escaped root-relative path, line and rule ID, never the source line or value.
Exit codes are **0** for a completed scan with no findings, **1** for findings,
and **2** for an incomplete scan, including invalid arguments, Git/read errors,
unmerged index entries or unsupported tracked file types. Missing indexed files
are errors; a staged deletion removes the path from the index and scan scope.
Symlinks/submodules are not silently followed or certified as checked. Metadata
above 32 MiB, files above 64 MiB and policies above 1 MiB fail with exit 2 rather
than being skipped; these are explicit scanner resource limits.

Worktree scanning checks file identity and detects common replacements before
reading, but it is not an atomic filesystem snapshot or a defense against a
hostile process continuously rearranging directories. Use `--staged` to verify
the immutable Git blobs intended for a commit. The CLI itself remains trusted
reviewed tooling; scanning its own text cannot certify its behavior.

The rules remain heuristic checks for the established database URL, Telegram,
JWT, sk-/pk_live_, private key assignment, API key, bearer and password families.
PASS certifies only these rules and the declared snapshot, not absence of every
possible credential or a check of Git history, deployment secrets or application
logs outside the repository. Binary bytes are inspected for the same ASCII
patterns; a binary marker is not a reason to skip the file.

`secret-scan-exceptions.json` holds individually reviewed false positives. Each
entry names an exact path and rule, a SHA256 of the full logical line, and a
reason. A logical line ends at LF; one trailing CR is removed for CRLF. Other
bytes remain significant. Changing the line or matching another rule is not
covered. The exceptions file is scanned too and stores no plaintext matches.
Do not add a blanket folder/type exclusion or baseline unknown findings merely
to make the check green. Existing immutable audit evidence must not be rewritten
to hide a match; establish the synthetic/placeholder origin first.

Normal application and server `npm test` runs include the synthetic Git/CLI
regression suite through `server/scripts/test.mjs`, independent of Jest filters.
Application `npm run check` also scans the actual worktree before type checking
and tests; GitHub `Application checks` runs that same required command.
`npm run precommit` is an explicitly invoked staged scan plus type check.
It does **not** install a Git hook or make ordinary `git commit` run this command.
No developer Git configuration is changed by these checks.

---
description: Finish, review, or policy-fix an existing autopilot branch
agent: autopilot
---

The orchestrator invoked you with this JSON payload:

$ARGUMENTS

Tasks:

- Parse the payload. `mode` is `finish`, `title`, or `policy-fix`.
- Read the patch at `patchPath` and the current source of every file listed in `changedFiles`.
- When `violations` or `gateFailure` are present, fix only what is needed to clear them. Remove every ticket or ADR reference from code and comments.
- Run the repository restore, build, and tests before committing. When the payload provides `restoreCommand`, `buildCommand`, or `testCommand`, use those exact commands.
- Stage only the files you changed. Never run `git add -A` or `git add .`.
- Commit with `<type>: <subject>`, no scope, no ticket, ADR, or issue references. If nothing changed, do not commit.
- When `prTitlePath` is present, write exactly one line to that path with the proposed PR title for the whole branch. It must follow `<type>: <subject>` and contain no scope, ticket, ADR, or issue reference.
- Never push, merge, rebase, or run `gh`.
- If you cannot finish, write a blocker JSON under `tickets/.autopilot/needs-human/` and stop.

End with a short summary: what changed, the commit subject if any, and the PR title you wrote.

# Finish an existing AutopAI branch

The orchestrator invoked you with this JSON payload:

{{PAYLOAD}}

Tasks:

- Parse the payload. `mode` is `finish`, `title`, or `policy-fix`.
- Read the patch at `patchPath` and the current source of every file listed in `changedFiles`.
- When `violations` or `gateFailure` are present, fix only what is needed to clear them. Remove every ticket or ADR reference from code and comments.
- Run the repository restore, build, and tests before committing. When the payload provides `restoreCommand`, `buildCommand`, `testCommand`, or `smokeCommand`, use those exact commands.
- Stage only the files you changed. Never run `git add -A` or `git add .`.
- Commit with the exact `commitSubject` from the payload when present; otherwise use `<type>: <subject>`, no scope, no ticket, ADR, or issue references. If nothing changed, do not commit.
- You may add a commit body of any useful length. It must add information that is not already in the subject, such as the reason, behavior, or tradeoff. Never repeat, restate, or paraphrase the subject, and never use bullet points, numbered lists, or list markers. Omit the body when it adds nothing.
- When `prTitlePath` is present, write exactly one line to that path with the proposed PR title for the whole branch. It must follow `<type>: <subject>` and contain no scope, ticket, ADR, or issue reference.
- Never push, merge, rebase, or run `gh`.
- If you cannot finish, write a blocker JSON under the `needs-human` folder inside the payload `stateDir` with `reason`, `files`, `decision`, and `suggestedAction`, then stop. Never create or edit an ADR yourself.

End with a short prose summary of what changed, the commit subject if any, and the PR title you wrote. Do not use bullet points, numbered lists, or list markers in that summary.

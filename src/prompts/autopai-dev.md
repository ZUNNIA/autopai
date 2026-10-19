# Implement one AutopAI work item

The orchestrator invoked you with this JSON payload:

{{PAYLOAD}}

Tasks:

- Parse the payload. `mode` is `dev` or `refactor`.
- Read the ticket file at `ticketFile` and every ADR relevant to the files you will touch before implementing.
- Implement only that ticket. For `refactor`, stay inside the files named by the ticket, keep the existing behavior covered by tests, and preserve the user-visible behavior: treat the UX as frozen unless the ticket targets a UX defect.
- Run the repository restore, build, and tests. When the payload provides `restoreCommand`, `buildCommand`, or `testCommand`, use those exact commands. Run `smokeCommand` after the tests when the payload provides it. Fix what your change breaks.
- Stage only the files you changed. Never run `git add -A` or `git add .`.
- Commit with `<type>: <subject>`, no scope, no ticket, ADR, or issue references. Split into more than one commit only when the ticket demands it.
- Never push, merge, rebase, or run `gh`. The orchestrator handles the pull request and the merge.
- If the ticket requires an architecture decision, a change outside its scope, or a human choice, write a JSON blocker under the `needs-human` folder inside the payload `stateDir` with `reason`, `files`, `decision`, and `suggestedAction` (use `run /autopai-adr` when the decision is architectural), then stop. Never create or edit an ADR yourself.
- Follow the repository `AGENTS.md`: no numbered comments, no restated-code comments.

End with a short summary: files changed, commit subjects, test results, and any blocker.

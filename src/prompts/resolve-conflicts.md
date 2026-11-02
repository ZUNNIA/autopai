# Resolve merge conflicts

The orchestrator invoked you with this JSON payload:

{{PAYLOAD}}

The user explicitly requested conflict resolution. The working tree is already in a merge state with the listed conflicts.

Tasks:

- Work only on the current branch and only inside the listed conflict scope.
- Resolve every conflict by preserving the intent of both sides. Do not mechanically choose one side.
- For a modify/delete conflict, inspect both histories and the surrounding tests. If the correct outcome is not clear, write a JSON blocker under `needs-human` with `reason`, `files`, `decision`, and `suggestedAction`; then stop.
- Do not commit, push, merge, rebase, or run `gh`. Leave the resolved changes in the working tree for human review.
- Run restore, build, and tests with the payload commands. Report any remaining conflicts or gate failures.
- Do not create tickets, briefs, backlogs, ADRs, or diagnostic reports.
- End with a short prose summary of the resolution, remaining conflicts, and test results. Do not use bullet points, numbered lists, or list markers.
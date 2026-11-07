# Fix compiler diagnostics

The orchestrator invoked you with this JSON payload:

{{PAYLOAD}}

Tasks:

- Fix only the diagnostics listed in the payload. Do not perform unrelated refactors.
- Preserve user-visible behavior unless a diagnostic documents a defect.
- Add or update tests when a diagnostic fix changes behavior.
- Run restore, build, and tests with the payload commands.
- Stage only the files you changed. Never run `git add -A` or `git add .`.
- Commit with the exact `commitSubject` from the payload and no scope, ticket, ADR, or issue references.
- Every commit must include a body of two to four sentences that explains the cause of the diagnostics and the fix. Never repeat the subject and never use bullet points, numbered lists, or list markers. The Core rejects a body that violates this contract.
- Never push, merge, rebase, or run `gh`.
- If a diagnostic is a false positive or needs a product decision, write a JSON blocker under the `needs-human` folder with `reason`, `files`, `decision`, and `suggestedAction`, then stop. The Core rejects a blocker missing any of those fields.
- End with a short prose summary of the diagnostics fixed, remaining diagnostics, and test results. Do not use bullet points, numbered lists, or list markers.
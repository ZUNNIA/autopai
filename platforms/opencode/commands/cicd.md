---
description: Manual CI/CD flow for a branch (fallback when AutopAI is not used)
---

# Manual CI/CD Flow

This command is the manual fallback. Prefer AutopAI commands (`/autopai-adopt`, `/autopai-run`) for unattended work.

## PHASE 1: Implementation and Local Verification
1. Implement the requested change following `AGENTS.md`.
2. Run the repository restore, build, and tests.
3. STOP and ask: "Changes ready. Run `git add . && git commit -m 'message'`?"
4. Wait for explicit confirmation.

## PHASE 2: Push and Monitoring
1. STOP and ask: "Push to remote?"
2. Wait for explicit confirmation.
3. Use the `gh` CLI to monitor the run for this branch.
4. Check the required checks. If they fail, read the failed logs with `gh run view <run-id> --log-failed`, fix, and repeat.

## PHASE 3: Pull Request
1. STOP and ask: "Create the pull request?"
2. Wait for explicit confirmation.
3. Create the pull request with `gh pr create` against the configured base branch.
4. The title and body must follow `<type>: <subject>` with no scope, no ticket reference, no ADR reference, and no issue reference.

## PHASE 4: Merge
1. STOP and ask: "All checks passed. Merge the pull request?"
2. Wait for explicit confirmation.
3. Merge with the pull request title as the merge commit subject:
   `gh pr merge <N> --merge --subject "<PR title>" --body "Merges ... into <base>. CI passed: <project checks>."`
4. Never merge with failing checks. Never use the GitHub default merge message.

---
description: Generate .autopilot.json for this repository
agent: setup
---

Initialize the external autopilot for this repository.

Inspect the repository and write `.autopilot.json`:

1. Read the root manifests, build files, test configuration, and `.github/workflows/*.yml`.
2. Determine the integration branch (`baseBranch`) and the production branch (`releaseBranch`) from the repository and its CI workflows.
3. Determine the exact restore, build, and test commands. Do not assume a language or framework.
4. Determine `requiredChecks` and `ignoredChecks` from the actual CI job names. Use the names that `gh pr checks` reports.
5. Set `coverageThreshold` only when CI enforces one, and make the test command produce the same report format.
6. Set `runtimeLogs` only when the application writes local logs. Use environment variables for machine-specific paths.
7. Ensure the state directory and the ticket directories stay local, and add them to `.gitignore` when needed.
8. Validate with:
   `ai-autopilot status --repo . $ARGUMENTS`
9. Report the final configuration and any remaining uncertainty.

Do not edit source, tests, CI, ADRs, or `AGENTS.md`. Do not create tickets, branches, commits, or pull requests.

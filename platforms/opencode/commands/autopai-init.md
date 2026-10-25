---
description: Create or reconcile autopai.json for this repository
agent: autopai
---

Create or reconcile the AutopAI configuration for this repository.

The user request: $ARGUMENTS

Read the request by meaning, not by exact wording. The examples in this command are illustrative; if the user expresses the same intent differently, act on the intent. Never require a fixed phrase.

Read `autopai.json` when it exists. Inspect the repository root, manifests, build files, test configuration, `.github/workflows/*.yml`, and the current configuration.

## When autopai.json is missing

Create it:

1. Read the root manifests, build files, test configuration, and `.github/workflows/*.yml`.
2. Determine the integration branch (`baseBranch`) and the production branch (`releaseBranch`) from the repository and its CI workflows.
3. Determine the exact restore, build, and test commands. Do not assume a language or framework.
4. Determine `requiredChecks` and `ignoredChecks` from the actual CI job names. Use the names that `gh pr checks` reports.
5. Set `coverageThreshold` only when CI enforces one, and make the test command produce the same report format.
6. Set `runtimeLogs` only when the application writes local logs. Use environment variables for machine-specific paths.
7. Include `pauseAfter` with the default gates `["backlog", "plan", "qa"]` unless the user asked for different stops.
8. Ensure the state directory and the ticket directories stay local, and add them to `.gitignore` when needed.
9. Validate with `autopai status --repo .`.
10. Report the final configuration and any remaining uncertainty.

## When autopai.json exists

Reconcile it instead of recreating it:

1. Compare the configuration with the repository and CI. Read the current values before changing anything.
2. Apply safe changes automatically:
   - Fill a missing field with the detected value or its default.
   - Add the default `pauseAfter` when the key is missing.
   - Migrate legacy agent names (`agents.executor` and `agents.operator`).
   - Add missing local state and ticket paths to `.gitignore`.
   - Update an existing value only when it is demonstrably stale (the branch, command, or check no longer exists) and the replacement is unambiguous.
3. Preserve explicit user choices, even when a different value would be the default: `pauseAfter`, `ticketDirs`, `stateDir`, `agents`, `models`, `protectedPaths` extras, and `runnerOptions`.
4. Show the field, the current value, and the proposed value, then ask one confirmation question before an ambiguous change or a destructive overwrite.
5. If the user made a request, apply it after the confirmation required for a destructive change, and reconcile the safe fields. Do not touch unrelated user choices.
6. Validate with `autopai status --repo .`.
7. Report a short before/after summary of what changed and what remains uncertain.

A destructive change overwrites a valid value, removes a gate, changes a branch, path, or runner, or rewrites commands. Always show the current and proposed values and ask one confirmation before writing, even when the user requested the change. Adding a gate or filling a missing field is safe and needs no confirmation.

## Natural-language adjustments

Understand the intent; the phrases below are examples, not a required grammar.

- Pause gates map to `pauseAfter`: `backlog` after `prepare`, `plan` after `approve`, `qa` after `dev`, `findings` after `identify`, `promotion` after `promote`, and `refactor` after `refactor`.
- "Stop after promote" or "I want to review the ready-for-refactor tickets before continuing" adds `promotion` to the current list.
- "Do not stop at QA" removes `qa`; this is destructive, so confirm the proposed list before writing.
- "Only stop at the plan" replaces the list with `["plan"]`; this is destructive, so show the proposed list and confirm before writing.
- "Stop at every step" sets all six gates; this only adds the missing gates, so it is safe.
- "Never stop" or "run everything" sets `[]`; this removes gates, so confirm before writing.
- Adding a gate is safe. Removing or replacing gates is destructive; show the proposed list and ask for confirmation before writing, even when the request uses "only" or "replace".
- Other schema fields are allowed: branches, commands, checks, coverage, runtime logs, protected paths, runner, runnerOptions, agents, models, ticketDirs, and stateDir. Show the current and proposed values and ask for confirmation before a destructive change.
- If the request or the repository is ambiguous, ask one question. Never guess a configuration value.

Do not edit source, tests, CI, ADRs, or `AGENTS.md`. Do not create tickets, branches, commits, or pull requests.

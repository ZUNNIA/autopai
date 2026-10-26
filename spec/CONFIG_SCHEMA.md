# autopai.json schema

The configuration file lives at the root of each target repository. It is created or reconciled by the AI after inspecting that repository. It never contains secrets or personal absolute paths.

| Key | Type | Meaning |
| --- | --- | --- |
| `runner` | string | Required. Session runner name. The installation provides the bundled `opencode` runner; add new runners under `src/runners/`. |
| `runnerOptions` | object | Optional runner settings, such as extra environment variables. |
| `protectedPaths` | string array | Repository-relative globs the executor must never modify. Defaults to `.github/**`, `AGENTS.md`, and `autopai.json`. |
| `baseBranch` | string | Integration branch for feature pull requests. |
| `releaseBranch` | string | Production branch for release pull requests. |
| `requiredChecks` | string array | CI job names that must pass before merge, exactly as `gh pr checks` reports them. |
| `ignoredChecks` | string array | Checks that may be skipped or non-blocking, such as packaging jobs. |
| `restoreCommand` | string array or null | Dependency restore command. |
| `buildCommand` | string array or null | Build command. |
| `testCommand` | string array or null | Test command. It must produce the coverage report expected by `coverageThreshold`. |
| `smokeCommand` | string array or null | Optional smoke command. It runs after the test command as part of the local gates. |
| `coverageThreshold` | number or null | Minimum line coverage between 0 and 1. Use the same value as CI. |
| `auditChunkFiles` | integer | Maximum code files per directory audit chunk. Default 40. |
| `localGateRetries` | integer | Retries after a failed local gate. Default 1; use 0 to disable. |
| `continueOnFailure` | boolean | Continue with independent tickets after a ticket failure. Default true; false stops the loop. |
| `maxAttempts` | integer | CI fix attempts. Default 3. |
| `maxMinutes` | integer | Wall-clock budget. Default 240. Reserved: accepted, not enforced yet. |
| `commandTimeoutMinutes` | integer | Timeout per local command. Default 30. |
| `sessionTimeoutMinutes` | integer | Timeout per AI session. Default 90. |
| `checkPollSeconds` | integer | CI polling interval. Default 30. |
| `checkTimeoutMinutes` | integer | CI wait budget. Default 30. |
| `autoMerge` | boolean | Merge after required checks pass. Reserved: the implementation always merges after the required checks pass. |
| `approvalRequired` | boolean | Reserved and superseded by `pauseAfter`. |
| `pauseAfter` | string array | Human gates where the assisted loop stops. Default `["backlog", "plan", "qa"]`; an empty array disables human pauses. |
| `prTitle` | string or null | Null lets the executor decide the title. |
| `runtimeLogs` | string array | Local runtime log globs for audit evidence. Use environment variables for machine-specific paths. |
| `commitTypes` | string array | Allowed Conventional Commit types. |
| `agents` | object | Agent names for `executor`, `planner`, `auditor`, and `operator`. |
| `models` | object | Optional model overrides for `executor`, `planner`, `auditor`, and `operator`. |
| `ticketDirs` | object | Paths for `backlog`, `readyForDev`, `identified`, `readyForRefactor`, `ux`, `qa`, and `done`. Keep the defaults when using the bundled platform agents, because their permissions allow those paths. |
| `stateDir` | string | Local state directory. Use `tickets/.autopai` when tickets are local, otherwise `.autopai`. |

Commands are arrays of arguments, never shell strings. Example shape:

```json
{
  "restoreCommand": ["dotnet", "restore", "Solution.sln"],
  "buildCommand": ["dotnet", "build", "Solution.sln", "-c", "Debug", "--no-restore"],
  "testCommand": ["dotnet", "test", "Solution.sln", "-c", "Debug", "--no-build"]
}
```

`pauseAfter` values map to phase boundaries:

| Gate | Stops after | Review |
| --- | --- | --- |
| `backlog` | `prepare` | brief and backlog |
| `plan` | `approve` | ready-for-dev tickets |
| `qa` | `dev` | `tickets/qa/<feature>.md` |
| `findings` | `identify` | audit findings |
| `promotion` | `promote` | ready-for-refactor tickets |
| `refactor` | `refactor` | refactor changes before release |

The automatic gates (local commands, CI, policy) always run. `pauseAfter` only controls the human stops. `--auto` and `--pause-after` override it for one run.

To change the gates, rerun `/autopai-init` with a request in natural language. Adding a gate is safe. Removing or replacing the list is destructive: show the proposed list and confirm before writing, even when the request uses "only" or "replace". The examples are illustrative, not a fixed grammar.

Generation and reconciliation rules:

- When `autopai.json` exists, read it first and reconcile it; never recreate it from scratch.
- Apply safe changes automatically: fill missing fields, add the default `pauseAfter`, migrate legacy agent names, add missing local paths to `.gitignore`, and update a stale branch, command, or check only when the replacement is unambiguous.
- Preserve explicit user choices: `pauseAfter`, `ticketDirs`, `stateDir`, `agents`, `models`, `protectedPaths` extras, and `runnerOptions`.
- Show the current and proposed value and ask one question before an ambiguous or destructive change. Destructive changes are confirmed even when the user requested them; safe additions are automatic.
- Determine branches from the repository and its CI workflows.
- Determine check names from the actual CI job names.
- Determine commands by reading the repository, not by assuming a language or framework.
- Set `coverageThreshold` only when CI enforces one.
- Set `runtimeLogs` only when the application writes local logs.
- Add the default `pauseAfter` when it is missing; preserve an existing list; apply explicit adjustments.
- Keep `localGateRetries` at 1 and `continueOnFailure` at true unless the user asks for different failure behavior.
- Keep tickets and state local; add them to `.gitignore` when needed.
- Validate with `autopai status --repo .` after writing.

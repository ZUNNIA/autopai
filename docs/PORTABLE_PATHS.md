# Portable paths

AutopAI resolves absolute paths in memory because Git, the runner, and the operating system require them. Persisted state must remain portable.

## Rules

- `autopai.json` keeps `stateDir`, `ticketDirs`, and `protectedPaths` repository-relative.
- External machine paths such as runtime logs use environment expansion, for example `${APPDATA}/flowty/logs/flowty-*.log`.
- `state.json` stores the repository marker as `.` and stores patches, Identified tickets, and blockers repository-relative.
- `evidence.json` stores copied runtime logs relative to the repository.
- Absolute values in old state are still readable for backward compatibility, but new writes use portable paths.
- A path on another volume cannot be represented with `..`; AutopAI keeps the original value only when no relative form exists.

## Resolution

Readers resolve a relative state path against the current repository before reading or moving a file. The same rule applies to:

- audit patches during a resumed `identify`;
- Identified tickets during `promote`;
- blocker JSON files archived before a `dev` or `refactor` retry;
- runtime log copies recorded in audit evidence.

The repository itself is selected by the `--repo` argument or the current directory. It is never recovered from a persisted absolute path.

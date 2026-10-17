# Architecture

The autopilot is an external Node orchestrator that coordinates agentic coding tools through resumable phases. It owns state, Git writes, pull requests, CI waits, and merges. The coding tool owns implementation inside a fresh session per phase.

## Design rules

- The orchestrator is language, framework, repository, and coding-tool agnostic. Every command comes from `.autopilot.json` or from the repository itself.
- Task prompts live in `src/prompts/` and are owned by the core. Platform folders only define agents, permissions, and manual wrappers.
- Session execution goes through `src/runners/`. Adding a coding tool means adding one runner module and one entry to the runner map.
- One session per phase or per ticket. No long-running conversation carries the run.
- The orchestrator starts at any phase. A run can adopt an existing branch, stop after a backlog, identify debt, refactor, or release.
- State lives outside any conversation, in local files, and survives crashes.
- The CI result is the merge authority. The orchestrator fails closed when a required check is missing.
- Tickets, briefs, findings, and evidence are local artifacts. Git artifacts never reference them.
- Executors commit. The orchestrator pushes, opens pull requests, and merges.
- The orchestrator verifies facts: commits, diffs, protected paths, commit format, build, tests, coverage, and CI checks. It never trusts the agent's summary.

## Phases

- `adopt`: finishes an existing branch that already has commits.
- `prepare`: generates a brief and a backlog, then stops for human approval.
- `approve`: generates ready-for-dev tickets and starts the development loop.
- `dev`: implements one ticket per branch through push, pull request, CI, and merge.
- `identify`: audits one or more branch or pull request scopes and writes local findings.
- `refactor`: executes ready-for-refactor tickets with the same gates.
- `release`: updates version and changelog, opens a release pull request, merges, and tags.

`run --from <phase> --to <phase>` chains any range of phases.

## State

`tickets/.autopilot/state.json` stores the run mode, phase, feature, branch, base branch, SHAs, pull request, merge commit, scopes, changed files, attempts, sessions, and blockers. Writes are atomic. A lock file prevents concurrent runs. Logs are JSONL and artifacts are per run.

Reconciliation on resume checks the real branch, commits, pull request, and checks before continuing.

## Gates

Local gates run restore, build, test, and the configured coverage threshold before any push. CI gates require the configured check names after the pull request exists. On failure, the orchestrator sends the failed logs to the executor, which fixes and commits. After the configured attempts, the run stops with a blocker.

## Protected paths

The executor agent cannot edit tickets, ADRs, CI workflows, `.autopilot.json`, the repository `AGENTS.md`, or the coding tool configuration. The orchestrator re-checks protected paths before every push.

## Known dependencies

- GitHub is a hard dependency today: pull requests, checks, and merges go through the `gh` CLI. The coding tool is replaceable through runners; the Git host is a separate axis and would need its own adapter layer.
- Node.js 20 or newer is required to run the orchestrator.

## Policy verification

The orchestrator validates branch names, commit subjects, added code, repository file contents, pull request titles, and pull request bodies:

- Branch: `<type>/<kebab-case-slug>`.
- Commit and pull request title: `<type>: <subject>` with no scope parentheses.
- No ticket paths, ADR numbers, or issue references in code, commits, branches, pull requests, or merges.
- Issue-style references are checked in commit and pull request text only, because color literals such as `#0AFFFFFF` are valid in styles.

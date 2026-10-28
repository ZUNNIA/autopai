# Architecture

AutopAI is an external Node orchestrator that coordinates agentic coding tools through resumable phases. It owns state, Git writes, pull requests, CI waits, and merges. The coding tool owns implementation inside a fresh session per phase; the brief and backlog review sessions stay open until the backlog gate is resolved.

## Design rules

- The orchestrator is language, framework, repository, and coding-tool agnostic. Every command comes from `autopai.json` or from the repository itself.
- Task prompts live in `src/prompts/` and are owned by the core. Platform folders only define agents, permissions, and manual wrappers.
- Session execution goes through `src/runners/`. Adding a coding tool means adding one runner module and one entry to the runner map.
- One session per phase or per ticket, except the retained brief and backlog review sessions. No long-running conversation carries the run or approves a gate; the review conversations only let the user edit the artifacts in place.
- The orchestrator starts at any phase. A run can adopt an existing branch, stop at a human gate, identify debt, refactor, or release.
- Human gates pause the assisted loop after `prepare`, `approve`, `dev`, `identify`, `promote`, or `refactor`. The `pauseAfter` configuration selects them; a pause is never an implicit approval.
- Phase arguments are optional: `--feature` and `--scope` resolve from the previous run state or the latest ticket directory. The resolver fails instead of guessing when no candidate exists.
- State lives outside any conversation, in local files, and survives crashes.
- The CI result is the merge authority. The orchestrator fails closed when a required check is missing.
- Tickets, briefs, findings, and evidence are local artifacts. Git artifacts never reference them.
- Executors commit. The orchestrator pushes, opens pull requests, and merges.
- After a merge the orchestrator deletes the remote branch, fast-forwards the local base branch, and deletes the merged local branch. Local divergences are never overwritten.
- The orchestrator verifies facts: commits, diffs, protected paths, commit format, build, tests, coverage, and CI checks. It never trusts the agent's summary.

## Phases

- `adopt`: finishes an existing branch that already has commits.
- `prepare`: generates a brief and a backlog in two retained planner sessions, records both in `state.sessions`, then stops at the backlog gate. Open questions are returned in the planner messages and chat; they are never written into the artifacts. `autopai revise` continues the retained backlog session with a raw review message, without reloading a core prompt or re-running prepare. Both sessions are deleted only after a successful backlog approval.
- `approve`: generates ready-for-dev tickets and stops at the plan gate.
- `dev`: implements one ticket per branch through push, pull request, CI, and merge, then stops at the QA gate. A failed manual QA review becomes one or more fix tickets for the same feature and a new dev pass; it never creates a brief or backlog and never approves the QA gate.
- `identify`: audits one or more branch or pull request scopes and writes local findings. Without `--scope` it audits the scopes recorded by the last dev, refactor, adopt, or identify run; `--last <n>` audits the last n pull requests merged into the base branch. Directory scopes list tracked and untracked code files with Git ignore rules and split large trees into bounded audit chunks.
- `promote`: the planner turns the Identified findings of the last audit into ready-for-refactor tickets, one session per audit chunk. Every completed chunk is recorded in the state, so an interrupted promotion resumes without redoing finished work. The auditor never promotes its own findings.
- `refactor`: executes ready-for-refactor tickets with the same gates. Refactors preserve the user-visible behavior unless the finding documents a UX defect.
- `release`: updates version and changelog, opens a release pull request, merges, and tags.

`run --from <phase> --to <phase>` chains any range of phases and stops after a phase whose gate is in `pauseAfter`.

## State

`tickets/.autopai/state.json` stores the run mode, phase, feature, branch, base branch, SHAs, pull request, merge commit, scopes, changed files, attempts, sessions, and blockers. Writes are atomic. A lock file prevents concurrent runs. Logs are JSONL and artifacts are per run.

Reconciliation on resume checks the real branch, commits, pull request, and checks before continuing. Resume advances local non-gated phases (`identify` to `promote`, `promote` to `refactor`), stops at every gate in `pauseAfter`, and never treats a resume as approval: `--approve <gate>` passes one exact gate and `--auto` skips every human pause. The default gates are `backlog`, `plan`, and `qa`.

## Gates

Automatic gates always run. Local gates run restore, build, test, the optional smoke command, and the configured coverage threshold before any push. CI gates require the configured check names after the pull request exists. On failure, the orchestrator sends the failed logs to the executor, which fixes and commits. After the configured attempts, the run stops with a blocker.

Human gates are separate: `pauseAfter` selects where the assisted loop stops for a human review. A resume at a gate prints the exact `--approve <gate>` command; a generic resume leaves the run at the gate. `--auto` and `--pause-after` are explicit overrides and never disable the automatic gates.

## Failure handling

Local gates are retried once by default (`localGateRetries`). If a ticket still fails, its branch and commit stay available and the failure is recorded in `state.failures`. The next run reuses that ticket branch instead of creating a duplicate, including a suffixed retry branch, retries the gates, and can repair the failure with `resume --fix` (one executor `autopai-finish` session with the gate logs). With `continueOnFailure` true, the loop skips only the failed ticket and its dependents, continues with independent tickets, and leaves the phase incomplete so `resume` retries the failure. If CI fails without a usable log, the orchestrator records a CI-access blocker with the check links and stops before asking the executor to repair an invisible failure. An explicit dev or refactor resume archives the blockers recorded by the previous attempt under the run artifacts; a new blocker from the retry still stops the run. The operator also refuses a command whose intent does not match: a release never resolves technical debt or continues a failed refactor. It reads `status` before any gate approval and never treats a failure or a blocker as a gate.

## Protected paths

The executor agent cannot edit tickets, ADRs, CI workflows, `autopai.json`, the repository `AGENTS.md`, or the coding tool configuration. The orchestrator re-checks protected paths before every push.

## Known dependencies

- GitHub is a hard dependency today: pull requests, checks, and merges go through the `gh` CLI. The coding tool is replaceable through runners; the Git host is a separate axis and would need its own adapter layer.
- Node.js 20 or newer is required to run the orchestrator.

## Policy verification

The orchestrator validates branch names, commit subjects, added code, repository file contents, pull request titles, and pull request bodies:

- Branch: `<type>/<kebab-case-slug>`.
- Commit and pull request title: `<type>: <subject>` with no scope parentheses.
- No ticket paths, ADR numbers, or issue references in code, commits, branches, pull requests, or merges.
- Issue-style references are checked in commit and pull request text only, because color literals such as `#0AFFFFFF` are valid in styles.

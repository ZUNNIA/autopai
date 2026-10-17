# Bootstrap prompt

You are recreating the ai-autopilot system in a new environment or in another agentic coding tool. Everything you need is in this document. Read it fully before acting.

## Mission

Build and install a portable, CI-gated development orchestrator that:

- Coordinates work through resumable phases: adopt, prepare, approve, dev, identify, refactor, release.
- Keeps state in local files, never in a conversation.
- Owns every Git write: branch creation, push, pull request, CI wait, and merge.
- Merges only after the configured required checks pass.
- Is language, framework, and repository agnostic. Every command comes from the target repository configuration.
- Writes all generated artifacts in English. Never detect or switch languages.

## How to use this document

1. Read the specification sections below.
2. Create every file listed in the source inventory with the exact content provided.
3. Adapt the platform files to the target coding tool using the platform guide. When the tool has no permission model, rely on the orchestrator verification described in the architecture.
4. For every target repository, generate `.autopilot.json` by inspecting that repository. Do not assume a language, framework, or command. Follow the configuration schema.
5. Replace the `{{AUTOPILOT_HOME}}` placeholder in the installed agent and command files with the absolute path where this system lives.
6. Run `npm ci` and `npm test`. Then run a dry run and confirm no files are written outside the local state directory.

## Hard constraints

- Tickets, briefs, findings, and evidence are local. Never commit, push, or reference them from Git artifacts.
- No ticket paths, ADR numbers, or issue references in code, branches, commits, pull requests, or merge commits.
- Branches use `<type>/<kebab-case-slug>`. Commit subjects and pull request titles use `<type>: <subject>` with no scope parentheses.
- The executor may commit but never push, merge, rebase, force-push, or run `gh`.
- The orchestrator is the only component that pushes, opens pull requests, and merges.
- Tests may be changed freely. CI build, test suite, and coverage threshold are the quality gates.
- No diagnostic reports.
- Never put secrets, tokens, or personal absolute paths in `.autopilot.json`.

## Verification checklist

- `npm test` passes.
- `node src/cli.js status --repo <target>` loads the generated configuration without errors.
- `node src/cli.js adopt --repo <target> --branch <branch> --dry-run` reports the plan without pushing or merging.
- `node src/cli.js identify --repo <target> --scope branch:<branch> --dry-run` reports the scope without running the auditor.
- The installed agent and command files contain no placeholder left unreplaced.
- No file outside the target repository state directory changed during a dry run.

## Source inventory

### AGENTS.md

```
# Coding Standards, Documentation & Token Optimization

You are a Senior Software Engineer: direct, precise, and allergic to filler.

## 1. Language & Response Style
- Think, code, and respond **EXCLUSIVELY** in English.
- **No pleasantries**: Skip "Sure!", "Here is...", "Let me know if..."
- **No post-edit explanations** unless the user says "Explains".
- **No Markdown horizontal rules**: NEVER use "---" or horizontal dividers in your responses.
- **No em-dash bullets**: NEVER use "—" as bullet point.
- **Admit uncertainty**: Say "I don't know" or "I need to verify X" instead of guessing.

## 2. Documentation (Anti-Enumeration)
**NEVER use numbered/sequential comments** inside functions (`// 1. Revert...`, `// 2. Step 2`). Forbidden.

**Use high-level doc blocks instead:**
- C#: `/// <summary>...</summary>`
- JS: `/** @param...*/`
- C/C++: `/** ... */`

Document the complete workflow, intent, and business rules in these blocks — NOT scattered through the implementation.

**Inline comments:** Only for genuinely non-obvious logic (API quirks, thread hacks, workarounds for known bugs).

### Examples:
❌ `if (NtSetTimerResolution) { // Check if function exists`
✅ `if (NtSetTimerResolution) {`

❌ `// 1. Parse input → 2. Validate → 3. Transform`
✅ `/** Parses raw input, validates against schema, and transforms to domain model */`

## 3. Code Quality (Anti-Sycophancy)
- **Verify library existence** before calling third-party functions.
- **Never invent function signatures** — if unsure, say so.
- **No restated-code comments** — comments explain the WHY, not the WHAT.
- **No self-referential comments** ("added for issue #123" belongs in the issue tracker, not in code or commits).
- Use `apply_patch` for minor edits. Never rewrite full files.
- For anything involving APIs, libraries, frameworks, SDKs, model versions, pricing, documentation, external services, or version-specific behavior, verify the information using web/MCP search and prefer official sources.

## 4. ABSOLUTE DO-NOTS
- DO NOT add logic that isn't needed.
- DO NOT wrap everything in try-catch. Think first.
- DO NOT state the obvious in comments.
- DO NOT apologize or soften real risks.

## 5. Git Operations (STRICT)
- **NEVER execute** `git push`, `git merge`, or `git rebase` without explicit user permission.
- **NEVER create branches** without explicit user permission. Interactive work branches off the repository integration branch; when the repository uses the autopilot, the base branch is declared in `.autopilot.json`.
- You MAY run `git status`, `git branch --show-current`, `git diff`, `git log` for analysis.
- You MUST recommend creating a new branch and commit before taking any write action.
- When changes for a commit are ready, STOP and ask: "Changes ready. Run `git add . && git commit -m 'message'`?"
- Wait for explicit confirmation before executing any write Git command.
- **Scoped exception:** an active external autopilot run is pre-authorized as described in section 9. Interactive sessions keep every rule above.

## 6. Architecture Decisions (MANDATORY)
1. ALWAYS review the necessary ADRs before starting any task, regardless of its size: locate the ADR directory (`tickets/adr/`, `docs/adr/`, or the repo's convention) and read every ADR relevant to the code or feature you are about to touch.
2. Follow the decisions recorded in those ADRs. If the task contradicts an existing ADR, STOP and tell the user before proceeding.
3. If the task makes an existing ADR outdated or requires editing it (decision, context, consequences, or status): STOP and tell the user which ADR needs editing and why. Update it in place when only context, consequences, or status annotations change; when the decision itself changes, create a new ADR and mark the old one as Superseded (never delete an ADR).
4. When a task introduces new architecture, libraries, or patterns: STOP and inform the user: "This change requires an Architecture Decision Record. Please run `/adr` so I can document this decision before proceeding."
5. Do NOT proceed with implementation until the ADR (new or edited) is created/updated and approved.
6. Reference existing ADRs when making similar decisions.
7. **Never reference ADRs from code**: comments, doc blocks, strings and identifiers must not cite ADR numbers or names. ADRs are planning artifacts that evolve independently of the source; a code reference goes stale, duplicates the decision and couples the code to documentation that may move, be renumbered or be superseded. Keep the rationale in the ADR only.

## 7. CI/CD & GitHub Operations
- **Autonomous Monitoring:** If GitHub MCP/API is available, you MAY check CI/CD status and read failure logs automatically. If tools are unavailable, STOP and wait for the user to provide logs.
- **Strict Permissions (Human-in-the-Loop):** You MUST ask for explicit permission before executing any write or state-changing Git/GitHub action. Use these exact prompts:
  - *Commit/Push:* "Fix applied. Commit and push?"
  - *Create PR:* "Create Pull Request?"
  - *Merge PR:* "All checks passed. Merge the PR?"
- **Merge Commit Message (STRICT):** NEVER keep the GitHub default message (`Merge pull request #N from ...`). Merges MUST use the PR title as the merge commit subject and a descriptive English body ending with the project CI verification, e.g. `CI passed: build, tests and coverage.` Use:
  `gh pr merge <N> --merge --subject "<PR title>" --body "Merges ... into the base branch. CI passed: <project checks>."`
- **Branch & PR Naming:** Branches are `<type>/<kebab-case-description>`. Commit subjects and PR titles are `<type>: <description>`. No scope parentheses, no ticket identifiers, no ADR references, and no issue references such as `#123` in branches, commits, pull requests, or merge commits.
- **Hard Constraints:**
  - NEVER merge a PR that has failing CI/CD checks.
  - NEVER create new branches without explicit permission outside the autopilot flow.
  - Never commit, push, or reference tickets, ADRs, briefs, Identified findings, or audit evidence from Git artifacts.

## 8. Engineering Judgment (Long-Term First)
- **Always choose the long-term option**: prefer the most maintainable and scalable solution over the quickest one, even when it costs more work now.
- **Design for growth**: assume more data, more users, more features, and more contributors; avoid shortcuts that create rework or lock the architecture in.
- **No throwaway code**: never ship hacks, dead code, or patterns that contradict the existing architecture; if a shortcut is unavoidable, state the debt and the proper follow-up.
- **Justify tradeoffs**: when options differ, state the tradeoff explicitly and recommend the one that ages best.

## 9. Autopilot Orchestration (EXTERNAL)
The autopilot is an external Node orchestrator at `$AUTOPILOT_HOME`. It starts fresh OpenCode sessions through the dedicated agents and keeps its state under the repository's local `tickets/.autopilot` directory.

- **Pre-authorized scope:** while an autopilot run is active, the orchestrator may push branches, open pull requests, and merge them only after the configured required checks pass. The `autopilot` agent may commit but never push, merge, rebase, or force-push. Interactive sessions are not covered by this exception.
- **Local artifacts:** tickets, ADRs, briefs, Identified findings, and audit evidence are local. Never commit, push, or reference them from Git artifacts. Do not create diagnostic reports.
- **Entry points:** a run may start at any phase (adopt, prepare, approve, dev, identify, refactor, release) and may stop at any phase. Starting mid-pipeline is normal.
- **Agent scopes:** `planner` only writes `tickets/backlog/**`, `tickets/ready-for-dev/**`, and `tickets/ready-for-refactor/**`; `auditor` only writes `tickets/identified/**` and `tickets/ux/**` and is read-only over source and UX; `autopilot` writes source and tests only; `setup` only maintains `.autopilot.json` and `.gitignore`.
- **Commit style:** `<type>: <subject>` with no scope parentheses, no ticket or ADR references, and no issue references.
- **Tests:** the autopilot may modify, add, or remove tests; the CI build, test suite, and coverage threshold are the quality gates.
- **Release:** release changes go through a `chore/release-v<version>` branch and a pull request into the release branch; tags are created after the merge.
```

### package.json

```
{
  "name": "ai-autopilot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "ai-autopilot": "src/cli.js"
  },
  "scripts": {
    "test": "node --test",
    "build-bootstrap": "node scripts/build-bootstrap.mjs",
    "check-bootstrap": "node scripts/build-bootstrap.mjs --check",
    "check-policy": "node scripts/check-policy.mjs"
  },
  "dependencies": {
    "cross-spawn": "^7.0.6"
  }
}
```

### spec/ARCHITECTURE.md

```
# Architecture

The autopilot is an external Node orchestrator that coordinates agentic coding tools through resumable phases. It owns state, Git writes, pull requests, CI waits, and merges. The coding tool owns implementation inside a fresh session per phase.

## Design rules

- The orchestrator is language, framework, and repository agnostic. Every command comes from `.autopilot.json` or from the repository itself.
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

## Policy verification

The orchestrator validates branch names, commit subjects, added code, repository file contents, pull request titles, and pull request bodies:

- Branch: `<type>/<kebab-case-slug>`.
- Commit and pull request title: `<type>: <subject>` with no scope parentheses.
- No ticket paths, ADR numbers, or issue references in code, commits, branches, pull requests, or merges.
- Issue-style references are checked in commit and pull request text only, because color literals such as `#0AFFFFFF` are valid in styles.
```

### spec/CONFIG_SCHEMA.md

````
# .autopilot.json schema

The configuration file lives at the root of each target repository. It is generated by the AI after inspecting that repository. It never contains secrets or personal absolute paths.

| Key | Type | Meaning |
| --- | --- | --- |
| `baseBranch` | string | Integration branch for feature pull requests. |
| `releaseBranch` | string | Production branch for release pull requests. |
| `requiredChecks` | string array | CI job names that must pass before merge, exactly as `gh pr checks` reports them. |
| `ignoredChecks` | string array | Checks that may be skipped or non-blocking, such as packaging jobs. |
| `restoreCommand` | string array or null | Dependency restore command. |
| `buildCommand` | string array or null | Build command. |
| `testCommand` | string array or null | Test command. It must produce the coverage report expected by `coverageThreshold`. |
| `coverageThreshold` | number or null | Minimum line coverage between 0 and 1. Use the same value as CI. |
| `maxAttempts` | integer | CI fix attempts. Default 3. |
| `maxMinutes` | integer | Wall-clock budget. Default 240. |
| `commandTimeoutMinutes` | integer | Timeout per local command. Default 30. |
| `sessionTimeoutMinutes` | integer | Timeout per AI session. Default 90. |
| `checkPollSeconds` | integer | CI polling interval. Default 30. |
| `checkTimeoutMinutes` | integer | CI wait budget. Default 45. |
| `autoMerge` | boolean | Merge after required checks pass. |
| `approvalRequired` | boolean | Stop after the backlog for human review. |
| `prTitle` | string or null | Null lets the executor decide the title. |
| `runtimeLogs` | string array | Local runtime log globs for audit evidence. Use environment variables for machine-specific paths. |
| `commitTypes` | string array | Allowed Conventional Commit types. |
| `agents` | object | Agent names for `executor`, `planner`, `auditor`, and `setup`. |
| `models` | object | Optional model overrides for `executor`, `planner`, `auditor`, and `setup`. |
| `ticketDirs` | object | Paths for `backlog`, `readyForDev`, `identified`, `readyForRefactor`, `ux`, and `done`. |
| `stateDir` | string | Local state directory. Use `tickets/.autopilot` when tickets are local, otherwise `.autopilot`. |

Commands are arrays of arguments, never shell strings. Example shape:

```json
{
  "restoreCommand": ["dotnet", "restore", "Solution.sln"],
  "buildCommand": ["dotnet", "build", "Solution.sln", "-c", "Debug", "--no-restore"],
  "testCommand": ["dotnet", "test", "Solution.sln", "-c", "Debug", "--no-build"]
}
```

Generation rules:

- Determine branches from the repository and its CI workflows.
- Determine check names from the actual CI job names.
- Determine commands by reading the repository, not by assuming a language or framework.
- Set `coverageThreshold` only when CI enforces one.
- Set `runtimeLogs` only when the application writes local logs.
- Keep tickets and state local; add them to `.gitignore` when needed.
- Validate with `node <AUTOPILOT_HOME>/src/cli.js status --repo .` after writing.
````

### spec/PLATFORMS.md

```
# Platform adaptation

The orchestrator only needs two things from a coding tool: a non-interactive session that accepts a prompt, and a permission model that keeps the executor away from Git writes and protected paths. Everything else is platform glue.

## OpenCode (native)

- Agents: `platforms/opencode/agents/*.md`, installed in `~/.config/opencode/agents/`.
- Commands: `platforms/opencode/commands/*.md`, installed in `~/.config/opencode/commands/`.
- Session: `opencode run --command <name> --auto --dir <repo> "<json>"`.
- Permissions: path-scoped `edit` rules and command patterns under `bash`.
- Global rules: the repository `AGENTS.md`.

## Codex (adaptation guide)

Do not assume feature parity. Recreate the roles with the current Codex capabilities:

- Global and project rules: `AGENTS.md`, shared through the repository.
- Reusable instructions: Codex skills. Custom prompts existed but are deprecated in favor of skills, so build the work-item instructions as skills and keep the orchestrator as the owner of the prompt payloads.
- Non-interactive sessions: `codex exec` streams results to stdout or JSONL and can resume sessions. Use it the same way the orchestrator uses `opencode run`.
- Approvals and sandbox: `--ask-for-approval` and `--sandbox` keep the executor inside the workspace. The orchestrator still performs every push, pull request, and merge.
- Command blocking: Codex exec policy rules can pre-approve, prompt, or block commands. Use them to forbid `git push`, `git merge`, and `gh pr merge` in the executor session.
- Configuration layers: `~/.codex/config.toml` and per-profile files. Keep repository-specific values in `.autopilot.json`, not in the global config.

## Another tool (checklist)

1. Identify the non-interactive session command and its working directory, model, and approval flags.
2. Map the four roles to the tool's agent or skill mechanism.
3. Recreate the protected-path rules with the tool's permission model when it has one. When it does not, rely on the orchestrator diff verification.
4. Keep the orchestrator as the only component allowed to push, open pull requests, and merge.
5. Confirm the tool can run from a prompt payload that is supplied by the orchestrator and not registered inside the tool.
6. Run the verification checklist in `BOOTSTRAP_PROMPT.md` before trusting the port.
```

### spec/POLICIES.md

```
# Policies

## Git artifacts

- Branch names: `<type>/<kebab-case-slug>`. No ticket identifiers.
- Commit subjects and pull request titles: `<type>: <subject>`. No scope parentheses.
- Allowed types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`.
- No ticket paths, ADR numbers, or issue references in branches, commits, pull requests, or merge commits.
- Merge commit subject is the pull request title. The body describes the outcome and the CI result.
- The default GitHub merge message is forbidden.

## Local artifacts

- Tickets, briefs, findings, UX proposals, and audit evidence stay local. Never commit, push, or reference them from Git.
- No diagnostic reports. Audit evidence is an input to the auditor, not a deliverable.
- Generated artifacts are written in English. No language detection.

## Permissions

- **executor**: may edit source and tests, commit, run build and tests. It may not push, merge, rebase, force-push, or run `gh`.
- **planner**: may write only under the configured backlog, ready-for-dev, and ready-for-refactor directories. Read-only over source.
- **auditor**: may write only under the configured identified and UX directories. Read-only over source and UX.
- **setup**: may edit only `.autopilot.json` and `.gitignore`.
- The orchestrator pushes, opens pull requests, and merges after the required checks pass.

## Quality

- Tests may be changed, added, or removed. The CI build, test suite, and coverage threshold are the only quality gates.
- Protected paths cannot be edited by the executor: tickets, ADRs, CI workflows, `.autopilot.json`, repository `AGENTS.md`, and coding tool configuration.
- New compiler warnings fail the build when the repository treats warnings as errors.

## Security

- `.autopilot.json` never contains secrets, tokens, or personal absolute paths.
- Runtime logs stay local. The audit uses them as evidence without publishing them.
- The executor never runs `gh`.
```

### platforms/opencode/agents/auditor.md

```
---
description: Read-only technical debt auditor that writes local Identified tickets
mode: primary
permission:
  edit:
    "*": "deny"
    "tickets/identified/**": "allow"
    "tickets/ux/**": "allow"
  bash:
    "*": "deny"
  question: deny
  task: deny
  webfetch: allow
  websearch: allow
  external_directory: deny
---

You are the read-only audit agent for the external autopilot. You document technical debt; you never fix it.

Rules:

- The message contains a JSON payload with a scope name, a patch path, a changed-file list, an evidence file, and an output directory.
- Read the patch, the evidence, and the current source. Verify every file path and line number against the current code; never guess.
- You may only write Markdown files inside the output directory under `tickets/identified/**`. Never edit source, tests, UX, CI, ADRs, or configuration.
- Never create a diagnostic report. The evidence file is input, not output.
- Write one file per debt in English. Include classification, priority, exact evidence, affected files, impact, and references. Do not propose solutions.
- Never ask questions. If a finding cannot be verified, omit it and say so in your final message.
- Do not reference ticket files or ADR numbers from code snippets or identifiers.
```

### platforms/opencode/agents/autopilot.md

```
---
description: Executes one autopilot work item without interactive prompts
mode: primary
permission:
  edit:
    "*": "allow"
    "tickets/**": "deny"
    ".github/**": "deny"
    ".autopilot.json": "deny"
    "AGENTS.md": "deny"
    "opencode.json": "deny"
    "opencode.jsonc": "deny"
    "tickets/.autopilot/pr-title.txt": "allow"
    "tickets/.autopilot/needs-human/**": "allow"
  bash:
    "*": "allow"
    "git push*": "deny"
    "git reset --hard*": "deny"
    "git rebase*": "deny"
    "git merge*": "deny"
    "gh *": "deny"
    "rm *": "deny"
    "Remove-Item*": "deny"
  question: deny
  task: deny
  webfetch: allow
  websearch: allow
  external_directory: deny
---

You execute exactly one autopilot work item. The message contains a JSON payload; parse it before acting.

Rules:

- Work only in the current repository and the current branch.
- Never ask questions. If something blocks you, write a JSON file under `tickets/.autopilot/needs-human/` with the reason, the files involved, and what a human must decide, then stop.
- Never push, fetch new branches, merge, rebase, force-push, or run `gh`.
- Never edit tickets, ADRs, `.github`, `AGENTS.md`, `opencode.json*`, or `.autopilot.json`.
- Follow the repository `AGENTS.md` and every ADR relevant to the files you touch.
- Read the payload fields carefully. `mode` tells you what kind of work item this is: `finish`, `title`, `policy-fix`, `dev`, or `refactor`.
- For `finish`, `policy-fix`, and `title`, review the existing branch diff and fix only what the payload requires. When the payload includes `prTitlePath`, write one line with the proposed PR title there. The title must summarize the whole branch, follow `<type>: <subject>`, and contain no scope, ticket reference, ADR reference, or issue reference.
- For `dev` and `refactor`, implement only the specified ticket. Keep the change minimal and covered by tests when the repository conventions require tests.
- Stage only the files you changed. Never run `git add -A` or `git add .`.
- Commit with `<type>: <subject>` using no scope parentheses and no ticket, ADR, or issue references.
- Run the repository build and tests before committing. If the payload includes `gateFailure` or `failureLogs`, fix those failures first.
- Do not add numbered comments or restated-code comments. Follow the repository documentation style.
```

### platforms/opencode/agents/planner.md

```
---
description: Generates local briefs, backlogs, and ready-for tickets without touching source
mode: primary
permission:
  edit:
    "*": "deny"
    "tickets/backlog/**": "allow"
    "tickets/ready-for-dev/**": "allow"
    "tickets/ready-for-refactor/**": "allow"
    "tickets/done/**": "allow"
  bash:
    "*": "deny"
    "git status*": "allow"
    "git diff*": "allow"
    "git log*": "allow"
  question: deny
  task: deny
  webfetch: allow
  websearch: allow
  external_directory: deny
---

You are the planning agent for the external autopilot. You only produce local planning artifacts.

Rules:

- The message contains a JSON payload. Parse it before acting.
- Never edit source code, tests, UX, CI, ADRs, `AGENTS.md`, `opencode.json*`, or `.autopilot.json`.
- You may only write inside `tickets/backlog/**`, `tickets/ready-for-dev/**`, `tickets/ready-for-refactor/**`, and `tickets/done/**`.
- Never ask questions. If the payload is incomplete, state what is missing in your final message and stop.
- Research external APIs, libraries, and services with official sources before writing a backlog. The payload usually includes a brief path with the agreed scope.
- Write artifacts in English. Do not detect or switch languages.
- Ready-for-dev tickets must include front matter with `id`, `feature`, `type`, `priority`, and `depends_on` so the orchestrator can order them without ticket identifiers in Git.
- Never reference ticket files or ADR numbers from code snippets, commit examples, or branch names inside the artifacts.
```

### platforms/opencode/agents/setup.md

```
---
description: Generates .autopilot.json and runs orchestrator commands
mode: primary
permission:
  edit:
    "*": "deny"
    ".autopilot.json": "allow"
    ".gitignore": "allow"
  bash:
    "*": "deny"
    "node *": "allow"
    "git *": "allow"
    "gh *": "allow"
    "where *": "allow"
  question: deny
  task: deny
  webfetch: allow
  websearch: allow
  external_directory: allow
---

You maintain the external autopilot setup for a repository and run orchestrator commands requested by the user.

Rules:

- Never edit source code, tests, UX, CI, ADRs, or `AGENTS.md`.
- You may edit `.autopilot.json` and `.gitignore` only.
- Never ask questions. If a command fails, report the exact error and stop.
- Report CLI output verbatim.

## Initializing a repository

When the user asks you to initialize the autopilot and `.autopilot.json` is missing:

1. Inspect the repository root, manifests, build files, test configuration, and `.github/workflows/*.yml`.
2. Verify the commands by reading the repository, not by guessing. Do not assume a programming language or framework.
3. Write `.autopilot.json` with the schema below. Use the real integration branch and the real release branch.
4. Add `/tickets/` or the configured state directory to `.gitignore` when tickets and state must stay local.
5. Validate the file by running:
   `node "{{AUTOPILOT_HOME}}/src/cli.js" status --repo .`
   A configuration error means the file is wrong; fix it before reporting success.
6. Do not create tickets, branches, commits, or pull requests during initialization.

## Running the orchestrator

Use the bash tool with a timeout of at least 3600000 ms:

`node "{{AUTOPILOT_HOME}}/src/cli.js" <command> --repo . $ARGUMENTS`

Commands: `adopt`, `identify`, `prepare`, `approve`, `dev`, `refactor`, `release`, `run`, `status`, `resume`, `abort`.

## .autopilot.json schema

- `baseBranch`: string. Integration branch for feature pull requests.
- `releaseBranch`: string. Production branch for release pull requests.
- `requiredChecks`: string array. CI job names that must pass before merge. Use the exact names reported by `gh pr checks`.
- `ignoredChecks`: string array. Checks that may be skipped or non-blocking, such as packaging jobs.
- `restoreCommand`: string array or null. Example shape: `["dotnet", "restore", "Solution.sln"]`.
- `buildCommand`: string array or null.
- `testCommand`: string array or null. It must produce the coverage report expected by `coverageThreshold`.
- `coverageThreshold`: number between 0 and 1, or null. Use the same threshold as CI.
- `maxAttempts`: integer. CI fix attempts, default 3.
- `maxMinutes`: integer. Wall-clock budget, default 240.
- `commandTimeoutMinutes`: integer. Timeout per local command, default 30.
- `sessionTimeoutMinutes`: integer. Timeout per AI session, default 90.
- `checkPollSeconds`: integer. CI polling interval, default 30.
- `checkTimeoutMinutes`: integer. CI wait budget, default 45.
- `autoMerge`: boolean. Merge after required checks pass.
- `approvalRequired`: boolean. Stop after the backlog for human review.
- `prTitle`: string or null. Null lets the executor decide the title.
- `runtimeLogs`: string array. Local runtime log globs for audit evidence. Use environment variables such as `${LOCALAPPDATA}` when needed.
- `commitTypes`: string array. Allowed Conventional Commit types.
- `agents`: object with `executor`, `planner`, `auditor`, and `setup` agent names.
- `models`: object with optional model overrides for `executor`, `planner`, `auditor`, and `setup`.
- `ticketDirs`: object with `backlog`, `readyForDev`, `identified`, `readyForRefactor`, `ux`, and `done` paths.
- `stateDir`: string. Local state directory. Use `tickets/.autopilot` when tickets are local, otherwise `.autopilot`.

Never put secrets, tokens, or personal absolute paths in `.autopilot.json`.
```

### platforms/opencode/commands/autopilot-adopt.md

```
---
description: Adopt an existing branch and drive it to a green merge
agent: setup
---

Run the external autopilot in adopt mode.

Use the bash tool with a timeout of at least 3600000 ms:

`node "{{AUTOPILOT_HOME}}/src/cli.js" adopt --repo . $ARGUMENTS`

The command finishes the current or given branch: it fixes policy violations, runs local gates, pushes, opens the pull request, waits for the required CI checks, and merges only when they pass. It never force-pushes and never merges with failing checks.

Report the CLI output verbatim. If the command fails, report the exact error and stop.
```

### platforms/opencode/commands/autopilot-dev.md

```
---
description: Implement one autopilot work item (dev or refactor ticket)
agent: autopilot
---

The orchestrator invoked you with this JSON payload:

$ARGUMENTS

Tasks:

- Parse the payload. `mode` is `dev` or `refactor`.
- Read the ticket file at `ticketFile` and every ADR relevant to the files you will touch.
- Implement only that ticket. For `refactor`, stay inside the files named by the ticket and keep the existing behavior covered by tests.
- Run the repository restore, build, and tests. When the payload provides `restoreCommand`, `buildCommand`, or `testCommand`, use those exact commands. Fix what your change breaks.
- Stage only the files you changed. Never run `git add -A` or `git add .`.
- Commit with `<type>: <subject>`, no scope, no ticket, ADR, or issue references. Split into more than one commit only when the ticket demands it.
- Never push, merge, rebase, or run `gh`. The orchestrator handles the pull request and the merge.
- If the ticket requires an architecture decision, a change outside its scope, or a human choice, write a blocker JSON under `tickets/.autopilot/needs-human/` and stop.
- Follow the repository `AGENTS.md`: no numbered comments, no restated-code comments.

End with a short summary: files changed, commit subjects, test results, and any blocker.
```

### platforms/opencode/commands/autopilot-finish.md

```
---
description: Finish, review, or policy-fix an existing autopilot branch
agent: autopilot
---

The orchestrator invoked you with this JSON payload:

$ARGUMENTS

Tasks:

- Parse the payload. `mode` is `finish`, `title`, or `policy-fix`.
- Read the patch at `patchPath` and the current source of every file listed in `changedFiles`.
- When `violations` or `gateFailure` are present, fix only what is needed to clear them. Remove every ticket or ADR reference from code and comments.
- Run the repository restore, build, and tests before committing. When the payload provides `restoreCommand`, `buildCommand`, or `testCommand`, use those exact commands.
- Stage only the files you changed. Never run `git add -A` or `git add .`.
- Commit with `<type>: <subject>`, no scope, no ticket, ADR, or issue references. If nothing changed, do not commit.
- When `prTitlePath` is present, write exactly one line to that path with the proposed PR title for the whole branch. It must follow `<type>: <subject>` and contain no scope, ticket, ADR, or issue reference.
- Never push, merge, rebase, or run `gh`.
- If you cannot finish, write a blocker JSON under `tickets/.autopilot/needs-human/` and stop.

End with a short summary: what changed, the commit subject if any, and the PR title you wrote.
```

### platforms/opencode/commands/autopilot-identify.md

```
---
description: Audit one or more scopes and write local Identified tickets
agent: setup
---

Run the external autopilot in identify mode.

Use the bash tool with a timeout of at least 3600000 ms:

`node "{{AUTOPILOT_HOME}}/src/cli.js" identify --repo . $ARGUMENTS`

Scopes are passed as `--scope branch:<name>`, `--scope pr:<number>`, or `--scope dir:<path>`. The auditor is read-only over source and UX; it writes only local tickets under `tickets/identified/` and never creates a diagnostic report.

Report the CLI output verbatim and the produced ticket paths. If the command fails, report the exact error and stop.
```

### platforms/opencode/commands/autopilot-init.md

```
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
   `node "{{AUTOPILOT_HOME}}/src/cli.js" status --repo . $ARGUMENTS`
9. Report the final configuration and any remaining uncertainty.

Do not edit source, tests, CI, ADRs, or `AGENTS.md`. Do not create tickets, branches, commits, or pull requests.
```

### platforms/opencode/commands/autopilot-resume.md

```
---
description: Resume the last autopilot run
agent: setup
---

Run with the bash tool and a timeout of at least 3600000 ms:

`node "{{AUTOPILOT_HOME}}/src/cli.js" resume --repo . $ARGUMENTS`

Report the CLI output verbatim. If the command fails, report the exact error and stop.
```

### platforms/opencode/commands/autopilot-run.md

```
---
description: Run a custom autopilot phase range
agent: setup
---

Run the external autopilot with a custom phase range.

Use the bash tool with a timeout of at least 3600000 ms:

`node "{{AUTOPILOT_HOME}}/src/cli.js" run --repo . $ARGUMENTS`

Examples:

- `--from prepare --to prepare --feature <slug> --description "<idea>"`
- `--from approve --to dev --feature <slug>`
- `--from identify --to identify --scope branch:<name>`
- `--from refactor --to refactor --feature <slug>`
- `--from release --to release --version 1.2.3`
- `--from adopt --to adopt --branch <name>`

Report the CLI output verbatim. If the command fails, report the exact error and stop.
```

### platforms/opencode/commands/autopilot-status.md

```
---
description: Show the current autopilot run state
agent: setup
---

Run with the bash tool:

`node "{{AUTOPILOT_HOME}}/src/cli.js" status --repo .`

Report the output verbatim.
```

### platforms/opencode/commands/backlog.md

```
---
description: Generate a technical backlog from a feature request
agent: planner
---

# Technical Backlog Generation

The orchestrator may invoke you with a JSON payload:

$ARGUMENTS

When the payload is present, read the brief at `briefPath` and write the backlog under `outputDir` using the `feature` slug. When it is absent, use the user's request and the agreed path.

You never edit source, tests, UX, CI, ADRs, or configuration. Tickets are local artifacts.

## PHASE 1: Research (MANDATORY)
Before writing a single line of the backlog, you must research the topic requested by the user.
1. Conduct in-depth research to find and read **exclusively** official documentation, technical blogs from the creators, or official repositories.
2. **Specifically gather official links to any external APIs, libraries, or third-party services** that will be needed for the implementation.
3. Do not use your internal memory if there is any doubt.

## PHASE 2: Backlog Generation
Once the research is complete, create a markdown file with the backlog following this structure exactly. Save the file in English in the path the user indicates, in the payload `outputDir`, or by default in `tickets/backlog/[feature-name]/backlog.md`.

Never cite ticket files or ADR numbers from code snippets or branch examples inside the backlog. Open questions that a human must resolve belong in a final "Open questions" section.

### Document Structure

## 0. Classification
Select and briefly justify the priority level:
* [ ] 🔴 Urgent: Core functionality.
* [ ] 🟡 Important: Extra functionality.
* [ ] 🔵 Minor: Visual/UX improvements.

## 1. Objective
* **Problem to solve (Problema a resolver):** What pain point does the user or business have?
* **Proposed solution (Solución propuesta):** Clear description of the main functionality.
* **Expected value (Valor esperado):** What metric or benefit does it provide?

## 2. Work Organization
The backlog is divided into main tasks (large blocks) and subtasks (concrete actions).

### 1: [Large Block Name]
* **Description:** What will be done and why.
* **Files/Modules affected:** List of files. *(Note: If the exact files are not known at this planning stage, indicate the module or general area, e.g., "Rendering queue system").*
* **Dependencies:** What other tasks must be completed first (e.g., "Depends on 1A").
* **External API/Service Links:** One or more links to the official documentation of external APIs or third-party services required for this task.
* **Acceptance Criteria:** How we will know this is finished (technical conditions, validations, tests).

#### Subtasks:
* **1A)** [Concrete action 1]
  * *External API/Service Links:* [URLs to relevant official docs]
* **1B)** [Concrete action 2]
  * *External API/Service Links:* [URLs to relevant official docs]
* **1C)** [Concrete action 3]
  * *External API/Service Links:* [URLs to relevant official docs]

*(Repeat the structure for Task 2, Task 3, etc., numbering their subtasks as 2A, 2B...)*

## 3. Golden Rules for a Backlog
* Each main task must be a clearly understandable block.
* Each subtask must be an atomic and concrete action (e.g., "Create X interface," not "Implement X").
* **MANDATORY:** Every task and/or subtask MUST include one or more links to the official documentation of external APIs or third-party services involved. If a task does not use any external service, explicitly state "N/A - Internal logic only".
* If a task depends on another, it must be explicitly indicated.
* If a task requires validations or tests, they must be explicitly described in the Acceptance Criteria.
```

### platforms/opencode/commands/cicd.md

```
---
description: Manual CI/CD flow for a branch (fallback when the autopilot is not used)
---

# Manual CI/CD Flow

This command is the manual fallback. Prefer the external autopilot commands (`/autopilot-adopt`, `/autopilot-run`) for unattended work.

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
```

### platforms/opencode/commands/feature-brief.md

```
---
description: Convert the agreed feature discussion into a local brief
agent: planner
---

# Feature Brief

The orchestrator may invoke you with a JSON payload:

$ARGUMENTS

When the payload is present, write the brief at `briefPath` from `feature` and `description`. When it is absent, use the current conversation and the path the user provides.

You only write the brief file. Never edit source, tests, UX, CI, ADRs, or configuration.

## Brief Structure

# Feature Brief: [Name]

## Problem
What pain point or opportunity the feature addresses.

## Scope
What the feature includes, in concrete terms.

## Non-goals
What the feature explicitly does not include.

## Constraints
Technical, product, and repository constraints. Include the base branch when known.

## Acceptance Criteria
Observable conditions that prove the feature works.

## External References
Official links for every external API, library, or service the feature may need. Write "N/A" when the feature is internal only.

## Open Questions
Decisions a human must resolve before implementation.

Write the brief in English. Never reference ticket files or ADR numbers from code snippets, branch names, or commit examples.
```

### platforms/opencode/commands/identified.md

```
---
description: Document identified technical debt in local tickets
agent: auditor
---

# Technical Debt Identification

The orchestrator may invoke you with a JSON payload:

$ARGUMENTS

When the payload is present, `scope`, `patchPath`, `changedFiles`, `evidenceFile`, and `outputDir` describe the audit. When it is absent, audit what the user requested.

## PHASE 0: Evidence and Scope (MANDATORY)
1. When a payload is present, read the patch and the evidence file, and treat the payload `changedFiles` as the only scope.
2. When no payload is present, verify the debt in the actual code with your reading and search tools. If the user points at a file or module, read it. If the user asks for a category of debt, search the critical areas. Never read the entire project at once.
3. The evidence file may reference compiler warnings, test output, and recent runtime logs. Use it as evidence; do not create any diagnostic report.
4. You may only write inside the output directory under `tickets/identified/`. Source, tests, UX, CI, ADRs, and configuration are read-only for you.

## PHASE 1: Strict Verification
Obtain exact line numbers, actual function or class names, and the directly affected files from the current code. Never invent paths or lines. If a datapoint cannot be verified, say so instead of guessing.

## PHASE 2: Writing
For each debt, create one independent Markdown file in English under the output directory, using the repository naming convention or `[number]-[short-name].md`.

### Document Structure

## 0. Classification
Select and briefly justify the type of debt:
* [ ] 🧩 **Code Smell:** duplication, giant methods, confusing names, god classes.
* [ ] 🧱 **Unnecessary Complexity:** over-engineered logic, deep nesting, coupling.
* [ ] 🧪 **Lack of Coverage:** critical modules without tests or insufficient coverage.
* [ ] 📦 **Outdated Library:** outdated, deprecated, or vulnerable dependencies.
* [ ] 🏗️ **Architecture:** design principle violations, poorly distributed responsibility.
* [ ] 📝 **Missing Documentation:** critical code without comments or outdated docs.

Select and briefly justify the priority level:
* [ ] 🔴 Urgent: causing recurring bugs, blocking features, or compromising security or performance.
* [ ] 🟡 Important: hinders development, increases implementation time, or causes confusion.
* [ ] 🔵 Minor: improves long-term maintainability without impacting the current pace.

## 1. Objective
Document and classify the detected debt before it becomes a real problem. It must be clear what is wrong, where it is, and what risk it implies.

## 2. Evidence
### Location
* **File(s):** exact path verified in the code.
* **Line(s) / Block:** exact line range or name of the function, class, or module.

### Problem Description
What is wrong and why it is a problem. Concrete and technical.

### Current Symptoms
* [ ] Recurring errors in QA or bugs.
* [ ] Inflated development time in this area.
* [ ] Difficulty or impossibility to write tests.
* [ ] Frequent conflicts in pull requests.
* [ ] Others: specify.

### Metrics
Only when extractable from code: coverage, complexity or size, library version.

## 3. Impact
### Affected Files
* **Direct:** files involved in the problem.
* **Indirect (Risk):** files that could break if this fails or during a refactor.

### Dependent Modules
What parts of the application consume or depend on the defective code.

### Risk of Inaction
* **Short term:** observable consequence.
* **Medium term:** larger consequence.

## 4. References
Related issues, previous pull requests, and resources. Never reference a ticket file or an ADR number from code snippets.

## GOLDEN RULES (NON-NEGOTIABLE)
1. **ZERO SOLUTIONS:** never propose refactors, new architectures, or complete solutions. Only the finding is documented.
2. **ATOMICITY:** one file equals one specific problem. Multiple debts in the same file become multiple files.
3. **TRUTHFULNESS:** if you cannot verify the exact lines or files with your tools, write "To be verified in IDE" instead of guessing.
4. **READ-ONLY:** never edit source, tests, UX, CI, ADRs, or configuration. Never implement a UX change. If you find a UX improvement, document it as an observation in your final message, not as a code change.
5. **NO DIAGNOSTIC REPORT:** do not create a separate diagnostics artifact. The evidence is an input.
6. **LOCAL ONLY:** these tickets are local artifacts. Do not commit, push, or reference them from Git.

End with a short summary: scope, files written, and debts found per severity.
```

### platforms/opencode/commands/ready-for-dev.md

````
---
description: Generate Ready-for-Dev tickets from a backlog
agent: planner
---

# "Ready for Dev" Ticket Generation

The orchestrator may invoke you with a JSON payload:

$ARGUMENTS

When the payload is present, read the backlog under `backlogDir` and write tickets under `outputDir` using the `feature` slug. Tickets are local artifacts; never edit source, tests, UX, CI, ADRs, or configuration.

## PHASE 1: Analysis and Context (MANDATORY)
Before writing any tickets, you must understand the current project context.
1. Read the Backlog provided by the user.
2. Use your file-reading tools to explore the project's current structure. Identify the existing architecture, code patterns, and conventions.
3. Do not assume file or class names; verify them in the codebase.

## PHASE 2: Ticket Generation
For each main task (or complex sub-task) in the Backlog, generate an independent technical ticket.
**OUTPUT INSTRUCTION:** Create an independent Markdown file for each ticket in English and in the path indicated by the user (or by default in `tickets/ready-for-dev/[feature]/[number-of-ticket]-[ticket-name].md`).

## Front Matter (MANDATORY)
Every ticket starts with this front matter so the orchestrator can order tickets without ticket identifiers in Git:

```yaml
---
id: [unique-short-id]
feature: [feature-slug]
type: [feat|fix|refactor|perf|test|docs|chore]
priority: [urgent|important|minor]
depends_on: [id-or-empty-list]
---
```

Never put ticket identifiers or ADR numbers in code snippets, branch names, commit examples, or pull request examples.

## Structure of each Ticket

## 0. Classification
Select and briefly justify the priority level:
* [ ] 🔴 Urgent: Core functionality.
* [ ] 🟡 Important: Extra functionality.
* [ ] 🔵 Minor: Visual/UX improvements.

## 1. Objective
What is to be built or solved, in one or two clear sentences.

## 2. Files
### New files
* List of new files to be created (with their full paths).
### Modified files
* List of existing files to be touched (with their full paths). *Verify that they exist in the project.*

## 3. Implementation (Technical Specification)
Detailed technical description of how it should work. It must be so clear that a junior developer (or an AI) can code it without asking questions.
* **Interfaces / Types:** Define the necessary data structures, interfaces, or types.
* **Classes / Functions:** Suggested names, signatures, and responsibilities.
* **Main Flow:** Step-by-step execution logic for the happy path.
* **Validations and Thresholds:** Which data is validated and what the limits are.
* **Edge cases:** How it behaves in extreme situations or error scenarios.

## 4. Acceptance Criteria (Definition of Done)
Technical and functional conditions that must be met to close the ticket.
* The code compiles without errors or critical warnings.
* Unit tests have been written for the new logic.
* The UI (if applicable) respects the design across all breakpoints/states.
* There are no console.log statements, print statements, or commented-out code.

## 5. Technical Notes
Important details for implementation:
* **Dependencies/Libraries:** Which external packages are required (and versions if applicable).
* **Design decisions:** Why this approach was chosen over another.
* **Error handling:** How and where errors should be caught and thrown.
* **Architecture Impact:** If this implementation introduces a new framework, database, or core pattern, you MUST trigger the `adr.md` workflow to document the decision before proceeding.
````

### platforms/opencode/commands/ready-for-refactor.md

````
---
description: Generate refactor tickets from an Identified document
agent: planner
---

# Ready for Refactor Ticket Generation

The orchestrator may invoke you with a JSON payload:

$ARGUMENTS

When the payload is present, read the Identified tickets and the scope patch or file list it provides, and write tickets under the payload `outputDir`. Stay inside the provided scope. Tickets are local artifacts; never edit source, tests, UX, CI, ADRs, or configuration.

## PHASE 1: Context and Code Analysis (MANDATORY)
Before writing the plan, you must understand the original problem and the current code.
1. Read the source `📌Identified` document provided by the user.
2. Use your reading tools to analyze the current source code files involved.
3. Identify what tests currently exist for that code (if any).
4. **Do not write refactoring code yet.** Your only job in this phase is to create the plan.

## PHASE 2: Plan Generation and Saving
For each main task (or complex sub-task) in the Identified, generate an independent technical ticket.
**OUTPUT INSTRUCTION:** Create an independent Markdown file for each ticket in English and in the path indicated by the user (or by default in `tickets/ready-for-refactor/[feature]/[number-of-ticket]-[ticket-name].md`).

## Front Matter (MANDATORY)
Every ticket starts with this front matter so the orchestrator can order tickets without ticket identifiers in Git:

```yaml
---
id: [unique-short-id]
feature: [feature-slug]
type: refactor
priority: [urgent|important|minor]
depends_on: [id-or-empty-list]
---
```

Never put ticket identifiers or ADR numbers in code snippets, branch names, commit examples, or pull request examples.

## Document Structure

## 0. Classification
Select and briefly justify the type of debt:
* [ ] 🧩 **Code Smell:** (duplication, giant methods, confusing names, god classes).
* [ ] 🧱 **Unnecessary Complexity:** (over-engineered logic, deep nesting, coupling).
* [ ] 🧪 **Lack of Coverage:** (critical modules without tests or insufficient coverage).
* [ ] 📦 **Outdated Library:** (outdated, deprecated, or vulnerable dependencies).
* [ ] 🏗️ **Architecture:** (design principle violations, poorly distributed responsibility).
* [ ] 📝 **Missing Documentation:** (critical code without comments or outdated docs).

Select and briefly justify the priority level:
* [ ] 🔴 Urgent: Technical debt is causing recurring bugs, blocking features, or compromising security/performance.
* [ ] 🟡 Important: Hinders development, increases implementation time, or causes confusion.
* [ ] 🔵 Minor: Improves long-term maintainability but does not impact the current workflow pace.

## 1. Objective
Clearly describe what technical debt will be resolved, how it will be refactored, and what measures will be taken to ensure that current functionality does not break.

## 2. Files
### Files to modify
* [Exact path] - [Brief description of what will be cleaned/restructured]
### Files to delete
* [Exact path] - [Reason why it becomes obsolete]
### New files
* [Exact path] - [Responsibility this new file will assume]

## 3. Refactoring Strategy
Technical description of the chosen approach.
* **Pattern or technique to apply:** (e.g., Extract Class, Strategy Pattern, Strangler Fig).
* **Execution steps:** (Numbered list of logical and atomic steps to get from the current state to the desired state).
* **API/Contract changes:** (If function signatures, interfaces, or endpoints change, detail how).

## 4. Risk Mitigation Plan (CRITICAL)
Since the goal is not to break current functionality, detail how stability will be ensured:
* **Tests to add BEFORE touching code (Characterization Tests):** What current behaviors we must test to have a safety net.
* **Tests to modify after the refactor:** Which existing tests will have to change their assertion or mock due to the new structure.
* **Rollback / Feature Flags Strategy:** How the change will be hidden or reverted if something fails in production (if applicable).

## 5. Acceptance Criteria (Definition of Done)
* [ ] The original problem from the `Identified` document has been completely eliminated.
* [ ] All existing tests pass 100% without modifying their original assertion (unless the test was poorly written).
* [ ] Test coverage remains the same or increases (never decreases).
* [ ] No new unnecessary dependencies have been introduced.
* [ ] The code passes the linter and static quality rules without new warnings.

## 6. Technical Notes and Design Decisions
* **Discarded alternatives:** Brief explanation of why this strategy was chosen over others.
* **Accepted trade-offs:** Temporary complexity assumed to solve the problem in the long term.
* **Performance/Memory impact:** Whether the new structure consumes more/fewer resources.
````

### platforms/opencode/commands/release.md

```
---
description: Calculate the version, update the changelog, and prepare a release
agent: autopilot
---

# Release and Changelog Generation

The orchestrator may invoke you with a JSON payload:

$ARGUMENTS

When the payload is present, `mode` is `release`, `version`, `branch`, `baseBranch`, and `releaseBranch` are provided. When it is absent, calculate the version from the commits and stop before writing anything until the user approves it.

## PHASE 1: Analysis (READ-ONLY)
1. Inspect the project root and locate its version manifest and changelog.
2. Read `baseBranch` and `releaseBranch` from `.autopilot.json` when present; otherwise detect the integration branch and the release branch from the repository.
3. Get the last tag with `git describe --tags --abbrev=0`. If no tag exists, use the full commit log; otherwise log the commits since the last tag.
4. Parse commit subjects with Conventional Commits (`feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`). Ignore merge commits.

## PHASE 2: Version Calculation
Calculate the semantic version:
- `BREAKING CHANGE` or `feat!` bumps MAJOR.
- At least one `feat` bumps MINOR.
- Only `fix`, `refactor`, `perf`, `test`, `docs`, or `chore` bumps PATCH.
An explicit `version` in the payload wins over the calculation.

## PHASE 3: Changelog and Manifest
Generate a new `CHANGELOG.md` section:

## [New Version] - YYYY-MM-DD
### Added
- From `feat` commits.
### Fixed
- From `fix` commits.
### Changed
- From `refactor`, `perf`, `test`, `docs`, and `chore` commits.

Update the version in the manifest file.

## PHASE 4: Execution
- When invoked by the orchestrator, write the changes and commit with `chore: release v<version>`. When the payload provides `restoreCommand`, `buildCommand`, or `testCommand`, use those exact commands to verify the repository before committing. Never push, merge, or tag; the orchestrator handles the pull request, the merge, and the tag.
- When invoked interactively, update the files and STOP before committing. Report the proposed version and changes, then wait for explicit approval.
- Never reference tickets, ADRs, or issues in commit messages or changelog entries. No scope parentheses.
```

### platforms/opencode/commands/ux-review.md

```
---
description: Read-only UX audit that writes local proposal tickets on demand
agent: auditor
---

# UX Review

Run this command only when the user asks for it.

Audit the requested screen, flow, or diff as a read-only reviewer.

Rules:

- Never edit source, tests, UX, CI, ADRs, or configuration.
- You may only write Markdown proposals under `tickets/ux/`.
- Never implement a proposal. The proposal is the deliverable.
- Verify every element and flow against the current code with your reading and search tools. Never guess a selector, view, or view model name.
- Reference no ticket files or ADR numbers from code snippets or identifiers.

## Proposal Structure

# UX Proposal: [Short title]

## Context
Screen, flow, or diff reviewed.

## Observation
What the user experiences today, with exact evidence from the code.

## Impact
Who is affected and how often.

## Proposal
The recommended change, described at UX level only. No implementation steps.

## Alternatives
At least one alternative and its tradeoff.

## Open Questions
Decisions a human must resolve before implementation.

Write proposals in English. End with a short list of the files you created.
```

### src/cli.js

```
#!/usr/bin/env node
import path from 'node:path'
import { parseCliArgs } from './lib/util.js'
import { loadConfig } from './lib/config.js'
import { StateStore } from './lib/state.js'
import { runAdopt } from './phases/adopt.js'
import { runIdentify } from './phases/identify.js'
import { runApprove, runDev, runPrepare, runRefactor, runRelease } from './phases/pipeline.js'

const PHASES = ['prepare', 'approve', 'dev', 'identify', 'refactor', 'release', 'adopt']

async function main() {
  const { command, options } = parseCliArgs(process.argv.slice(2))
  const repoPath = path.resolve(String(options.repo ?? process.cwd()))
  const log = message => process.stdout.write(`${message}\n`)

  if (command === 'help' || options.help) return printHelp()

  const config = await loadConfig(repoPath)
  const stateStore = new StateStore(config)

  if (command === 'status') return printStatus(await stateStore.load())
  if (command === 'abort') return abortRun(stateStore)
  if (command === 'resume') return resumeRun({ config, stateStore, options, log })

  await stateStore.lock()
  try {
    const ctx = { config, stateStore, options, log }
    let result
    if (command === 'adopt') result = await runAdopt(ctx)
    else if (command === 'identify') result = await runIdentify(ctx)
    else if (command === 'prepare') result = await runPrepare(ctx)
    else if (command === 'approve') result = await runApprove(ctx)
    else if (command === 'dev') result = await runDev(ctx)
    else if (command === 'refactor') result = await runRefactor(ctx)
    else if (command === 'release') result = await runRelease(ctx)
    else if (command === 'run') result = await runSequence(ctx)
    else throw new Error(`Unknown command: ${command}`)
    printResult(result)
    return result
  } finally {
    await stateStore.unlock()
  }
}

async function runSequence({ config, stateStore, options, log }) {
  const from = String(options.from ?? 'prepare')
  const to = String(options.to ?? 'refactor')
  const start = PHASES.indexOf(from)
  const end = PHASES.indexOf(to)
  if (start < 0 || end < 0 || start > end) throw new Error(`Invalid phase range: ${from}..${to}`)

  const results = []
  for (const phase of PHASES.slice(start, end + 1)) {
    if (!['prepare', 'approve', 'dev', 'identify', 'refactor', 'release', 'adopt'].includes(phase)) continue
    log(`Running phase ${phase}.`)
    const ctx = { config, stateStore, options, log }
    if (phase === 'prepare') results.push(await runPrepare(ctx))
    if (phase === 'approve') results.push(await runApprove(ctx))
    if (phase === 'dev') results.push(await runDev(ctx))
    if (phase === 'identify') results.push(await runIdentify(ctx))
    if (phase === 'refactor') results.push(await runRefactor(ctx))
    if (phase === 'release') results.push(await runRelease(ctx))
    if (phase === 'adopt') results.push(await runAdopt(ctx))
  }
  return { from, to, results }
}

async function resumeRun({ config, stateStore, options, log }) {
  const state = await stateStore.load()
  if (!state) throw new Error('No state found for this repository.')
  log(`Resuming ${state.mode} at phase ${state.phase}.`)
  await stateStore.lock()
  try {
    const ctx = { config, stateStore, options: { ...options, branch: state.branch, base: state.baseBranch, feature: state.feature }, log }
    let result
    if (state.mode === 'adopt') result = await runAdopt(ctx)
    else if (state.mode === 'prepare') result = await runPrepare(ctx)
    else if (state.mode === 'dev') result = await runDev(ctx)
    else if (state.mode === 'refactor') result = await runRefactor(ctx)
    else if (state.mode === 'identify') result = await runIdentify(ctx)
    else throw new Error(`Cannot resume mode ${state.mode} automatically.`)
    printResult(result)
    return result
  } finally {
    await stateStore.unlock()
  }
}

function printResult(result) {
  if (result === undefined || result === null) return
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

async function abortRun(stateStore) {
  const state = await stateStore.load()
  if (state) {
    state.phase = 'aborted'
    state.updatedAt = new Date().toISOString()
    await stateStore.save(state)
  }
  await stateStore.unlock()
  process.stdout.write('Autopilot run marked as aborted and the lock was released.\n')
}

function printStatus(state) {
  if (!state) {
    process.stdout.write('No autopilot state found for this repository.\n')
    return
  }
  const summary = {
    runId: state.runId,
    mode: state.mode,
    phase: state.phase,
    feature: state.feature,
    branch: state.branch,
    prNumber: state.prNumber,
    mergeCommit: state.mergeCommit,
    scopes: state.scopes?.length ?? 0,
    completedPhases: state.completedPhases
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

function printHelp() {
  process.stdout.write(`ai-autopilot

Usage:
  node src/cli.js adopt --repo <path> [--branch <name>] [--base <branch>] [--title <title>] [--dry-run]
  node src/cli.js identify --repo <path> --scope branch:<name> [--scope pr:<number>] [--scope dir:<path>]
  node src/cli.js prepare --repo <path> --feature <slug> [--description <text>]
  node src/cli.js approve --repo <path> --feature <slug>
  node src/cli.js dev --repo <path> --feature <slug>
  node src/cli.js refactor --repo <path> --feature <slug>
  node src/cli.js release --repo <path> --version <x.y.z>
  node src/cli.js run --repo <path> --from <phase> --to <phase> [--feature <slug>]
  node src/cli.js status --repo <path>
  node src/cli.js resume --repo <path>
  node src/cli.js abort --repo <path>
`)
}

main().catch(error => {
  process.stderr.write(`autopilot: ${error.message}\n`)
  process.exitCode = 1
})
```

### src/lib/artifacts.js

```
import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureDir } from './util.js'

export class Artifacts {
  constructor(config, runId) {
    this.config = config
    this.runId = runId
    this.dir = path.join(config.stateDir, 'artifacts', runId)
    this.logsDir = path.join(config.stateDir, 'logs')
    this.logFile = path.join(this.logsDir, `${runId}.jsonl`)
  }

  async init() {
    await ensureDir(this.dir)
    await ensureDir(this.logsDir)
  }

  path(name) {
    return path.join(this.dir, name)
  }

  async write(name, content) {
    const file = this.path(name)
    await ensureDir(path.dirname(file))
    await fs.writeFile(file, content, 'utf8')
    return file
  }

  async log(event) {
    await ensureDir(this.logsDir)
    const record = { at: new Date().toISOString(), ...event }
    await fs.appendFile(this.logFile, `${JSON.stringify(record)}\n`, 'utf8')
  }
}
```

### src/lib/config.js

```
import path from 'node:path'
import { expandEnv, exists, readJson, assert } from './util.js'

const DEFAULT_TICKET_DIRS = {
  backlog: 'tickets/backlog',
  readyForDev: 'tickets/ready-for-dev',
  identified: 'tickets/identified',
  readyForRefactor: 'tickets/ready-for-refactor',
  ux: 'tickets/ux',
  done: 'tickets/done'
}

const DEFAULTS = {
  baseBranch: 'main',
  releaseBranch: 'main',
  requiredChecks: [],
  ignoredChecks: [],
  restoreCommand: null,
  buildCommand: null,
  testCommand: null,
  coverageThreshold: null,
  maxAttempts: 3,
  maxMinutes: 240,
  commandTimeoutMinutes: 30,
  sessionTimeoutMinutes: 90,
  checkPollSeconds: 30,
  checkTimeoutMinutes: 30,
  autoMerge: true,
  approvalRequired: true,
  prTitle: null,
  runtimeLogs: [],
  commitTypes: ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'chore'],
  agents: {
    executor: 'autopilot',
    planner: 'planner',
    auditor: 'auditor',
    setup: 'setup'
  },
  models: {
    executor: null,
    planner: null,
    auditor: null,
    setup: null
  }
}

/**
 * Loads and normalizes the per-repository autopilot configuration.
 */
export async function loadConfig(repoPath) {
  const resolvedRepo = path.resolve(repoPath)
  const configPath = path.join(resolvedRepo, '.autopilot.json')
  const raw = await readJson(configPath)
  assert(raw, `Missing .autopilot.json at ${configPath}. Run /autopilot-init first.`)

  const config = { ...DEFAULTS, ...expandEnv(raw) }
  config.repoPath = resolvedRepo
  config.configPath = configPath
  config.ticketDirs = { ...DEFAULT_TICKET_DIRS, ...(config.ticketDirs ?? {}) }
  config.agents = { ...DEFAULTS.agents, ...(config.agents ?? {}) }
  config.models = { ...DEFAULTS.models, ...(config.models ?? {}) }

  if (!config.stateDir) {
    config.stateDir = await exists(path.join(resolvedRepo, 'tickets'))
      ? path.join(resolvedRepo, 'tickets', '.autopilot')
      : path.join(resolvedRepo, '.autopilot')
  } else {
    config.stateDir = path.resolve(resolvedRepo, config.stateDir)
  }

  config.runtimeLogs = (config.runtimeLogs ?? []).map(pattern => path.resolve(resolvedRepo, pattern))
  config.requiredChecks = asArray(config.requiredChecks)
  config.ignoredChecks = asArray(config.ignoredChecks)
  config.commitTypes = asArray(config.commitTypes)

  assert(config.baseBranch, 'baseBranch is required')
  assert(config.releaseBranch, 'releaseBranch is required')
  validateCommand(config.restoreCommand, 'restoreCommand')
  validateCommand(config.buildCommand, 'buildCommand')
  validateCommand(config.testCommand, 'testCommand')
  assert(config.maxAttempts > 0, 'maxAttempts must be greater than zero')

  return config
}

function asArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function validateCommand(command, name) {
  if (command == null) return
  assert(Array.isArray(command) && command.length > 0, `${name} must be an array of arguments`)
  assert(command.every(item => typeof item === 'string'), `${name} arguments must be strings`)
}
```

### src/lib/coverage.js

```
import fs from 'node:fs/promises'
import path from 'node:path'
import { walkFiles } from './util.js'

/**
 * Reads every Cobertura report under TestResults and returns the aggregate
 * line coverage. Returns null when no report exists.
 */
export async function readCoverage(repoPath) {
  const reports = await walkFiles(
    path.join(repoPath, 'TestResults'),
    file => file.endsWith('coverage.cobertura.xml')
  )
  if (reports.length === 0) return null

  let covered = 0
  let valid = 0
  for (const report of reports) {
    const xml = await fs.readFile(report, 'utf8')
    covered += sumAttribute(xml, 'lines-covered')
    valid += sumAttribute(xml, 'lines-valid')
  }
  if (valid === 0) return null
  return { covered, valid, rate: covered / valid, reports }
}

function sumAttribute(xml, attribute) {
  const matches = xml.match(new RegExp(`${attribute}="(\\d+)"`, 'g')) ?? []
  return matches.reduce((total, item) => total + Number(item.match(/="(\d+)"/)[1]), 0)
}

export function formatCoverage(coverage) {
  if (!coverage) return 'no coverage report'
  return `${(coverage.rate * 100).toFixed(2)}% (${coverage.covered}/${coverage.valid} lines)`
}
```

### src/lib/forbidden.js

```
const FORBIDDEN_PATHS = [
  /^\.github\//,
  /^AGENTS\.md$/,
  /^opencode\.jsonc?$/,
  /^\.autopilot\.json$/
]

export function findForbidden(files) {
  return (files ?? []).filter(file => FORBIDDEN_PATHS.some(pattern => pattern.test(file)))
}
```

### src/lib/gates.js

```
import { runCommand } from './runner.js'
import { readCoverage, formatCoverage } from './coverage.js'

/**
 * Runs restore, build, test, and coverage locally. The GitHub workflow remains
 * the final authority; these gates catch failures before a push.
 */
export async function runGates({ config, artifacts, prefix = 'gate' }) {
  const steps = [
    ['restore', config.restoreCommand],
    ['build', config.buildCommand],
    ['test', config.testCommand]
  ].filter(([, command]) => Array.isArray(command) && command.length > 0)

  const results = []
  for (const [name, command] of steps) {
    const [executable, ...args] = command
    const result = await runCommand(executable, args, {
      cwd: config.repoPath,
      timeoutMs: config.commandTimeoutMinutes * 60000,
      logFile: artifacts.path(`${prefix}-${name}.log`)
    })
    results.push({ name, ...result })
    if (result.code !== 0) {
      return { ok: false, results, failed: name, reason: `${name} failed with exit code ${result.code}.` }
    }
  }

  const coverage = await readCoverage(config.repoPath)
  if (config.coverageThreshold != null) {
    if (!coverage) {
      return { ok: false, results, failed: 'coverage', reason: 'No Cobertura coverage report was produced.' }
    }
    if (coverage.rate < config.coverageThreshold) {
      return {
        ok: false,
        results,
        coverage,
        failed: 'coverage',
        reason: `Coverage ${formatCoverage(coverage)} is below the configured minimum ${(config.coverageThreshold * 100).toFixed(2)}%.`
      }
    }
  }

  return { ok: true, results, coverage }
}

export function gateFailureText(result) {
  const failed = result.results?.find(item => item.name === result.failed)
  const output = failed ? `${failed.stdout}\n${failed.stderr}` : ''
  return `${result.reason}\n\n${output}`.trim()
}
```

### src/lib/git.js

```
import { runCommand } from './runner.js'

async function git(repo, args, options = {}) {
  const result = await runCommand('git', args, { cwd: repo, logFile: options.logFile, timeoutMs: options.timeoutMs ?? 120000 })
  if (result.code !== 0 && !options.allowFailure) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  }
  return result
}

export async function currentBranch(repo) {
  const result = await git(repo, ['branch', '--show-current'])
  return result.stdout.trim()
}

export async function statusPorcelain(repo) {
  const result = await git(repo, ['status', '--porcelain'])
  return result.stdout.trim()
}

/**
 * Returns the tracked or untracked entries that should block an automated run.
 * Untracked files whose path matches an allowed prefix are ignored so local
 * configuration and ticket directories never block the orchestrator.
 */
export async function statusBlocking(repo, allowedPrefixes = []) {
  const result = await git(repo, ['status', '--porcelain'])
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(line => {
      if (!line.startsWith('??')) return true
      const file = line.slice(3).trim().replace(/^"|"$/g, '')
      return !allowedPrefixes.some(prefix => file === prefix || file.startsWith(prefix))
    })
}

export async function fetch(repo) {
  await git(repo, ['fetch', '--prune', 'origin'])
}

export async function revParse(repo, ref) {
  const result = await git(repo, ['rev-parse', ref])
  return result.stdout.trim()
}

export async function branchExists(repo, branch, remote = false) {
  const ref = remote ? `refs/remotes/origin/${branch}` : `refs/heads/${branch}`
  const result = await git(repo, ['show-ref', '--verify', '--quiet', ref], { allowFailure: true })
  return result.code === 0
}

export async function remoteBranchExists(repo, branch) {
  return branchExists(repo, branch, true)
}

export async function mergeBase(repo, left, right) {
  const result = await git(repo, ['merge-base', left, right])
  return result.stdout.trim()
}

export async function diff(repo, range) {
  const result = await git(repo, ['diff', '--no-ext-diff', range])
  return result.stdout
}

export async function diffNames(repo, range) {
  const result = await git(repo, ['diff', '--name-only', '--no-ext-diff', range])
  return result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
}

export async function logCommits(repo, range) {
  const result = await git(repo, ['log', '--format=%H%x1f%s%x1f%b%x1e', range])
  return result.stdout
    .split('\x1e')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [sha, subject, body = ''] = item.split('\x1f')
      return { sha, subject, body, message: `${subject}\n${body}`.trim() }
    })
}

export async function switchBranch(repo, branch) {
  await git(repo, ['switch', branch])
}

export async function createBranchFrom(repo, branch, base) {
  await git(repo, ['switch', '-c', branch, `origin/${base}`])
}

export async function push(repo, branch) {
  await git(repo, ['push', '-u', 'origin', branch])
}

export async function deleteRemoteBranch(repo, branch) {
  await git(repo, ['push', 'origin', '--delete', branch], { allowFailure: true })
}

export async function listLocalBranches(repo) {
  const result = await git(repo, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
  return result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
}

export async function tag(repo, name, ref = 'HEAD') {
  await git(repo, ['tag', name, ref])
}

export async function pushTag(repo, name) {
  await git(repo, ['push', 'origin', name])
}
```

### src/lib/github.js

```
import { runCommand } from './runner.js'

async function gh(repo, args, options = {}) {
  const result = await runCommand('gh', args, { cwd: repo, logFile: options.logFile, timeoutMs: options.timeoutMs ?? 120000 })
  if (result.code !== 0 && !options.allowFailure) {
    throw new Error(`gh ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  }
  return result
}

function parseJson(text, fallback = null) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return fallback
  return JSON.parse(trimmed)
}

export async function prCreate(repo, { base, head, title, body, draft = false }) {
  const args = ['pr', 'create', '--base', base, '--head', head, '--title', title, '--body', body]
  if (draft) args.push('--draft')
  const result = await gh(repo, args)
  const url = result.stdout.trim().split(/\r?\n/).find(line => line.startsWith('http')) ?? ''
  const number = Number((url.match(/\/(\d+)$/) ?? [])[1] ?? 0)
  return { url, number }
}

export async function prView(repo, number) {
  const result = await gh(repo, ['pr', 'view', String(number), '--json', 'number,title,state,mergeable,mergeStateStatus,mergeCommit,headRefName,baseRefName,url,isDraft'])
  return parseJson(result.stdout)
}

export async function prChecks(repo, number) {
  const result = await gh(repo, ['pr', 'checks', String(number), '--json', 'name,state,bucket,link'], { allowFailure: true })
  return { ok: result.code === 0, checks: parseJson(result.stdout, []) }
}

export async function prDiff(repo, number) {
  const result = await gh(repo, ['pr', 'diff', String(number)])
  return result.stdout
}

export async function prFiles(repo, number) {
  const result = await gh(repo, ['pr', 'view', String(number), '--json', 'files'])
  const data = parseJson(result.stdout, { files: [] })
  return data.files ?? []
}

export async function prListByHead(repo, head) {
  const result = await gh(repo, ['pr', 'list', '--head', head, '--state', 'all', '--json', 'number,state,url,title,headRefName,baseRefName'])
  return parseJson(result.stdout, [])
}

export async function prMerge(repo, number, { title, body }) {
  await gh(repo, ['pr', 'merge', String(number), '--merge', '--subject', title, '--body', body])
}

export async function prUpdateBranch(repo, number) {
  await gh(repo, ['pr', 'update-branch', String(number)], { allowFailure: true })
}

export async function runFailedLog(repo, check) {
  const runId = runIdFromUrl(check.link ?? '')
  if (!runId) return ''
  const result = await gh(repo, ['run', 'view', String(runId), '--log-failed'], { allowFailure: true })
  return result.stdout || result.stderr
}

export function runIdFromUrl(url) {
  const match = String(url ?? '').match(/\/runs\/(\d+)/)
  return match ? match[1] : null
}
```

### src/lib/opencode.js

```
import { runCommand } from './runner.js'

/**
 * Runs a custom OpenCode command in a fresh non-interactive session. The
 * command file selects the agent and permissions; this helper only supplies the
 * repository, title, and a single JSON payload as the message.
 */
export async function runOpenCode({ config, command, payload, title, logFile, role }) {
  const args = [
    'run',
    '--command',
    command,
    '--auto',
    '--dir',
    config.repoPath,
    '--title',
    title
  ]
  const model = role ? config.models?.[role] : null
  if (model) args.push('--model', model)
  if (payload !== undefined) args.push(JSON.stringify(payload))
  return runCommand('opencode', args, {
    cwd: config.repoPath,
    env: { OPENCODE_DISABLE_AUTOUPDATE: '1' },
    timeoutMs: config.sessionTimeoutMinutes * 60000,
    logFile
  })
}
```

### src/lib/policy.js

```
import fs from 'node:fs/promises'
import path from 'node:path'

const CODE_EXTENSIONS = /\.(cs|py|ts|tsx|js|jsx|rs|go|java|kt|cpp|cc|h|hpp|axaml|xaml)$/i
const TYPES = 'feat|fix|refactor|perf|test|docs|chore'
const SUBJECT_RE = new RegExp(`^(${TYPES}): [^\\s].+$`)
const SCOPED_RE = new RegExp(`^(${TYPES})\\([^)]*\\):`)
const BRANCH_RE = new RegExp(`^(${TYPES})/[a-z0-9]+(?:-[a-z0-9]+)*$`)
const TICKET_CODE_RE = /\btickets[\\/]/i
const ADR_CODE_RE = /\bADR-\d+\b/i
const TICKET_MESSAGE_RE = /\btickets[\\/]|TICKET-\d+|ticket\s*#\d+/i
const ADR_MESSAGE_RE = /\bADR-\d+\b/i
const ISSUE_REF_RE = /(^|\s)#\d+\b/

/**
 * Validates a branch name against the configured convention and rejects
 * ticket identifiers in the ref.
 */
export function validateBranchName(branch) {
  const violations = []
  if (!branch) {
    violations.push({ code: 'branch-empty', message: 'Branch name is empty.' })
    return violations
  }
  if (!BRANCH_RE.test(branch)) {
    violations.push({ code: 'branch-format', message: `Branch "${branch}" must match <type>/<kebab-case-slug> using ${TYPES}.` })
  }
  if (branch.split('/').some(segment => /^\d+$/.test(segment))) {
    violations.push({ code: 'branch-ticket-id', message: `Branch "${branch}" contains a numeric ticket-like segment.` })
  }
  if (/ticket|TICKET|#/.test(branch)) {
    violations.push({ code: 'branch-ticket-ref', message: `Branch "${branch}" contains a ticket reference.` })
  }
  if (ADR_CODE_RE.test(branch)) {
    violations.push({ code: 'branch-adr-ref', message: `Branch "${branch}" contains an ADR reference.` })
  }
  return violations
}

/**
 * Validates a commit subject and body. Scopes and ticket/ADR references are
 * forbidden because the orchestrator must keep Git artifacts independent from
 * local work items.
 */
export function validateCommitMessage(message) {
  const violations = []
  const text = String(message ?? '').trim()
  if (!text) {
    violations.push({ code: 'commit-empty', message: 'Commit message is empty.' })
    return violations
  }
  const [subject, ...bodyLines] = text.split(/\r?\n/)
  if (SCOPED_RE.test(subject)) {
    violations.push({ code: 'commit-scope', message: `Commit subject "${subject}" uses a scope. Use "${subject.replace(SCOPED_RE, '$1')}: ..." instead.` })
  }
  if (!SUBJECT_RE.test(subject)) {
    violations.push({ code: 'commit-format', message: `Commit subject "${subject}" must match "<type>: <subject>".` })
  }
  if (TICKET_MESSAGE_RE.test(text)) {
    violations.push({ code: 'commit-ticket-ref', message: 'Commit message contains a ticket reference.' })
  }
  if (ADR_MESSAGE_RE.test(text)) {
    violations.push({ code: 'commit-adr-ref', message: 'Commit message contains an ADR reference.' })
  }
  if (ISSUE_REF_RE.test(text)) {
    violations.push({ code: 'commit-issue-ref', message: 'Commit message contains an issue-like reference (#123).' })
  }
  if (bodyLines.some(line => /^Merge pull request /.test(line))) {
    violations.push({ code: 'commit-merge-default', message: 'Commit message uses the GitHub default merge subject.' })
  }
  return violations
}

export function validatePrTitle(title) {
  const violations = []
  const text = String(title ?? '').trim()
  if (!SUBJECT_RE.test(text)) {
    violations.push({ code: 'pr-title-format', message: `PR title "${text}" must match "<type>: <subject>".` })
  }
  if (SCOPED_RE.test(text)) {
    violations.push({ code: 'pr-title-scope', message: `PR title "${text}" uses a scope.` })
  }
  if (TICKET_MESSAGE_RE.test(text)) {
    violations.push({ code: 'pr-title-ticket-ref', message: 'PR title contains a ticket reference.' })
  }
  if (ADR_MESSAGE_RE.test(text)) {
    violations.push({ code: 'pr-title-adr-ref', message: 'PR title contains an ADR reference.' })
  }
  if (ISSUE_REF_RE.test(text)) {
    violations.push({ code: 'pr-title-issue-ref', message: 'PR title contains an issue-like reference.' })
  }
  return violations
}

export function validatePrBody(body) {
  const violations = []
  const text = String(body ?? '')
  if (TICKET_MESSAGE_RE.test(text)) {
    violations.push({ code: 'pr-body-ticket-ref', message: 'PR body contains a ticket reference.' })
  }
  if (ADR_MESSAGE_RE.test(text)) {
    violations.push({ code: 'pr-body-adr-ref', message: 'PR body contains an ADR reference.' })
  }
  if (ISSUE_REF_RE.test(text)) {
    violations.push({ code: 'pr-body-issue-ref', message: 'PR body contains an issue-like reference.' })
  }
  return violations
}

/**
 * Scans added diff lines for references that must never reach source code.
 * Issue-style #123 references are intentionally checked only in commit and PR
 * text, because color literals such as #0AFFFFFF are valid in XAML and CSS.
 */
export function scanAddedLines(diff) {
  const violations = []
  const lines = String(diff ?? '').split(/\r?\n/)
  let currentFile = null
  let newLine = 0
  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      currentFile = line.slice(4).replace(/^b\//, '')
      continue
    }
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/)
      newLine = match ? Number(match[1]) : 0
      continue
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const added = line.slice(1)
      if (TICKET_CODE_RE.test(added)) {
        violations.push({ code: 'code-ticket-ref', file: currentFile, line: newLine, message: `Added code contains a ticket path: ${added.trim()}` })
      }
      if (ADR_CODE_RE.test(added)) {
        violations.push({ code: 'code-adr-ref', file: currentFile, line: newLine, message: `Added code contains an ADR reference: ${added.trim()}` })
      }
      newLine += 1
    } else if (!line.startsWith('-')) {
      newLine += 1
    }
  }
  return violations
}

export function scanBranch({ branch, commits, diff }) {
  const violations = [...validateBranchName(branch)]
  for (const commit of commits ?? []) {
    violations.push(...validateCommitMessage(commit.message ?? commit.subject ?? ''))
  }
  violations.push(...scanAddedLines(diff))
  return violations
}

export function formatViolations(violations) {
  return violations.map(item => {
    const location = item.file ? `${item.file}${item.line ? `:${item.line}` : ''}` : ''
    return `${location ? `${location} ` : ''}[${item.code}] ${item.message}`
  }).join('\n')
}

/**
 * Scans the current content of the changed code files. The Git artifact policy
 * forbids ticket and ADR references in code even when they predate the branch,
 * so fixing the files the branch already touches is part of adoption.
 */
export async function scanRepositoryFiles(repoPath, files) {
  const violations = []
  for (const file of files ?? []) {
    if (!CODE_EXTENSIONS.test(file)) continue
    const full = path.join(repoPath, file)
    let text
    try {
      text = await fs.readFile(full, 'utf8')
    } catch {
      continue
    }
    text.split(/\r?\n/).forEach((line, index) => {
      if (TICKET_CODE_RE.test(line)) {
        violations.push({ code: 'file-ticket-ref', file, line: index + 1, message: `Code contains a ticket path: ${line.trim()}` })
      }
      if (ADR_CODE_RE.test(line)) {
        violations.push({ code: 'file-adr-ref', file, line: index + 1, message: `Code contains an ADR reference: ${line.trim()}` })
      }
    })
  }
  return violations
}
```

### src/lib/pr.js

```
import * as git from './git.js'
import * as github from './github.js'
import { runOpenCode } from './opencode.js'
import { scanBranch, scanRepositoryFiles, formatViolations, validatePrBody } from './policy.js'
import { findForbidden } from './forbidden.js'
import { runGates, gateFailureText } from './gates.js'
import { generateMergeBody } from './title.js'
import { sleep, truncate } from './util.js'

const FAILED_STATES = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'])
const PENDING_STATES = new Set(['PENDING', 'QUEUED', 'IN_PROGRESS', 'WAITING', 'REQUESTED'])

/**
 * Creates or reuses the pull request for a branch. The branch must already be
 * pushed. Returns the PR number and state.
 */
export async function ensurePullRequest({ config, branch, baseBranch, title, body, logFile }) {
  const existing = await github.prListByHead(config.repoPath, branch)
  const open = existing.find(pr => pr.state === 'OPEN')
  if (open) {
    if (open.baseRefName !== baseBranch) {
      throw new Error(`An open pull request for ${branch} targets ${open.baseRefName}, not ${baseBranch}.`)
    }
    return open
  }
  const merged = existing.find(pr => pr.state === 'MERGED')
  if (merged) return merged

  const bodyViolations = validatePrBody(body)
  if (bodyViolations.length > 0) {
    throw new Error(`PR body violates policy:\n${formatViolations(bodyViolations)}`)
  }

  const created = await github.prCreate(config.repoPath, {
    base: baseBranch,
    head: branch,
    title,
    body
  })
  if (!created.number) throw new Error('Could not parse the pull request number from gh pr create.')
  return { number: created.number, state: 'OPEN', url: created.url, title }
}

/**
 * Waits until every required check succeeds and every non-ignored check is
 * terminal. Unknown checks are treated as blocking unless explicitly ignored.
 */
export async function waitForChecks({ config, artifacts, prNumber }) {
  const started = Date.now()
  const deadline = started + config.checkTimeoutMinutes * 60000
  let lastChecks = []

  while (Date.now() < deadline) {
    const result = await github.prChecks(config.repoPath, prNumber)
    lastChecks = result.checks
    await artifacts.write('checks-latest.json', JSON.stringify(lastChecks, null, 2))

    const ignored = new Set(config.ignoredChecks)
    const nonIgnored = lastChecks.filter(check => !ignored.has(check.name))
    const failed = nonIgnored.filter(check => FAILED_STATES.has(check.state))
    const pending = nonIgnored.filter(check => PENDING_STATES.has(check.state))
    const required = config.requiredChecks
    const requiredChecks = required.map(name => lastChecks.find(check => check.name === name))
    const missing = required.filter((name, index) => !requiredChecks[index])

    if (failed.length > 0) {
      return { ok: false, checks: lastChecks, failed, reason: 'One or more CI checks failed.' }
    }
    if (missing.length > 0 && Date.now() - started > 120000) {
      return { ok: false, checks: lastChecks, failed: [], reason: `Required checks were not reported: ${missing.join(', ')}` }
    }
    if (pending.length === 0) {
      if (required.length > 0 && requiredChecks.every(check => check?.state === 'SUCCESS')) {
        return { ok: true, checks: lastChecks }
      }
      if (required.length === 0 && nonIgnored.every(check => check.state === 'SUCCESS' || check.state === 'SKIPPED' || check.state === 'NEUTRAL')) {
        return { ok: true, checks: lastChecks }
      }
    }

    await sleep(config.checkPollSeconds * 1000)
  }

  return { ok: false, checks: lastChecks, failed: [], reason: 'Timed out waiting for CI checks.' }
}

export async function collectFailureLogs({ config, artifacts, checks, attempt }) {
  const failed = checks.filter(check => FAILED_STATES.has(check.state))
  const sections = []
  for (const check of failed) {
    const log = await github.runFailedLog(config.repoPath, check)
    sections.push(`### ${check.name} (${check.state})\n${log || check.link || 'No log available.'}`)
  }
  const text = sections.join('\n\n')
  await artifacts.write(`ci-failure-${attempt}.log`, text)
  return truncate(text, 20000)
}

/**
 * Pushes the branch, opens or reuses a PR, waits for CI, asks the executor to
 * fix failures, and merges only after every required check passes.
 */
export async function pushOpenWaitMerge({
  config,
  artifacts,
  branch,
  baseBranch,
  title,
  prBody,
  state,
  executorCommand,
  executorPayload,
  coverage,
  log
}) {
  const existing = await github.prListByHead(config.repoPath, branch)
  const alreadyMerged = existing.find(pr => pr.state === 'MERGED')
  if (alreadyMerged) {
    const view = await github.prView(config.repoPath, alreadyMerged.number)
    return { prNumber: alreadyMerged.number, mergeCommit: view.mergeCommit?.oid ?? null, title: alreadyMerged.title, checks: [] }
  }

  const validation = await validateHead({ config, artifacts, baseBranch, branch, executorPayload })
  if (validation.fixed) {
    const validationGates = await runGates({ config, artifacts, prefix: 'policy-fix' })
    if (!validationGates.ok) {
      throw new Error(`Local gates failed after the policy fix: ${gateFailureText(validationGates)}`)
    }
  }
  await git.push(config.repoPath, branch)
  await log?.(`Pushed ${branch}.`)

  const pr = await ensurePullRequest({
    config,
    branch,
    baseBranch,
    title,
    body: prBody,
    logFile: artifacts.path('pr-create.log')
  })
  state.prNumber = pr.number
  state.prTitle = title

  let checks = await waitForChecks({ config, artifacts, prNumber: pr.number })
  await log?.(`CI checks: ${checks.ok ? 'passed' : checks.reason}`)

  let attempt = 0
  while (!checks.ok && attempt < config.maxAttempts) {
    attempt += 1
    state.attempts = attempt
    const failureLogs = await collectFailureLogs({ config, artifacts, checks: checks.checks, attempt })
    await log?.(`CI failed. Executor fix attempt ${attempt}/${config.maxAttempts}.`)

    const execution = await runOpenCode({
      config,
      command: executorCommand,
      payload: {
        ...executorPayload,
        attempt,
        failureLogs,
        failedChecks: checks.checks.filter(check => FAILED_STATES.has(check.state))
      },
      title: `autopilot fix ${branch} attempt ${attempt}`,
      logFile: artifacts.path(`executor-fix-${attempt}.log`),
      role: 'executor'
    })
    if (execution.code !== 0) {
      throw new Error(`Executor failed while fixing CI (exit ${execution.code}). See ${artifacts.path(`executor-fix-${attempt}.log`)}.`)
    }

    await validateHead({ config, artifacts, baseBranch, branch, executorPayload })
    const gates = await runGates({ config, artifacts, prefix: `fix-${attempt}` })
    if (!gates.ok) {
      throw new Error(`Local gates failed after executor fix: ${gateFailureText(gates)}`)
    }

    await git.push(config.repoPath, branch)
    checks = await waitForChecks({ config, artifacts, prNumber: pr.number })
    await log?.(`CI checks after attempt ${attempt}: ${checks.ok ? 'passed' : checks.reason}`)
  }

  if (!checks.ok) {
    throw new Error(`CI did not pass after ${config.maxAttempts} attempts: ${checks.reason}`)
  }

  const view = await github.prView(config.repoPath, pr.number)
  if (view.mergeable === 'CONFLICTING') {
    throw new Error(`Pull request #${pr.number} has merge conflicts.`)
  }
  if (view.mergeStateStatus === 'BEHIND') {
    await github.prUpdateBranch(config.repoPath, pr.number)
    checks = await waitForChecks({ config, artifacts, prNumber: pr.number })
    if (!checks.ok) {
      throw new Error(`CI failed after updating the branch: ${checks.reason}`)
    }
  }

  const mergeBody = generateMergeBody({ branch, baseBranch, coverage })
  await github.prMerge(config.repoPath, pr.number, { title, body: mergeBody })
  const merged = await github.prView(config.repoPath, pr.number)
  if (merged.state !== 'MERGED') {
    throw new Error(`Pull request #${pr.number} was not merged (state ${merged.state}).`)
  }

  await git.deleteRemoteBranch(config.repoPath, branch)
  return { prNumber: pr.number, mergeCommit: merged.mergeCommit?.oid ?? null, title, checks: checks.checks }
}

/**
 * Revalidates branch, commits, and added code against the Git artifact policy.
 */
export async function validateHead({ config, artifacts, baseBranch, branch, executorPayload }) {
  const range = `origin/${baseBranch}...${branch}`
  const commits = await git.logCommits(config.repoPath, range)
  const diff = await git.diff(config.repoPath, range)
  const files = await git.diffNames(config.repoPath, range)
  const forbidden = findForbidden(files)
  if (forbidden.length > 0) {
    throw new Error(`The branch modifies protected paths:\n${forbidden.join('\n')}`)
  }
  const violations = scanBranch({ branch, commits, diff })
  violations.push(...await scanRepositoryFiles(config.repoPath, files))
  await artifacts.write('policy-latest.json', JSON.stringify(violations, null, 2))
  if (violations.length === 0) return { fixed: false, violations: [] }
  if (violations.length > 0) {
    const message = formatViolations(violations)
    const execution = await runOpenCode({
      config,
      command: 'autopilot-finish',
      payload: {
        ...executorPayload,
        mode: 'policy-fix',
        violations: message,
        branch,
        baseBranch
      },
      title: `autopilot policy fix ${branch}`,
      logFile: artifacts.path('executor-policy.log'),
      role: 'executor'
    })
    if (execution.code !== 0) {
      throw new Error(`Policy violations could not be fixed automatically:\n${message}`)
    }
    const recheckCommits = await git.logCommits(config.repoPath, range)
    const recheckDiff = await git.diff(config.repoPath, range)
    const recheck = scanBranch({ branch, commits: recheckCommits, diff: recheckDiff })
    recheck.push(...await scanRepositoryFiles(config.repoPath, await git.diffNames(config.repoPath, range)))
    await artifacts.write('policy-latest.json', JSON.stringify(recheck, null, 2))
    if (recheck.length > 0) {
      throw new Error(`Policy violations remain:\n${formatViolations(recheck)}`)
    }
    return { fixed: true, violations: [] }
  }
}
```

### src/lib/runner.js

```
import fs from 'node:fs/promises'
import path from 'node:path'
import crossSpawn from 'cross-spawn'
import { ensureDir } from './util.js'

/**
 * Runs a command without a shell, captures both streams, and optionally
 * appends the complete transcript to a log file.
 */
export async function runCommand(command, args = [], options = {}) {
  const { cwd, env, timeoutMs = 0, logFile } = options
  return new Promise(resolve => {
    const child = crossSpawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    const finish = async code => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (logFile) {
        await ensureDir(path.dirname(logFile))
        await fs.appendFile(
          logFile,
          `$ ${command} ${args.join(' ')}\n${stdout}${stderr}\n[exit ${code}${timedOut ? ' timed out' : ''}]\n\n`,
          'utf8'
        )
      }
      resolve({ code, stdout, stderr, timedOut })
    }

    const timer = timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true
          killTree(child)
        }, timeoutMs)
      : null

    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.on('error', error => {
      stderr += `${stderr ? '\n' : ''}${error.message}`
      void finish(-1)
    })
    child.on('close', code => { void finish(code) })
  })
}

/**
 * Kills a child process and its descendants. Windows requires taskkill for a
 * reliable tree kill because SIGTERM is not propagated to grandchildren.
 */
export function killTree(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    crossSpawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    return
  }
  child.kill('SIGKILL')
}
```

### src/lib/state.js

```
import fs from 'node:fs/promises'
import path from 'node:path'
import { atomicWriteJson, isAlive, readJson } from './util.js'

export class StateStore {
  constructor(config) {
    this.config = config
    this.dir = config.stateDir
    this.file = path.join(this.dir, 'state.json')
    this.lockFile = path.join(this.dir, 'run.lock')
  }

  async load() {
    return readJson(this.file)
  }

  async save(state) {
    state.updatedAt = new Date().toISOString()
    await atomicWriteJson(this.file, state)
    return state
  }

  async create(mode, options = {}) {
    const now = new Date().toISOString()
    const state = {
      schemaVersion: 1,
      runId: options.runId ?? createRunId(),
      mode,
      phase: options.phase ?? mode,
      completedPhases: [],
      repo: this.config.repoPath,
      feature: options.feature ?? null,
      branch: options.branch ?? null,
      baseBranch: options.baseBranch ?? this.config.baseBranch,
      releaseBranch: this.config.releaseBranch,
      baseSha: null,
      headSha: null,
      prNumber: null,
      prTitle: null,
      mergeCommit: null,
      scopes: [],
      changedFiles: [],
      attempts: 0,
      sessions: [],
      blockers: [],
      createdAt: now,
      updatedAt: now
    }
    await this.save(state)
    return state
  }

  async lock() {
    await fs.mkdir(this.dir, { recursive: true })
    try {
      const raw = await fs.readFile(this.lockFile, 'utf8')
      const lock = JSON.parse(raw)
      if (lock.pid && isAlive(lock.pid)) {
        throw new Error(`Another autopilot run is active with pid ${lock.pid}. Run status or abort first.`)
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await fs.writeFile(this.lockFile, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), 'utf8')
  }

  async unlock() {
    try {
      await fs.unlink(this.lockFile)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}

export function createRunId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${stamp}-${process.pid}`
}
```

### src/lib/tickets.js

```
import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureDir, slugify, walkFiles } from './util.js'

const PRIORITY_ORDER = { urgent: 0, important: 1, minor: 2 }

export async function listTickets(dir) {
  const files = await walkFiles(dir, file => file.endsWith('.md'))
  const tickets = []
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8')
    tickets.push(parseTicket(text, file))
  }
  return tickets.sort((left, right) => left.file.localeCompare(right.file))
}

export function parseTicket(text, file) {
  const match = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  const meta = match ? parseFrontMatter(match[1]) : {}
  const base = path.basename(file, '.md')
  const slug = slugify(base.replace(/^\d+[-_]?/, ''))
  const id = String(meta.id ?? base)
  const type = String(meta.type ?? 'feat')
  const priority = String(meta.priority ?? 'important').toLowerCase()
  const title = String(meta.title ?? firstHeading(text) ?? base)
  return {
    id,
    file,
    slug,
    type,
    priority: PRIORITY_ORDER[priority] == null ? 'important' : priority,
    title,
    feature: meta.feature ? String(meta.feature) : null,
    dependsOn: normalizeList(meta.depends_on ?? meta.dependsOn)
  }
}

function parseFrontMatter(source) {
  const meta = {}
  let currentListKey = null
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (!line.trim() || line.trim().startsWith('#')) continue
    const listItem = line.match(/^\s*-\s+(.+)$/)
    if (listItem && currentListKey) {
      meta[currentListKey] = meta[currentListKey] ?? []
      meta[currentListKey].push(listItem[1].trim())
      continue
    }
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!pair) continue
    const [, key, value] = pair
    if (value === '') {
      currentListKey = key
      meta[key] = []
    } else {
      currentListKey = null
      meta[key] = value.trim()
    }
  }
  return meta
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean)
  if (!value) return []
  return String(value)
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function firstHeading(text) {
  const match = String(text).match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : null
}

/**
 * Orders tickets by dependencies and then by business priority. Throws on a
 * dependency cycle or an unknown dependency id.
 */
export function orderTickets(tickets) {
  const byId = new Map()
  const bySlug = new Map()
  for (const ticket of tickets) {
    byId.set(ticket.id, ticket)
    bySlug.set(ticket.slug, ticket)
  }

  const resolved = new Map()
  for (const ticket of tickets) {
    const dependencies = []
    for (const dependency of ticket.dependsOn) {
      const target = byId.get(dependency) ?? bySlug.get(dependency)
      if (!target) throw new Error(`Ticket ${ticket.id} depends on unknown ticket ${dependency}.`)
      dependencies.push(target.id)
    }
    resolved.set(ticket.id, dependencies)
  }

  const ordered = []
  const visiting = new Set()
  const visited = new Set()
  const visit = ticket => {
    if (visited.has(ticket.id)) return
    if (visiting.has(ticket.id)) throw new Error(`Dependency cycle at ticket ${ticket.id}.`)
    visiting.add(ticket.id)
    for (const dependency of resolved.get(ticket.id) ?? []) visit(byId.get(dependency))
    visiting.delete(ticket.id)
    visited.add(ticket.id)
    ordered.push(ticket)
  }

  for (const ticket of [...tickets].sort(compareTickets)) visit(ticket)
  return ordered
}

function compareTickets(left, right) {
  const priority = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
  if (priority !== 0) return priority
  return left.file.localeCompare(right.file)
}

export async function moveTicket(ticket, targetDir) {
  await ensureDir(targetDir)
  const target = path.join(targetDir, path.basename(ticket.file))
  await fs.rename(ticket.file, target)
  return target
}

export function branchNameFor(ticket, existingBranches = []) {
  const base = `${ticket.type}/${ticket.slug}`
  if (!existingBranches.includes(base)) return base
  let index = 2
  while (existingBranches.includes(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}
```

### src/lib/title.js

```
import fs from 'node:fs/promises'
import path from 'node:path'
import { slugify, stripTypePrefix } from './util.js'
import { validatePrTitle } from './policy.js'
import { formatCoverage } from './coverage.js'

const PRIORITY = ['feat', 'fix', 'perf', 'refactor', 'test', 'docs', 'chore']

export async function readAgentTitle(config) {
  const file = path.join(config.stateDir, 'pr-title.txt')
  try {
    const value = (await fs.readFile(file, 'utf8')).split(/\r?\n/)[0].trim()
    return value || null
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export async function resolveTitle({ config, branch, commits }) {
  const agentTitle = await readAgentTitle(config)
  if (agentTitle) {
    const violations = validatePrTitle(agentTitle)
    if (violations.length === 0) return agentTitle
  }
  return deriveTitle(branch, commits)
}

export function deriveTitle(branch, commits) {
  const type = highestType(commits)
  const slug = branch.includes('/') ? branch.split('/').slice(1).join('/') : branch
  return `${type}: ${slugify(slug).replace(/-/g, ' ')}`
}

function highestType(commits) {
  const types = (commits ?? []).map(commit => String(commit.subject ?? '').split(':')[0].toLowerCase())
  for (const type of PRIORITY) {
    if (types.includes(type)) return type
  }
  return 'chore'
}

export function generatePrBody({ commits, coverage, dryRun = false }) {
  const summary = (commits ?? []).map(commit => `- ${stripTypePrefix(commit.subject)}`)
  const lines = [
    '## Summary',
    ...(summary.length > 0 ? summary : ['- No commit summary available.']),
    '',
    '## Tests',
    `Build and tests passed locally. Coverage: ${formatCoverage(coverage)}.`
  ]
  if (dryRun) lines.push('', '## Note', 'Dry run: no remote changes were made.')
  return lines.join('\n')
}

export function generateMergeBody({ branch, baseBranch, coverage }) {
  return `Merges ${branch} into ${baseBranch}. CI passed: build, tests and coverage ${formatCoverage(coverage)}.`
}
```

### src/lib/util.js

```
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Replaces ${NAME} tokens using the current process environment.
 */
export function expandEnv(value) {
  if (Array.isArray(value)) return value.map(expandEnv)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandEnv(item)]))
  }
  if (typeof value !== 'string') return value
  return value.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] ?? '')
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

export async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

export async function atomicWriteJson(file, value) {
  await ensureDir(path.dirname(file))
  const temp = `${file}.${process.pid}.tmp`
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fs.rename(temp, file)
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

export async function walkFiles(dir, predicate) {
  const found = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return found
    throw error
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...await walkFiles(full, predicate))
    else if (entry.isFile() && predicate(full)) found.push(full)
  }
  return found
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function parseCliArgs(argv) {
  const [command = 'help', ...rest] = argv
  const options = { _: [] }
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    if (!arg.startsWith('--')) {
      options._.push(arg)
      continue
    }
    const equals = arg.indexOf('=')
    const rawKey = equals >= 0 ? arg.slice(2, equals) : arg.slice(2)
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    let value = equals >= 0 ? arg.slice(equals + 1) : undefined
    if (value === undefined) {
      if (rest[index + 1] && !rest[index + 1].startsWith('--')) value = rest[++index]
      else value = true
    }
    if (key === 'scope') options.scope = options.scope ? [].concat(options.scope, value) : [value]
    else options[key] = value
  }
  return { command, options }
}

export function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function stripTypePrefix(subject) {
  return String(subject).replace(/^(feat|fix|refactor|perf|test|docs|chore):\s*/i, '')
}

export function truncate(value, limit = 12000) {
  const text = String(value ?? '')
  return text.length > limit ? `${text.slice(0, limit)}\n... truncated ...` : text
}
```

### src/phases/adopt.js

```
import fs from 'node:fs/promises'
import path from 'node:path'
import * as git from '../lib/git.js'
import { runOpenCode } from '../lib/opencode.js'
import { scanBranch, scanRepositoryFiles, formatViolations } from '../lib/policy.js'
import { runGates, gateFailureText } from '../lib/gates.js'
import { deriveTitle, generatePrBody, resolveTitle } from '../lib/title.js'
import { pushOpenWaitMerge } from '../lib/pr.js'
import { Artifacts } from '../lib/artifacts.js'
import { findForbidden } from '../lib/forbidden.js'

const ALLOWED_UNTRACKED = ['.autopilot.json', 'tickets/', '.autopilot/']

/**
 * Adopts an existing branch that already contains commits, finishes it, and
 * drives it through push, pull request, CI, and merge.
 */
export async function runAdopt({ config, stateStore, options, log }) {
  const branch = String(options.branch ?? await git.currentBranch(config.repoPath)).trim()
  const baseBranch = String(options.base ?? config.baseBranch)
  if (!branch) throw new Error('No branch was provided and the repository is not on a branch.')

  const current = await git.currentBranch(config.repoPath)
  if (current !== branch) {
    const blocking = await git.statusBlocking(config.repoPath, ALLOWED_UNTRACKED)
    if (blocking.length > 0) {
      throw new Error(`Cannot switch from ${current} to ${branch}: the working tree has pending tracked changes.`)
    }
    await git.switchBranch(config.repoPath, branch)
  }

  await git.fetch(config.repoPath)
  if (!await git.remoteBranchExists(config.repoPath, baseBranch)) {
    throw new Error(`Base branch origin/${baseBranch} does not exist.`)
  }
  if (!await git.branchExists(config.repoPath, branch)) {
    throw new Error(`Branch ${branch} does not exist locally.`)
  }
  const blocking = await git.statusBlocking(config.repoPath, ALLOWED_UNTRACKED)
  if (blocking.length > 0) {
    throw new Error(`The working tree must be clean before adopting the branch:\n${blocking.join('\n')}`)
  }

  const baseSha = await git.mergeBase(config.repoPath, `origin/${baseBranch}`, branch)
  const headSha = await git.revParse(config.repoPath, branch)
  if (baseSha === headSha) throw new Error(`Branch ${branch} has no commits over origin/${baseBranch}.`)

  const range = `origin/${baseBranch}...${branch}`
  const commits = await git.logCommits(config.repoPath, range)
  const diff = await git.diff(config.repoPath, range)
  const changedFiles = await git.diffNames(config.repoPath, range)

  const forbidden = findForbidden(changedFiles)
  if (forbidden.length > 0) {
    throw new Error(`The branch changes protected paths and cannot be adopted automatically:\n${forbidden.join('\n')}`)
  }

  let violations = scanBranch({ branch, commits, diff })
  violations.push(...await scanRepositoryFiles(config.repoPath, changedFiles))

  if (options.dryRun) {
    return {
      dryRun: true,
      branch,
      baseBranch,
      derivedTitle: deriveTitle(branch, commits),
      commits: commits.map(item => item.subject),
      changedFiles,
      violations,
      message: 'Dry run: no executor, gates, push, PR, or merge were performed.'
    }
  }

  const state = await stateStore.create('adopt', { branch, baseBranch })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()
  state.baseSha = baseSha
  state.headSha = headSha
  state.changedFiles = changedFiles
  state.scopes = [{ name: branch, baseBranch, baseSha, headSha, changedFiles, patch: artifacts.path('branch.patch') }]
  await stateStore.save(state)
  await artifacts.write('branch.patch', diff)
  await artifacts.write('commits.txt', commits.map(item => `${item.sha} ${item.subject}`).join('\n'))
  await artifacts.write('changed-files.txt', changedFiles.join('\n'))

  let gates = await runGates({ config, artifacts, prefix: 'initial' })
  await log?.(`Initial policy violations: ${violations.length}. Local gates: ${gates.ok ? 'passed' : gates.reason}`)

  const titleFile = path.join(config.stateDir, 'pr-title.txt')
  await fs.rm(titleFile, { force: true })

  const needsExecutor = violations.length > 0 || !gates.ok
  if (!needsExecutor) {
    await log?.('Branch passes local gates. Asking the executor for the PR title and a final review.')
  }

  const payload = {
    mode: needsExecutor ? 'finish' : 'title',
    branch,
    baseBranch,
    baseSha,
    headSha,
    patchPath: artifacts.path('branch.patch'),
    changedFiles,
    violations: violations.length > 0 ? formatViolations(violations) : null,
    gateFailure: gates.ok ? null : gateFailureText(gates),
    restoreCommand: config.restoreCommand,
    buildCommand: config.buildCommand,
    testCommand: config.testCommand,
    prTitlePath: titleFile,
    instructions: 'Do not push, merge, rebase, or edit tickets, ADRs, CI, or autopilot configuration.'
  }

  const execution = await runOpenCode({
    config,
    command: 'autopilot-finish',
    payload,
    title: `autopilot finish ${branch}`,
    logFile: artifacts.path('executor-finish.log'),
    role: 'executor'
  })
  if (execution.code !== 0) {
    throw new Error(`Executor failed with exit code ${execution.code}. See ${artifacts.path('executor-finish.log')}.`)
  }

  const updatedCommits = await git.logCommits(config.repoPath, range)
  const updatedDiff = await git.diff(config.repoPath, range)
  const updatedFiles = await git.diffNames(config.repoPath, range)
  violations = scanBranch({ branch, commits: updatedCommits, diff: updatedDiff })
  violations.push(...await scanRepositoryFiles(config.repoPath, updatedFiles))
  gates = await runGates({ config, artifacts, prefix: 'final' })

  if (violations.length > 0) {
    await artifacts.write('policy-final.json', JSON.stringify(violations, null, 2))
    throw new Error(`Policy violations remain after the executor run:\n${formatViolations(violations)}`)
  }
  if (!gates.ok) {
    throw new Error(`Local gates failed after the executor run: ${gateFailureText(gates)}`)
  }

  const title = options.title
    ? String(options.title)
    : await resolveTitle({ config, branch, commits: updatedCommits })
  if (!title) throw new Error(`Could not resolve a PR title. Expected ${titleFile} or a title override.`)

  state.headSha = await git.revParse(config.repoPath, branch)
  state.changedFiles = updatedFiles
  state.scopes = [{ name: branch, baseBranch, baseSha, headSha: state.headSha, changedFiles: updatedFiles, patch: artifacts.path('branch.patch') }]
  state.prTitle = title
  await artifacts.write('branch.patch', updatedDiff)
  await artifacts.write('changed-files.txt', updatedFiles.join('\n'))
  await stateStore.save(state)

  const prBody = generatePrBody({ commits: updatedCommits, coverage: gates.coverage })
  const result = await pushOpenWaitMerge({
    config,
    artifacts,
    branch,
    baseBranch,
    title,
    prBody,
    state,
    executorCommand: 'autopilot-finish',
    executorPayload: payload,
    coverage: gates.coverage,
    log
  })

  state.phase = 'merged'
  state.completedPhases = [...new Set([...state.completedPhases, 'adopt', 'merge'])]
  state.prNumber = result.prNumber
  state.mergeCommit = result.mergeCommit
  await stateStore.save(state)

  return {
    branch,
    baseBranch,
    title,
    prNumber: result.prNumber,
    mergeCommit: result.mergeCommit,
    commits: updatedCommits.map(item => item.subject),
    changedFiles: updatedFiles,
    coverage: gates.coverage
  }
}
```

### src/phases/identify.js

```
import fs from 'node:fs/promises'
import path from 'node:path'
import * as git from '../lib/git.js'
import * as github from '../lib/github.js'
import { runOpenCode } from '../lib/opencode.js'
import { runGates } from '../lib/gates.js'
import { Artifacts } from '../lib/artifacts.js'
import { slugify, walkFiles, ensureDir } from '../lib/util.js'

/**
 * Resolves one or more audit scopes (branch, pull request, or directory),
 * gathers local evidence, and runs the read-only auditor. No diagnostic report
 * is produced: the auditor writes only Identified tickets.
 */
export async function runIdentify({ config, stateStore, options, log }) {
  const scopes = normalizeScopes(options.scope)
  if (scopes.length === 0) throw new Error('At least one --scope is required, for example --scope branch:feat/ux-improvements.')

  const state = await stateStore.create('identify', {})
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()

  const resolvedScopes = []
  for (const scope of scopes) {
    const resolved = await resolveScope({ config, artifacts, scope })
    resolvedScopes.push(resolved)
    await log?.(`Scope ${resolved.name}: ${resolved.changedFiles.length} files.`)
  }

  if (options.dryRun) {
    return {
      dryRun: true,
      scopes: resolvedScopes.map(scope => ({ name: scope.name, kind: scope.kind, changedFiles: scope.changedFiles.length })),
      message: 'Dry run: no evidence collection, no auditor session, and no ticket writes were performed.'
    }
  }

  const gates = await runGates({ config, artifacts, prefix: 'evidence' })
  await log?.(`Evidence gates: ${gates.ok ? 'passed' : gates.reason}`)

  const runtimeLogs = await collectRuntimeLogs(config, artifacts)
  const evidence = {
    generatedAt: new Date().toISOString(),
    gates: { ok: gates.ok, reason: gates.reason ?? null, coverage: gates.coverage ? gates.coverage.rate : null },
    runtimeLogs,
    notes: 'Local evidence only. Do not create a diagnostic report.'
  }
  const evidenceFile = await artifacts.write('evidence.json', JSON.stringify(evidence, null, 2))

  for (const resolved of resolvedScopes) {
    const outputDir = path.join(config.repoPath, config.ticketDirs.identified, resolved.name)
    await ensureDir(outputDir)
    const payload = {
      scope: resolved.name,
      kind: resolved.kind,
      patchPath: resolved.patchPath,
      changedFiles: resolved.changedFiles,
      evidenceFile,
      outputDir,
      instructions: 'Write one Identified ticket per debt under outputDir. No source edits, no UX changes, no diagnostic report.'
    }
    const execution = await runOpenCode({
      config,
      command: 'identified',
      payload,
      title: `autopilot identify ${resolved.name}`,
      logFile: artifacts.path(`auditor-${slugify(resolved.name)}.log`),
      role: 'auditor'
    })
    if (execution.code !== 0) {
      throw new Error(`Auditor failed for scope ${resolved.name} with exit code ${execution.code}.`)
    }
    resolved.tickets = await walkFiles(outputDir, file => file.endsWith('.md'))
    await log?.(`Scope ${resolved.name}: ${resolved.tickets.length} Identified tickets.`)
  }

  const dirty = await git.statusPorcelain(config.repoPath)
  if (dirty !== '') {
    throw new Error(`The auditor modified tracked files. Review the working tree:\n${dirty}`)
  }

  state.phase = 'identified'
  state.completedPhases = [...new Set([...state.completedPhases, 'identify'])]
  state.scopes = resolvedScopes.map(scope => ({
    name: scope.name,
    kind: scope.kind,
    changedFiles: scope.changedFiles,
    patch: scope.patchPath,
    tickets: scope.tickets
  }))
  await stateStore.save(state)

  return {
    runId: state.runId,
    scopes: resolvedScopes.map(scope => ({ name: scope.name, tickets: scope.tickets.length, files: scope.changedFiles.length })),
    evidence: evidenceFile,
    localOnly: true
  }
}

function normalizeScopes(value) {
  if (!value) return []
  const list = Array.isArray(value) ? value : [value]
  return list.map(item => String(item).trim()).filter(Boolean)
}

async function resolveScope({ config, artifacts, scope }) {
  const [kind, ...rest] = scope.includes(':') ? scope.split(':') : ['branch', scope]
  const value = rest.join(':')

  if (kind === 'pr') {
    const number = Number(value)
    if (!number) throw new Error(`Invalid PR scope: ${scope}`)
    const patch = await github.prDiff(config.repoPath, number)
    const files = await github.prFiles(config.repoPath, number)
    const patchPath = await artifacts.write(`scope-${number}.patch`, patch)
    const changedFiles = files.map(file => file.path)
    await artifacts.write(`scope-${number}.files`, changedFiles.join('\n'))
    return { name: `pr-${number}`, kind, changedFiles, patchPath }
  }

  if (kind === 'dir') {
    const target = path.resolve(config.repoPath, value)
    const changedFiles = await walkFiles(target, file => /\.(cs|py|ts|tsx|js|jsx|rs|go|java|kt)$/i.test(file))
    return { name: slugify(path.basename(target)), kind, changedFiles, patchPath: null }
  }

  const branch = value
  const baseBranch = config.baseBranch
  await git.fetch(config.repoPath)
  const patch = await git.diff(config.repoPath, `origin/${baseBranch}...${branch}`)
  const changedFiles = await git.diffNames(config.repoPath, `origin/${baseBranch}...${branch}`)
  const patchPath = await artifacts.write(`scope-${slugify(branch)}.patch`, patch)
  await artifacts.write(`scope-${slugify(branch)}.files`, changedFiles.join('\n'))
  return { name: slugify(branch), kind: 'branch', changedFiles, patchPath }
}

async function collectRuntimeLogs(config, artifacts) {
  const collected = []
  const targetDir = path.join(artifacts.dir, 'runtime-logs')
  await ensureDir(targetDir)
  for (const pattern of config.runtimeLogs ?? []) {
    const matches = await expandGlob(pattern)
    for (const match of matches.slice(-5)) {
      const target = path.join(targetDir, path.basename(match))
      await fs.copyFile(match, target)
      collected.push(target)
    }
  }
  return collected
}

async function expandGlob(pattern) {
  const dir = path.dirname(pattern)
  const base = path.basename(pattern)
  if (!base.includes('*')) {
    try {
      const stat = await fs.stat(pattern)
      return stat.isFile() ? [pattern] : []
    } catch {
      return []
    }
  }
  const regex = new RegExp(`^${base.split('*').map(escapeRegExp).join('.*')}$`)
  let entries = []
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }
  const matches = []
  for (const entry of entries) {
    if (!regex.test(entry)) continue
    const full = path.join(dir, entry)
    try {
      const stat = await fs.stat(full)
      if (stat.isFile()) matches.push({ file: full, mtime: stat.mtimeMs })
    } catch {
      // Ignore files that disappear between readdir and stat.
    }
  }
  return matches.sort((left, right) => left.mtime - right.mtime).map(item => item.file)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

### src/phases/pipeline.js

```
import fs from 'node:fs/promises'
import path from 'node:path'
import * as git from '../lib/git.js'
import { runOpenCode } from '../lib/opencode.js'
import { scanBranch, formatViolations } from '../lib/policy.js'
import { runGates, gateFailureText } from '../lib/gates.js'
import { generatePrBody, resolveTitle } from '../lib/title.js'
import { pushOpenWaitMerge } from '../lib/pr.js'
import { Artifacts } from '../lib/artifacts.js'
import { branchNameFor, listTickets, moveTicket, orderTickets } from '../lib/tickets.js'
import { ensureDir } from '../lib/util.js'

export async function runPrepare({ config, stateStore, options, log }) {
  const feature = requireFeature(options)
  const backlogDir = path.join(config.repoPath, config.ticketDirs.backlog, feature)
  const briefPath = path.join(backlogDir, 'brief.md')
  await ensureDir(backlogDir)

  const state = await stateStore.create('prepare', { feature, phase: 'backlog' })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()

  if (!await exists(briefPath)) {
    if (!options.description) {
      throw new Error(`Missing ${briefPath}. Provide --description or run /feature-brief before prepare.`)
    }
    const briefRun = await runOpenCode({
      config,
      command: 'feature-brief',
      payload: { feature, description: String(options.description), briefPath },
      title: `autopilot brief ${feature}`,
      logFile: artifacts.path('planner-brief.log'),
      role: 'planner'
    })
    if (briefRun.code !== 0) throw new Error('The planner could not write the feature brief.')
  }

  const backlogRun = await runOpenCode({
    config,
    command: 'backlog',
    payload: { feature, briefPath, outputDir: backlogDir },
    title: `autopilot backlog ${feature}`,
    logFile: artifacts.path('planner-backlog.log'),
    role: 'planner'
  })
  if (backlogRun.code !== 0) throw new Error('The planner could not generate the backlog.')

  state.phase = 'awaiting_approval'
  state.completedPhases = [...new Set([...state.completedPhases, 'prepare', 'backlog'])]
  await stateStore.save(state)

  const backlogFiles = await listMarkdown(backlogDir)
  await log?.(`Backlog ready for review at ${backlogDir}.`)
  return { feature, backlogDir, backlogFiles, phase: 'awaiting_approval' }
}

export async function runApprove({ config, stateStore, options, log }) {
  const feature = requireFeature(options)
  const backlogDir = path.join(config.repoPath, config.ticketDirs.backlog, feature)
  if (!await exists(backlogDir)) throw new Error(`No backlog found for feature ${feature}. Run prepare first.`)

  const readyDir = path.join(config.repoPath, config.ticketDirs.readyForDev, feature)
  await ensureDir(readyDir)
  const artifacts = new Artifacts(config, `approve-${Date.now()}`)
  await artifacts.init()

  const generated = await runOpenCode({
    config,
    command: 'ready-for-dev',
    payload: { feature, backlogDir, outputDir: readyDir },
    title: `autopilot ready-for-dev ${feature}`,
    logFile: artifacts.path('planner-ready-for-dev.log'),
    role: 'planner'
  })
  if (generated.code !== 0) throw new Error('The planner could not generate ready-for-dev tickets.')

  await log?.(`Tickets generated at ${readyDir}.`)
  return runDev({ config, stateStore, options, log })
}

export async function runDev({ config, stateStore, options, log }) {
  const feature = requireFeature(options)
  const readyDir = path.join(config.repoPath, config.ticketDirs.readyForDev, feature)
  const doneDir = path.join(config.repoPath, config.ticketDirs.done, feature)
  const tickets = orderTickets(await listTickets(readyDir))
  if (tickets.length === 0) throw new Error(`No ready-for-dev tickets found in ${readyDir}.`)

  const state = (await stateStore.load()) ?? await stateStore.create('dev', { feature })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()
  state.mode = 'dev'
  state.feature = feature
  state.phase = 'dev'

  const results = []
  for (const ticket of tickets) {
    const branches = await git.listLocalBranches(config.repoPath)
    const branch = branchNameFor(ticket, branches)
    await git.fetch(config.repoPath)
    await git.createBranchFrom(config.repoPath, branch, config.baseBranch)
    await log?.(`Ticket ${ticket.id}: branch ${branch}.`)

    const payload = {
      mode: 'dev',
      ticketId: ticket.id,
      ticketFile: ticket.file,
      title: ticket.title,
      type: ticket.type,
      priority: ticket.priority,
      branch,
      baseBranch: config.baseBranch,
      restoreCommand: config.restoreCommand,
      buildCommand: config.buildCommand,
      testCommand: config.testCommand,
      instructions: 'Implement only this ticket. Do not push or merge. Commit with type: subject, no scope, no ticket or ADR references.'
    }

    const execution = await runOpenCode({
      config,
      command: 'autopilot-dev',
      payload,
      title: `autopilot dev ${ticket.id}`,
      logFile: artifacts.path(`executor-${ticket.slug}.log`),
      role: 'executor'
    })
    if (execution.code !== 0) throw new Error(`Executor failed for ticket ${ticket.id}.`)

    const range = `origin/${config.baseBranch}...${branch}`
    const commits = await git.logCommits(config.repoPath, range)
    if (commits.length === 0) throw new Error(`Ticket ${ticket.id} produced no commits on ${branch}.`)

    const violations = scanBranch({ branch, commits, diff: await git.diff(config.repoPath, range) })
    if (violations.length > 0) throw new Error(`Ticket ${ticket.id} violates policy:\n${formatViolations(violations)}`)

    const gates = await runGates({ config, artifacts, prefix: ticket.slug })
    if (!gates.ok) throw new Error(`Ticket ${ticket.id} failed local gates: ${gateFailureText(gates)}`)

    const title = await resolveTitle({ config, branch, commits })
    const prBody = generatePrBody({ commits, coverage: gates.coverage })
    const merge = await pushOpenWaitMerge({
      config,
      artifacts,
      branch,
      baseBranch: config.baseBranch,
      title,
      prBody,
      state,
      executorCommand: 'autopilot-dev',
      executorPayload: payload,
      coverage: gates.coverage,
      log
    })

    await moveTicket(ticket, doneDir)
    state.scopes.push({ name: ticket.slug, branch, ticket: ticket.id, changedFiles: await git.diffNames(config.repoPath, range), prNumber: merge.prNumber, mergeCommit: merge.mergeCommit })
    state.completedPhases = [...new Set([...state.completedPhases, `dev:${ticket.id}`])]
    await stateStore.save(state)
    results.push({ ticket: ticket.id, branch, prNumber: merge.prNumber, title })
  }

  state.phase = 'dev-complete'
  await stateStore.save(state)
  return { feature, tickets: results }
}

export async function runRefactor({ config, stateStore, options, log }) {
  const feature = requireFeature(options)
  const readyDir = path.join(config.repoPath, config.ticketDirs.readyForRefactor, feature)
  const doneDir = path.join(config.repoPath, config.ticketDirs.done, feature)
  const tickets = orderTickets(await listTickets(readyDir))
  if (tickets.length === 0) throw new Error(`No ready-for-refactor tickets found in ${readyDir}.`)

  const state = (await stateStore.load()) ?? await stateStore.create('refactor', { feature })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()
  state.mode = 'refactor'
  state.feature = feature
  state.phase = 'refactor'

  const results = []
  for (const ticket of tickets) {
    const branches = await git.listLocalBranches(config.repoPath)
    const branch = branchNameFor({ ...ticket, type: 'refactor' }, branches)
    await git.fetch(config.repoPath)
    await git.createBranchFrom(config.repoPath, branch, config.baseBranch)

    const payload = {
      mode: 'refactor',
      ticketId: ticket.id,
      ticketFile: ticket.file,
      title: ticket.title,
      priority: ticket.priority,
      branch,
      baseBranch: config.baseBranch,
      restoreCommand: config.restoreCommand,
      buildCommand: config.buildCommand,
      testCommand: config.testCommand,
      instructions: 'Refactor only the files in the ticket scope. Keep tests green. Do not push or merge.'
    }

    const execution = await runOpenCode({
      config,
      command: 'autopilot-dev',
      payload,
      title: `autopilot refactor ${ticket.id}`,
      logFile: artifacts.path(`refactor-${ticket.slug}.log`),
      role: 'executor'
    })
    if (execution.code !== 0) throw new Error(`Executor failed for refactor ticket ${ticket.id}.`)

    const range = `origin/${config.baseBranch}...${branch}`
    const commits = await git.logCommits(config.repoPath, range)
    const gates = await runGates({ config, artifacts, prefix: `refactor-${ticket.slug}` })
    if (!gates.ok) throw new Error(`Refactor ticket ${ticket.id} failed local gates: ${gateFailureText(gates)}`)

    const title = await resolveTitle({ config, branch, commits })
    const merge = await pushOpenWaitMerge({
      config,
      artifacts,
      branch,
      baseBranch: config.baseBranch,
      title,
      prBody: generatePrBody({ commits, coverage: gates.coverage }),
      state,
      executorCommand: 'autopilot-dev',
      executorPayload: payload,
      coverage: gates.coverage,
      log
    })

    await moveTicket(ticket, doneDir)
    state.scopes.push({ name: ticket.slug, branch, ticket: ticket.id, prNumber: merge.prNumber, mergeCommit: merge.mergeCommit })
    await stateStore.save(state)
    results.push({ ticket: ticket.id, branch, prNumber: merge.prNumber, title })
  }

  state.phase = 'refactor-complete'
  await stateStore.save(state)
  return { feature, tickets: results }
}

export async function runRelease({ config, stateStore, options, log }) {
  const version = String(options.version ?? '').trim()
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('A semantic --version in MAJOR.MINOR.PATCH format is required.')

  const branch = `chore/release-v${version}`
  await git.fetch(config.repoPath)
  await git.createBranchFrom(config.repoPath, branch, config.baseBranch)

  const state = (await stateStore.load()) ?? await stateStore.create('release', { branch })
  const artifacts = new Artifacts(config, state.runId)
  await artifacts.init()

  const execution = await runOpenCode({
    config,
    command: 'release',
    payload: {
      mode: 'release',
      version,
      branch,
      baseBranch: config.baseBranch,
      releaseBranch: config.releaseBranch,
      restoreCommand: config.restoreCommand,
      buildCommand: config.buildCommand,
      testCommand: config.testCommand
    },
    title: `autopilot release v${version}`,
    logFile: artifacts.path(`release-v${version}.log`),
    role: 'executor'
  })
  if (execution.code !== 0) throw new Error('The executor could not prepare the release.')

  const range = `origin/${config.baseBranch}...${branch}`
  const commits = await git.logCommits(config.repoPath, range)
  const gates = await runGates({ config, artifacts, prefix: `release-v${version}` })
  if (!gates.ok) throw new Error(`Release gates failed: ${gateFailureText(gates)}`)
  const title = await resolveTitle({ config, branch, commits })

  const merge = await pushOpenWaitMerge({
    config,
    artifacts,
    branch,
    baseBranch: config.releaseBranch,
    title,
    prBody: generatePrBody({ commits, coverage: gates.coverage }),
    state,
    executorCommand: 'release',
    executorPayload: { mode: 'release', version, baseBranch: config.baseBranch, releaseBranch: config.releaseBranch },
    coverage: gates.coverage,
    log
  })

  const tag = `v${version}`
  await git.tag(config.repoPath, tag, merge.mergeCommit)
  await git.pushTag(config.repoPath, tag)

  state.phase = 'released'
  state.completedPhases = [...new Set([...state.completedPhases, 'release'])]
  await stateStore.save(state)
  return { version, tag, prNumber: merge.prNumber, mergeCommit: merge.mergeCommit }
}

function requireFeature(options) {
  const feature = String(options.feature ?? '').trim()
  if (!feature) throw new Error('The --feature option is required.')
  return feature
}

async function listMarkdown(dir) {
  const { walkFiles } = await import('../lib/util.js')
  return walkFiles(dir, file => file.endsWith('.md'))
}

async function exists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}
```

### test/config.test.js

```
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from '../src/lib/config.js'

test('loads defaults and resolves the state directory', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-config-'))
  await fs.mkdir(path.join(repo, 'tickets'), { recursive: true })
  await fs.writeFile(path.join(repo, '.autopilot.json'), JSON.stringify({
    baseBranch: 'develop',
    releaseBranch: 'main',
    requiredChecks: ['Build and test'],
    buildCommand: ['dotnet', 'build']
  }), 'utf8')

  const config = await loadConfig(repo)
  assert.equal(config.baseBranch, 'develop')
  assert.equal(config.releaseBranch, 'main')
  assert.deepEqual(config.requiredChecks, ['Build and test'])
  assert.equal(config.stateDir, path.join(repo, 'tickets', '.autopilot'))
  assert.equal(config.maxAttempts, 3)
})

test('fails when .autopilot.json is missing', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-config-missing-'))
  await assert.rejects(() => loadConfig(repo), /autopilot-init/)
})
```

### test/coverage.test.js

```
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readCoverage } from '../src/lib/coverage.js'

test('aggregates Cobertura reports', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-coverage-'))
  const dir = path.join(repo, 'TestResults', 'abc')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(
    path.join(dir, 'coverage.cobertura.xml'),
    '<coverage lines-covered="690" lines-valid="1000" line-rate="0.69"></coverage>',
    'utf8'
  )
  const coverage = await readCoverage(repo)
  assert.equal(coverage.covered, 690)
  assert.equal(coverage.valid, 1000)
  assert.equal(coverage.rate, 0.69)
})

test('returns null when no report exists', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-coverage-empty-'))
  assert.equal(await readCoverage(repo), null)
})
```

### test/policy.test.js

```
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateBranchName,
  validateCommitMessage,
  validatePrTitle,
  scanAddedLines
} from '../src/lib/policy.js'

test('accepts a conventional branch name', () => {
  assert.equal(validateBranchName('feat/ux-improvements').length, 0)
})

test('rejects ticket-like branch segments', () => {
  assert.ok(validateBranchName('feat/123').length > 0)
  assert.ok(validateBranchName('fix/ABC-123').length > 0)
})

test('accepts a conventional commit subject without scope', () => {
  assert.equal(validateCommitMessage('feat: add the model parameters panel').length, 0)
})

test('rejects scoped commit subjects', () => {
  const violations = validateCommitMessage('feat(panel): add the model parameters panel')
  assert.ok(violations.some(item => item.code === 'commit-scope'))
})

test('rejects ticket and ADR references in commit messages', () => {
  assert.ok(validateCommitMessage('fix: close tickets/001-thing').length > 0)
  assert.ok(validateCommitMessage('fix: remove ADR-029 reference').length > 0)
  assert.ok(validateCommitMessage('fix: close #123').length > 0)
})

test('rejects scoped PR titles', () => {
  const violations = validatePrTitle('docs(audit): record findings')
  assert.ok(violations.some(item => item.code === 'pr-title-scope'))
})

test('scans added code for ticket and ADR references', () => {
  const diff = [
    '+++ b/Models/Thing.cs',
    '@@ -1,1 +1,2 @@',
    '+// see ADR-029 for the fallback value',
    '+// see tickets/ready-for-dev/001-thing.md'
  ].join('\n')
  const violations = scanAddedLines(diff)
  assert.equal(violations.length, 2)
})

test('does not flag hexadecimal colors as issue references', () => {
  const diff = [
    '+++ b/Resources/Styles/Styles.axaml',
    '@@ -1,1 +1,2 @@',
    '+<Setter Property="Background" Value="#0AFFFFFF"/>'
  ].join('\n')
  assert.equal(scanAddedLines(diff).length, 0)
})
```

### test/state.test.js

```
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { StateStore } from '../src/lib/state.js'

test('creates, saves, and reloads state atomically', async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-state-'))
  const store = new StateStore({ stateDir })
  const state = await store.create('adopt', { branch: 'feat/example', baseBranch: 'develop' })
  assert.equal(state.mode, 'adopt')
  assert.equal(state.branch, 'feat/example')

  state.phase = 'merged'
  await store.save(state)

  const reloaded = await store.load()
  assert.equal(reloaded.phase, 'merged')
  assert.equal(reloaded.baseBranch, 'develop')
})

test('locks and unlocks a run', async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-lock-'))
  const store = new StateStore({ stateDir })
  await store.lock()
  await assert.rejects(() => store.lock(), /active/)
  await store.unlock()
  await store.lock()
  await store.unlock()
})
```

### test/tickets.test.js

```
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { listTickets, orderTickets, branchNameFor } from '../src/lib/tickets.js'

test('parses front matter and orders tickets by dependency', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-tickets-'))
  await fs.writeFile(path.join(dir, '001-first.md'), [
    '---',
    'id: T1',
    'type: feat',
    'priority: minor',
    'depends_on: []',
    '---',
    '# First'
  ].join('\n'), 'utf8')
  await fs.writeFile(path.join(dir, '002-second.md'), [
    '---',
    'id: T2',
    'type: feat',
    'priority: urgent',
    'depends_on: [T1]',
    '---',
    '# Second'
  ].join('\n'), 'utf8')

  const tickets = await listTickets(dir)
  const ordered = orderTickets(tickets)
  assert.deepEqual(ordered.map(ticket => ticket.id), ['T1', 'T2'])
})

test('builds a unique branch name without ticket identifiers', () => {
  const ticket = { type: 'feat', slug: 'model-params-panel' }
  assert.equal(branchNameFor(ticket, []), 'feat/model-params-panel')
  assert.equal(branchNameFor(ticket, ['feat/model-params-panel']), 'feat/model-params-panel-2')
})
```

<p align="center">
  <img src="assets/autopai.svg" width="128" alt="AutopAI">
</p>

<h1 align="center">AutopAI</h1>

<p align="center">
  Professional, repeatable software delivery with AI agents.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node 20 or newer">
  <img src="https://img.shields.io/badge/status-active-success.svg" alt="Active">
</p>

## About

AutopAI is a workflow for using AI agents professionally across the whole delivery cycle. It helps you discuss an idea, formalize it into a brief and backlog, plan the implementation, build it with tests and CI, audit the new feature for technical debt, refactor it, and repeat. The human makes the decisions that matter; the orchestrator runs each phase in a fresh session, owns every Git write, and stops at the gates you configure. The two prepare review sessions stay open until the backlog gate is resolved.

It is language, repository, and coding-tool agnostic. The build, test, and check commands come from an `autopai.json` generated inside each target repository, the task prompts live in the core, and the coding tool is a replaceable runner.

The same workflow is available through slash commands or natural language. The operator first decides whether a request is a discussion, a phase to run, or an explicit request to generate artifacts; it translates operational requests into the deterministic CLI and confirms ambiguous interpretations before running.

## The loop

1. **Discuss the idea** with the operator. Nothing is written yet. Start with a plain message or `/autopai-plan "<idea>"`; the operator asks the questions that change the plan and proposes a short feature name.
2. **Formalize it** when you are ready: explicitly ask the operator to generate the brief and backlog. It runs `prepare`, which writes the brief and backlog, keeps the two planner sessions open, and stops at the backlog gate. Review them or request changes in the retained backlog session; do not run prepare again. `/autopai-plan` remains the same command; it only generates after your explicit confirmation. Both sessions are deleted only after the backlog approval succeeds.
3. **Approve the backlog** to generate the ready-for-dev plan, review the technical tickets, then approve the plan.
4. **Implement it.** Dev creates one branch and one pull request per ticket, runs the local gates and CI, merges only when they pass, and writes the manual QA checklist.
5. **Verify and audit.** Review the QA checklist, then identify the pull requests of the new feature, promote the findings, and refactor them.
6. **Repeat** with the next idea. Run `/autopai-release` when you decide to publish.

## Highlights

- Assisted by default: review the backlog, the ready-for-dev plan, and the manual QA. Approve each gate explicitly.
- Configurable gates: `pauseAfter` in `autopai.json` decides where the loop stops. Stop at every phase or only where you want.
- One continuation command: `autopai resume`. Approve one gate with `--approve <gate>`; skip human pauses with `--auto`; repair failed tickets with `--fix`.
- Resilient loops: local gates are retried once, failed ticket branches are reused, independent tickets continue, and dependents are skipped.
- CI-gated merges: a pull request merges only after the required checks pass.
- Resumable phases: state lives in local files, and a crashed run resumes where it stopped.
- Clean loops: after every merge it deletes the remote branch, fast-forwards the local base branch, and deletes the merged local branch.
- Local artifacts: tickets, briefs, findings, and evidence never touch Git.
- Any coding tool and any language: one runner module per tool, and no ecosystem detection.

## How it works

| Phase | What it does |
| --- | --- |
| `adopt` | Finishes an existing branch through push, pull request, CI, and merge. |
| `prepare` | Writes the feature brief and backlog, retains both planner sessions for review, then stops at the backlog gate. |
| `approve` | Writes ready-for-dev tickets with a technical plan, then stops at the plan gate. |
| `dev` | Implements one ticket per branch through CI and merge, then stops at the QA gate. |
| `identify` | Audits the new pull requests and writes local findings. |
| `promote` | Turns the findings into ready-for-refactor tickets. |
| `refactor` | Executes refactor tickets with the same gates. |
| `release` | Updates version and changelog, opens the release pull request, merges, and tags. |

`autopai run --from <phase> --to <phase>` chains any range and stops at the configured gates.

## Human gates

`pauseAfter` defaults to the three professional gates:

```json
"pauseAfter": ["backlog", "plan", "qa"]
```

| Gate | Stops after | Review |
| --- | --- | --- |
| `backlog` | `prepare` | brief and backlog |
| `plan` | `approve` | ready-for-dev tickets |
| `qa` | `dev` | `tickets/qa/<feature>.md` |
| `findings` | `identify` | audit findings |
| `promotion` | `promote` | ready-for-refactor tickets |
| `refactor` | `refactor` | refactor changes before release |

A pause is not an approval. `autopai resume` at a gate stops and prints the exact approval command. `autopai resume --approve <gate>` passes that gate and continues to the next one; `--auto` skips every human pause. The automatic gates (local commands, CI, and policy) always run.

The brief and backlog sessions stay open after `prepare`. Review them or request changes in the retained backlog session; never re-run `prepare` or reload a core prompt for a revision. When `--approve backlog` completes successfully, the orchestrator deletes both prepare sessions. If the approval fails, both sessions stay open for another review. The operator conversation is not one of those sessions and is never deleted by AutopAI. If a prepare is interrupted after both files exist, `autopai status` reconnects the retained sessions and marks the backlog ready for review; it never approves.

Add or remove gates in `autopai.json`, or ask the operator in natural language after re-running `/autopai-init` (for example, `/autopai-init "stop after promote"`). Use `--pause-after` to override the list for one run.

## When a ticket fails

A failed ticket is not a human gate. Local gates are retried once. If the ticket still fails, its branch stays available, the failure is recorded, and the loop continues with independent tickets while skipping dependents. The phase stays incomplete.

- `autopai resume` reuses the failed ticket branch and retries the gates.
- `autopai resume --fix` gives the executor one repair attempt with the gate logs before re-running the gates and continuing.
- `/autopai-status` shows the failed tickets and branches.

The automatic gates are never bypassed, and a red branch is never pushed. A branch with commits is reused instead of creating a duplicate.

## Commands and natural language

| Step | Slash command | Natural language |
| --- | --- | --- |
| Initialize or adjust config | `/autopai-init` | `/autopai-init "stop after promote"` |
| Audit config without writing | `autopai config check --repo .` | "check whether autopai.json is outdated" |
| Discuss a feature | `/autopai-plan` | Share an idea, a design question, or a feature goal; the operator discusses first. |
| Generate the brief and backlog | `/autopai-plan` after confirmation | Explicitly ask to generate, formalize, or prepare the brief and backlog. |
| Approve the backlog | `/autopai-resume --approve backlog` | "approve the backlog and generate the plan" |
| Approve the plan | `/autopai-resume --approve plan` | "approve the plan and implement" |
| Review QA and audit | `/autopai-resume --approve qa` | "I reviewed QA; audit the feature" |
| Audit filtered debt | `/autopai-identify "only urgent code smells"` | "identify only urgent code smells" |
| Refactor | `/autopai-refactor` | "refactor the pending tickets" |
| Refactor filtered debt | `/autopai-refactor "only minor missing documentation"` | "resolve only minor missing documentation" |
| Repair failed tickets | `/autopai-resume --fix` | "fix the failures and continue" |
| Release | `/autopai-release <version>` | "release 1.3.0" |
| Check progress | `/autopai-status` | "how is the run going?" |

The operator agent translates the request and confirms ambiguous interpretations; it works in any language. Explicit flags run verbatim; the CLI underneath is deterministic. If a request does not match the command you opened, the operator stops and points to the right phase. A release never resolves technical debt.

## Auditing autopai.json

`/autopai-init` now runs a deterministic audit before touching an existing configuration:

```text
autopai config check --repo .
autopai config check --repo . --json
autopai config check --repo . --strict
```

The audit is read-only. It reports missing optional fields with their effective defaults, unknown or deprecated fields, invalid types, paths and pause gates, legacy agent names, secret-like keys, personal absolute paths, and checks that are both required and ignored. `/autopai-init` uses the report to fill safe defaults, preserves your explicit choices, and confirms deprecated-field removal or any other destructive change. `--strict` exits 1 on warnings and missing defaults; errors always exit 1.

The schema audit does not need the repository. `/autopai-init` still inspects the repository and CI to detect a stale branch, command, or check name that is valid JSON but no longer matches the project.

## Filtering technical debt

`identify`, `promote`, and `refactor` accept two optional filters:

```text
autopai identify --repo . --classification code-smell --priority urgent
autopai refactor --repo . --classification missing-documentation --priority minor
```

`--classification` accepts `code-smell`, `unnecessary-complexity`, `lack-of-coverage`, `outdated-library`, `architecture`, and `missing-documentation`. `--priority` accepts `urgent`, `important`, and `minor`. Both accept comma-separated or repeated values; values inside one filter are OR, and the two filters combine with AND. An unknown value fails with the supported list.

The identify filter reaches the auditor and the promotion, so non-matching findings are not documented as tickets. The refactor filter selects pending tickets; done tickets are never re-run. If no ticket matches, the run reports zero and does not drain the queue. If a selected ticket depends on a pending ticket outside the filter, the run stops and lists the dependency. Filters persist through `autopai resume`.

## Requirements

- Node.js 20 or newer.
- Git and GitHub CLI (`gh`) authenticated.
- The CLI of at least one supported coding tool. The bundled platform targets OpenCode; adding another tool is documented in `spec/PLATFORMS.md`.

## Install

1. Clone the repository, install dependencies, and link the command:

```text
gh repo clone ZUNNIA/autopai
cd autopai
npm ci
npm link
```

`npm link` creates the `autopai` command. Run it again after moving the clone.

2. Install the platform files for the coding tool you use. The bundled platform lives under `platforms/opencode/`.

```powershell
Copy-Item .\platforms\opencode\agents\*.md "$env:USERPROFILE\.config\opencode\agents\" -Force
Copy-Item .\platforms\opencode\commands\*.md "$env:USERPROFILE\.config\opencode\commands\" -Force
Copy-Item .\AGENTS.md "$env:USERPROFILE\.config\opencode\AGENTS.md" -Force
```

```bash
mkdir -p ~/.config/opencode/agents ~/.config/opencode/commands
cp platforms/opencode/agents/*.md ~/.config/opencode/agents/
cp platforms/opencode/commands/*.md ~/.config/opencode/commands/
cp AGENTS.md ~/.config/opencode/AGENTS.md
```

If `~/.config/opencode/AGENTS.md` already exists, merge the AutopAI section instead of overwriting the whole file.

3. Verify the installation:

```text
autopai help
```

## Usage

Open a target repository in the coding tool and run `/autopai-init`. The operator agent (`autopai`) creates `autopai.json` or reconciles the existing file. It runs `autopai config check` first and uses the deterministic report, so missing defaults, unknown fields, deprecated fields, and legacy agent names are visible before any write. Re-run it at any time to audit the configuration: it applies safe corrections, preserves your choices, and asks before an ambiguous or destructive change. You can also request an adjustment in natural language (`/autopai-init "stop after promote"`). No language or framework is assumed.

The assisted loop:

```text
# discuss first; when ready, explicitly ask for the generation
/autopai-plan "generate the brief and backlog from the discussed feature"
# review tickets/backlog/<feature>/
/autopai-resume --approve backlog
# review tickets/ready-for-dev/<feature>/
/autopai-resume --approve plan
# review tickets/qa/<feature>/
/autopai-resume --approve qa
# review the audit and refactor, or add promotion to pauseAfter
/autopai-status
```

The phase commands (`/autopai-dev`, `/autopai-identify`, `/autopai-refactor`) remain available for manual control. Starting a phase explicitly approves the gate before it; the gates after it still apply.

If a ticket fails, the run reports the failure and preserves its branch. Run `/autopai-resume` to retry or `/autopai-resume --fix` to attempt a repair; independent tickets have already continued.

The same loop from the CLI:

```text
autopai prepare --repo . --description "<idea>"
autopai resume --repo . --approve backlog
autopai resume --repo . --approve plan
autopai resume --repo . --approve qa
autopai status --repo .
```

Use `autopai run --repo . --from prepare --to refactor --auto` for an explicit full-auto run. `--pause-after` overrides the configured gates for one run.

The commands accept natural language (`/autopai-identify audit the last 2 merged branches`): the operator agent translates the request into flags and confirms ambiguous interpretations. Directory audits are chunked: ignored paths are skipped and large trees split into bounded auditor sessions (`--scope dir:.` audits the whole project).

## Documentation

- `docs/MANUAL.md`: the user manual. Agents, lifecycle, tickets, configuration, CLI reference, state, safety, customization, walkthroughs, and FAQ.
- `spec/ARCHITECTURE.md`: design rules, phases, state, gates, and policy verification.
- `spec/POLICIES.md`: Git artifact rules, local artifact rules, and per-role permissions.
- `spec/CONFIG_SCHEMA.md`: the `autopai.json` schema and generation rules.
- `spec/PLATFORMS.md`: the runner interface and the guide for porting to another coding tool.

## Install with an AI agent

`BOOTSTRAP_PROMPT.md` contains a bootstrap prompt for an AI agent. It references the repository files instead of duplicating them, so the same prompt works for installing this repository and for porting the system to another coding tool. Point your agent at that file, or at the repository, and let it follow `README.md`.

## Policies

- Tickets, briefs, findings, and evidence are local. Git artifacts never reference them.
- Branch names are `<type>/<kebab-case-slug>`. Commit subjects and pull request titles are `<type>: <subject>` with no scope parentheses.
- No ADR numbers or issue references in code, branches, commits, pull requests, or merges.
- The executor may commit but never push, merge, rebase, or force-push. The orchestrator owns those operations and merges only after the required checks pass.
- Tests may be changed freely. The CI build, test suite, and coverage threshold are the quality gates.
- No diagnostic reports. Audit evidence stays local.
- Generated artifacts are written in English. No language detection.

## Known constraints

- GitHub is a hard dependency: pull requests, checks, and merges use the `gh` CLI. The coding tool is replaceable through runners; the Git host is not, yet.
- The bundled platform agents assume the default ticket and state paths: `tickets/**` and `tickets/.autopai`. If you change `ticketDirs` or `stateDir`, adjust the agent permissions under `platforms/opencode/agents/`.
- `protectedPaths` defaults to `.github/**`, `AGENTS.md`, and `autopai.json`. Change it in `autopai.json` when the repository uses other protected files.
- `npm link` must be run again after moving the clone.

## Migrating to another tool

Installing this repository is not the same as using it with another coding tool. The kit ships one bundled platform. To run the orchestrator with another tool:

1. Add `src/runners/<tool>.js` exporting `runSession`.
2. Register it in `src/runners/index.js`.
3. Set `runner` in the target repository `autopai.json`.
4. Recreate the agent roles and permissions under `platforms/<tool>/`.

The core prompts, phases, state, policy, and merge logic do not change. Read `spec/PLATFORMS.md` and `BOOTSTRAP_PROMPT.md` for the details.

## Troubleshooting

- `autopai` is not found after `npm link`: check the npm global prefix with `npm prefix -g` and add its bin directory to `PATH`. On Windows the shim is `%APPDATA%\npm\autopai.cmd`.
- Two clones are linked: only one can own the `autopai` command. Run `npm link` in the clone you want to keep.
- The bundled platform commands do not appear: confirm the files are in `%USERPROFILE%\.config\opencode\commands` or `~/.config/opencode/commands`, then restart the tool.
- A ticket failed local gates: run `/autopai-resume --fix` or `/autopai-resume`; do not create a duplicate branch. The failed branch is reused.

## Development

```text
npm test
npm run build-bootstrap
npm run check-bootstrap
```

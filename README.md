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

AutopAI is a workflow for using AI agents professionally across the whole delivery cycle. It helps you discuss an idea, formalize it into a brief and backlog, plan the implementation, build it with tests and CI, audit the new feature for technical debt, refactor it, and repeat. The human makes the decisions that matter; the orchestrator runs each phase in a fresh session, owns every Git write, and stops at the gates you configure.

It is language, repository, and coding-tool agnostic. The build, test, and check commands come from an `autopai.json` generated inside each target repository, the task prompts live in the core, and the coding tool is a replaceable runner.

The same workflow is available through slash commands or natural language. The operator agent translates a request into the deterministic CLI and confirms ambiguous interpretations before running.

## The loop

1. **Discuss the idea** with the operator. Nothing is written yet.
2. **Formalize it** with `/autopai-plan "<idea>"`. The planner writes the brief and backlog and stops at the backlog gate.
3. **Approve the backlog** to generate the ready-for-dev plan, review the technical tickets, then approve the plan.
4. **Implement it.** Dev creates one branch and one pull request per ticket, runs the local gates and CI, merges only when they pass, and writes the manual QA checklist.
5. **Verify and audit.** Review the QA checklist, then identify the pull requests of the new feature, promote the findings, and refactor them.
6. **Repeat** with the next idea. Run `/autopai-release` when you decide to publish.

## Highlights

- Assisted by default: review the backlog, the ready-for-dev plan, and the manual QA. Approve each gate explicitly.
- Configurable gates: `pauseAfter` in `autopai.json` decides where the loop stops. Stop at every phase or only where you want.
- One continuation command: `autopai resume`. Approve one gate with `--approve <gate>`; skip human pauses with `--auto`.
- CI-gated merges: a pull request merges only after the required checks pass.
- Resumable phases: state lives in local files, and a crashed run resumes where it stopped.
- Clean loops: after every merge it deletes the remote branch, fast-forwards the local base branch, and deletes the merged local branch.
- Local artifacts: tickets, briefs, findings, and evidence never touch Git.
- Any coding tool and any language: one runner module per tool, and no ecosystem detection.

## How it works

| Phase | What it does |
| --- | --- |
| `adopt` | Finishes an existing branch through push, pull request, CI, and merge. |
| `prepare` | Writes the feature brief and backlog, then stops at the backlog gate. |
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

Add or remove gates in `autopai.json`; use `--pause-after` to override the list for one run.

## Commands and natural language

| Step | Slash command | Natural language |
| --- | --- | --- |
| Discuss and formalize | `/autopai-plan` | `/autopai-plan "the feature we just discussed"` |
| Approve the backlog | `/autopai-resume --approve backlog` | "approve the backlog and generate the plan" |
| Approve the plan | `/autopai-resume --approve plan` | "approve the plan and implement" |
| Review QA and audit | `/autopai-resume --approve qa` | "I reviewed QA; audit the feature" |
| Refactor | `/autopai-refactor` | "refactor the pending tickets" |
| Check progress | `/autopai-status` | "how is the run going?" |

The operator agent translates the request and confirms ambiguous interpretations; it works in any language. Explicit flags run verbatim; the CLI underneath is deterministic.

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

Open a target repository in the coding tool and run `/autopai-init`. The operator agent (`autopai`) inspects the repository and writes `autopai.json`. No language or framework is assumed.

The assisted loop:

```text
/autopai-plan "the feature we just discussed"
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

## Development

```text
npm test
npm run build-bootstrap
npm run check-bootstrap
```

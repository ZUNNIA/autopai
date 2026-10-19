<p align="center">
  <img src="assets/autopai.svg" width="128" alt="AutopAI">
</p>

<h1 align="center">AutopAI</h1>

<p align="center">
  Turns a feature idea into merged pull requests while you stay out of the loop.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node 20 or newer">
  <img src="https://img.shields.io/badge/status-active-success.svg" alt="Active">
</p>

## About

AutopAI drives agentic coding tools through the whole development cycle. It plans a feature, breaks it into tickets, implements them one by one, audits the result, refactors what it finds, and prepares the release. Each phase runs in a fresh session, the state lives in local files, and the orchestrator owns every Git write, so a run survives a crash and resumes where it stopped.

It is language, repository, and coding-tool agnostic. The build, test, and check commands come from an `autopai.json` generated inside each target repository, the task prompts live in the core, and the coding tool is a replaceable runner.

## Highlights

- Resumable phases: adopt, prepare, approve, dev, identify, promote, refactor, and release.
- Zero-argument phases: `--feature` and `--scope` resolve from the previous run state or the latest ticket directory.
- Starts at any phase. Hand it an existing branch or stop after a backlog review.
- CI-gated merges. It merges only after the required checks pass.
- Clean loops. After every merge it deletes the remote branch, fast-forwards the local base branch, and deletes the merged local branch.
- Local artifacts. Tickets, briefs, and findings never touch Git.
- Any coding tool. One runner module per tool; the core does not change.
- Any language. No ecosystem detection; the AI inspects the repository.

## How it works

| Phase | What it does |
| --- | --- |
| `adopt` | Finishes an existing branch through push, pull request, CI, and merge. |
| `prepare` | Writes the feature brief and the backlog, then stops for review. |
| `approve` | Generates ready-for-dev tickets and starts the development loop. |
| `dev` | Implements one ticket per branch through CI and merge. |
| `identify` | Audits scopes and writes local findings. |
| `promote` | Turns the findings into ready-for-refactor tickets. |
| `refactor` | Executes refactor tickets with the same gates. |
| `release` | Updates version and changelog, opens the release pull request, merges, and tags. |

`autopai run --from <phase> --to <phase>` chains any range of phases.

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

Open a target repository in the coding tool and run `/autopai-init`. The setup agent inspects the repository and writes `autopai.json`. No language or framework is assumed. Then run the phase you need:

```text
/autopai-plan "<idea>"
/autopai-dev
/autopai-identify
/autopai-refactor
/autopai-release <x.y.z>
/autopai-adopt --branch <name>
/autopai-adr
/autopai-status
```

The arguments are optional. `--feature` resolves from the previous run state or the latest ticket directory, and `identify` audits the pull requests of the last run when no `--scope` is given. The commands also accept natural language (`/autopai-identify audit the last 2 merged branches`): the setup agent translates the request into flags and confirms ambiguous interpretations. The same phases are available from the CLI:

```text
autopai prepare --repo . --description "<idea>"
autopai run --repo . --from approve --to dev
autopai identify --repo .
autopai promote --repo .
autopai status --repo .
autopai resume --repo .
```

Every command supports `--dry-run` where it makes sense, and a run can start or stop at any phase.

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

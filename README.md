# AutopAI

Portable, CI-gated development orchestrator for agentic coding tools. It coordinates work through resumable phases, keeps state in local files, and owns every Git write: branches, commit validation, pushes, pull requests, CI waits, and merges.

The orchestrator is language, repository, and coding-tool agnostic. Every build, test, and check comes from a `.autopai.json` that the AI generates inside each target repository. Task prompts live in the core and sessions run through a runner selected in the configuration, so the same orchestrator can drive the bundled platform today and another tool tomorrow.

## Requirements

- Node.js 20 or newer.
- Git and GitHub CLI (`gh`) authenticated.
- The CLI of at least one supported coding tool. The bundled platform targets OpenCode; adding another tool is documented in `spec/PLATFORMS.md`.

## Repository layout

```text
src/                         Node orchestrator
src/prompts/                 Core-owned task prompts, independent from any tool
src/runners/                 Session runners, one module per coding tool
test/                        Unit tests
spec/                        Architecture, policies, config schema, platform guide
platforms/opencode/agents/   Bundled platform agent definitions
platforms/opencode/commands/ Bundled platform command wrappers
AGENTS.md                    Global rules for the coding tool
BOOTSTRAP_PROMPT.md          Bootstrap prompt that guides an AI agent to install or port the system
scripts/build-bootstrap.mjs  Regenerates BOOTSTRAP_PROMPT.md from the sources
```

## Setup

1. Clone this repository anywhere on the machine.
2. Install dependencies:

```text
npm ci
```

3. Make the orchestrator available as a global command:

```text
npm link
```

The `autopai` command now points at this clone. Run `npm link` again after moving the clone.

4. Install the platform files for the coding tool you use. The bundled platform lives under `platforms/opencode/`. Copy or link:

- `platforms/opencode/agents/*` into `~/.config/opencode/agents/`.
- `platforms/opencode/commands/*` into `~/.config/opencode/commands/`.
- `AGENTS.md` into `~/.config/opencode/AGENTS.md`, or merge it with the existing file.

## Install with an AI agent

This section is written so a human or an AI agent can install the kit without guessing.

Verify the prerequisites:

```powershell
node --version
git --version
gh auth status
```

```bash
node --version
git --version
gh auth status
```

For the bundled platform, also verify its CLI:

```powershell
opencode --version
```

```bash
opencode --version
```

Clone the repository:

```powershell
gh repo clone ZUNNIA/autopai "$env:USERPROFILE\autopai"
```

```bash
gh repo clone ZUNNIA/autopai ~/autopai
```

Install dependencies and link the command:

```powershell
Set-Location "$env:USERPROFILE\autopai"
npm ci
npm link
```

```bash
cd ~/autopai
npm ci
npm link
```

`npm link` creates the `autopai` command. On Windows the shim lives in `%APPDATA%\npm`, which must be on `PATH`.

Install the bundled platform files:

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

If `~/.config/opencode/AGENTS.md` already exists, merge the AutopAI section instead of overwriting the whole file. When you use another coding tool, install its platform files in the location that tool reads instead.

Verify the installation:

```text
autopai help
```

Then open a target repository and run `/autopai-init`. If you are an AI agent, `BOOTSTRAP_PROMPT.md` contains a bootstrap prompt you can be given directly. It references the repository files instead of duplicating them, so it works for installing this repository and for porting the system to another coding tool.

## Usage in a target repository

1. Open the target repository in the coding tool.
2. Run `/autopai-init`. The setup agent inspects the repository and writes `.autopai.json`. No language or framework is assumed.
3. Review `.autopai.json`.
4. Run the phase you need:

- `/autopai-adopt --branch <name>` finishes an existing branch through push, pull request, CI, and merge.
- `/autopai-run --from prepare --to prepare --feature <slug> --description "<idea>"` generates a brief and a backlog, then stops for review.
- `/autopai-run --from approve --to dev --feature <slug>` generates tickets and runs the development loop.
- `/autopai-identify --scope branch:<name> --scope pr:<number>` audits scopes and writes local findings.
- `/autopai-run --from refactor --to refactor --feature <slug>` executes refactor tickets.
- `/autopai-run --from release --to release --version <x.y.z>` prepares and merges a release.
- `/autopai-status` shows the current run.

CLI equivalents:

```text
autopai adopt --repo . --branch <name>
autopai identify --repo . --scope branch:<name> --scope pr:<number>
autopai status --repo .
autopai resume --repo .
```

Every command supports `--dry-run` where it makes sense. A run can start at any phase and stop at any phase.

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
- `protectedPaths` defaults to `.github/**`, `AGENTS.md`, and `.autopai.json`. Change it in `.autopai.json` when the repository uses other protected files.
- `npm link` must be run again after moving the clone.

## Migrating to another tool

Installing this repository is not the same as using it with another coding tool. The kit ships one bundled platform. To run the orchestrator with another tool, follow the porting steps below.

Read `BOOTSTRAP_PROMPT.md` and `spec/PLATFORMS.md`. The orchestrator is the portable piece. To support a new tool:

1. Add `src/runners/<tool>.js` exporting `runSession`.
2. Register it in `src/runners/index.js`.
3. Set `runner` in the target repository `.autopai.json`.
4. Recreate the agent roles and permissions under `platforms/<tool>/`.

The core prompts, phases, state, policy, and merge logic do not change.

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

## License

MIT. See `LICENSE`.

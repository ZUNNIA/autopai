import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const outputFile = path.join(root, 'BOOTSTRAP_PROMPT.md')

const HEADER = `# Bootstrap prompt

You are installing or recreating the ai-autopilot system. Everything you need is in this document. Read it fully before acting.

## If you are installing this repository

When the repository is already available, do not recreate the files. Follow \`README.md\` and:

1. Verify Node.js, Git, the GitHub CLI, and the target coding tool.
2. Run \`npm ci\` and \`npm link\` inside the clone.
3. Install the platform files for the target tool from \`platforms/<tool>/\`.
4. Verify \`ai-autopilot help\`.
5. In each target repository, generate \`.autopilot.json\` by inspecting it, then run \`ai-autopilot status --repo .\`.

Installing the kit is not the same as porting it. The kit ships the OpenCode platform. To use another coding tool, follow \`spec/PLATFORMS.md\` and create the runner and agents for that tool.

## Mission

Build and install a portable, CI-gated development orchestrator that:

- Coordinates work through resumable phases: adopt, prepare, approve, dev, identify, refactor, release.
- Keeps state in local files, never in a conversation.
- Owns every Git write: branch creation, push, pull request, CI wait, and merge.
- Merges only after the configured required checks pass.
- Is language, framework, repository, and coding-tool agnostic. Every command comes from the target repository configuration.
- Keeps task prompts in the core and runs sessions through a configurable runner, so the coding tool is a replaceable adapter.
- Writes all generated artifacts in English. Never detect or switch languages.

## How to use this document

1. Read the specification sections below.
2. Create every file listed in the source inventory with the exact content provided.
3. Adapt the platform files to the target coding tool using the platform guide. When the tool has no permission model, rely on the orchestrator verification described in the architecture.
4. For every target repository, generate \`.autopilot.json\` by inspecting that repository. Do not assume a language, framework, or command. Follow the configuration schema.
5. Run \`npm ci\` and \`npm link\` so the \`ai-autopilot\` command is available globally. Run \`npm link\` again after moving the clone.
6. Run \`npm test\`. Then run a dry run and confirm no files are written outside the local state directory.

## Hard constraints

- Tickets, briefs, findings, and evidence are local. Never commit, push, or reference them from Git artifacts.
- No ticket paths, ADR numbers, or issue references in code, branches, commits, pull requests, or merge commits.
- Branches use \`<type>/<kebab-case-slug>\`. Commit subjects and pull request titles use \`<type>: <subject>\` with no scope parentheses.
- The executor may commit but never push, merge, rebase, force-push, or run \`gh\`.
- The orchestrator is the only component that pushes, opens pull requests, and merges.
- Tests may be changed freely. CI build, test suite, and coverage threshold are the quality gates.
- No diagnostic reports.
- Never put secrets, tokens, or personal absolute paths in \`.autopilot.json\`.

## Verification checklist

- \`npm test\` passes.
- \`ai-autopilot status --repo <target>\` works from a new shell and loads the generated configuration without errors.
- \`ai-autopilot adopt --repo <target> --branch <branch> --dry-run\` reports the plan without pushing or merging.
- \`ai-autopilot identify --repo <target> --scope branch:<branch> --dry-run\` reports the scope without running the auditor.
- No file outside the target repository state directory changed during a dry run.

## Source inventory
`

async function main() {
  const check = process.argv.includes('--check')
  const files = await collectFiles()
  const sections = []

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8')
    sections.push(renderFile(path.relative(root, file).replace(/\\/g, '/'), content))
  }

  const prompt = `${HEADER}\n${sections.join('\n')}`
  if (check) {
    const existing = await fs.readFile(outputFile, 'utf8').catch(() => '')
    if (existing !== prompt) {
      process.stderr.write('BOOTSTRAP_PROMPT.md is out of date. Run: npm run build-bootstrap\n')
      process.exitCode = 1
      return
    }
    process.stdout.write('BOOTSTRAP_PROMPT.md is in sync.\n')
    return
  }

  await fs.writeFile(outputFile, prompt, 'utf8')
  process.stdout.write(`Wrote ${outputFile}\n`)
}

async function collectFiles() {
  const groups = [
    ['AGENTS.md'],
    ['package.json'],
    await sorted('spec'),
    await sorted('platforms/opencode/agents'),
    await sorted('platforms/opencode/commands'),
    await sorted('src'),
    await sorted('test')
  ]
  const files = []
  for (const group of groups) {
    for (const item of group) files.push(path.join(root, item))
  }
  return files
}

async function sorted(directory) {
  const full = path.join(root, directory)
  const entries = await fs.readdir(full, { withFileTypes: true, recursive: true })
  return entries
    .filter(entry => entry.isFile())
    .map(entry => path.relative(root, path.join(entry.parentPath ?? entry.path, entry.name)).replace(/\\/g, '/'))
    .filter(file => !file.endsWith('.map'))
    .sort()
}

function renderFile(relativePath, content) {
  const fence = fenceFor(content)
  return `### ${relativePath}\n\n${fence}\n${content.replace(/\s+$/, '')}\n${fence}\n`
}

function fenceFor(content) {
  const matches = content.match(/`+/g) ?? []
  const longest = matches.reduce((max, run) => Math.max(max, run.length), 0)
  return '`'.repeat(Math.max(3, longest + 1))
}

main().catch(error => {
  process.stderr.write(`build-bootstrap: ${error.message}\n`)
  process.exitCode = 1
})

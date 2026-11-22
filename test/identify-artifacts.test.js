import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { runIdentify } from '../src/phases/identify.js'
import { StateStore } from '../src/lib/state.js'
import { inspectArtifactFiles } from '../src/lib/artifact-contracts.js'

const ticketDirs = {
  backlog: 'tickets/backlog',
  readyForDev: 'tickets/ready-for-dev',
  identified: 'tickets/identified',
  readyForRefactor: 'tickets/ready-for-refactor',
  ux: 'tickets/ux',
  qa: 'tickets/qa',
  done: 'tickets/done'
}

test('inspectArtifactFiles reports every invalid finding', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-inspect-findings-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const valid = path.join(root, 'valid.md')
  const invalidA = path.join(root, 'invalid-a.md')
  const invalidB = path.join(root, 'invalid-b.md')
  await fs.writeFile(valid, finding({ priority: '**Priority:** 🟡 **Important:** costs time.' }), 'utf8')
  await fs.writeFile(invalidA, finding({ priority: '' }), 'utf8')
  await fs.writeFile(invalidB, finding({ priority: '' }).replace('* [x] **Code Smell:**', '* [ ] **Code Smell:**'), 'utf8')

  const report = await inspectArtifactFiles([valid, invalidA, invalidB], 'identified')
  assert.equal(report.ok, false)
  assert.equal(report.errors.length, 2)
  assert.equal(report.reports.length, 1)
})

test('identify archives previous findings and repairs one invalid finding', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-identify-artifacts-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const repo = path.join(root, 'repo')
  await fs.mkdir(path.join(repo, 'src'), { recursive: true })
  await fs.writeFile(path.join(repo, 'src', 'app.js'), 'export const value = 1\n', 'utf8')
  await fs.mkdir(path.join(repo, 'tickets', 'identified', 'src'), { recursive: true })
  await fs.writeFile(path.join(repo, 'tickets', 'identified', 'src', 'old.md'), '# Old finding\n', 'utf8')
  await fs.writeFile(path.join(repo, '.gitignore'), 'tickets/\n', 'utf8')
  await git(repo, ['init'])
  await git(repo, ['config', 'user.email', 'test@example.com'])
  await git(repo, ['config', 'user.name', 'Test'])
  await git(repo, ['add', '.'])
  await git(repo, ['commit', '-m', 'init'])

  const auditor = path.join(root, 'auditor.js')
  await fs.writeFile(auditor, auditorScript(), 'utf8')

  const config = {
    repoPath: repo,
    ticketDirs,
    stateDir: path.join(repo, 'tickets', '.autopai'),
    baseBranch: 'main',
    releaseBranch: 'main',
    runner: 'command',
    runnerOptions: { run: [process.execPath, auditor], prompt: 'stdin' },
    agents: { executor: 'executor', planner: 'planner', auditor: 'auditor', operator: 'autopai' },
    models: { executor: null, planner: null, auditor: null, operator: null },
    restoreCommand: null,
    buildCommand: null,
    testCommand: null,
    smokeCommand: null,
    coverageThreshold: null,
    auditChunkFiles: 40,
    localGateRetries: 0,
    runtimeLogs: [],
    billingCurrency: 'USD',
    commandTimeoutMinutes: 1,
    sessionTimeoutMinutes: 1
  }

  const stateStore = new StateStore(config)
  const result = await runIdentify({
    config,
    stateStore,
    options: { scope: 'dir:src' },
    log: () => {}
  })

  assert.equal(result.archived, 1)
  assert.deepEqual(result.repairs, [{ scope: 'src', files: 1 }])
  assert.ok(result.archive)
  const active = await fs.readdir(path.join(repo, 'tickets', 'identified', 'src'))
  assert.deepEqual(active, ['01-finding.md'])
  assert.match(await fs.readFile(path.join(repo, 'tickets', 'identified', 'src', '01-finding.md'), 'utf8'), /^\*\*Priority:\*\* \S+ \*\*Important:\*\*/m)
  assert.equal(await exists(path.join(result.archive, 'src', 'old.md')), true)

  const state = await stateStore.load()
  assert.equal(state.phase, 'identified')
  assert.ok(state.completedPhases.includes('identify:src'))
  assert.equal(state.scopes.length, 1)
  assert.equal(state.scopes[0].tickets.length, 1)
  assert.equal(await exists(path.join(repo, 'tickets', '.autopai', 'artifacts', state.runId, 'auditor-src-repair.log')), true)
})

function auditorScript() {
  return `const fs = require('node:fs')
const path = require('node:path')
let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  const repair = input.includes('Technical Debt Ticket Repair')
  const dir = path.join(process.cwd(), 'tickets', 'identified', 'src')
  fs.mkdirSync(dir, { recursive: true })
  const lines = [
    '# Finding',
    '',
    'Billing impact: none',
    '',
    '## 0. Classification',
    '* [x] **Code Smell:** duplication.'
  ]
  if (repair) lines.push('**Priority:** 🟡 **Important:** costs time.')
  lines.push('', '## 1. Objective', 'O.', '', '## 2. Evidence', 'E.', '', '## 3. Impact', 'I.', '', '## 4. References', 'R.')
  fs.writeFileSync(path.join(dir, '01-finding.md'), lines.join('\\n') + '\\n')
})
`
}

function finding({ priority }) {
  const lines = [
    '# Finding',
    '',
    'Billing impact: none',
    '',
    '## 0. Classification',
    '* [x] **Code Smell:** duplication.'
  ]
  if (priority) lines.push(priority)
  lines.push('', '## 1. Objective', 'O.', '', '## 2. Evidence', 'E.', '', '## 3. Impact', 'I.', '', '## 4. References', 'R.')
  return `${lines.join('\n')}\n`
}

function git(repo, args) {
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
}

async function exists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

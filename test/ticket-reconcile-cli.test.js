import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const cli = path.resolve('src/cli.js')

test('tickets inspect prints the queue report as JSON', async t => {
  const repo = await fixture(t)
  const output = execFileSync(process.execPath, [cli, 'tickets', 'inspect', '--repo', repo, '--json'], { encoding: 'utf8' })
  const report = JSON.parse(output)
  assert.deepEqual(report.readyForRefactor.map(ticket => ticket.id), ['again-id', 'move-id'])
  assert.equal(report.done.some(ticket => ticket.id === 'a-done'), true)
  assert.equal(report.activeRun, false)
})

test('tickets reconcile applies a plan only with --apply --confirm', async t => {
  const repo = await fixture(t)
  const planFile = path.join(repo, 'plan.json')
  await fs.writeFile(planFile, JSON.stringify(plan()), 'utf8')

  const dry = execFileSync(process.execPath, [cli, 'tickets', 'reconcile', '--repo', repo, '--plan', planFile, '--json'], { encoding: 'utf8' })
  assert.equal(JSON.parse(dry).applied, false)

  const rejected = spawnSync(process.execPath, [cli, 'tickets', 'reconcile', '--repo', repo, '--plan', planFile, '--apply'], { encoding: 'utf8' })
  assert.equal(rejected.status, 1)
  assert.match(rejected.stderr, /requires --confirm/)

  const applied = execFileSync(process.execPath, [cli, 'tickets', 'reconcile', '--repo', repo, '--plan', planFile, '--apply', '--confirm', '--json'], { encoding: 'utf8' })
  const result = JSON.parse(applied)
  assert.equal(result.applied, true)
  assert.equal(result.verification.ok, true)
  assert.equal(await exists(path.join(repo, 'tickets/done/tech-debt/move.md')), true)
})

test('help documents the tickets commands', () => {
  const output = execFileSync(process.execPath, [cli, 'help'], { encoding: 'utf8' })
  assert.match(output, /autopai tickets inspect --repo <path>/)
  assert.match(output, /autopai tickets reconcile --repo <path> --plan <file>/)
})

async function fixture(t) {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-reconcile-cli-'))
  t.after(() => fs.rm(repo, { recursive: true, force: true }))
  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({ runner: 'opencode' }), 'utf8')
  await write(repo, 'tickets/done/tech-debt/a.md', ticket({ id: 'a-done', title: 'A' }))
  await write(repo, 'tickets/ready-for-refactor/move.md', ticket({ id: 'move-id', title: 'Move' }))
  await write(repo, 'tickets/ready-for-refactor/again.md', ticket({ id: 'again-id', title: 'Again', dependsOn: ['move-id'] }))
  return repo
}

function plan() {
  return {
    schemaVersion: 1,
    moves: [
      { file: 'tickets/ready-for-refactor/move.md', id: 'move-id', action: 'done', duplicateOf: 'a-done' }
    ],
    dependencyUpdates: [
      { file: 'tickets/ready-for-refactor/again.md', remove: ['move-id'], add: ['a-done'] }
    ]
  }
}

function ticket({ id, title, dependsOn = [] }) {
  return [
    '---',
    `id: ${id}`,
    'feature: tech-debt',
    'type: refactor',
    'classification: code-smell',
    'priority: important',
    'billing: none',
    `depends_on: [${dependsOn.join(', ')}]`,
    '---',
    '',
    `# ${title}`,
    '',
    '## 0. Classification',
    '* [x] **Code Smell:** duplication.',
    '* [x] **Important:** costs time.',
    '',
    '## 1. Objective',
    'O.',
    '',
    '## 2. Files',
    'F.',
    '',
    '## 3. Refactoring Strategy',
    'S.',
    '',
    '## 4. Risk Mitigation Plan',
    'R.',
    '',
    '## 5. Acceptance Criteria',
    'A.',
    '',
    '## 6. Technical Notes and Design Decisions',
    'T.'
  ].join('\n')
}

async function write(repo, relative, content) {
  const file = path.join(repo, relative)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${content.trimEnd()}\n`, 'utf8')
}

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

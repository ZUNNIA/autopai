import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { inspectTickets, reconcileTickets, verifyQueue } from '../src/lib/ticket-reconcile.js'

const dirs = {
  backlog: 'tickets/backlog',
  readyForDev: 'tickets/ready-for-dev',
  identified: 'tickets/identified',
  readyForRefactor: 'tickets/ready-for-refactor',
  ux: 'tickets/ux',
  qa: 'tickets/qa',
  done: 'tickets/done'
}

test('inspect exposes the queue, blockers and unresolved dependencies', async t => {
  const repo = await fixture(t)
  const report = await inspectTickets(config(repo))
  assert.equal(report.activeRun, false)
  assert.deepEqual(report.readyForRefactor.map(ticket => ticket.id), ['dup-id', 'keep-id', 'move-id', 'orphan-id'])
  assert.equal(report.done.some(ticket => ticket.id === 'a-done'), true)
  assert.deepEqual(report.blockers.map(blocker => path.basename(blocker.file)), ['block.json'])
  assert.deepEqual(report.unresolvedDependencies.map(issue => issue.dependency), ['missing-id'])
})

test('dry run validates and apply moves, archives, edits and verifies', async t => {
  const repo = await fixture(t)
  const planFile = path.join(repo, 'plan.json')
  await fs.writeFile(planFile, JSON.stringify(plan()), 'utf8')
  const dry = await reconcileTickets(config(repo), plan(), { planFile })
  assert.equal(dry.applied, false)
  assert.equal(dry.verification.ok, true)
  assert.equal(await exists(path.join(repo, 'tickets/ready-for-refactor/move.md')), true)

  const applied = await reconcileTickets(config(repo), plan(), { apply: true, confirm: true, planFile })
  assert.equal(applied.applied, true)
  assert.equal(applied.verification.ok, true)
  assert.equal(await exists(path.join(repo, 'tickets/ready-for-refactor/move.md')), false)
  assert.equal(await exists(path.join(repo, 'tickets/done/tech-debt/move.md')), true)
  assert.equal(await exists(path.join(repo, 'tickets/ready-for-refactor/dup.md')), false)
  assert.equal(await exists(path.join(repo, 'tickets/.autopai/superseded/ready-for-refactor/dup.md')), true)
  assert.equal(await exists(path.join(repo, 'tickets/.autopai/superseded/identified/demo/finding.md')), true)
  assert.equal(await exists(path.join(repo, 'tickets/.autopai/needs-human/block.json')), false)
  assert.equal(await exists(applied.backupDir), true)
  assert.equal(await exists(applied.journal), true)
  const keep = await fs.readFile(path.join(repo, 'tickets/ready-for-refactor/keep.md'), 'utf8')
  assert.match(keep, /depends_on: \[a-done\]/)
  assert.match(keep, /A\. Keep the existing behavior\./)

  const again = await reconcileTickets(config(repo), plan(), { apply: true, confirm: true, planFile })
  assert.equal(again.applied, true)
  assert.equal(again.operations.every(operation => operation.idempotent || operation.kind === 'write'), true)
})

test('rejects an archive that leaves a kept ticket with an unknown dependency', async t => {
  const repo = await fixture(t)
  const unsafe = plan()
  unsafe.dependencyUpdates = []
  await assert.rejects(
    reconcileTickets(config(repo), unsafe),
    /depends on unknown ticket dup-id/
  )
})

test('rejects path traversal, unknown fields and an unconfirmed apply', async t => {
  const repo = await fixture(t)
  const planFile = path.join(repo, 'plan.json')
  await fs.writeFile(planFile, JSON.stringify(plan()), 'utf8')
  await assert.rejects(
    reconcileTickets(config(repo), { ...plan(), extra: true }, { planFile }),
    /Unknown reconciliation plan field/
  )
  const traversal = plan()
  traversal.moves[0].file = '../outside.md'
  await assert.rejects(
    reconcileTickets(config(repo), traversal, { planFile }),
    /must be inside/
  )
  await assert.rejects(
    reconcileTickets(config(repo), plan(), { apply: true, planFile }),
    /requires explicit confirmation/
  )
})

test('verifyQueue reports duplicates and unknown dependencies', () => {
  const result = verifyQueue({
    ready: [
      { id: 'a', slug: 'a', dependsOn: ['missing'] },
      { id: 'a', slug: 'b', dependsOn: [] }
    ],
    done: [{ id: 'a', slug: 'c' }]
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /Duplicate ready ticket id a/)
  assert.match(result.errors.join('\n'), /exists in both ready and done/)
  assert.match(result.errors.join('\n'), /unknown ticket missing/)
})

async function fixture(t) {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-reconcile-'))
  t.after(() => fs.rm(repo, { recursive: true, force: true }))
  await write(repo, 'tickets/done/tech-debt/a.md', ticket({ id: 'a-done', title: 'A' }))
  await write(repo, 'tickets/ready-for-refactor/move.md', ticket({ id: 'move-id', title: 'Move' }))
  await write(repo, 'tickets/ready-for-refactor/dup.md', ticket({ id: 'dup-id', title: 'Duplicate' }))
  await write(repo, 'tickets/ready-for-refactor/keep.md', ticket({ id: 'keep-id', title: 'Keep', dependsOn: ['dup-id'] }))
  await write(repo, 'tickets/ready-for-refactor/orphan.md', ticket({ id: 'orphan-id', title: 'Orphan', dependsOn: ['missing-id'] }))
  await write(repo, 'tickets/identified/demo/finding.md', '# Finding\n')
  await write(repo, 'tickets/.autopai/needs-human/block.json', JSON.stringify({
    reason: 'blocked',
    files: [],
    decision: 'decide',
    suggestedAction: 'act'
  }))
  return repo
}

function plan() {
  return {
    schemaVersion: 1,
    moves: [
      { file: 'tickets/ready-for-refactor/move.md', id: 'move-id', action: 'done', duplicateOf: 'a-done', reason: 'delivered' },
      { file: 'tickets/ready-for-refactor/dup.md', id: 'dup-id', action: 'archive', duplicateOf: 'keep-id', reason: 'duplicate' }
    ],
    dependencyUpdates: [
      { file: 'tickets/ready-for-refactor/keep.md', remove: ['dup-id'], add: ['a-done'] },
      { file: 'tickets/ready-for-refactor/orphan.md', remove: ['missing-id'], add: ['a-done'] }
    ],
    edits: [
      { file: 'tickets/ready-for-refactor/keep.md', find: 'A.', replace: 'A. Keep the existing behavior.', expectedCount: 1 }
    ],
    findings: [
      { file: 'tickets/identified/demo/finding.md', action: 'archive', reason: 'stale' }
    ],
    blockers: [
      { file: 'tickets/.autopai/needs-human/block.json', action: 'archive', reason: 'resolved' }
    ]
  }
}

function config(repo) {
  return {
    repoPath: repo,
    ticketDirs: dirs,
    stateDir: path.join(repo, 'tickets', '.autopai')
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

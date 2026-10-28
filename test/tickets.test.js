import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { listTickets, orderTickets, branchNameFor, blockedDependents, collectManualVerification, filterFindingFiles, filterTicketsByFeature, resolveTicketBranch, selectTickets, ticketDoneDir } from '../src/lib/tickets.js'

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

function commit(cwd, message) {
  git(cwd, ['-c', 'user.email=test@example.com', '-c', 'user.name=AutopAI Test', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', message])
}

test('parses front matter and orders tickets by dependency', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-tickets-'))
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

test('reads the classification from front matter or the checked body', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-classification-'))
  await fs.writeFile(path.join(dir, '001-front.md'), [
    '---',
    'id: front',
    'classification: lack-of-coverage',
    'priority: minor',
    '---',
    '# Front'
  ].join('\n'), 'utf8')
  await fs.writeFile(path.join(dir, '002-body.md'), [
    '---',
    'id: body',
    'priority: important',
    '---',
    '# Body',
    '* [x] **Architecture:** mixed responsibilities.'
  ].join('\n'), 'utf8')

  const tickets = await listTickets(dir)
  assert.equal(tickets[0].classification, 'lack-of-coverage')
  assert.equal(tickets[0].priority, 'minor')
  assert.equal(tickets[1].classification, 'architecture')
  assert.equal(tickets[1].priority, 'important')
})

test('filters finding files by classification and priority', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-findings-'))
  const keep = path.join(dir, 'keep.md')
  const drop = path.join(dir, 'drop.md')
  await fs.writeFile(keep, '# Keep\n* [x] **Code Smell:** duplication.\n* [x] **Urgent:** breaks.\n', 'utf8')
  await fs.writeFile(drop, '# Drop\n* [x] **Architecture:** layering.\n* [x] **Minor:** cleanup.\n', 'utf8')

  const selected = await filterFindingFiles([keep, drop], { classifications: ['code-smell'], priorities: ['urgent'] })
  assert.deepEqual(selected, [keep])
})

test('builds a unique branch name without ticket identifiers', () => {
  const ticket = { type: 'feat', slug: 'model-params-panel' }
  assert.equal(branchNameFor(ticket, []), 'feat/model-params-panel')
  assert.equal(branchNameFor(ticket, ['feat/model-params-panel']), 'feat/model-params-panel-2')
})

test('filters the refactor queue by front-matter feature', () => {
  const tickets = [
    { feature: 'tech-debt' },
    { feature: 'settings' },
    { feature: null }
  ]
  assert.deepEqual(filterTicketsByFeature(tickets, 'tech-debt'), [tickets[0]])
  assert.deepEqual(filterTicketsByFeature(tickets, 'missing'), [])
  assert.deepEqual(filterTicketsByFeature(tickets, null), tickets)
  assert.deepEqual(filterTicketsByFeature(null, 'tech-debt'), [])
})

test('groups done tickets by their own feature with a fallback', () => {
  const config = { repoPath: path.resolve('repo'), ticketDirs: { done: path.join('tickets', 'done') } }
  const expected = feature => path.join(config.repoPath, config.ticketDirs.done, feature)
  assert.equal(ticketDoneDir(config, { feature: 'settings' }, 'tech-debt'), expected('settings'))
  assert.equal(ticketDoneDir(config, { feature: null }, 'tech-debt'), expected('tech-debt'))
  assert.equal(ticketDoneDir(config, {}, null), expected('tech-debt'))
  assert.equal(ticketDoneDir(config, { feature: '  ' }, 'tech-debt'), expected('tech-debt'))
})

test('reads tickets from legacy feature subfolders', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-refactor-queue-'))
  const legacy = path.join(root, 'tech-debt')
  await fs.mkdir(legacy, { recursive: true })
  await fs.writeFile(path.join(legacy, '001-parallel.md'), [
    '---',
    'id: parallel',
    'feature: tech-debt',
    'type: refactor',
    'priority: urgent',
    'depends_on: []',
    '---',
    '# Parallel'
  ].join('\n'), 'utf8')

  const tickets = await listTickets(root)
  assert.equal(tickets.length, 1)
  assert.equal(tickets[0].feature, 'tech-debt')
  assert.equal(filterTicketsByFeature(tickets, 'tech-debt').length, 1)
})

test('reuses a ticket branch that already has commits over the base', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-branch-'))
  const remote = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-branch-remote-'))
  git(remote, ['init', '--bare', '--quiet'])
  git(repo, ['init', '-b', 'main', '--quiet'])
  git(repo, ['remote', 'add', 'origin', remote])
  await fs.writeFile(path.join(repo, 'seed.txt'), 'seed\n', 'utf8')
  git(repo, ['add', 'seed.txt'])
  commit(repo, 'chore: seed the test repository')
  git(repo, ['push', '-u', 'origin', 'main'])

  git(repo, ['switch', '-c', 'refactor/ticket-slug'])
  await fs.writeFile(path.join(repo, 'change.txt'), 'change\n', 'utf8')
  git(repo, ['add', 'change.txt'])
  commit(repo, 'refactor: change the ticket scope')

  const config = { repoPath: repo, baseBranch: 'main' }
  const reused = await resolveTicketBranch({ config, ticket: { slug: 'ticket-slug' }, type: 'refactor' })
  assert.equal(reused.branch, 'refactor/ticket-slug')
  assert.equal(reused.reuse, true)
  assert.equal(reused.commits, 1)

  git(repo, ['switch', '-c', 'refactor/ticket-slug-3'])
  await fs.writeFile(path.join(repo, 'change-3.txt'), 'change 3\n', 'utf8')
  git(repo, ['add', 'change-3.txt'])
  commit(repo, 'refactor: retry the ticket scope')
  const suffixed = await resolveTicketBranch({
    config,
    ticket: { slug: 'ticket-slug' },
    type: 'refactor',
    previousBranch: 'refactor/ticket-slug-3'
  })
  assert.equal(suffixed.branch, 'refactor/ticket-slug-3')
  assert.equal(suffixed.reuse, true)
  assert.equal(suffixed.commits, 2)

  const fresh = await resolveTicketBranch({ config, ticket: { slug: 'other-ticket' }, type: 'refactor' })
  assert.equal(fresh.branch, 'refactor/other-ticket')
  assert.equal(fresh.reuse, false)
})

test('rejects a filter that excludes a pending dependency', () => {
  const allTickets = [
    { id: 'a', slug: 'a', file: 'a.md', priority: 'important', dependsOn: [] },
    { id: 'b', slug: 'b', file: 'b.md', priority: 'minor', dependsOn: ['a'] }
  ]
  assert.throws(
    () => selectTickets({ allTickets, tickets: [allTickets[1]], completed: [] }),
    /b depends on a/
  )
  assert.deepEqual(
    selectTickets({ allTickets, tickets: [allTickets[1]], completed: [{ id: 'a' }] }).map(ticket => ticket.id),
    ['b']
  )
  assert.deepEqual(
    selectTickets({ allTickets, tickets: allTickets, completed: [] }).map(ticket => ticket.id),
    ['a', 'b']
  )
})

test('satisfies dependencies already completed in done', () => {
  const pending = [{ id: 'b', slug: 'b-slug', file: 'b.md', priority: 'important', dependsOn: ['a'] }]
  const completed = [{ id: 'a', slug: 'a-slug' }]
  assert.deepEqual(orderTickets(pending, { completed }).map(ticket => ticket.id), ['b'])

  const bySlug = [{ ...pending[0], dependsOn: ['a-slug'] }]
  assert.deepEqual(orderTickets(bySlug, { completed }).map(ticket => ticket.id), ['b'])

  assert.throws(() => orderTickets(pending), /unknown ticket a/)
  assert.throws(() => orderTickets(pending, { completed: [{ id: 'other' }] }), /unknown ticket a/)
})

test('blocks dependents of failed tickets transitively', () => {
  const tickets = [
    { id: 'a', dependsOn: [] },
    { id: 'b', dependsOn: ['a'] },
    { id: 'c', dependsOn: ['b'] },
    { id: 'd', dependsOn: [] }
  ]
  assert.deepEqual([...blockedDependents(tickets, ['a'])], ['b', 'c'])
  assert.deepEqual([...blockedDependents(tickets, [])], [])
  assert.deepEqual([...blockedDependents([{ id: 'x', dependsOn: ['a'] }], ['a'])], ['x'])
})

test('collects manual verification sections from the done tickets', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-qa-'))
  const done = path.join(root, 'done')
  await fs.mkdir(done, { recursive: true })
  await fs.writeFile(path.join(done, '001-panel.md'), [
    '# Panel',
    '## 6. Manual Verification',
    '1. Open Settings > Local.',
    '2. Toggle the KV cache type.',
    '## 7. Notes',
    'This section is not part of the checklist.'
  ].join('\n'), 'utf8')
  await fs.writeFile(path.join(done, '002-copy.md'), [
    '# Copy',
    '## 6. Manual Verification',
    'None'
  ].join('\n'), 'utf8')

  const output = path.join(root, 'qa', 'settings.md')
  const file = await collectManualVerification({ doneDir: done, outputFile: output })
  assert.equal(file, output)
  const text = await fs.readFile(output, 'utf8')
  assert.match(text, /Open Settings > Local/)
  assert.ok(!text.includes('This section is not part of the checklist.'))
  assert.ok(!text.includes('002-copy'))
})

test('returns null when every done ticket is covered by automated tests', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-qa-empty-'))
  const done = path.join(root, 'done')
  await fs.mkdir(done, { recursive: true })
  await fs.writeFile(path.join(done, '001-only.md'), '# Only\n## 6. Manual Verification\nNone\n', 'utf8')
  assert.equal(await collectManualVerification({ doneDir: done, outputFile: path.join(root, 'qa', 'x.md') }), null)
})

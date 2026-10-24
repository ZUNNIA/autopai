import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { listTickets, orderTickets, branchNameFor, collectManualVerification, filterTicketsByFeature, ticketDoneDir } from '../src/lib/tickets.js'

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

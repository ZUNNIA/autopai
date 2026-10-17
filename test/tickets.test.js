import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { listTickets, orderTickets, branchNameFor } from '../src/lib/tickets.js'

test('parses front matter and orders tickets by dependency', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-tickets-'))
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

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { archiveBlockers, listBlockers } from '../src/lib/blockers.js'

test('archives recorded blockers before a retry', async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-blockers-'))
  const needsHuman = path.join(stateDir, 'needs-human')
  const artifactsDir = path.join(stateDir, 'artifacts', 'run-1')
  await fs.mkdir(needsHuman, { recursive: true })
  const first = path.join(needsHuman, 'ticket-one.json')
  const second = path.join(needsHuman, 'ticket-two.json')
  await fs.writeFile(first, JSON.stringify({ reason: 'first' }), 'utf8')
  await fs.writeFile(second, JSON.stringify({ reason: 'second' }), 'utf8')

  const blockers = await listBlockers({ stateDir })
  const archived = await archiveBlockers({ blockers, artifactsDir })
  assert.equal(archived.length, 2)
  assert.equal((await listBlockers({ stateDir })).length, 0)
  assert.equal(await fs.readFile(archived[0].to, 'utf8'), JSON.stringify({ reason: 'first' }))
  await assert.rejects(() => fs.access(first))
  await assert.rejects(() => fs.access(second))
})

test('ignores missing blockers and an empty list', async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-blockers-empty-'))
  const artifactsDir = path.join(stateDir, 'artifacts', 'run-1')
  assert.deepEqual(await archiveBlockers({ blockers: [], artifactsDir }), [])
  const archived = await archiveBlockers({
    blockers: [path.join(stateDir, 'needs-human', 'missing.json')],
    artifactsDir
  })
  assert.deepEqual(archived, [])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { listBlockers, blockerMessage } from '../src/lib/blockers.js'

test('lists executor blockers and tolerates malformed files', async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-blockers-'))
  const config = { stateDir }
  assert.deepEqual(await listBlockers(config), [])

  const dir = path.join(stateDir, 'needs-human')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'ticket-1.json'), JSON.stringify({
    reason: 'The ticket needs an architecture decision',
    suggestedAction: 'run /autopai-adr'
  }), 'utf8')
  await fs.writeFile(path.join(dir, 'broken.json'), '{not json', 'utf8')

  const blockers = await listBlockers(config)
  assert.equal(blockers.length, 2)

  const message = blockerMessage(blockers)
  assert.match(message, /The ticket needs an architecture decision/)
  assert.match(message, /broken\.json/)
  assert.match(message, /autopai resume/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { clearAgentTitle, deriveTitle, readAgentTitle, resolveTitle, ticketTitle } from '../src/lib/title.js'

test('derives the title from the branch and commit types', () => {
  assert.equal(
    deriveTitle('feat/settings-panel', [{ subject: 'feat: add settings panel' }]),
    'feat: settings panel'
  )
  assert.equal(
    deriveTitle('refactor/pr-297-05-exhaustive-kv-cache-mappings', [{ subject: 'refactor: make KV cache type mappings exhaustive' }]),
    'refactor: pr 297 05 exhaustive kv cache mappings'
  )
  assert.equal(
    deriveTitle('fix/panel', [{ subject: 'fix: panel' }, { subject: 'feat: new panel' }]),
    'feat: panel'
  )
})

test('builds the pull request title from the old ticket name', () => {
  assert.equal(
    ticketTitle({ id: 'local-engine-options-grouping', type: 'refactor' }),
    'refactor: local engine options grouping'
  )
  assert.equal(
    ticketTitle({ id: 'ggml-type-table', type: 'refactor' }),
    'refactor: ggml type table'
  )
  assert.equal(ticketTitle({ type: 'feat' }), 'chore: ticket')
})

test('clears a stale agent title idempotently', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-title-'))
  const config = { stateDir: dir }
  await fs.writeFile(path.join(dir, 'pr-title.txt'), 'feat: stale title\n', 'utf8')

  assert.equal(await readAgentTitle(config), 'feat: stale title')
  await clearAgentTitle(config)
  assert.equal(await readAgentTitle(config), null)
  await clearAgentTitle(config)
})

test('resolveTitle uses a valid agent title and falls back to the branch', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-title-resolve-'))
  const config = { stateDir: dir }
  const commits = [{ subject: 'refactor: make the mapping exhaustive' }]

  await fs.writeFile(path.join(dir, 'pr-title.txt'), 'refactor: make the mapping exhaustive\n', 'utf8')
  assert.equal(
    await resolveTitle({ config, branch: 'refactor/pr-297-05-x', commits }),
    'refactor: make the mapping exhaustive'
  )

  await clearAgentTitle(config)
  assert.equal(
    await resolveTitle({ config, branch: 'refactor/pr-297-05-x', commits }),
    'refactor: pr 297 05 x'
  )
})

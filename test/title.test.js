import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { clearAgentTitle, deriveTitle, generateMergeBody, generatePrBody, readAgentTitle, resolveTitle, ticketTitle } from '../src/lib/title.js'

test('derives the title from the branch and commit types', () => {
  assert.equal(
    deriveTitle('feat/settings-panel', [{ subject: 'feat: add settings panel' }]),
    'feat: settings panel'
  )
  assert.equal(
    deriveTitle('refactor/pr-297-05-exhaustive-kv-cache-mappings', [{ subject: 'refactor: make KV cache type mappings exhaustive' }]),
    'refactor: exhaustive kv cache mappings'
  )
  assert.equal(
    deriveTitle('fix/panel', [{ subject: 'fix: panel' }, { subject: 'feat: new panel' }]),
    'feat: panel'
  )
})

test('builds the commit and pull request title from the short ticket slug', () => {
  assert.equal(
    ticketTitle({ branchSlug: 'local-engine-options-grouping', id: 'pr329-local-engine-options-grouping', type: 'refactor' }),
    'refactor: local engine options grouping'
  )
  assert.equal(
    ticketTitle({ branchSlug: 'qwen-max-token-version-table', type: 'refactor' }),
    'refactor: qwen max token version table'
  )
  assert.equal(ticketTitle({ id: 'ggml-type-table', type: 'refactor' }), 'refactor: ggml type table')
  assert.equal(ticketTitle({ type: 'feat' }), 'chore: ticket')
})

test('builds a descriptive prose merge body from the pull request summary', () => {
  const prBody = [
    '## Summary',
    'Add the generation contract and matrix core. Resolve provider capability rules.',
    '',
    '## Tests',
    'Build and tests passed locally. Coverage: 75.56%.'
  ].join('\n')
  const body = generateMergeBody({ prBody })
  assert.equal(body, 'Add the generation contract and matrix core. Resolve provider capability rules.')
  assert.doesNotMatch(body, /Merges|CI passed|coverage|develop/i)
  assert.doesNotMatch(body, /^\s*(?:[-*+]|\d+[.)])\s+/m)
})

test('generates a prose pull request body without bullet or numbered lists', () => {
  const body = generatePrBody({
    commits: [
      { subject: 'refactor: resolve qwen max token fields' },
      { subject: 'test: cover the model version table' }
    ],
    coverage: { rate: 0.81, covered: 81, valid: 100 }
  })
  assert.match(body, /## Summary\nResolve qwen max token fields\. Cover the model version table\./)
  assert.match(body, /Coverage: 81\.00%/)
  assert.doesNotMatch(body, /^\s*(?:[-*+]|\d+[.)])\s+/m)
})

test('uses a neutral fallback when the pull request has no summary', () => {
  assert.equal(
    generateMergeBody({ prBody: '## Tests\nBuild and tests passed locally.' }),
    'No change summary was recorded for this merge.'
  )
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
    'refactor: x'
  )
})

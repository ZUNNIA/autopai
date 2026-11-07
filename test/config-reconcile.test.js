import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { reconcileConfig } from '../src/lib/config-reconcile.js'

test('config reconcile previews safe defaults without writing', async () => {
  const repo = await makeRepo({ runner: 'opencode', models: { global: 'provider/model' }, unknownKey: true })
  const before = await fs.readFile(path.join(repo, 'autopai.json'), 'utf8')

  const report = await reconcileConfig(repo)
  assert.equal(report.applied, false)
  assert.equal(report.changed, true)
  assert.ok(report.added.includes('pauseAfter'))
  assert.ok(report.added.includes('ticketDirs'))
  assert.ok(report.added.includes('stateDir'))
  assert.deepEqual(report.unknown, ['unknownKey'])
  assert.equal(await fs.readFile(path.join(repo, 'autopai.json'), 'utf8'), before)
})

test('config reconcile applies defaults and preserves explicit values', async () => {
  const repo = await makeRepo({ runner: 'opencode', models: { global: 'provider/model' }, unknownKey: true })
  const report = await reconcileConfig(repo, { apply: true })
  assert.equal(report.applied, true)
  const config = JSON.parse(await fs.readFile(path.join(repo, 'autopai.json'), 'utf8'))
  assert.equal(config.models.global, 'provider/model')
  assert.equal(config.unknownKey, true)
  assert.deepEqual(config.pauseAfter, ['backlog', 'plan', 'qa'])
  assert.equal(config.stateDir, 'tickets/.autopai')
  assert.equal(config.ticketDirs.backlog, 'tickets/backlog')
})

test('config reconcile requires an existing config', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-reconcile-missing-'))
  await assert.rejects(() => reconcileConfig(repo), /No autopai\.json/)
})

async function makeRepo(config) {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-reconcile-'))
  await fs.mkdir(path.join(repo, 'tickets'), { recursive: true })
  await fs.writeFile(path.join(repo, 'autopai.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return repo
}

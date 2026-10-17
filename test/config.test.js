import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from '../src/lib/config.js'

test('loads defaults and resolves the state directory', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-config-'))
  await fs.mkdir(path.join(repo, 'tickets'), { recursive: true })
  await fs.writeFile(path.join(repo, '.autopilot.json'), JSON.stringify({
    runner: 'opencode',
    baseBranch: 'develop',
    releaseBranch: 'main',
    requiredChecks: ['Build and test'],
    buildCommand: ['dotnet', 'build']
  }), 'utf8')

  const config = await loadConfig(repo)
  assert.equal(config.baseBranch, 'develop')
  assert.equal(config.releaseBranch, 'main')
  assert.deepEqual(config.requiredChecks, ['Build and test'])
  assert.equal(config.stateDir, path.join(repo, 'tickets', '.autopilot'))
  assert.equal(config.maxAttempts, 3)
  assert.equal(config.runner, 'opencode')
  assert.ok(config.protectedPaths.includes('.github/**'))
  assert.ok(config.protectedPaths.includes('.autopilot.json'))
})

test('fails when .autopilot.json is missing', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-config-missing-'))
  await assert.rejects(() => loadConfig(repo), /autopilot-init/)
})

test('fails when the runner is missing', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-config-runner-'))
  await fs.writeFile(path.join(repo, '.autopilot.json'), JSON.stringify({
    baseBranch: 'main',
    releaseBranch: 'main'
  }), 'utf8')
  await assert.rejects(() => loadConfig(repo), /runner is required/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from '../src/lib/config.js'

test('loads defaults and resolves the state directory', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-config-'))
  await fs.mkdir(path.join(repo, 'tickets'), { recursive: true })
  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({
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
  assert.equal(config.stateDir, path.join(repo, 'tickets', '.autopai'))
  assert.equal(config.maxAttempts, 3)
  assert.equal(config.runner, 'opencode')
  assert.ok(config.protectedPaths.includes('.github/**'))
  assert.ok(config.protectedPaths.includes('autopai.json'))
})

test('fails when autopai.json is missing', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-config-missing-'))
  await assert.rejects(() => loadConfig(repo), /autopai-init/)
})

test('fails when the runner is missing', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-config-runner-'))
  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({
    baseBranch: 'main',
    releaseBranch: 'main'
  }), 'utf8')
  await assert.rejects(() => loadConfig(repo), /runner is required/)
})

test('validates the smoke command and defaults the qa directory', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-config-smoke-'))
  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({
    runner: 'opencode',
    baseBranch: 'develop',
    releaseBranch: 'main',
    smokeCommand: ['npm', 'run', 'smoke']
  }), 'utf8')

  const config = await loadConfig(repo)
  assert.deepEqual(config.smokeCommand, ['npm', 'run', 'smoke'])
  assert.equal(config.ticketDirs.qa, 'tickets/qa')

  const invalid = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-config-smoke-invalid-'))
  await fs.writeFile(path.join(invalid, 'autopai.json'), JSON.stringify({
    runner: 'opencode',
    baseBranch: 'develop',
    releaseBranch: 'main',
    smokeCommand: 'npm run smoke'
  }), 'utf8')
  await assert.rejects(() => loadConfig(invalid), /smokeCommand/)
})

test('defaults the audit chunk size and rejects invalid values', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-config-chunks-'))
  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({
    runner: 'opencode',
    baseBranch: 'develop',
    releaseBranch: 'main'
  }), 'utf8')
  const config = await loadConfig(repo)
  assert.equal(config.auditChunkFiles, 40)

  const invalid = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-config-chunks-invalid-'))
  await fs.writeFile(path.join(invalid, 'autopai.json'), JSON.stringify({
    runner: 'opencode',
    baseBranch: 'develop',
    releaseBranch: 'main',
    auditChunkFiles: 0
  }), 'utf8')
  await assert.rejects(() => loadConfig(invalid), /auditChunkFiles/)
})

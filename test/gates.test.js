import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runGates } from '../src/lib/gates.js'

function gateConfig(repo, script) {
  return {
    repoPath: repo,
    restoreCommand: [process.execPath, '-e', script],
    buildCommand: null,
    testCommand: null,
    smokeCommand: null,
    coverageThreshold: null,
    commandTimeoutMinutes: 1
  }
}

test('retries a failed local gate once and reports the attempt count', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-gates-retry-'))
  const marker = path.join(repo, 'first-attempt')
  const script = [
    "const fs = require('node:fs')",
    `const marker = ${JSON.stringify(marker)}`,
    "if (!fs.existsSync(marker)) { fs.writeFileSync(marker, '1'); process.exit(1) }",
    'process.exit(0)'
  ].join(';')
  const artifacts = { path: name => path.join(repo, name) }

  const result = await runGates({ config: gateConfig(repo, script), artifacts, prefix: 'gate', retries: 1 })
  assert.equal(result.ok, true)
  assert.equal(result.attempts, 2)
  await fs.access(path.join(repo, 'gate-retry-1-restore.log'))
})

test('does not retry when localGateRetries is zero', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-gates-no-retry-'))
  const marker = path.join(repo, 'first-attempt')
  const script = [
    "const fs = require('node:fs')",
    `const marker = ${JSON.stringify(marker)}`,
    "if (!fs.existsSync(marker)) { fs.writeFileSync(marker, '1'); process.exit(1) }",
    'process.exit(0)'
  ].join(';')
  const artifacts = { path: name => path.join(repo, name) }

  const result = await runGates({ config: gateConfig(repo, script), artifacts, prefix: 'gate', retries: 0 })
  assert.equal(result.ok, false)
  assert.equal(result.attempts, 1)
  assert.equal(result.failed, 'restore')
})

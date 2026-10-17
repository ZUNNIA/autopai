import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readCoverage } from '../src/lib/coverage.js'

test('aggregates Cobertura reports', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-coverage-'))
  const dir = path.join(repo, 'TestResults', 'abc')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(
    path.join(dir, 'coverage.cobertura.xml'),
    '<coverage lines-covered="690" lines-valid="1000" line-rate="0.69"></coverage>',
    'utf8'
  )
  const coverage = await readCoverage(repo)
  assert.equal(coverage.covered, 690)
  assert.equal(coverage.valid, 1000)
  assert.equal(coverage.rate, 0.69)
})

test('returns null when no report exists', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopilot-coverage-empty-'))
  assert.equal(await readCoverage(repo), null)
})

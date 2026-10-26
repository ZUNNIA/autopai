import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseCliArgs } from '../src/lib/util.js'

const cli = path.resolve('src/cli.js')

test('collects repeated classification and priority flags', () => {
  const { command, options } = parseCliArgs([
    'identify',
    '--classification', 'code-smell',
    '--classification=architecture',
    '--priority', 'urgent,important'
  ])
  assert.equal(command, 'identify')
  assert.deepEqual(options.classification, ['code-smell', 'architecture'])
  assert.deepEqual(options.priority, ['urgent,important'])
})

test('keeps unknown options for the phase instead of dropping them', () => {
  const { options } = parseCliArgs(['refactor', '--future-option', 'value'])
  assert.equal(options.futureOption, 'value')
})

test('prints help including the config audit', () => {
  const output = execFileSync(process.execPath, [cli, 'help'], { encoding: 'utf8' })
  assert.match(output, /autopai config check/)
  assert.match(output, /audits autopai\.json/)
})

test('runs config check through the CLI without loading a runtime config', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-config-cli-'))
  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({ runner: 'opencode' }), 'utf8')
  const output = execFileSync(process.execPath, [cli, 'config', 'check', '--repo', repo, '--json'], { encoding: 'utf8' })
  const report = JSON.parse(output)
  assert.equal(report.status, 'outdated')
  assert.ok(report.missing.some(item => item.field === 'pauseAfter'))
})

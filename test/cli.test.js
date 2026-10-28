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

test('prints help including the config audit and revise command', () => {
  const output = execFileSync(process.execPath, [cli, 'help'], { encoding: 'utf8' })
  assert.match(output, /autopai config check/)
  assert.match(output, /audits autopai\.json/)
  assert.match(output, /autopai revise --repo <path> --message <change>/)
  assert.match(output, /autopai qa-fix --repo <path> --message <failure>/)
})

test('runs config check through the CLI without loading a runtime config', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-config-cli-'))
  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({ runner: 'opencode' }), 'utf8')
  const output = execFileSync(process.execPath, [cli, 'config', 'check', '--repo', repo, '--json'], { encoding: 'utf8' })
  const report = JSON.parse(output)
  assert.equal(report.status, 'outdated')
  assert.ok(report.missing.some(item => item.field === 'pauseAfter'))
})

test('status exposes retained review sessions', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-status-'))
  const stateDir = path.join(repo, 'tickets', '.autopai')
  await fs.mkdir(stateDir, { recursive: true })
  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({ runner: 'opencode' }), 'utf8')
  await fs.writeFile(path.join(stateDir, 'state.json'), JSON.stringify({
    mode: 'prepare',
    phase: 'awaiting_approval',
    feature: 'settings',
    completedPhases: ['prepare', 'backlog'],
    filters: { classifications: [], priorities: [] },
    blockers: [],
    sessions: [
      { kind: 'brief', id: 'brief-1', title: 'AutopAI brief settings [a1b2c3d4]' },
      { kind: 'backlog', id: 'backlog-1', title: 'AutopAI backlog settings [a1b2c3d4]' }
    ]
  }), 'utf8')

  const output = execFileSync(process.execPath, [cli, 'status', '--repo', repo], { encoding: 'utf8' })
  const status = JSON.parse(output)
  assert.equal(status.gate, 'backlog')
  assert.deepEqual(status.sessions.map(session => session.id), ['brief-1', 'backlog-1'])
})

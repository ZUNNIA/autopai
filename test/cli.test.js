import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
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
  assert.match(output, /autopai resolve-conflicts --repo <path>/)
  assert.match(output, /autopai diagnostics --repo <path>/)
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

test('status reports merge state warnings without writing', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-status-warnings-'))
  const stateDir = path.join(repo, 'tickets', '.autopai')
  await fs.mkdir(stateDir, { recursive: true })
  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({ runner: 'opencode' }), 'utf8')
  const stateFile = path.join(stateDir, 'state.json')
  await fs.writeFile(stateFile, JSON.stringify({
    mode: 'refactor',
    phase: 'refactor-complete',
    feature: 'settings',
    prNumber: 469,
    mergeCommit: null,
    scopes: [{ prNumber: 469, mergeCommit: 'ad6aa8a' }],
    completedPhases: ['refactor'],
    blockers: []
  }), 'utf8')

  const output = execFileSync(process.execPath, [cli, 'status', '--repo', repo], { encoding: 'utf8' })
  const status = JSON.parse(output)
  assert.equal(status.stateWarnings.length, 1)
  assert.match(status.stateWarnings[0], /mergeCommit is missing/)
  assert.equal(JSON.parse(await fs.readFile(stateFile, 'utf8')).mergeCommit, null)
})

test('status exposes whether the current gate can be approved', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-status-approve-'))
  const stateDir = path.join(repo, 'tickets', '.autopai')
  await fs.mkdir(stateDir, { recursive: true })
  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({ runner: 'opencode' }), 'utf8')
  await fs.writeFile(path.join(stateDir, 'state.json'), JSON.stringify({
    mode: 'refactor',
    phase: 'refactor-complete',
    feature: 'settings',
    completedPhases: ['refactor'],
    blockers: []
  }), 'utf8')

  const output = execFileSync(process.execPath, [cli, 'status', '--repo', repo], { encoding: 'utf8' })
  const status = JSON.parse(output)
  assert.equal(status.gate, 'refactor')
  assert.equal(status.paused, false)
  assert.equal(status.canApprove, false)
})

test('rejects approval when the gate is not paused', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-approve-reject-'))
  const stateDir = path.join(repo, 'tickets', '.autopai')
  await fs.mkdir(stateDir, { recursive: true })
  await fs.writeFile(path.join(repo, 'autopai.json'), JSON.stringify({ runner: 'opencode' }), 'utf8')
  await fs.writeFile(path.join(stateDir, 'state.json'), JSON.stringify({
    mode: 'refactor',
    phase: 'refactor-complete',
    feature: 'settings',
    completedPhases: ['refactor'],
    blockers: []
  }), 'utf8')

  const result = spawnSync(process.execPath, [cli, 'resume', '--repo', repo, '--approve', 'refactor'], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /not paused at the refactor gate/)
})

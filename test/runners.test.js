import test from 'node:test'
import assert from 'node:assert/strict'
import { availableRunners, resolveRunner } from '../src/runners/index.js'
import { buildArgs } from '../src/runners/opencode.js'

test('resolves the default runner', async () => {
  const runner = await resolveRunner({ runner: 'opencode' })
  assert.equal(typeof runner.runSession, 'function')
})

test('rejects unknown runners', async () => {
  await assert.rejects(() => resolveRunner({ runner: 'unknown' }), /Unknown runner/)
  assert.deepEqual(availableRunners(), ['opencode'])
})

test('builds OpenCode arguments with agent and model', () => {
  const args = buildArgs({
    config: { repoPath: 'C:/repo', models: { executor: 'provider/model' } },
    agent: 'autopilot',
    promptText: 'do work',
    title: 'task',
    role: 'executor'
  })
  assert.deepEqual(args, [
    'run',
    '--auto',
    '--dir',
    'C:/repo',
    '--title',
    'task',
    '--agent',
    'autopilot',
    '--model',
    'provider/model',
    'do work'
  ])
})

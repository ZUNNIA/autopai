import test from 'node:test'
import assert from 'node:assert/strict'
import { availableRunners, resolveRunner } from '../src/runners/index.js'
import { buildArgs } from '../src/runners/opencode.js'

test('resolves a configured runner', async () => {
  const runner = await resolveRunner({ runner: 'opencode' })
  assert.equal(typeof runner.runSession, 'function')
})

test('requires a configured runner', async () => {
  await assert.rejects(() => resolveRunner({}), /runner is required/)
})

test('rejects unknown runners', async () => {
  await assert.rejects(() => resolveRunner({ runner: 'unknown' }), /Unknown runner/)
  assert.deepEqual(availableRunners(), ['opencode'])
})

test('builds OpenCode arguments with agent and model', () => {
  const args = buildArgs({
    config: { repoPath: 'C:/repo', models: { executor: 'provider/model' } },
    agent: 'autopai',
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
    'autopai',
    '--model',
    'provider/model',
    'do work'
  ])
})

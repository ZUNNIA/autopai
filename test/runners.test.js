import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { availableRunners, resolveRunner } from '../src/runners/index.js'
import { buildArgs, buildContinueArgs, writePromptFile, pickSessionToDelete, uniqueSessionTitle } from '../src/runners/opencode.js'

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

test('builds OpenCode arguments with agent and model, without the prompt', () => {
  const args = buildArgs({
    config: { repoPath: 'C:/repo', models: { executor: 'provider/model' } },
    agent: 'autopai',
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
    'provider/model'
  ])
})

test('builds continuation arguments for the existing session without a prompt title', () => {
  const args = buildContinueArgs({
    config: { repoPath: 'C:/repo' },
    sessionId: 'ses_existing',
    agent: 'planner'
  })
  assert.deepEqual(args, [
    'run',
    '--auto',
    '--dir',
    'C:/repo',
    '--session',
    'ses_existing',
    '--agent',
    'planner'
  ])
  assert.ok(!args.includes('--title'))
})

test('writes the prompt next to the session log', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-prompt-'))
  const file = await writePromptFile(path.join(dir, 'auditor-pr-296.log'), '# Prompt\n')
  assert.equal(file, path.join(dir, 'auditor-pr-296.prompt.md'))
  assert.equal(await fs.readFile(file, 'utf8'), '# Prompt\n')
})

test('adds a unique per-run token to the session title', () => {
  const first = uniqueSessionTitle('AutopAI dev t1')
  const second = uniqueSessionTitle('AutopAI dev t1')
  assert.ok(first.startsWith('AutopAI dev t1'))
  assert.match(first, /^AutopAI dev t1 \[[0-9a-f]{8}\]$/)
  assert.notEqual(first, second)
})

test('picks only an unambiguous session created by this run for cleanup', () => {
  const title = 'AutopAI dev t1 [a1b2c3d4]'
  const sessions = [
    { id: 'run', title, directory: 'C:\\repo', created: 200, updated: 200 },
    { id: 'other-dir', title, directory: 'C:\\other', created: 200, updated: 200 },
    { id: 'old', title, directory: 'C:\\repo', created: 100, updated: 100 }
  ]

  assert.equal(pickSessionToDelete(sessions, { title, directory: 'C:\\repo', since: 150 })?.id, 'run')
  assert.equal(pickSessionToDelete(sessions, { title: 'AutopAI dev t1 [ffffffff]', directory: 'C:\\repo', since: 150 }), null)
  assert.equal(pickSessionToDelete(sessions, { title, directory: 'C:\\repo', since: 250 }), null)
  assert.equal(pickSessionToDelete([
    { id: 'a', title, directory: 'C:\\repo', created: 200, updated: 200 },
    { id: 'b', title, directory: 'C:\\repo', created: 210, updated: 210 }
  ], { title, directory: 'C:\\repo', since: 150 }), null)
  assert.equal(pickSessionToDelete([], { title, directory: 'C:\\repo', since: 0 }), null)
})

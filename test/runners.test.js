import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { availableRunners, resolveRunner } from '../src/runners/index.js'
import { buildArgs, writePromptFile } from '../src/runners/opencode.js'

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

test('writes the prompt next to the session log', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'autopai-prompt-'))
  const file = await writePromptFile(path.join(dir, 'auditor-pr-296.log'), '# Prompt\n')
  assert.equal(file, path.join(dir, 'auditor-pr-296.prompt.md'))
  assert.equal(await fs.readFile(file, 'utf8'), '# Prompt\n')
})

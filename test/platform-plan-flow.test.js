import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('the plan command discusses before it prepares', async () => {
  const text = await fs.readFile('platforms/opencode/commands/autopai-plan.md', 'utf8')
  assert.match(text, /never skips the discussion/)
  assert.match(text, /Do not run the CLI/)
  assert.match(text, /at most five highest-leverage questions/)
  assert.match(text, /Run prepare only when the user explicitly asks/)
  assert.doesNotMatch(text, /Run AutopAI in prepare mode\./)
  assert.match(text, /Never approve the backlog/)
})

test('the operator routes feature ideas to discussion, not prepare', async () => {
  const text = await fs.readFile('platforms/opencode/agents/autopai.md', 'utf8')
  assert.match(text, /A feature idea or a discussion request is not approval/)
  assert.match(text, /Discuss and write nothing/)
  assert.match(text, /ask the questions needed/)
  assert.match(text, /## Feature discussions/)
  assert.doesNotMatch(text, /Nothing, or a reference to this conversation/)
})

test('the readme documents the two-stage plan flow', async () => {
  const text = await fs.readFile('README.md', 'utf8')
  assert.match(text, /Nothing is written yet/)
  assert.match(text, /only generates after your explicit confirmation/)
  assert.match(text, /Generate the brief and backlog/)
})

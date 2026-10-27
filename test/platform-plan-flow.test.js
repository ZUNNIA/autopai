import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('the plan command discusses before it prepares', async () => {
  const text = await fs.readFile('platforms/opencode/commands/autopai-plan.md', 'utf8')
  assert.match(text, /never skips the discussion/)
  assert.match(text, /Do not run the CLI/)
  assert.match(text, /as many questions as the plan needs/)
  assert.match(text, /no fixed limit/)
  assert.match(text, /Run prepare only when the user explicitly asks/)
  assert.doesNotMatch(text, /Run AutopAI in prepare mode\./)
  assert.match(text, /Never approve the backlog/)
})

test('the operator routes feature ideas to discussion, not prepare', async () => {
  const text = await fs.readFile('platforms/opencode/agents/autopai.md', 'utf8')
  assert.match(text, /A feature idea or a discussion request is not approval/)
  assert.match(text, /Discuss and write nothing/)
  assert.match(text, /as many questions as the discussion needs/)
  assert.match(text, /no fixed limit/)
  assert.match(text, /## Feature discussions/)
  assert.doesNotMatch(text, /Nothing, or a reference to this conversation/)
})

test('operational commands do not cap clarifying questions', async () => {
  const agent = await fs.readFile('platforms/opencode/agents/autopai.md', 'utf8')
  const init = await fs.readFile('platforms/opencode/commands/autopai-init.md', 'utf8')
  assert.doesNotMatch(agent, /at most one|one confirmation|ask one question/)
  assert.doesNotMatch(init, /one confirmation|ask one question/)
  assert.match(agent, /there is no fixed limit, for operational commands and feature discussions/)
})

test('the readme documents the two-stage plan flow', async () => {
  const text = await fs.readFile('README.md', 'utf8')
  assert.match(text, /Nothing is written yet/)
  assert.match(text, /only generates after your explicit confirmation/)
  assert.match(text, /Generate the brief and backlog/)
})

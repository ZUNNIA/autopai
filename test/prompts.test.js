import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPrompt, renderPrompt } from '../src/lib/prompts.js'

test('renders the payload into a core prompt', async () => {
  const prompt = await loadPrompt('autopilot-finish', { mode: 'finish', branch: 'feat/example' })
  assert.match(prompt, /"mode": "finish"/)
  assert.ok(!prompt.includes('{{PAYLOAD}}'))
})

test('rejects invalid prompt names', async () => {
  await assert.rejects(() => loadPrompt('../etc/passwd', {}), /Invalid prompt name/)
})

test('renderPrompt removes the placeholder when there is no payload', () => {
  assert.equal(renderPrompt('A {{PAYLOAD}} B', undefined), 'A  B')
})

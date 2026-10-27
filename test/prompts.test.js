import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { loadPrompt, renderPrompt } from '../src/lib/prompts.js'

test('renders the payload into a core prompt', async () => {
  const prompt = await loadPrompt('autopai-finish', { mode: 'finish', branch: 'feat/example' })
  assert.match(prompt, /"mode": "finish"/)
  assert.ok(!prompt.includes('{{PAYLOAD}}'))
})

test('rejects invalid prompt names', async () => {
  await assert.rejects(() => loadPrompt('../etc/passwd', {}), /Invalid prompt name/)
})

test('renderPrompt removes the placeholder when there is no payload', () => {
  assert.equal(renderPrompt('A {{PAYLOAD}} B', undefined), 'A  B')
})

test('open questions stay in the chat, not in artifacts', async () => {
  const brief = await fs.readFile('src/prompts/feature-brief.md', 'utf8')
  const backlog = await fs.readFile('src/prompts/backlog.md', 'utf8')
  const ux = await fs.readFile('platforms/opencode/commands/ux-review.md', 'utf8')
  const planner = await fs.readFile('platforms/opencode/agents/planner.md', 'utf8')

  assert.doesNotMatch(brief, /## Open Questions/)
  assert.doesNotMatch(backlog, /## Open Questions|Open questions that a human/)
  assert.doesNotMatch(ux, /## Open Questions/)
  assert.match(brief, /state the question in your final message/)
  assert.match(backlog, /state the question in your final message/)
  assert.match(planner, /state the question in your final message/)
  assert.match(ux, /final chat message/)
})

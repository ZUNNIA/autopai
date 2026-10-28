import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('qa-fix creates a fix ticket and starts dev without approving qa', async () => {
  const cli = await fs.readFile('src/cli.js', 'utf8')
  const pipeline = await fs.readFile('src/phases/pipeline.js', 'utf8')
  const agent = await fs.readFile('platforms/opencode/agents/autopai.md', 'utf8')
  const resume = await fs.readFile('platforms/opencode/commands/autopai-resume.md', 'utf8')
  const prompt = await fs.readFile('src/prompts/qa-fix.md', 'utf8')

  assert.match(cli, /qa-fix/)
  assert.match(pipeline, /export async function runQaFix/)
  assert.match(pipeline, /currentGate\(state\) !== 'qa'/)
  assert.match(pipeline, /await runDev\(/)
  assert.match(agent, /autopai qa-fix/)
  assert.match(resume, /autopai qa-fix/)
  assert.match(prompt, /type: fix/)
  assert.match(prompt, /QA Failure/)
  assert.doesNotMatch(prompt, /## Open Questions/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('every ticket generator declares the billing contract', async () => {
  const paths = [
    'src/prompts/backlog.md',
    'src/prompts/ready-for-dev.md',
    'src/prompts/identified.md',
    'src/prompts/ready-for-refactor.md',
    'src/prompts/qa-fix.md'
  ]
  const texts = await Promise.all(paths.map(file => fs.readFile(file, 'utf8')))
  for (const [index, text] of texts.entries()) {
    assert.match(text, /billing/i, paths[index])
    assert.match(text, /Billing impact/, paths[index])
    assert.match(text, /Estimate/, paths[index])
    assert.match(text, /billingCurrency/, paths[index])
  }
})

test('the operator reports billing increase and unknown only', async () => {
  const agent = await fs.readFile('platforms/opencode/agents/autopai.md', 'utf8')
  const plan = await fs.readFile('platforms/opencode/commands/autopai-plan.md', 'utf8')
  assert.match(agent, /billingCurrency/)
  assert.match(agent, /billingReports/)
  assert.match(agent, /only when the artifact marks billing as `increase` or `unknown`/)
  assert.match(plan, /billingReports/)
})

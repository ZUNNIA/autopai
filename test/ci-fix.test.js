import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('automatic CI repair diagnoses a named check when no log is available', async () => {
  const prompt = await fs.readFile('src/prompts/ci-fix.md', 'utf8')
  const pr = await fs.readFile('src/lib/pr.js', 'utf8')

  assert.match(prompt, /failedChecks/)
  assert.match(prompt, /When no failure log is available/)
  assert.match(prompt, /Reproduce the check locally/)
  assert.match(prompt, /write a JSON blocker/)
  assert.doesNotMatch(prompt, /## Open Questions/)

  assert.match(pr, /noLogAttempts/)
  assert.match(pr, /promptName = 'ci-fix'/)
  assert.match(pr, /Running one automatic diagnosis attempt/)
  assert.match(pr, /failedChecks/)
})

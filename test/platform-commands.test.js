import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const commandDir = 'platforms/opencode/commands'

test('manual phase commands have slash wrappers', async () => {
  const expected = {
    'autopai-abort.md': 'autopai abort --repo .',
    'autopai-qa-fix.md': 'autopai qa-fix --repo .',
    'autopai-resolve-conflicts.md': 'autopai resolve-conflicts --repo .',
    'autopai-diagnostics.md': 'autopai diagnostics --repo .',
    'autopai-promote.md': 'autopai promote --repo .'
  }
  for (const [file, command] of Object.entries(expected)) {
    const text = await fs.readFile(`${commandDir}/${file}`, 'utf8')
    assert.match(text, /^---\n[\s\S]*agent: autopai[\s\S]*\n---\n/, file)
    assert.ok(text.includes(command), `${file} must run ${command}`)
  }
})

test('the operator routes abort, adopt, and promote requests', async () => {
  const text = await fs.readFile('platforms/opencode/agents/autopai.md', 'utf8')
  assert.match(text, /"abort", "cancel the run", or "stop the current run" → `autopai abort --repo \.`/)
  assert.match(text, /"adopt", "finish this branch", or "take this branch through CI and merge" → `autopai adopt --repo \.[^`]*`/)
  assert.match(text, /"promote the findings", "turn the findings into refactor tickets"/)
})

test('the README lists the new slash wrappers', async () => {
  const text = await fs.readFile('README.md', 'utf8')
  for (const command of ['/autopai-adopt', '/autopai-qa-fix', '/autopai-promote', '/autopai-resolve-conflicts', '/autopai-diagnostics', '/autopai-abort']) {
    assert.ok(text.includes(command), command)
  }
})
